/* eslint-disable @typescript-eslint/no-unused-vars */
 
import { vi } from 'vitest';

/**
 * Test Utilities for CodeSight Tests
 *
 * This module provides common utilities and helpers for testing
 * the CodeSight MCP server and its components.
 */

// Mock logger for testing
export const createMockLogger = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
});

// Mock config for testing
export const createMockConfig = (overrides = {}) => ({
  version: '0.1.0',
  port: 4000,
  database: {
    url: 'sqlite::memory:',
  },
  rust: {
    enabled: false,
    path: './rust-core/target/release',
  },
  ...overrides,
});

// Mock Fastify request and reply
export const createMockRequest = (overrides = {}) => ({
  method: 'GET',
  url: '/',
  headers: {},
  query: {},
  params: {},
  body: {},
  ...overrides,
});

export const createMockReply = () => {
  const reply = {
    code: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    callNotFound: vi.fn(),
    getResponseTime: vi.fn().mockReturnValue(10),
  };
  return reply as any;
};

// Test data generators
export const generateTestCodebase = () => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Codebase',
  path: '/tmp/test-codebase',
  language: 'typescript',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const generateTestEntity = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  file_path: '/test/file.ts',
  start_line: 1,
  end_line: 10,
  entity_type: 'function',
  name: 'testFunction',
  code_snippet: 'function testFunction() {}',
  relevance_score: 0.9,
  context: ['// Context line 1', '// Context line 2'],
  ...overrides,
});

// Performance measurement utilities
export const measurePerformance = async (operation: () => Promise<void> | void) => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;

  await operation();

  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;

  return {
    duration: endTime - startTime,
    memoryUsed: endMemory - startMemory,
    startMemory,
    endMemory,
  };
};

// Retry utility for flaky tests
export const retry = async (
  operation: () => Promise<any>,
  maxAttempts = 3,
  delay = 100,
): Promise<any> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Assertion helpers
export const expectSuccessResponse = (response: any) => {
  expect(response.statusCode).toBe(200);
  expect(typeof response.body).toBe('string');
};

export const expectErrorResponse = (response: any, expectedStatus: number) => {
  expect(response.statusCode).toBe(expectedStatus);
};

export const expectJsonResponse = (response: any) => {
  expect(response.headers['content-type']).toMatch(/application\/json/);
};

// Environment helpers
export const setTestEnvironment = (env: Record<string, string>) => {
  const originalEnv = { ...process.env };
  process.env = { ...process.env, ...env };

  return () => {
    process.env = originalEnv;
  };
};

// File system helpers (for testing file operations)
export const createTestFile = async (path: string, content: string) => {
  // This would typically use fs/promises or similar
  // For now, it's a placeholder for when we need actual file operations
  console.log(`Would create test file: ${path}`);
};

export const cleanupTestFiles = async (paths: string[]) => {
  // Cleanup test files after tests
  console.log(`Would clean up test files: ${paths.join(', ')}`);
};

// Database helpers
export const createTestDatabase = async () => {
  // Create in-memory SQLite database for testing
  console.log('Would create test database');
  return {
    close: async () => {
      console.log('Would close test database');
    },
  };
};

// WebSocket test helpers
export const createMockWebSocket = () => ({
  send: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  readyState: 1, // WebSocket.OPEN
});

// HTTP request helpers
export const createTestHttpRequest = (method: string, path: string, body?: any) => ({
  method,
  path,
  headers: {
    'content-type': 'application/json',
    'user-agent': 'vitest-test',
  },
  body,
});

// Security test helpers
export const createMaliciousRequest = (path: string, payload: any) => ({
  method: 'POST',
  path,
  headers: {
    'content-type': 'application/json',
    'x-malicious-header': 'malicious-value',
  },
  body: payload,
});

// Validation helpers
export const isValidUuid = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const isValidTimestamp = (timestamp: string) => {
  return !isNaN(Date.parse(timestamp));
};

export const isValidFilePath = (path: string) => {
  return typeof path === 'string' && path.length > 0 && !path.includes('..');
};

// Test fixtures
export const testFixtures = {
  validSearchQuery: {
    query: 'find authentication function',
    codebase_id: '550e8400-e29b-41d4-a716-446655440000',
  },
  invalidSearchQuery: {
    query: '',
    codebase_id: 'invalid-uuid',
  },
  validHealthResponse: {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: 100,
    components: {
      database: { status: 'healthy' },
      rustBridge: { status: 'healthy', available: false },
      indexing: { status: 'healthy', indexedFiles: 10, indexedEntities: 50 },
      search: { status: 'healthy' },
      memory: { status: 'healthy', usage: 10, limit: 100, percentage: 10 },
    },
    metrics: {
      totalSearchQueries: 0,
      averageSearchTime: 0,
      errorRate: 0,
      activeConnections: 0,
    },
  },
};

// Performance test helpers
export const generateLoadTest = (
  concurrency: number,
  iterations: number,
  operation: () => Promise<any>,
) => {
  return async () => {
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const concurrentRequests = Array(concurrency)
        .fill(null)
        .map(() => operation());
      const responses = await Promise.all(concurrentRequests);
      const endTime = performance.now();

      results.push({
        iteration: i + 1,
        duration: endTime - startTime,
        successCount: responses.filter(r => r.statusCode === 200).length,
        errorCount: responses.filter(r => r.statusCode !== 200).length,
      });
    }

    return results;
  };
};

// Export all utilities
export default {
  createMockLogger,
  createMockConfig,
  createMockRequest,
  createMockReply,
  generateTestCodebase,
  generateTestEntity,
  measurePerformance,
  retry,
  expectSuccessResponse,
  expectErrorResponse,
  expectJsonResponse,
  setTestEnvironment,
  createTestFile,
  cleanupTestFiles,
  createTestDatabase,
  createMockWebSocket,
  createTestHttpRequest,
  createMaliciousRequest,
  isValidUuid,
  isValidTimestamp,
  isValidFilePath,
  testFixtures,
  generateLoadTest,
};
