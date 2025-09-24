import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';
import { DataFlowTrace } from '../../src/types/mcp';

/**
 * Contract Test for trace_data_flow MCP Tool
 * 
 * This test validates that the trace_data_flow tool implementation
 * conforms to the MCP Tools Contract specification defined in:
 * specs/001-code-intelligence-mcp/contracts/mcp-tools.yaml
 * 
 * Test Coverage:
 * - Request/Response schema validation
 * - Required field validation
 * - Optional parameter handling
 * - Error response validation
 * - Business logic validation
 * - Data flow path validation
 */

describe('MCP Tool: trace_data_flow - Contract Tests', () => {
  let app: FastifyInstance;
  const testCodebaseId = '550e8400-e29b-41d4-a716-446655440000';

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Request Schema Validation', () => {
    it('should accept valid request with all required fields', async () => {
      const validRequest = {
        start_point: 'REST API /users',
        end_point: 'database table users',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept valid request with optional max_depth parameter', async () => {
      const validRequestWithOptionals = {
        start_point: 'API endpoint /api/users/create',
        end_point: 'PostgreSQL users table',
        codebase_id: testCodebaseId,
        max_depth: 15
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: validRequestWithOptionals
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept request without codebase_id (optional)', async () => {
      const validRequestWithoutCodebase = {
        start_point: 'function getUserData',
        end_point: 'Redis cache'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: validRequestWithoutCodebase
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject request missing required start_point field', async () => {
      const invalidRequest = {
        end_point: 'database table users',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('start_point');
    });

    it('should reject request missing required end_point field', async () => {
      const invalidRequest = {
        start_point: 'REST API /users',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('end_point');
    });

    it('should reject request with invalid codebase_id format', async () => {
      const invalidRequest = {
        start_point: 'REST API /users',
        end_point: 'database table users',
        codebase_id: 'invalid-uuid-format'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('uuid');
    });

    it('should reject request with invalid max_depth type', async () => {
      const invalidRequest = {
        start_point: 'REST API /users',
        end_point: 'database table users',
        codebase_id: testCodebaseId,
        max_depth: 'invalid'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject request with negative max_depth', async () => {
      const invalidRequest = {
        start_point: 'REST API /users',
        end_point: 'database table users',
        codebase_id: testCodebaseId,
        max_depth: -1
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject request with empty start_point', async () => {
      const invalidRequest = {
        start_point: '',
        end_point: 'database table users',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject request with empty end_point', async () => {
      const invalidRequest = {
        start_point: 'REST API /users',
        end_point: '',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return DataFlowTrace conforming to contract schema', async () => {
      const validRequest = {
        start_point: 'API /users/create',
        end_point: 'database users table',
        codebase_id: testCodebaseId,
        max_depth: 10
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);

      // Validate required DataFlowTrace fields
      expect(trace).toHaveProperty('path');
      expect(trace).toHaveProperty('total_steps');
      expect(trace).toHaveProperty('confidence');

      // Validate field types
      expect(Array.isArray(trace.path)).toBe(true);
      expect(typeof trace.total_steps).toBe('number');
      expect(typeof trace.confidence).toBe('number');

      // Validate total_steps matches path length
      expect(trace.total_steps).toBe(trace.path.length);

      // Validate confidence range
      expect(trace.confidence).toBeGreaterThanOrEqual(0);
      expect(trace.confidence).toBeLessThanOrEqual(1);
    });

    it('should validate path step objects structure', async () => {
      const validRequest = {
        start_point: 'controller method createUser',
        end_point: 'database insert operation',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);

      if (trace.path.length > 0) {
        trace.path.forEach(step => {
          // Validate required step fields
          expect(step).toHaveProperty('entity_id');
          expect(step).toHaveProperty('name');
          expect(step).toHaveProperty('file_path');
          expect(step).toHaveProperty('line_number');
          expect(step).toHaveProperty('transformation');

          // Validate field types
          expect(typeof step.entity_id).toBe('string');
          expect(typeof step.name).toBe('string');
          expect(typeof step.file_path).toBe('string');
          expect(typeof step.line_number).toBe('number');
          expect(typeof step.transformation).toBe('string');

          // Validate UUID format for entity_id
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          expect(step.entity_id).toMatch(uuidRegex);

          // Validate line number
          expect(step.line_number).toBeGreaterThan(0);

          // Validate file path format
          expect(step.file_path).toMatch(/\.(ts|js|py|java|cpp|c|rs|go|cs|php|rb|swift|kt|scala|dart|ex)$/);

          // Validate name and transformation are not empty
          expect(step.name.length).toBeGreaterThan(0);
          expect(step.transformation.length).toBeGreaterThan(0);
        });
      }
    });

    it('should handle empty path gracefully', async () => {
      const unreachableRequest = {
        start_point: 'isolated function',
        end_point: 'unreachable destination',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: unreachableRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);

      expect(trace.path).toEqual([]);
      expect(trace.total_steps).toBe(0);
      expect(trace.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Optional Parameter Behavior', () => {
    it('should use default max_depth when not specified', async () => {
      const requestWithDefaults = {
        start_point: 'API endpoint',
        end_point: 'database table'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: requestWithDefaults
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);

      // Default max_depth = 10, so path should not exceed 10 steps
      expect(trace.path.length).toBeLessThanOrEqual(10);
      expect(trace.total_steps).toBeLessThanOrEqual(10);
    });

    it('should respect custom max_depth parameter', async () => {
      const customDepth = 5;
      const requestWithCustomDepth = {
        start_point: 'API endpoint /users',
        end_point: 'database users table',
        codebase_id: testCodebaseId,
        max_depth: customDepth
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: requestWithCustomDepth
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);

      // Path should not exceed custom max_depth
      expect(trace.path.length).toBeLessThanOrEqual(customDepth);
      expect(trace.total_steps).toBeLessThanOrEqual(customDepth);
    });

    it('should handle very small max_depth values', async () => {
      const smallDepth = 1;
      const requestWithSmallDepth = {
        start_point: 'function call',
        end_point: 'return value',
        max_depth: smallDepth
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: requestWithSmallDepth
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);

      expect(trace.path.length).toBeLessThanOrEqual(smallDepth);
      expect(trace.total_steps).toBeLessThanOrEqual(smallDepth);
    });

    it('should handle very large max_depth values', async () => {
      const largeDepth = 100;
      const requestWithLargeDepth = {
        start_point: 'API endpoint',
        end_point: 'database table',
        max_depth: largeDepth
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: requestWithLargeDepth
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);

      // Should complete without timeout even with large depth
      expect(trace.path.length).toBeLessThanOrEqual(largeDepth);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent codebase', async () => {
      const nonExistentCodebaseId = '00000000-0000-0000-0000-000000000000';
      const validRequest = {
        start_point: 'API endpoint',
        end_point: 'database table',
        codebase_id: nonExistentCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: validRequest
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('codebase not found');
    });

    it('should handle invalid start_point gracefully', async () => {
      const invalidRequest = {
        start_point: 'non-existent-entity',
        end_point: 'database table',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);
      
      // Should return empty path for invalid start point
      expect(trace.path).toEqual([]);
      expect(trace.total_steps).toBe(0);
      expect(trace.confidence).toBeLessThan(0.5);
    });

    it('should handle invalid end_point gracefully', async () => {
      const invalidRequest = {
        start_point: 'API endpoint /users',
        end_point: 'non-existent-destination',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);
      
      // Should return empty or partial path for invalid end point
      expect(trace.confidence).toBeLessThan(1.0);
    });
  });

  describe('Business Logic Validation', () => {
    it('should trace logical data flow paths', async () => {
      const validRequest = {
        start_point: 'REST API /users/create',
        end_point: 'database users table',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);

      if (trace.path.length > 0) {
        // Path should represent logical flow
        const transformations = trace.path.map(step => step.transformation);
        
        // Should contain meaningful transformation descriptions
        transformations.forEach(transformation => {
          expect(transformation.length).toBeGreaterThan(5);
          expect(transformation).not.toBe('unknown');
        });
      }
    });

    it('should provide meaningful step names', async () => {
      const validRequest = {
        start_point: 'user input validation',
        end_point: 'database persistence',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);

      trace.path.forEach(step => {
        // Step names should be descriptive
        expect(step.name.length).toBeGreaterThan(2);
        expect(step.name).not.toMatch(/^(step|node|entity)\d+$/);
      });
    });

    it('should calculate reasonable confidence scores', async () => {
      const validRequest = {
        start_point: 'API controller method',
        end_point: 'database table',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);

      // Confidence should be reasonable based on path completeness
      if (trace.path.length > 0) {
        expect(trace.confidence).toBeGreaterThan(0.1);
      } else {
        expect(trace.confidence).toBeLessThan(0.5);
      }
    });

    it('should handle circular dependencies gracefully', async () => {
      const circularRequest = {
        start_point: 'recursive function A',
        end_point: 'recursive function A',
        codebase_id: testCodebaseId,
        max_depth: 5
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: circularRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);

      // Should not get stuck in infinite loops
      expect(trace.path.length).toBeLessThanOrEqual(5);
      expect(trace.total_steps).toBeLessThanOrEqual(5);
    });

    it('should identify different types of data transformations', async () => {
      const validRequest = {
        start_point: 'HTTP request body',
        end_point: 'SQL INSERT statement',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);

      if (trace.path.length > 1) {
        // Should identify different transformation types
        const transformations = trace.path.map(step => step.transformation.toLowerCase());
        
        // Common transformation patterns
        const hasValidTransformation = transformations.some(t => 
          t.includes('parse') || 
          t.includes('validate') || 
          t.includes('transform') || 
          t.includes('map') || 
          t.includes('convert') ||
          t.includes('serialize') ||
          t.includes('deserialize')
        );
        
        expect(hasValidTransformation).toBe(true);
      }
    });
  });

  describe('Performance Validation', () => {
    it('should complete data flow tracing within reasonable time', async () => {
      const validRequest = {
        start_point: 'API endpoint /complex/operation',
        end_point: 'database complex_table',
        codebase_id: testCodebaseId,
        max_depth: 10
      };

      const startTime = Date.now();
      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: validRequest
      });
      const endTime = Date.now();

      expect(response.statusCode).toBe(200);
      
      // Should complete within 5 seconds for complex tracing
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000);
    });

    it('should handle deep traces efficiently', async () => {
      const deepRequest = {
        start_point: 'entry point',
        end_point: 'deep destination',
        max_depth: 20
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: deepRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);
      
      // Should handle deep traces without performance issues
      expect(trace.total_steps).toBeLessThanOrEqual(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle same start and end points', async () => {
      const samePointRequest = {
        start_point: 'function processData',
        end_point: 'function processData',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: samePointRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);
      
      // Should handle identity case
      expect(trace.total_steps).toBeLessThanOrEqual(1);
      expect(trace.confidence).toBeGreaterThan(0.8);
    });

    it('should handle cross-language data flows', async () => {
      const crossLanguageRequest = {
        start_point: 'TypeScript API endpoint',
        end_point: 'Python data processor',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: crossLanguageRequest
      });

      expect(response.statusCode).toBe(200);
      const trace: DataFlowTrace = JSON.parse(response.body);
      
      // Should handle cross-language flows
      if (trace.path.length > 0) {
        const fileExtensions = trace.path.map(step => {
          const match = step.file_path.match(/\.(\w+)$/);
          return match ? match[1] : '';
        });
        
        // May contain different file extensions for cross-language flows
        expect(fileExtensions.length).toBeGreaterThan(0);
      }
    });

    it('should handle very long point descriptions', async () => {
      const longDescription = 'very long description '.repeat(20);
      const longPointRequest = {
        start_point: longDescription + 'start',
        end_point: longDescription + 'end',
        codebase_id: testCodebaseId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/trace_data_flow',
        payload: longPointRequest
      });

      expect([200, 400]).toContain(response.statusCode);
      
      if (response.statusCode === 200) {
        const trace: DataFlowTrace = JSON.parse(response.body);
        expect(trace).toHaveProperty('path');
        expect(trace).toHaveProperty('total_steps');
        expect(trace).toHaveProperty('confidence');
      }
    });
  });
});