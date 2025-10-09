/**
 * HuggingFace integration for cloud LLM fallback
 * Provides remote AI capabilities when local solutions are unavailable
 */

import { Logger } from '../services/logger';

const logger = new Logger('HuggingFace');

export interface HuggingFaceConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  timeout?: number;
  enableFallback?: boolean;
}

export interface HuggingFaceModel {
  id: string;
  task: string;
  pipeline_tag: string;
  likes: number;
  downloads: number;
  tags: string[];
}

export interface HuggingFaceCompletionOptions {
  model?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  stream?: boolean;
}

export interface HuggingFaceCompletionResult {
  text: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finishReason: 'stop' | 'length' | 'error';
}

export interface HuggingFaceEmbeddingResult {
  embeddings: number[];
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class HuggingFaceService {
  private config: Required<HuggingFaceConfig>;
  private isAvailable: boolean = false;

  constructor(config: HuggingFaceConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.HUGGINGFACE_API_KEY || '',
      baseUrl: config.baseUrl || 'https://api-inference.huggingface.co',
      defaultModel: config.defaultModel || 'microsoft/CodeGPT-small-py',
      timeout: config.timeout || 30000,
      enableFallback: config.enableFallback ?? false,
    };
  }

  /**
   * Check if HuggingFace service is available
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.config.apiKey) {
      logger.warn('HuggingFace API key not configured');
      this.isAvailable = false;
      return false;
    }

    try {
      const response = await this.request('/models', { method: 'GET' });
      this.isAvailable = true;
      return true;
    } catch (error) {
      logger.warn('HuggingFace service not available', { error: error.message });
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Search for models
   */
  async searchModels(query: string, limit: number = 10): Promise<HuggingFaceModel[]> {
    const params = new URLSearchParams({
      search: query,
      limit: limit.toString(),
    });

    const response = await this.request(`/models?${params}`, { method: 'GET' });
    return response || [];
  }

  /**
   * Generate text completion using Inference API
   */
  async complete(options: HuggingFaceCompletionOptions): Promise<HuggingFaceCompletionResult> {
    if (!this.isAvailable) {
      throw new Error('HuggingFace service is not available');
    }

    const model = options.model || this.config.defaultModel;
    logger.debug('Generating text with HuggingFace', {
      model,
      promptLength: options.prompt.length,
    });

    try {
      // For text generation models
      if (model.includes('gpt') || model.includes('codegen') || model.includes('code')) {
        return await this.completeTextGeneration(model, options);
      }
      // For other completion models
      else {
        return await this.completeDefault(model, options);
      }
    } catch (error) {
      logger.error('HuggingFace completion failed', { error: error.message });
      throw new Error(`HuggingFace completion failed: ${error.message}`);
    }
  }

  /**
   * Generate completion using text generation API
   */
  private async completeTextGeneration(model: string, options: HuggingFaceCompletionOptions): Promise<HuggingFaceCompletionResult> {
    const requestBody = {
      inputs: options.prompt,
      parameters: {
        max_new_tokens: options.maxTokens || 256,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        stop: options.stopSequences,
        do_sample: true,
        return_full_text: false,
      },
    };

    const response = await this.request(`/models/${model}`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    let text = '';
    if (Array.isArray(response) && response.length > 0) {
      text = response[0].generated_text || '';
    } else if (response.generated_text) {
      text = response.generated_text;
    }

    return {
      text,
      model,
      finishReason: 'stop',
    };
  }

  /**
   * Generate completion using default API
   */
  private async completeDefault(model: string, options: HuggingFaceCompletionOptions): Promise<HuggingFaceCompletionResult> {
    const requestBody = {
      inputs: options.prompt,
      options: {
        max_length: options.maxTokens || 256,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        stop: options.stopSequences,
      },
    };

    const response = await this.request(`/models/${model}`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    let text = '';
    if (Array.isArray(response) && response.length > 0) {
      text = response[0].generated_text || '';
    } else if (response.generated_text) {
      text = response.generated_text;
    }

    return {
      text,
      model,
      finishReason: 'stop',
    };
  }

  /**
   * Generate embeddings
   */
  async generateEmbedding(text: string, model?: string): Promise<HuggingFaceEmbeddingResult> {
    if (!this.isAvailable) {
      throw new Error('HuggingFace service is not available');
    }

    const embeddingModel = model || 'sentence-transformers/all-MiniLM-L6-v2';
    logger.debug('Generating embedding with HuggingFace', {
      model: embeddingModel,
      textLength: text.length,
    });

    try {
      const requestBody = {
        inputs: text,
      };

      const response = await this.request(`/models/${embeddingModel}`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      let embeddings: number[] = [];
      if (Array.isArray(response)) {
        embeddings = response;
      } else if (response.embeddings) {
        embeddings = response.embeddings;
      }

      return {
        embeddings,
        model: embeddingModel,
      };
    } catch (error) {
      logger.error('HuggingFace embedding generation failed', { error: error.message });
      throw new Error(`HuggingFace embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Generate streaming completion
   */
  async *completeStream(options: HuggingFaceCompletionOptions): AsyncGenerator<string, void, unknown> {
    if (!this.isAvailable) {
      throw new Error('HuggingFace service is not available');
    }

    const model = options.model || this.config.defaultModel;
    logger.debug('Starting streaming generation with HuggingFace', {
      model,
      promptLength: options.prompt.length,
    });

    try {
      const requestBody = {
        inputs: options.prompt,
        parameters: {
          max_new_tokens: options.maxTokens || 256,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.9,
          stop: options.stopSequences,
          stream: true,
        },
      };

      const response = await fetch(`${this.config.baseUrl}/models/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token && data.token.text) {
                yield data.token.text;
              }
            } catch (e) {
              logger.debug('Failed to parse streaming response', { line });
            }
          }
        }
      }
    } catch (error) {
      logger.error('HuggingFace streaming generation failed', { error: error.message });
      throw new Error(`HuggingFace streaming generation failed: ${error.message}`);
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(modelId: string): Promise<any> {
    const response = await this.request(`/models/${modelId}`, { method: 'GET' });
    return response;
  }

  /**
   * List available models for a specific task
   */
  async listModelsByTask(task: string, limit: number = 20): Promise<HuggingFaceModel[]> {
    const params = new URLSearchParams({
      task,
      limit: limit.toString(),
    });

    const response = await this.request(`/models?${params}`, { method: 'GET' });
    return response || [];
  }

  /**
   * Check if fallback is enabled
   */
  fallbackEnabled(): boolean {
    return this.config.enableFallback;
  }

  /**
   * Enable/disable fallback
   */
  setFallbackEnabled(enabled: boolean): void {
    this.config.enableFallback = enabled;
    logger.info('HuggingFace fallback updated', { enabled });
  }

  /**
   * Check if service is available
   */
  available(): boolean {
    return this.isAvailable;
  }

  /**
   * Make HTTP request to HuggingFace API
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
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): Required<HuggingFaceConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HuggingFaceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('HuggingFace configuration updated');
  }
}

// Factory function
export function createHuggingFaceService(config: HuggingFaceConfig = {}): HuggingFaceService {
  return new HuggingFaceService(config);
}

export default HuggingFaceService;