/**
 * LM Studio integration for local LLM inference
 * Provides user-friendly local AI with model management capabilities
 */

import { Logger } from '../services/logger.js';

const logger = new Logger('LMStudio');

export interface LMStudioConfig {
  baseUrl?: string;
  timeout?: number;
  defaultModel?: string;
}

export interface LMStudioCompletionOptions {
  model?: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  stream?: boolean;
}

export interface LMStudioCompletionResult {
  text: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finishReason: 'stop' | 'length' | 'error';
}

export class LMStudioService {
  private config: Required<LMStudioConfig>;
  private isAvailable: boolean = false;

  constructor(config: LMStudioConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:1234/v1',
      timeout: config.timeout || 30000,
      defaultModel: config.defaultModel || '',
    };
  }

  async checkAvailability(): Promise<boolean> {
    try {
      await this.request('/models', { method: 'GET' });
      this.isAvailable = true;
      return true;
    } catch (error) {
      logger.warn('LM Studio service not available', { error: error.message });
      this.isAvailable = false;
      return false;
    }
  }

  async listModels(): Promise<any[]> {
    const response = await this.request('/models', { method: 'GET' });
    return response.data || [];
  }

  async complete(options: LMStudioCompletionOptions): Promise<LMStudioCompletionResult> {
    if (!this.isAvailable) {
      throw new Error('LM Studio service is not available');
    }

    const model = options.model || this.config.defaultModel;
    logger.debug('Generating text with LM Studio', {
      model,
      messageCount: options.messages.length,
    });

    try {
      const requestBody: any = {
        model,
        messages: options.messages,
        max_tokens: options.maxTokens || 256,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP ?? 1.0,
        stream: false,
      };

      if (options.stopSequences && options.stopSequences.length > 0) {
        requestBody.stop = options.stopSequences;
      }

      const response = await this.request('/chat/completions', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const choice = response.choices?.[0];
      if (!choice) {
        throw new Error('No completion choice returned from LM Studio');
      }

      return {
        text: choice.message?.content || '',
        model: model || 'default',
        usage: response.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
        finishReason:
          choice.finish_reason === 'stop'
            ? 'stop'
            : choice.finish_reason === 'length'
              ? 'length'
              : 'stop',
      };
    } catch (error) {
      logger.error('LM Studio completion failed', { error: error.message });
      throw new Error(`LM Studio completion failed: ${error.message}`);
    }
  }

  async *completeStream(options: LMStudioCompletionOptions): AsyncGenerator<string, void, unknown> {
    if (!this.isAvailable) {
      throw new Error('LM Studio service is not available');
    }

    const model = options.model || this.config.defaultModel;
    logger.debug('Starting streaming generation with LM Studio', {
      model,
      messageCount: options.messages.length,
    });

    try {
      const requestBody: any = {
        model,
        messages: options.messages,
        max_tokens: options.maxTokens || 256,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP ?? 1.0,
        stream: true,
      };

      if (options.stopSequences && options.stopSequences.length > 0) {
        requestBody.stop = options.stopSequences;
      }

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              logger.debug('Failed to parse streaming response', { line });
            }
          }
        }
      }
    } catch (error) {
      logger.error('LM Studio streaming generation failed', { error: error.message });
      throw new Error(`LM Studio streaming generation failed: ${error.message}`);
    }
  }

  async generateEmbedding(text: string, model?: string): Promise<{ embeddings: number[] }> {
    if (!this.isAvailable) {
      throw new Error('LM Studio service is not available');
    }

    const embeddingModel = model || this.config.defaultModel;
    logger.debug('Generating embedding with LM Studio', {
      model: embeddingModel,
      textLength: text.length,
    });

    try {
      const response = await this.request('/embeddings', {
        method: 'POST',
        body: JSON.stringify({ model: embeddingModel, input: text }),
      });

      return {
        embeddings: response.data?.[0]?.embedding || [],
      };
    } catch (error) {
      logger.error('LM Studio embedding generation failed', { error: error.message });
      throw new Error(`LM Studio embedding generation failed: ${error.message}`);
    }
  }

  available(): boolean {
    return this.isAvailable;
  }

  getDefaultModel(): string {
    return this.config.defaultModel;
  }

  setDefaultModel(modelName: string): void {
    this.config.defaultModel = modelName;
    logger.info('LM Studio default model updated', { modelName });
  }

  getConfig(): Required<LMStudioConfig> {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<LMStudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('LM Studio configuration updated');
  }

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
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

export function createLMStudioService(config: LMStudioConfig = {}): LMStudioService {
  return new LMStudioService(config);
}

export default LMStudioService;
