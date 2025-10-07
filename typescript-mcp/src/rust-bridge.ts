// ! TypeScript wrapper for Rust FFI bridge

import { createRequire } from 'module';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './services/logger.js';


// __dirname will be defined by the import statement below

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Interface for the native module
interface NativeModule {
  initEngine(): Promise<void>;
  parseFile(_filePath: string, content: string): Promise<CodeEntity[]>;
  searchCode(query: string, codebasePath?: string): Promise<SearchResult[]>;
  generateEmbedding(text: string): Promise<Float32Array>;
  indexCodebase(path: string, forceReindex?: boolean): Promise<string>;
  getStatistics?(): Promise<{
    total_entities: number;
    by_type: Record<string, number>;
    by_language: Record<string, number>;
  }>;
  clear?(): Promise<void>;
}

// Try to load the native addon
let nativeModule: NativeModule | null = null;

// Development mode - try to load from build directories first
const possiblePaths = [
  join(__dirname, '..', 'rust-core', 'target', 'release', 'code_intelligence_ffi.node'),
  join(__dirname, '..', 'rust-core', 'target', 'debug', 'code_intelligence_ffi.node'),
  join(__dirname, '..', 'native', 'code_intelligence_ffi.node'),
  join(__dirname, 'code_intelligence_ffi.node'),
];

for (const path of possiblePaths) {
  if (existsSync(path)) {
    try {
      nativeModule = require(path);
      logger.warn(`Loaded Rust FFI module from: ${path}`);
      break;
    } catch (error) {
      logger.warn(`Failed to load Rust FFI module from ${path}:`, error);
    }
  }
}

if (!nativeModule) {
  // Fallback to mock implementation for development
  logger.warn('Rust FFI module not found, using mock implementation');
  nativeModule = createMockModule();
}

// Mock implementation for development
function createMockModule() {
  return {
    initEngine: () => {
          logger.warn('[MOCK] Initializing Rust engine');
      return Promise.resolve();
    },
    parseFile: (_filePath: string, content: string) => {
        logger.warn(`[MOCK] Parsing file: ${_filePath}, content length: ${content.length}`);
      return Promise.resolve([
        {
          id: `${_filePath}:1:mock_function`,
          name: 'mock_function',
          file_path: _filePath,
          entity_type: 'function',
          start_line: 1,
          end_line: 5,
          content: 'function mock_function() { return "mock"; }',
        },
      ]);
       
    },
    searchCode: (query: string, codebasePath?: string) => {
      logger.warn(`[MOCK] Searching for: ${query} in ${codebasePath ?? 'default path'}`);
      return Promise.resolve([
        {
          file: 'mock.ts',
          line: 1,
          content: 'function mock_function() { return "mock"; }',
          score: 0.8,
        },
      ]);
       
    },
    generateEmbedding: (text: string) => {
      logger.warn(`[MOCK] Generating embedding for: ${text}`);
      // Return mock 384-dimensional embedding
      const embedding = new Float32Array(384);
      for (let i = 0; i < 384; i++) {
        embedding[i] = Math.random();
      }
      return Promise.resolve(embedding);
    },
    indexCodebase: (path: string) => {
      logger.warn(`[MOCK] Indexing codebase: ${path}`);
      return Promise.resolve(`Indexed 1 files in ${path}`);
    },
  };
}

// TypeScript interfaces for the Rust FFI
export interface CodeEntity {
  id: string;
  name: string;
  file_path: string;
  entity_type: string;
  start_line: number;
  end_line: number;
  content: string;
  signature?: string;
  documentation?: string;
  visibility?: string;
  parameters?: Parameter[];
  return_type?: string;
  dependencies?: string[];
  metadata?: Record<string, string>;
}

export interface Parameter {
  name: string;
  param_type?: string;
  default_value?: string;
  is_optional: boolean;
}

export interface SearchResult {
  file: string;
  line: number;
  content: string;
  score: number;
  highlights?: string[];
}

export interface IndexingProgress {
  total_files: number;
  processed_files: number;
  total_entities: number;
  current_file?: string;
  errors: string[];
  start_time: number;
  estimated_time_remaining?: number;
}

export interface SearchQuery {
  text: string;
  query_type: 'keyword' | 'semantic' | 'hybrid';
  limit: number;
  filters?: Record<string, string>;
}

export interface EngineConfig {
  database_url?: string;
  redis_url?: string;
  embedding_model_path?: string;
  max_workers?: number;
  cache_size?: number;
  log_level?: string;
}

// Rust FFI Bridge class
export class RustFFIBridge {
  private isInitialized: boolean = false;

  constructor(config: EngineConfig = {}) {
    // Store configuration for future use
    // Rule 15: Constructor with dependency injection is necessary
    this.config = config;
  }

  private config: EngineConfig;

  /**
   * Initialize the Rust engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await (nativeModule as NativeModule).initEngine();
      this.isInitialized = true;
      logger.warn('Rust FFI bridge initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Rust FFI bridge:', error);
      throw error;
    }
  }

  /**
   * Parse a file and extract code entities
   */
  async parseFile(filePath: string, content: string): Promise<CodeEntity[]> {
    this.ensureInitialized();

    try {
      const entities = await (nativeModule as NativeModule).parseFile(filePath, content);
      return entities.map(this.normalizeEntity);
    } catch (error) {
      logger.error(`Failed to parse file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Search for code entities
   */
  async searchCode(query: string, codebasePath?: string): Promise<SearchResult[]> {
    this.ensureInitialized();

    try {
      const results = await (nativeModule as NativeModule).searchCode(query, codebasePath);
      return results.map(this.normalizeSearchResult);
    } catch (error) {
      logger.error(`Failed to search for "${query}":`, error);
      throw error;
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(text: string): Promise<Float32Array> {
    this.ensureInitialized();

    try {
      return await (nativeModule as NativeModule).generateEmbedding(text);
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Index a codebase
   */
  async indexCodebase(path: string): Promise<string> {
    this.ensureInitialized();

    try {
      return await (nativeModule as NativeModule).indexCodebase(path);
    } catch (error) {
      logger.error(`Failed to index codebase ${path}:`, error);
      throw error;
    }
  }

  /**
   * Get indexing statistics
   */
  async getStatistics(): Promise<{
    total_entities: number;
    by_type: Record<string, number>;
    by_language: Record<string, number>;
  }> {
    this.ensureInitialized();

    try {
      return (
        (await (nativeModule as NativeModule).getStatistics?.()) ?? {
          total_entities: 0,
          by_type: {},
          by_language: {},
        }
      );
    } catch (error) {
      logger.error('Failed to get statistics:', error);
      throw error;
    }
  }

  /**
   * Clear all indexed data
   */
  async clear(): Promise<void> {
    this.ensureInitialized();

    try {
      await (nativeModule as NativeModule).clear?.();
    } catch (error) {
      logger.error('Failed to clear indexed data:', error);
      throw error;
    }
  }

  /**
   * Check if Rust module is available
   */
  isRustAvailable(): boolean {
    return nativeModule !== null && !nativeModule.toString().includes('[MOCK]');
  }

  /**
   * Check if the bridge is available (alias for isRustAvailable)
   */
  async isAvailable(): Promise<boolean> {
    return this.isRustAvailable();
  }

  /**
   * Get the version of the Rust bridge
   */
  async getVersion(): Promise<string> {
    // Return a mock version for now
    return '0.1.0-mock';
  }

  /**
   * Get engine configuration
   */
  getConfig(): EngineConfig {
    return { ...this.config };
  }

  /**
   * Update engine configuration
   */
  updateConfig(newConfig: Partial<EngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Rust FFI bridge is not initialized. Call initialize() first.');
    }
  }

  private normalizeEntity(entity: unknown): CodeEntity {
    const entityData = entity as Record<string, unknown>;
    return {
      id: entityData.id as string,
      name: entityData.name as string,
      file_path: entityData.file_path as string,
      entity_type: entityData.entity_type as string,
      start_line: entityData.start_line as number,
      end_line: entityData.end_line as number,
      content: entityData.content as string,
      signature: entityData.signature as string | undefined,
      documentation: entityData.documentation as string | undefined,
      visibility: entityData.visibility as string | undefined,
      parameters: Array.isArray(entityData.parameters) ? entityData.parameters as Parameter[] : [],
      return_type: entityData.return_type as string | undefined,
      dependencies: Array.isArray(entityData.dependencies) ? entityData.dependencies as string[] : [],
      metadata: (entityData.metadata && typeof entityData.metadata === 'object') ? entityData.metadata as Record<string, string> : {},
    };
  }

  private normalizeSearchResult(result: unknown): SearchResult {
    const resultData = result as Record<string, unknown>;
    return {
      file: resultData.file as string,
      line: resultData.line as number,
      content: resultData.content as string,
      score: resultData.score as number,
      highlights: Array.isArray(resultData.highlights) ? resultData.highlights as string[] : [],
    };
  }
}

// Export singleton instance
export const rustBridge = new RustFFIBridge();

// Export types and utilities
export { nativeModule as rustNativeModule };
