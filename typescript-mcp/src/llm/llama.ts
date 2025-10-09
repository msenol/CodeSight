/**
 * llama.cpp integration for local LLM inference
 * Provides offline, privacy-preserving LLM capabilities
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Logger } from '../services/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = new Logger('LlamaCpp');

export interface LlamaModelConfig {
  modelPath: string;
  contextSize?: number;
  gpuLayers?: number;
  threads?: number;
  temperature?: number;
  topP?: number;
  repeatPenalty?: number;
  batchSize?: number;
}

export interface LlamaCompletionOptions {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  stream?: boolean;
}

export interface LlamaCompletionResult {
  text: string;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  finishReason: 'stop' | 'length' | 'error';
  model: string;
}

export class LlamaCppService extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: LlamaModelConfig;
  private isReady: boolean = false;
  private requestId: number = 0;

  constructor(config: LlamaModelConfig) {
    super();
    this.config = {
      contextSize: 2048,
      gpuLayers: 0,
      threads: 4,
      temperature: 0.7,
      topP: 0.9,
      repeatPenalty: 1.1,
      batchSize: 512,
      ...config,
    };
  }

  /**
   * Initialize llama.cpp server
   */
  async initialize(): Promise<void> {
    try {
      // Verify model file exists
      await fs.access(this.config.modelPath);

      // Get model info
      const modelStats = await fs.stat(this.config.modelPath);
      logger.info('Initializing llama.cpp', {
        modelPath: this.config.modelPath,
        modelSize: `${(modelStats.size / 1024 / 1024).toFixed(2)} MB`,
        contextSize: this.config.contextSize,
        gpuLayers: this.config.gpuLayers,
      });

      // Start llama.cpp server process
      await this.startServer();

      // Wait for server to be ready
      await this.waitForReady();

      this.isReady = true;
      this.emit('ready');
      logger.info('llama.cpp service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize llama.cpp', error);
      throw new Error(`llama.cpp initialization failed: ${error.message}`);
    }
  }

  /**
   * Start llama.cpp server process
   */
  private async startServer(): Promise<void> {
    const args = [
      '--model', this.config.modelPath,
      '--ctx-size', this.config.contextSize.toString(),
      '--threads', this.config.threads.toString(),
      '--batch-size', this.config.batchSize.toString(),
      '--temp', this.config.temperature.toString(),
      '--top-p', this.config.topP.toString(),
      '--repeat-penalty', this.config.repeatPenalty.toString(),
      '--host', '127.0.0.1',
      '--port', '8081',
      '--log-disable',
    ];

    if (this.config.gpuLayers > 0) {
      args.push('--gpu-layers', this.config.gpuLayers.toString());
    }

    // Try to find llama.cpp executable
    const llamaPath = await this.findLlamaExecutable();

    this.process = spawn(llamaPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        LLAMA_LOG_LEVEL: '1',
      },
    });

    this.process.on('error', (error) => {
      logger.error('llama.cpp process error', error);
      this.emit('error', error);
    });

    this.process.on('exit', (code, signal) => {
      logger.warn(`llama.cpp process exited with code ${code}, signal ${signal}`);
      this.isReady = false;
      this.emit('exit', { code, signal });
    });

    // Log output for debugging
    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          logger.debug('llama.cpp stderr:', output);
        }
      });
    }
  }

  /**
   * Find llama.cpp executable in common locations
   */
  private async findLlamaExecutable(): Promise<string> {
    const possiblePaths = [
      './llama.cpp/main',
      './llama.cpp/build/bin/main',
      '/usr/local/bin/llama.cpp',
      'llama-server',
      'llama.cpp',
    ];

    for (const execPath of possiblePaths) {
      try {
        await fs.access(execPath);
        return execPath;
      } catch {
        // Continue checking
      }
    }

    throw new Error('llama.cpp executable not found. Please install llama.cpp and ensure it\'s in PATH or specified path.');
  }

  /**
   * Wait for server to be ready
   */
  private async waitForReady(): Promise<void> {
    const maxAttempts = 30;
    const delay = 1000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch('http://127.0.0.1:8081/health');
        if (response.ok) {
          return;
        }
      } catch {
        // Server not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }

    throw new Error('llama.cpp server failed to start within timeout period');
  }

  /**
   * Generate text completion
   */
  async complete(options: LlamaCompletionOptions): Promise<LlamaCompletionResult> {
    if (!this.isReady) {
      throw new Error('llama.cpp service is not ready');
    }

    const requestId = ++this.requestId;
    logger.debug('Starting completion', { requestId, promptLength: options.prompt.length });

    try {
      const requestBody = {
        prompt: options.prompt,
        n_predict: options.maxTokens || 256,
        temperature: options.temperature ?? this.config.temperature,
        top_p: options.topP ?? this.config.topP,
        stop: options.stopSequences || [],
        stream: options.stream || false,
      };

      const response = await fetch('http://127.0.0.1:8081/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const result: LlamaCompletionResult = {
        text: data.content || '',
        tokens: data.tokens_predicted || 0,
        promptTokens: data.tokens_evaluated || 0,
        completionTokens: data.tokens_predicted || 0,
        finishReason: data.stopped_eos ? 'stop' : data.stopped_limit ? 'length' : 'stop',
        model: path.basename(this.config.modelPath),
      };

      logger.debug('Completion finished', {
        requestId,
        tokens: result.tokens,
        finishReason: result.finishReason,
      });

      return result;

    } catch (error) {
      logger.error('Completion failed', { requestId, error: error.message });
      throw new Error(`llama.cpp completion failed: ${error.message}`);
    }
  }

  /**
   * Generate streaming completion
   */
  async *completeStream(options: LlamaCompletionOptions): AsyncGenerator<string, void, unknown> {
    if (!this.isReady) {
      throw new Error('llama.cpp service is not ready');
    }

    const requestId = ++this.requestId;
    logger.debug('Starting streaming completion', { requestId });

    try {
      const requestBody = {
        prompt: options.prompt,
        n_predict: options.maxTokens || 256,
        temperature: options.temperature ?? this.config.temperature,
        top_p: options.topP ?? this.config.topP,
        stop: options.stopSequences || [],
        stream: true,
      };

      const response = await fetch('http://127.0.0.1:8081/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to get response reader');
      }

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
              if (data.content) {
                yield data.content;
              }
              if (data.stopped_eos || data.stopped_limit) {
                return;
              }
            } catch (e) {
              logger.debug('Failed to parse streaming response', { line, error: e.message });
            }
          }
        }
      }

    } catch (error) {
      logger.error('Streaming completion failed', { requestId, error: error.message });
      throw new Error(`llama.cpp streaming completion failed: ${error.message}`);
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<any> {
    if (!this.isReady) {
      throw new Error('llama.cpp service is not ready');
    }

    const response = await fetch('http://127.0.0.1:8081/props');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Check if service is ready
   */
  ready(): boolean {
    return this.isReady;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down llama.cpp service');

    if (this.process) {
      this.process.kill('SIGTERM');

      // Force kill if graceful shutdown fails
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }

    this.isReady = false;
    this.emit('shutdown');
  }
}

// Factory function
export function createLlamaCppService(config: LlamaModelConfig): LlamaCppService {
  return new LlamaCppService(config);
}

export default LlamaCppService;