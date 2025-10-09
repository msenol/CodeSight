/**
 * Ollama client integration for local LLM inference
 * Provides seamless integration with Ollama for offline AI capabilities
 */

import { Logger } from '../services/logger';

const logger = new Logger('Ollama');

export interface OllamaConfig {
  baseUrl?: string;
  timeout?: number;
  modelName?: string;
  defaultOptions?: OllamaGenerateOptions;
}

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaGenerateOptions {
  model?: string;
  prompt?: string;
  system?: string;
  context?: number[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    seed?: number;
    num_predict?: number;
    num_ctx?: number;
    repeat_last_n?: number;
    tfs_z?: number;
    mirostat?: number;
    mirostat_tau?: number;
    mirostat_eta?: number;
    penalize_newline?: boolean;
    stop?: string[];
  };
  format?: string;
  template?: string;
  stream?: boolean;
  raw?: boolean;
  keep_alive?: string;
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaEmbedResponse {
  embeddings: number[];
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  total_duration?: number;
  load_duration?: number;
}

export class OllamaService {
  private config: Required<OllamaConfig>;
  private isAvailable: boolean = false;

  constructor(config: OllamaConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:11434',
      timeout: config.timeout || 30000,
      modelName: config.modelName || 'codellama:7b',
      defaultOptions: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 256,
        num_ctx: 2048,
        ...config.defaultOptions,
      },
    };
  }

  /**
   * Check if Ollama service is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await this.request('/api/tags', { method: 'GET' });
      this.isAvailable = true;
      return true;
    } catch (error) {
      logger.warn('Ollama service not available', { error: error.message });
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<OllamaModel[]> {
    const response = await this.request('/api/tags', { method: 'GET' });
    return response.models || [];
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string, onProgress?: (progress: { status: string; completed: number; total: number }) => void): Promise<void> {
    logger.info('Pulling Ollama model', { modelName });

    const response = await fetch(`${this.config.baseUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: modelName,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body for model pull');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (onProgress && data.status) {
              onProgress({
                status: data.status,
                completed: data.completed || 0,
                total: data.total || 0,
              });
            }
          } catch (e) {
            logger.debug('Failed to parse pull progress', { line });
          }
        }
      }
    }

    logger.info('Model pull completed', { modelName });
  }

  /**
   * Generate text completion
   */
  async generate(prompt: string, options: Partial<OllamaGenerateOptions> = {}): Promise<string> {
    const generateOptions: OllamaGenerateOptions = {
      model: this.config.modelName,
      prompt,
      options: {
        ...this.config.defaultOptions,
        ...options.options,
      },
      ...options,
    };

    logger.debug('Generating text', {
      model: generateOptions.model,
      promptLength: prompt.length,
    });

    try {
      const response = await this.request('/api/generate', {
        method: 'POST',
        body: JSON.stringify(generateOptions),
      });

      return response.response || '';
    } catch (error) {
      logger.error('Text generation failed', { error: error.message });
      throw new Error(`Ollama generation failed: ${error.message}`);
    }
  }

  /**
   * Generate streaming completion
   */
  async *generateStream(prompt: string, options: Partial<OllamaGenerateOptions> = {}): AsyncGenerator<string, void, unknown> {
    const generateOptions: OllamaGenerateOptions = {
      model: this.config.modelName,
      prompt,
      stream: true,
      options: {
        ...this.config.defaultOptions,
        ...options.options,
      },
      ...options,
    };

    logger.debug('Starting streaming generation', {
      model: generateOptions.model,
      promptLength: prompt.length,
    });

    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(generateOptions),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body for streaming generation');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                yield data.response;
              }
              if (data.done) {
                return;
              }
            } catch (e) {
              logger.debug('Failed to parse streaming response', { line });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Streaming generation failed', { error: error.message });
      throw new Error(`Ollama streaming generation failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings
   */
  async generateEmbedding(prompt: string, model?: string): Promise<number[]> {
    const requestBody = {
      model: model || this.config.modelName,
      prompt,
    };

    logger.debug('Generating embedding', {
      model: requestBody.model,
      promptLength: prompt.length,
    });

    try {
      const response = await this.request('/api/embeddings', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      return response.embeddings || [];
    } catch (error) {
      logger.error('Embedding generation failed', { error: error.message });
      throw new Error(`Ollama embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Check if a model is available locally
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some(model => model.name === modelName || model.name.startsWith(modelName + ':'));
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete a model
   */
  async deleteModel(modelName: string): Promise<void> {
    logger.info('Deleting Ollama model', { modelName });

    await this.request('/api/delete', {
      method: 'DELETE',
      body: JSON.stringify({ name: modelName }),
    });

    logger.info('Model deleted successfully', { modelName });
  }

  /**
   * Get model information
   */
  async getModelInfo(modelName?: string): Promise<any> {
    const response = await this.request('/api/show', {
      method: 'POST',
      body: JSON.stringify({
        name: modelName || this.config.modelName,
      }),
    });

    return response;
  }

  /**
   * Create a new model from a modelfile
   */
  async createModel(modelName: string, modelfile: string): Promise<void> {
    logger.info('Creating Ollama model', { modelName });

    await this.request('/api/create', {
      method: 'POST',
      body: JSON.stringify({
        name: modelName,
        modelfile,
      }),
    });

    logger.info('Model created successfully', { modelName });
  }

  /**
   * Check if service is available
   */
  available(): boolean {
    return this.isAvailable;
  }

  /**
   * Make HTTP request to Ollama API
   */
  private async request(endpoint: string, options: RequestInit): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Get default model name
   */
  getDefaultModel(): string {
    return this.config.modelName;
  }

  /**
   * Set default model
   */
  setDefaultModel(modelName: string): void {
    this.config.modelName = modelName;
    logger.info('Default model updated', { modelName });
  }

  /**
   * Get configuration
   */
  getConfig(): Required<OllamaConfig> {
    return { ...this.config };
  }
}

// Factory function
export function createOllamaService(config: OllamaConfig = {}): OllamaService {
  return new OllamaService(config);
}

export default OllamaService;