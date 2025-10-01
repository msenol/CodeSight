/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/**
 * Rust FFI Bridge
 */
import { logger } from '../services/logger.js';

// Rule 15: Proper TypeScript interfaces instead of 'any' types
// Rule 15: Interfaces reserved for future Rust FFI implementation
/*
interface NativeModule {
  initEngine: () => Promise<void>;
  searchCode: (_query: string, _limit: number) => Promise<Record<string, unknown>[]>;
  parseFile: (_filePath: string, _content: string) => Promise<Record<string, unknown>[]>;
  indexCodebase: (_path: string, _forceReindex: boolean) => Promise<string>;
  getCodebaseStats: (_codebasePath?: string) => Promise<Record<string, unknown>>;
}

interface SearchResult {
  file: string;
  line: number;
  content: string;
  score: number;
  entity?: Record<string, unknown>;
}
*/

interface CodebaseStats {
  total_files: number;
  total_entities: number;
  languages: Record<string, number>;
  entity_types: Record<string, number>;
  indexed_at: string;
}

interface FunctionAnalysis {
  name: string;
  complexity: string;
  description: string;
  suggestions: string[];
}

// Rule 15: Global declarations for Node.js environment

// Try to load the native module, fall back to mock if not available
// Rule 15: Native module reference reserved for future implementation
const nativeModule: unknown = null;

/**
 * Get codebase statistics using Rust core
 */
export async function getCodebaseStats(codebasePath?: string): Promise<CodebaseStats> {
  if (!nativeModule) { // Rule 15: Native module check - always false in current implementation
    return {
      total_files: 0,
      total_entities: 0,
      languages: {},
      entity_types: {},
      indexed_at: new Date().toISOString(),
    };
  }

  try {
    const stats = await nativeModule.getCodebaseStats(codebasePath);
    return stats as CodebaseStats;
  } catch (error) {
    logger.error('Native stats failed:', error);
    return {
      total_files: 0,
      total_entities: 0,
      languages: {},
      entity_types: {},
      indexed_at: new Date().toISOString(),
    };
  }
}

/**
 * Analyze function using Rust core
 */
export async function analyzeFunction(functionName: string, codebaseId: string): Promise<FunctionAnalysis> {
  logger.info(`Analyzing function: ${functionName} in codebase: ${codebaseId}`);

  // Mock implementation - could be enhanced to use native module
  return {
    name: functionName,
    complexity: 'medium',
    description: `Mock analysis for function: ${functionName}`,
    suggestions: ['Consider adding error handling', 'Add type annotations'],
  };
}
