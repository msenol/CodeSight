//! TypeScript wrapper for Rust FFI bridge

import { createRequire } from 'module';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Try to load the native addon
let nativeModule: any = null;

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
      console.log(`Loaded Rust FFI module from: ${path}`);
      break;
    } catch (error) {
      console.warn(`Failed to load Rust FFI module from ${path}:`, error);
    }
  }
}

if (!nativeModule) {
  // Fallback to mock implementation for development
  console.warn('Rust FFI module not found, using mock implementation');
  nativeModule = createMockModule();
}

// Mock implementation for development
function createMockModule() {
  return {
    initEngine: () => {
      console.log('[MOCK] Initializing Rust engine');
      return Promise.resolve();
    },
    parseFile: (filePath: string, content: string) => {
      console.log(`[MOCK] Parsing file: ${filePath}`);
      return Promise.resolve([
        {
          id: `${filePath}:1:mock_function`,
          name: 'mock_function',
          file_path: filePath,
          entity_type: 'function',
          start_line: 1,
          end_line: 5,
          content: 'function mock_function() { return "mock"; }',
        },
      ]);
    },
    searchCode: (query: string, codebasePath?: string) => {
      console.log(`[MOCK] Searching for: ${query}`);
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
      console.log(`[MOCK] Generating embedding for: ${text}`);
      // Return mock 384-dimensional embedding
      const embedding = new Float32Array(384);
      for (let i = 0; i < 384; i++) {
        embedding[i] = Math.random();
      }
      return Promise.resolve(embedding);
    },
    indexCodebase: (path: string) => {
      console.log(`[MOCK] Indexing codebase: ${path}`);
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

  constructor(private config: EngineConfig = {}) {}

  /**
   * Initialize the Rust engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await nativeModule.initEngine();
      this.isInitialized = true;
      console.log('Rust FFI bridge initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Rust FFI bridge:', error);
      throw error;
    }
  }

  /**
   * Parse a file and extract code entities
   */
  async parseFile(filePath: string, content: string): Promise<CodeEntity[]> {
    this.ensureInitialized();

    try {
      const entities = await nativeModule.parseFile(filePath, content);
      return entities.map(this.normalizeEntity);
    } catch (error) {
      console.error(`Failed to parse file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Search for code entities
   */
  async searchCode(query: string, codebasePath?: string): Promise<SearchResult[]> {
    this.ensureInitialized();

    try {
      const results = await nativeModule.searchCode(query, codebasePath);
      return results.map(this.normalizeSearchResult);
    } catch (error) {
      console.error(`Failed to search for "${query}":`, error);
      throw error;
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(text: string): Promise<Float32Array> {
    this.ensureInitialized();

    try {
      return await nativeModule.generateEmbedding(text);
    } catch (error) {
      console.error(`Failed to generate embedding:`, error);
      throw error;
    }
  }

  /**
   * Index a codebase
   */
  async indexCodebase(path: string): Promise<string> {
    this.ensureInitialized();

    try {
      return await nativeModule.indexCodebase(path);
    } catch (error) {
      console.error(`Failed to index codebase ${path}:`, error);
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
      return await nativeModule.getStatistics?.() || {
        total_entities: 0,
        by_type: {},
        by_language: {},
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      throw error;
    }
  }

  /**
   * Clear all indexed data
   */
  async clear(): Promise<void> {
    this.ensureInitialized();

    try {
      await nativeModule.clear?.();
    } catch (error) {
      console.error('Failed to clear indexed data:', error);
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

  private normalizeEntity(entity: any): CodeEntity {
    return {
      id: entity.id,
      name: entity.name,
      file_path: entity.file_path,
      entity_type: entity.entity_type,
      start_line: entity.start_line,
      end_line: entity.end_line,
      content: entity.content,
      signature: entity.signature,
      documentation: entity.documentation,
      visibility: entity.visibility,
      parameters: entity.parameters || [],
      return_type: entity.return_type,
      dependencies: entity.dependencies || [],
      metadata: entity.metadata || {},
    };
  }

  private normalizeSearchResult(result: any): SearchResult {
    return {
      file: result.file,
      line: result.line,
      content: result.content,
      score: result.score,
      highlights: result.highlights || [],
    };
  }
}

// Export singleton instance
export const rustBridge = new RustFFIBridge();

// Export types and utilities
export { nativeModule as rustNativeModule };