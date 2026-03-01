/**
 * Groq Cloud integration for ultra-fast LLM inference
 * Provides high-speed AI capabilities with Groq's LPU technology
 */

import { Logger } from '../services/logger.js';

const logger = new Logger('Groq');

export interface GroqConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  timeout?: number;
}

export interface GroqModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface GroqCompletionOptions {
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

export interface GroqCompletionResult {
  text: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finishReason: 'stop' | 'length' | 'error';
}

export interface GroqEmbeddingResult {
  embeddings: number[];
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class GroqService {
  private config: Required<GroqConfig>;
  private isAvailable: boolean = false;
  private models: GroqModel[] = [];

  constructor(config: GroqConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.GROQ_API_KEY || '',
      baseUrl: config.baseUrl || 'https://api.groq.com/openai/v1',
      defaultModel: config.defaultModel || 'llama-3.1-8b-instant',
      timeout: config.timeout || 30000,
    };
  }

  async checkAvailability(): Promise<boolean> {
    if (!this.config.apiKey) {
      logger.warn('Groq API key not configured');
      this.isAvailable = false;
      return false;
    }

    try {
      await this.request('/models', { method: 'GET' });
      this.isAvailable = true;
      return true;
    } catch (error) {
      logger.warn('Groq service not available', { error: error.message });
      this.isAvailable = false;
      return false;
    }
  }

  async listModels(): Promise<GroqModel[]> {
    const response = await this.request('/models', { method: 'GET' });
    this.models = response.data || [];
    return this.models;
  }

  async complete(options: GroqCompletionOptions): Promise<GroqCompletionResult> {
    if (!this.isAvailable) {
      throw new Error('Groq service is not available');
    }

    const model = options.model || this.config.defaultModel;
    logger.debug('Generating text with Groq', {
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
        throw new Error('No completion choice returned from Groq');
      }

      return {
        text: choice.message?.content || '',
        model,
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
      logger.error('Groq completion failed', { error: error.message });
      throw new Error(`Groq completion failed: ${error.message}`);
    }
  }

  async *completeStream(options: GroqCompletionOptions): AsyncGenerator<string, void, unknown> {
    if (!this.isAvailable) {
      throw new Error('Groq service is not available');
    }

    const model = options.model || this.config.defaultModel;
    logger.debug('Starting streaming generation with Groq', {
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
          Authorization: `Bearer ${this.config.apiKey}`,
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
      logger.error('Groq streaming generation failed', { error: error.message });
      throw new Error(`Groq streaming generation failed: ${error.message}`);
    }
  }

  async generateEmbedding(text: string, model?: string): Promise<GroqEmbeddingResult> {
    throw new Error('Groq does not currently support embeddings');
  }

  available(): boolean {
    return this.isAvailable;
  }

  getDefaultModel(): string {
    return this.config.defaultModel;
  }

  setDefaultModel(modelName: string): void {
    this.config.defaultModel = modelName;
    logger.info('Groq default model updated', { modelName });
  }

  getConfig(): Required<GroqConfig> {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<GroqConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Groq configuration updated');
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
          Authorization: `Bearer ${this.config.apiKey}`,
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

export function createGroqService(config: GroqConfig = {}): GroqService {
  return new GroqService(config);
}

export default GroqService;
