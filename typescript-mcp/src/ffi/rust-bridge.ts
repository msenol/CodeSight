/**
 * Rust FFI Bridge
 */
import { logger } from '../services/logger.js';

// Try to load the native module, fall back to mock if not available
let nativeModule: any = null;

try {
  // Try to load the native module
  const nativePath = process.platform === 'win32'
    ? './native/code_intelligence_native.node'
    : './native/code_intelligence_native.node';

  nativeModule = require(nativePath);
  logger.info('Native Rust module loaded successfully');
} catch (error) {
  logger.warn('Failed to load native Rust module, using fallback:', error);
  nativeModule = null;
}

/**
 * Initialize the Rust core library
 */
export async function initializeRustCore(): Promise<void> {
  try {
    if (nativeModule) {
      // Initialize the database with the native module
      await nativeModule.initEngine();
      logger.info('Rust core initialized successfully');
    } else {
      logger.info('Rust core initialization (mock - no native module)');
    }

    return Promise.resolve();
  } catch (error) {
    logger.error('Failed to initialize Rust core:', error);
    throw error;
  }
}

/**
 * Search code using Rust core
 */
export async function searchCode(query: string, codebaseId: string): Promise<any[]> {
  logger.info(`Searching for: ${query} in codebase: ${codebaseId}`);

  if (nativeModule) {
    try {
      // Use the native module for searching
      const results = await nativeModule.searchCode(query, 10);
      return results.map((result: any) => ({
        file: result.file,
        line: result.line,
        content: result.entity.name,
        score: result.score,
        entity: result.entity
      }));
    } catch (error) {
      logger.error('Native search failed, falling back to mock:', error);
      // Fall back to mock implementation
      return [
        {
          file: 'example.ts',
          line: 42,
          content: `// Mock result for query: ${query}`,
          score: 0.95
        }
      ];
    }
  } else {
    // Mock implementation
    return [
      {
        file: 'example.ts',
        line: 42,
        content: `// Mock result for query: ${query}`,
        score: 0.95
      }
    ];
  }
}

/**
 * Parse a file using Rust core
 */
export async function parseFile(filePath: string, content: string): Promise<any[]> {
  if (!nativeModule) {
    return [];
  }

  try {
    const entities = await nativeModule.parseFile(filePath, content);
    return entities;
  } catch (error) {
    logger.error('Native parse failed:', error);
    return [];
  }
}

/**
 * Index a codebase using Rust core
 */
export async function indexCodebase(path: string, forceReindex: boolean = false): Promise<string> {
  if (!nativeModule) {
    return 'Mock indexing completed (no native module)';
  }

  try {
    const result = await nativeModule.indexCodebase(path, forceReindex);
    return result;
  } catch (error) {
    logger.error('Native indexing failed:', error);
    return 'Indexing failed';
  }
}

/**
 * Get codebase stats using Rust core
 */
export async function getCodebaseStats(codebasePath?: string): Promise<any> {
  if (!nativeModule) {
    return {
      total_files: 0,
      total_entities: 0,
      languages: {},
      entity_types: {},
      indexed_at: new Date().toISOString()
    };
  }

  try {
    const stats = await nativeModule.getCodebaseStats(codebasePath);
    return stats;
  } catch (error) {
    logger.error('Native stats failed:', error);
    return {
      total_files: 0,
      total_entities: 0,
      languages: {},
      entity_types: {},
      indexed_at: new Date().toISOString()
    };
  }
}

/**
 * Analyze function using Rust core
 */
export async function analyzeFunction(functionName: string, codebaseId: string): Promise<any> {
  logger.info(`Analyzing function: ${functionName} in codebase: ${codebaseId}`);

  // Mock implementation - could be enhanced to use native module
  return {
    name: functionName,
    complexity: 'medium',
    description: `Mock analysis for function: ${functionName}`,
    suggestions: ['Consider adding error handling', 'Add type annotations']
  };
}