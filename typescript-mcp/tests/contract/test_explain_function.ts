import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';
import { FunctionExplanation, ComplexityMetrics, CodeEntityReference } from '../../src/types/mcp';

/**
 * Contract Test for explain_function MCP Tool
 *
 * This test validates that the explain_function tool implementation
 * conforms to the MCP Tools Contract specification defined in:
 * specs/001-code-intelligence-mcp/contracts/mcp-tools.yaml
 *
 * Test Coverage:
 * - Request/Response schema validation
 * - Required field validation
 * - Optional parameter handling
 * - Error response validation
 * - Business logic validation
 * - Complex nested object validation
 */

describe('MCP Tool: explain_function - Contract Tests', () => {
  let app: FastifyInstance;
  const testEntityId = '550e8400-e29b-41d4-a716-446655440001';

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Request Schema Validation', () => {
    it('should accept valid request with required fields only', async () => {
      const validRequest = {
        entity_id: testEntityId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept valid request with all optional parameters', async () => {
      const validRequestWithOptionals = {
        entity_id: testEntityId,
        include_callers: true,
        include_callees: true,
        include_complexity: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequestWithOptionals,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept request with optional parameters set to false', async () => {
      const validRequestWithFalseOptionals = {
        entity_id: testEntityId,
        include_callers: false,
        include_callees: false,
        include_complexity: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequestWithFalseOptionals,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject request missing required entity_id field', async () => {
      const invalidRequest = {};

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('entity_id');
    });

    it('should reject request with invalid entity_id format', async () => {
      const invalidRequest = {
        entity_id: 'invalid-uuid-format',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('uuid');
    });

    it('should reject request with invalid include_callers type', async () => {
      const invalidRequest = {
        entity_id: testEntityId,
        include_callers: 'invalid',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject request with invalid include_callees type', async () => {
      const invalidRequest = {
        entity_id: testEntityId,
        include_callees: 'invalid',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject request with invalid include_complexity type', async () => {
      const invalidRequest = {
        entity_id: testEntityId,
        include_complexity: 'invalid',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return FunctionExplanation conforming to contract schema', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_callers: true,
        include_callees: true,
        include_complexity: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);

      // Validate required FunctionExplanation fields
      expect(explanation).toHaveProperty('entity_id');
      expect(explanation).toHaveProperty('name');
      expect(explanation).toHaveProperty('description');
      expect(explanation).toHaveProperty('parameters');
      expect(explanation).toHaveProperty('return_type');
      expect(explanation).toHaveProperty('complexity');
      expect(explanation).toHaveProperty('callers');
      expect(explanation).toHaveProperty('callees');

      // Validate field types
      expect(typeof explanation.entity_id).toBe('string');
      expect(typeof explanation.name).toBe('string');
      expect(typeof explanation.description).toBe('string');
      expect(Array.isArray(explanation.parameters)).toBe(true);
      expect(typeof explanation.return_type).toBe('string');
      expect(typeof explanation.complexity).toBe('object');
      expect(Array.isArray(explanation.callers)).toBe(true);
      expect(Array.isArray(explanation.callees)).toBe(true);

      // Validate UUID format for entity_id
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(explanation.entity_id).toMatch(uuidRegex);
    });

    it('should validate parameter objects structure', async () => {
      const validRequest = {
        entity_id: testEntityId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);

      if (explanation.parameters.length > 0) {
        explanation.parameters.forEach(param => {
          expect(param).toHaveProperty('name');
          expect(param).toHaveProperty('type');
          expect(param).toHaveProperty('description');

          expect(typeof param.name).toBe('string');
          expect(typeof param.type).toBe('string');
          expect(typeof param.description).toBe('string');
        });
      }
    });

    it('should validate ComplexityMetrics structure', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_complexity: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);
      const complexity: ComplexityMetrics = explanation.complexity;

      // Validate ComplexityMetrics fields
      expect(complexity).toHaveProperty('cyclomatic_complexity');
      expect(complexity).toHaveProperty('cognitive_complexity');
      expect(complexity).toHaveProperty('lines_of_code');
      expect(complexity).toHaveProperty('maintainability_index');
      expect(complexity).toHaveProperty('test_coverage');

      // Validate field types
      expect(typeof complexity.cyclomatic_complexity).toBe('number');
      expect(typeof complexity.cognitive_complexity).toBe('number');
      expect(typeof complexity.lines_of_code).toBe('number');
      expect(typeof complexity.maintainability_index).toBe('number');
      expect(typeof complexity.test_coverage).toBe('number');

      // Validate value ranges
      expect(complexity.cyclomatic_complexity).toBeGreaterThanOrEqual(1);
      expect(complexity.cognitive_complexity).toBeGreaterThanOrEqual(0);
      expect(complexity.lines_of_code).toBeGreaterThan(0);
      expect(complexity.maintainability_index).toBeGreaterThanOrEqual(0);
      expect(complexity.maintainability_index).toBeLessThanOrEqual(100);
      expect(complexity.test_coverage).toBeGreaterThanOrEqual(0);
      expect(complexity.test_coverage).toBeLessThanOrEqual(1);
    });

    it('should validate CodeEntityReference structure for callers', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_callers: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);

      if (explanation.callers.length > 0) {
        explanation.callers.forEach((caller: CodeEntityReference) => {
          expect(caller).toHaveProperty('entity_id');
          expect(caller).toHaveProperty('name');
          expect(caller).toHaveProperty('file_path');
          expect(caller).toHaveProperty('line_number');

          expect(typeof caller.entity_id).toBe('string');
          expect(typeof caller.name).toBe('string');
          expect(typeof caller.file_path).toBe('string');
          expect(typeof caller.line_number).toBe('number');

          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          expect(caller.entity_id).toMatch(uuidRegex);

          // Validate line number
          expect(caller.line_number).toBeGreaterThan(0);
        });
      }
    });

    it('should validate CodeEntityReference structure for callees', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_callees: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);

      if (explanation.callees.length > 0) {
        explanation.callees.forEach((callee: CodeEntityReference) => {
          expect(callee).toHaveProperty('entity_id');
          expect(callee).toHaveProperty('name');
          expect(callee).toHaveProperty('file_path');
          expect(callee).toHaveProperty('line_number');

          expect(typeof callee.entity_id).toBe('string');
          expect(typeof callee.name).toBe('string');
          expect(typeof callee.file_path).toBe('string');
          expect(typeof callee.line_number).toBe('number');

          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          expect(callee.entity_id).toMatch(uuidRegex);

          // Validate line number
          expect(callee.line_number).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Optional Parameter Behavior', () => {
    it('should use default values for optional parameters', async () => {
      const requestWithDefaults = {
        entity_id: testEntityId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: requestWithDefaults,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);

      // Default include_callers = true
      expect(explanation.callers).toBeDefined();

      // Default include_callees = true
      expect(explanation.callees).toBeDefined();

      // Default include_complexity = true
      expect(explanation.complexity).toBeDefined();
    });

    it('should exclude callers when include_callers is false', async () => {
      const requestWithoutCallers = {
        entity_id: testEntityId,
        include_callers: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: requestWithoutCallers,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);
      expect(explanation.callers).toEqual([]);
    });

    it('should exclude callees when include_callees is false', async () => {
      const requestWithoutCallees = {
        entity_id: testEntityId,
        include_callees: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: requestWithoutCallees,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);
      expect(explanation.callees).toEqual([]);
    });

    it('should exclude complexity when include_complexity is false', async () => {
      const requestWithoutComplexity = {
        entity_id: testEntityId,
        include_complexity: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: requestWithoutComplexity,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);

      // When complexity is excluded, it should be null or have default/empty values
      if (explanation.complexity) {
        expect(explanation.complexity.cyclomatic_complexity).toBe(0);
        expect(explanation.complexity.cognitive_complexity).toBe(0);
        expect(explanation.complexity.lines_of_code).toBe(0);
        expect(explanation.complexity.maintainability_index).toBe(0);
        expect(explanation.complexity.test_coverage).toBe(0);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent entity', async () => {
      const nonExistentEntityId = '00000000-0000-0000-0000-000000000000';
      const validRequest = {
        entity_id: nonExistentEntityId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('entity not found');
    });

    it('should return 400 for entity that is not a function', async () => {
      // Assuming we have a test entity that exists but is not a function
      const nonFunctionEntityId = '550e8400-e29b-41d4-a716-446655440002';
      const validRequest = {
        entity_id: nonFunctionEntityId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect([400, 422]).toContain(response.statusCode);
      const body = JSON.parse(response.body);
      expect(body.error).toMatch(/not a function|invalid entity type/);
    });
  });

  describe('Business Logic Validation', () => {
    it('should provide meaningful function description', async () => {
      const validRequest = {
        entity_id: testEntityId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);

      expect(explanation.description.length).toBeGreaterThan(10);
      expect(explanation.name.length).toBeGreaterThan(0);
    });

    it('should correctly identify function parameters', async () => {
      const validRequest = {
        entity_id: testEntityId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);

      // Parameters should be properly parsed
      explanation.parameters.forEach(param => {
        expect(param.name).not.toBe('');
        expect(param.type).not.toBe('');
        expect(param.description).not.toBe('');
      });
    });

    it('should provide accurate complexity metrics', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_complexity: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);
      const complexity = explanation.complexity;

      // Complexity metrics should be realistic
      expect(complexity.cyclomatic_complexity).toBeLessThan(100);
      expect(complexity.cognitive_complexity).toBeLessThan(200);
      expect(complexity.lines_of_code).toBeLessThan(10000);
    });

    it('should identify caller-callee relationships correctly', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_callers: true,
        include_callees: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);

      // Callers and callees should not include the function itself
      const selfReferences = [...explanation.callers, ...explanation.callees].filter(
        ref => ref.entity_id === testEntityId,
      );
      expect(selfReferences.length).toBe(0);

      // All references should have valid file paths
      [...explanation.callers, ...explanation.callees].forEach(ref => {
        expect(ref.file_path).toMatch(/\.(ts|js|py|java|cpp|c|rs|go)$/);
      });
    });
  });

  describe('Performance Validation', () => {
    it('should complete explanation within reasonable time', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_callers: true,
        include_callees: true,
        include_complexity: true,
      };

      const startTime = Date.now();
      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });
      const endTime = Date.now();

      expect(response.statusCode).toBe(200);

      // Should complete within 3 seconds for complex analysis
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(3000);
    });

    it('should handle functions with many callers efficiently', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_callers: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/explain_function',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const explanation: FunctionExplanation = JSON.parse(response.body);

      // Should handle large numbers of callers without timeout
      // (This assumes the test function might have many callers)
      expect(explanation.callers.length).toBeGreaterThanOrEqual(0);
    });
  });
});
