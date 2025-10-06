import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createFastifyServer } from '../../src/server';
import { SearchResult } from '../../src/types';

/**
 * Contract Test for search_code MCP Tool
 *
 * This test validates that the search_code tool implementation
 * conforms to the MCP Tools Contract specification defined in:
 * specs/001-code-intelligence-mcp/contracts/mcp-tools.yaml
 *
 * Test Coverage:
 * - Request/Response schema validation
 * - Required field validation
 * - Optional parameter handling
 * - Error response validation
 * - Business logic validation
 */

describe('MCP Tool: search_code - Contract Tests', () => {
  let app: FastifyInstance;
  const testCodebaseId = '550e8400-e29b-41d4-a716-446655440000';

  beforeAll(async () => {
    app = await createFastifyServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Request Schema Validation', () => {
    it('should accept valid request with all required fields', async () => {
      const validRequest = {
        query: 'where is user authentication implemented?',
        codebase_id: testCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept valid request with optional parameters', async () => {
      const validRequestWithOptionals = {
        query: 'find database connection logic',
        codebase_id: testCodebaseId,
        context_lines: 5,
        max_results: 20,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: validRequestWithOptionals,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject request missing required query field', async () => {
      const invalidRequest = {
        codebase_id: testCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('query');
    });

    it('should reject request missing required codebase_id field', async () => {
      const invalidRequest = {
        query: 'test query',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('codebase_id');
    });

    it('should reject request with invalid codebase_id format', async () => {
      const invalidRequest = {
        query: 'test query',
        codebase_id: 'invalid-uuid-format',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('uuid');
    });

    it('should reject request with invalid context_lines type', async () => {
      const invalidRequest = {
        query: 'test query',
        codebase_id: testCodebaseId,
        context_lines: 'invalid',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject request with invalid max_results type', async () => {
      const invalidRequest = {
        query: 'test query',
        codebase_id: testCodebaseId,
        max_results: 'invalid',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return response conforming to contract schema', async () => {
      const validRequest = {
        query: 'authentication function',
        codebase_id: testCodebaseId,
        context_lines: 3,
        max_results: 10,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Validate top-level response structure
      expect(body).toHaveProperty('results');
      expect(body).toHaveProperty('query_intent');
      expect(body).toHaveProperty('execution_time_ms');

      // Validate results array
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.results.length).toBeLessThanOrEqual(validRequest.max_results);

      // Validate query_intent enum
      const validIntents = [
        'find_function',
        'explain_code',
        'trace_flow',
        'find_usage',
        'security_audit',
      ];
      expect(validIntents).toContain(body.query_intent);

      // Validate execution_time_ms
      expect(typeof body.execution_time_ms).toBe('number');
      expect(body.execution_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should return SearchResult objects conforming to schema', async () => {
      const validRequest = {
        query: 'user authentication',
        codebase_id: testCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.results.length > 0) {
        const result: SearchResult = body.results[0];

        // Validate required SearchResult fields
        expect(result).toHaveProperty('entity_id');
        expect(result).toHaveProperty('file_path');
        expect(result).toHaveProperty('start_line');
        expect(result).toHaveProperty('end_line');
        expect(result).toHaveProperty('code_snippet');
        expect(result).toHaveProperty('relevance_score');
        expect(result).toHaveProperty('entity_type');
        expect(result).toHaveProperty('context');

        // Validate field types
        expect(typeof result.entity_id).toBe('string');
        expect(typeof result.file_path).toBe('string');
        expect(typeof result.start_line).toBe('number');
        expect(typeof result.end_line).toBe('number');
        expect(typeof result.code_snippet).toBe('string');
        expect(typeof result.relevance_score).toBe('number');
        expect(typeof result.entity_type).toBe('string');
        expect(Array.isArray(result.context)).toBe(true);

        // Validate entity_type enum
        const validEntityTypes = [
          'function',
          'class',
          'method',
          'variable',
          'import',
          'type',
          'interface',
          'enum',
          'constant',
        ];
        expect(validEntityTypes).toContain(result.entity_type);

        // Validate UUID format for entity_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(result.entity_id).toMatch(uuidRegex);

        // Validate relevance_score range
        expect(result.relevance_score).toBeGreaterThanOrEqual(0);
        expect(result.relevance_score).toBeLessThanOrEqual(1);

        // Validate line numbers
        expect(result.start_line).toBeGreaterThan(0);
        expect(result.end_line).toBeGreaterThanOrEqual(result.start_line);

        // Validate context array contains strings
        result.context.forEach(contextLine => {
          expect(typeof contextLine).toBe('string');
        });
      }
    });

    it('should respect max_results parameter', async () => {
      const maxResults = 5;
      const validRequest = {
        query: 'function',
        codebase_id: testCodebaseId,
        max_results: maxResults,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results.length).toBeLessThanOrEqual(maxResults);
    });

    it('should use default values for optional parameters', async () => {
      const validRequest = {
        query: 'test function',
        codebase_id: testCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should use default max_results = 10
      expect(body.results.length).toBeLessThanOrEqual(10);

      // Should use default context_lines = 3
      if (body.results.length > 0) {
        const result = body.results[0];
        expect(result.context.length).toBeLessThanOrEqual(6); // 3 before + 3 after
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent codebase', async () => {
      const nonExistentCodebaseId = '00000000-0000-0000-0000-000000000000';
      const validRequest = {
        query: 'test query',
        codebase_id: nonExistentCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('codebase not found');
    });

    it('should handle empty query gracefully', async () => {
      const validRequest = {
        query: '',
        codebase_id: testCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results).toEqual([]);
    });

    it('should handle very long query gracefully', async () => {
      const longQuery = 'a'.repeat(10000);
      const validRequest = {
        query: longQuery,
        codebase_id: testCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: validRequest,
      });

      expect([200, 400]).toContain(response.statusCode);
    });
  });

  describe('Business Logic Validation', () => {
    it('should correctly identify query intent', async () => {
      const testCases = [
        { query: 'find function getUserById', expectedIntent: 'find_function' },
        { query: 'explain how authentication works', expectedIntent: 'explain_code' },
        { query: 'trace data flow from API to database', expectedIntent: 'trace_flow' },
        { query: 'where is validateUser used', expectedIntent: 'find_usage' },
        { query: 'security vulnerabilities in login', expectedIntent: 'security_audit' },
      ];

      for (const testCase of testCases) {
        const request = {
          query: testCase.query,
          codebase_id: testCodebaseId,
        };

        const response = await app.inject({
          method: 'POST',
          url: '/tools/search_code',
          payload: request,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.query_intent).toBe(testCase.expectedIntent);
      }
    });

    it('should return results sorted by relevance score', async () => {
      const validRequest = {
        query: 'authentication',
        codebase_id: testCodebaseId,
        max_results: 10,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.results.length > 1) {
        for (let i = 0; i < body.results.length - 1; i++) {
          expect(body.results[i].relevance_score).toBeGreaterThanOrEqual(
            body.results[i + 1].relevance_score,
          );
        }
      }
    });

    it('should include appropriate context lines', async () => {
      const contextLines = 5;
      const validRequest = {
        query: 'function declaration',
        codebase_id: testCodebaseId,
        context_lines: contextLines,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.results.length > 0) {
        const result = body.results[0];
        // Context should include lines before and after the match
        expect(result.context.length).toBeLessThanOrEqual(contextLines * 2);
      }
    });
  });

  describe('Performance Validation', () => {
    it('should complete search within reasonable time', async () => {
      const validRequest = {
        query: 'performance test query',
        codebase_id: testCodebaseId,
      };

      const startTime = Date.now();
      const response = await app.inject({
        method: 'POST',
        url: '/tools/search_code',
        payload: validRequest,
      });
      const endTime = Date.now();

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Execution time should be reasonable (< 5 seconds)
      expect(body.execution_time_ms).toBeLessThan(5000);

      // Actual response time should be close to reported execution time
      const actualTime = endTime - startTime;
      expect(Math.abs(actualTime - body.execution_time_ms)).toBeLessThan(1000);
    });
  });
});
