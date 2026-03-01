/**
 * LLM Router with intelligent fallback logic
 * Manages multiple LLM backends with automatic failover and load balancing
 */

import { EventEmitter } from 'events';
import { Logger } from '../services/logger.js';
import { LlamaCppService, LlamaModelConfig } from './llama.js';
import { OllamaService, OllamaConfig } from './ollama.js';
import { HuggingFaceService, HuggingFaceConfig } from './huggingface.js';
import { GroqService, GroqConfig } from './groq.js';
import { LMStudioService, LMStudioConfig } from './lmstudio.js';

const logger = new Logger('LLMRouter');

export interface LLMProvider {
  name: string;
  available: boolean;
  priority: number;
  capabilities: LLMCapabilities;
  health: () => Promise<boolean>;
  complete: (prompt: string, options?: any) => Promise<string>;
  completeStream?: (prompt: string, options?: any) => AsyncGenerator<string>;
  generateEmbedding?: (text: string) => Promise<number[]>;
}

export interface LLMCapabilities {
  textGeneration: boolean;
  streaming: boolean;
  embeddings: boolean;
  maxTokens: number;
  supportsSystemPrompt: boolean;
  codeOptimized: boolean;
}

export interface RouterConfig {
  providers: ProviderConfig[];
  fallbackStrategy: 'priority' | 'round-robin' | 'random';
  healthCheckInterval: number;
  maxRetries: number;
  timeout: number;
}

export interface ProviderConfig {
  name: string;
  type: 'llamacpp' | 'ollama' | 'huggingface' | 'groq' | 'lmstudio';
  enabled: boolean;
  priority: number;
  config: LlamaModelConfig | OllamaConfig | HuggingFaceConfig | GroqConfig | LMStudioConfig;
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  stream?: boolean;
}

export interface CompletionResult {
  text: string;
  provider: string;
  model: string;
  tokens: number;
  finishReason: 'stop' | 'length' | 'error';
  metadata?: any;
}

export interface EmbeddingResult {
  embeddings: number[];
  provider: string;
  model: string;
  dimension: number;
  metadata?: any;
}

export class LLMRouter extends EventEmitter {
  private config: RouterConfig;
  private providers: Map<string, LLMProvider> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private roundRobinIndex: number = 0;

  constructor(config: RouterConfig) {
    super();
    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      maxRetries: 3,
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Initialize the router and all providers
   */
  async initialize(): Promise<void> {
    logger.info('Initializing LLM router');

    try {
      // Initialize providers
      for (const providerConfig of this.config.providers) {
        if (!providerConfig.enabled) {
          continue;
        }

        const provider = await this.createProvider(providerConfig);
        if (provider) {
          this.providers.set(providerConfig.name, provider);
          logger.info('Provider initialized', {
            name: provider.name,
            type: providerConfig.type,
            priority: providerConfig.priority,
          });
        }
      }

      // Start health checks
      this.startHealthChecks();

      logger.info('LLM router initialized successfully', {
        providersCount: this.providers.size,
        providers: Array.from(this.providers.keys()),
      });

      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize LLM router', error);
      throw new Error(`LLM router initialization failed: ${error.message}`);
    }
  }

  /**
   * Create a provider instance
   */
  private async createProvider(config: ProviderConfig): Promise<LLMProvider | null> {
    try {
      switch (config.type) {
        case 'llamacpp': {
          const llamaService = new LlamaCppService(config.config as LlamaModelConfig);
          await llamaService.initialize();
          return {
            name: config.name,
            available: llamaService.ready(),
            priority: config.priority,
            capabilities: {
              textGeneration: true,
              streaming: true,
              embeddings: false,
              maxTokens: 4096,
              supportsSystemPrompt: false,
              codeOptimized: true,
            },
            health: async () => llamaService.ready(),
            complete: async (prompt: string, options?: any) => {
              const result = await llamaService.complete({ prompt, ...options });
              return result.text;
            },
            completeStream: async function* (prompt: string, options?: any) {
              for await (const chunk of llamaService.completeStream({ prompt, ...options })) {
                yield chunk;
              }
            },
          };
        }

        case 'ollama': {
          const ollamaService = new OllamaService(config.config as OllamaConfig);
          await ollamaService.checkAvailability();
          return {
            name: config.name,
            available: ollamaService.available(),
            priority: config.priority,
            capabilities: {
              textGeneration: true,
              streaming: true,
              embeddings: true,
              maxTokens: 4096,
              supportsSystemPrompt: true,
              codeOptimized: false,
            },
            health: async () => ollamaService.available(),
            complete: async (prompt: string, options?: any) => {
              return await ollamaService.generate(prompt, options);
            },
            completeStream: async function* (prompt: string, options?: any) {
              for await (const chunk of ollamaService.generateStream(prompt, options)) {
                yield chunk;
              }
            },
            generateEmbedding: async (text: string) => {
              return await ollamaService.generateEmbedding(text);
            },
          };
        }

        case 'huggingface': {
          const hfService = new HuggingFaceService(config.config as HuggingFaceConfig);
          await hfService.checkAvailability();
          return {
            name: config.name,
            available: hfService.available(),
            priority: config.priority,
            capabilities: {
              textGeneration: true,
              streaming: true,
              embeddings: true,
              maxTokens: 2048,
              supportsSystemPrompt: false,
              codeOptimized: false,
            },
            health: async () => hfService.available(),
            complete: async (prompt: string, options?: any) => {
              const result = await hfService.complete({ prompt, ...options });
              return result.text;
            },
            completeStream: async function* (prompt: string, options?: any) {
              for await (const chunk of hfService.completeStream({ prompt, ...options })) {
                yield chunk;
              }
            },
            generateEmbedding: async (text: string) => {
              const result = await hfService.generateEmbedding(text);
              return result.embeddings;
            },
          };
        }

        case 'groq': {
          const groqService = new GroqService(config.config as GroqConfig);
          await groqService.checkAvailability();
          return {
            name: config.name,
            available: groqService.available(),
            priority: config.priority,
            capabilities: {
              textGeneration: true,
              streaming: true,
              embeddings: false,
              maxTokens: 32768,
              supportsSystemPrompt: true,
              codeOptimized: true,
            },
            health: async () => groqService.available(),
            complete: async (prompt: string, options?: any) => {
              const messages = options?.messages || [{ role: 'user', content: prompt }];
              const result = await groqService.complete({ messages, ...options });
              return result.text;
            },
            completeStream: async function* (prompt: string, options?: any) {
              const messages = options?.messages || [{ role: 'user', content: prompt }];
              for await (const chunk of groqService.completeStream({ messages, ...options })) {
                yield chunk;
              }
            },
          };
        }

        case 'lmstudio': {
          const lmStudioService = new LMStudioService(config.config as LMStudioConfig);
          await lmStudioService.checkAvailability();
          return {
            name: config.name,
            available: lmStudioService.available(),
            priority: config.priority,
            capabilities: {
              textGeneration: true,
              streaming: true,
              embeddings: true,
              maxTokens: 4096,
              supportsSystemPrompt: true,
              codeOptimized: false,
            },
            health: async () => lmStudioService.available(),
            complete: async (prompt: string, options?: any) => {
              const messages = options?.messages || [{ role: 'user', content: prompt }];
              const result = await lmStudioService.complete({ messages, ...options });
              return result.text;
            },
            completeStream: async function* (prompt: string, options?: any) {
              const messages = options?.messages || [{ role: 'user', content: prompt }];
              for await (const chunk of lmStudioService.completeStream({ messages, ...options })) {
                yield chunk;
              }
            },
            generateEmbedding: async (text: string) => {
              const result = await lmStudioService.generateEmbedding(text);
              return result.embeddings;
            },
          };
        }

        default: {
          logger.warn('Unknown provider type', { type: config.type });
          return null;
        }
      }
    } catch (error) {
      logger.error('Failed to create provider', { name: config.name, error: error.message });
      return null;
    }
  }

  /**
   * Generate text completion with automatic fallback
   */
  async complete(prompt: string, options: CompletionOptions = {}): Promise<CompletionResult> {
    const providers = this.getAvailableProviders();

    if (providers.length === 0) {
      throw new Error('No LLM providers available');
    }

    logger.debug('Starting completion', {
      promptLength: prompt.length,
      providersCount: providers.length,
      strategy: this.config.fallbackStrategy,
    });

    let lastError: Error | null = null;

    for (const provider of providers) {
      for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
        try {
          logger.debug('Attempting completion', {
            provider: provider.name,
            attempt: attempt + 1,
          });

          const startTime = Date.now();
          const text = await provider.complete(prompt, options);
          const duration = Date.now() - startTime;

          logger.info('Completion successful', {
            provider: provider.name,
            duration,
            textLength: text.length,
          });

          return {
            text,
            provider: provider.name,
            model: options.model || 'default',
            tokens: text.split(/\s+/).length,
            finishReason: 'stop',
            metadata: { duration, attempt: attempt + 1 },
          };
        } catch (error) {
          lastError = error as Error;
          logger.warn('Completion attempt failed', {
            provider: provider.name,
            attempt: attempt + 1,
            error: error.message,
          });

          // Mark provider as unhealthy
          provider.available = false;
          this.emit('providerUnhealthy', { provider: provider.name, error });

          if (attempt < this.config.maxRetries - 1) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      }
    }

    logger.error('All completion attempts failed', { lastError: lastError?.message });
    throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Generate streaming completion with automatic fallback
   */
  async *completeStream(
    prompt: string,
    options: CompletionOptions = {},
  ): AsyncGenerator<string, void, unknown> {
    const providers = this.getAvailableProviders();

    if (providers.length === 0) {
      throw new Error('No LLM providers available');
    }

    logger.debug('Starting streaming completion', {
      promptLength: prompt.length,
      providersCount: providers.length,
    });

    for (const provider of providers) {
      if (!provider.completeStream) {
        logger.debug('Provider does not support streaming', { provider: provider.name });
        continue;
      }

      try {
        logger.debug('Starting streaming with provider', { provider: provider.name });

        yield* provider.completeStream(prompt, options);
        return;
      } catch (error) {
        logger.warn('Streaming attempt failed', {
          provider: provider.name,
          error: error.message,
        });

        // Mark provider as unhealthy
        provider.available = false;
        this.emit('providerUnhealthy', { provider: provider.name, error });
      }
    }

    throw new Error('All streaming completion attempts failed');
  }

  /**
   * Generate embeddings with automatic fallback
   */
  async generateEmbedding(text: string, model?: string): Promise<EmbeddingResult> {
    const providers = this.getAvailableProviders().filter(p => p.generateEmbedding);

    if (providers.length === 0) {
      throw new Error('No LLM providers with embedding support available');
    }

    logger.debug('Starting embedding generation', {
      textLength: text.length,
      providersCount: providers.length,
    });

    for (const provider of providers) {
      try {
        logger.debug('Generating embedding with provider', { provider: provider.name });

        const embeddings = await provider.generateEmbedding!(text);

        logger.info('Embedding generation successful', {
          provider: provider.name,
          dimension: embeddings.length,
        });

        return {
          embeddings,
          provider: provider.name,
          model: model || 'default',
          dimension: embeddings.length,
        };
      } catch (error) {
        logger.warn('Embedding generation failed', {
          provider: provider.name,
          error: error.message,
        });

        // Mark provider as unhealthy
        provider.available = false;
        this.emit('providerUnhealthy', { provider: provider.name, error });
      }
    }

    throw new Error('All embedding generation attempts failed');
  }

  /**
   * Get available providers sorted by strategy
   */
  private getAvailableProviders(): LLMProvider[] {
    const available = Array.from(this.providers.values()).filter(p => p.available);

    switch (this.config.fallbackStrategy) {
      case 'priority': {
        return available.sort((a, b) => a.priority - b.priority);
      }

      case 'round-robin': {
        const sorted = [...available].sort((a, b) => a.priority - b.priority);
        const start = this.roundRobinIndex % sorted.length;
        this.roundRobinIndex++;
        return [...sorted.slice(start), ...sorted.slice(0, start)];
      }

      case 'random': {
        return available.sort(() => Math.random() - 0.5);
      }

      default: {
        return available;
      }
    }
  }

  /**
   * Start health checks for all providers
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      const providerEntries = Array.from(this.providers.entries());
      for (const [name, provider] of providerEntries) {
        try {
          const isHealthy = await provider.health();
          const wasHealthy = provider.available;
          provider.available = isHealthy;

          if (wasHealthy !== isHealthy) {
            if (isHealthy) {
              logger.info('Provider became healthy', { name });
              this.emit('providerHealthy', { name });
            } else {
              logger.warn('Provider became unhealthy', { name });
              this.emit('providerUnhealthy', { name, error: 'Health check failed' });
            }
          }
        } catch (error) {
          if (provider.available) {
            logger.warn('Provider health check failed', { name, error: error.message });
            provider.available = false;
            this.emit('providerUnhealthy', { name, error });
          }
        }
      }
    }, this.config.healthCheckInterval);

    logger.debug('Health checks started', { interval: this.config.healthCheckInterval });
  }

  /**
   * Get provider status
   */
  getProviderStatus(): Array<{
    name: string;
    available: boolean;
    priority: number;
    capabilities: LLMCapabilities;
  }> {
    return Array.from(this.providers.values()).map(provider => ({
      name: provider.name,
      available: provider.available,
      priority: provider.priority,
      capabilities: provider.capabilities,
    }));
  }

  /**
   * Get router statistics
   */
  getStats(): any {
    const providers = this.getProviderStatus();
    return {
      totalProviders: this.providers.size,
      availableProviders: providers.filter(p => p.available).length,
      strategy: this.config.fallbackStrategy,
      healthCheckInterval: this.config.healthCheckInterval,
      providers,
    };
  }

  /**
   * Shutdown the router and all providers
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down LLM router');

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Shutdown providers
    const providers = Array.from(this.providers.values());
    for (const provider of providers) {
      try {
        // Check if provider has shutdown method
        if ('shutdown' in provider && typeof provider.shutdown === 'function') {
          await (provider as any).shutdown();
        }
      } catch (error) {
        logger.warn('Failed to shutdown provider', {
          provider: provider.name,
          error: error.message,
        });
      }
    }

    this.providers.clear();
    this.emit('shutdown');
    logger.info('LLM router shutdown complete');
  }
}

// Factory function
export function createLLMRouter(config: RouterConfig): LLMRouter {
  return new LLMRouter(config);
}

export default LLMRouter;
