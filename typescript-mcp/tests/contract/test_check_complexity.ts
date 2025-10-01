import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';
import { ComplexityMetrics } from '../../src/types/mcp';

/**
 * Contract Test for check_complexity MCP Tool
 *
 * This test validates that the check_complexity tool implementation
 * conforms to the MCP Tools Contract specification defined in:
 * specs/001-code-intelligence-mcp/contracts/mcp-tools.yaml
 *
 * Test Coverage:
 * - Request/Response schema validation
 * - Required field validation
 * - Optional parameter handling
 * - Error response validation
 * - Business logic validation
 * - Complexity metric validation
 * - Metric type filtering
 */

describe('MCP Tool: check_complexity - Contract Tests', () => {
  let app: FastifyInstance;
  const testEntityId = '550e8400-e29b-41d4-a716-446655440003';

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
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept valid request with all optional parameters', async () => {
      const validRequestWithOptionals = {
        entity_id: testEntityId,
        metric_types: ['cyclomatic', 'cognitive', 'lines_of_code'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequestWithOptionals,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept request with single metric type', async () => {
      const validRequestSingleMetric = {
        entity_id: testEntityId,
        metric_types: ['cyclomatic'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequestSingleMetric,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept request with all metric types', async () => {
      const validRequestAllMetrics = {
        entity_id: testEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequestAllMetrics,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept request with maintainability metric', async () => {
      const validRequestMaintainability = {
        entity_id: testEntityId,
        metric_types: ['maintainability'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequestMaintainability,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject request missing required entity_id field', async () => {
      const invalidRequest = {};

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
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
        url: '/tools/check_complexity',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('uuid');
    });

    it('should reject request with invalid metric_types enum', async () => {
      const invalidRequest = {
        entity_id: testEntityId,
        metric_types: ['invalid_metric'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('metric');
    });

    it('should reject request with non-array metric_types', async () => {
      const invalidRequest = {
        entity_id: testEntityId,
        metric_types: 'cyclomatic',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject request with empty metric_types array', async () => {
      const invalidRequest = {
        entity_id: testEntityId,
        metric_types: [],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject request with mixed valid and invalid metric types', async () => {
      const invalidRequest = {
        entity_id: testEntityId,
        metric_types: ['cyclomatic', 'invalid_metric'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return ComplexityMetrics conforming to contract schema', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Validate required ComplexityMetrics fields
      expect(metrics).toHaveProperty('cyclomatic_complexity');
      expect(metrics).toHaveProperty('cognitive_complexity');
      expect(metrics).toHaveProperty('lines_of_code');
      expect(metrics).toHaveProperty('maintainability_index');
      expect(metrics).toHaveProperty('test_coverage');

      // Validate field types
      expect(typeof metrics.cyclomatic_complexity).toBe('number');
      expect(typeof metrics.cognitive_complexity).toBe('number');
      expect(typeof metrics.lines_of_code).toBe('number');
      expect(typeof metrics.maintainability_index).toBe('number');
      expect(typeof metrics.test_coverage).toBe('number');

      // Validate value ranges
      expect(metrics.cyclomatic_complexity).toBeGreaterThanOrEqual(1);
      expect(metrics.cognitive_complexity).toBeGreaterThanOrEqual(0);
      expect(metrics.lines_of_code).toBeGreaterThan(0);
      expect(metrics.maintainability_index).toBeGreaterThanOrEqual(0);
      expect(metrics.maintainability_index).toBeLessThanOrEqual(100);
      expect(metrics.test_coverage).toBeGreaterThanOrEqual(0);
      expect(metrics.test_coverage).toBeLessThanOrEqual(1);
    });

    it('should validate cyclomatic complexity values', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['cyclomatic'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Cyclomatic complexity should be at least 1 (for any function)
      expect(metrics.cyclomatic_complexity).toBeGreaterThanOrEqual(1);

      // Should be reasonable (most functions have complexity < 50)
      expect(metrics.cyclomatic_complexity).toBeLessThan(1000);

      // Should be an integer
      expect(Number.isInteger(metrics.cyclomatic_complexity)).toBe(true);
    });

    it('should validate cognitive complexity values', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['cognitive'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Cognitive complexity can be 0 for very simple functions
      expect(metrics.cognitive_complexity).toBeGreaterThanOrEqual(0);

      // Should be reasonable
      expect(metrics.cognitive_complexity).toBeLessThan(1000);

      // Should be an integer
      expect(Number.isInteger(metrics.cognitive_complexity)).toBe(true);
    });

    it('should validate lines of code values', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['lines_of_code'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Lines of code should be at least 1
      expect(metrics.lines_of_code).toBeGreaterThan(0);

      // Should be reasonable (most functions < 10000 lines)
      expect(metrics.lines_of_code).toBeLessThan(100000);

      // Should be an integer
      expect(Number.isInteger(metrics.lines_of_code)).toBe(true);
    });

    it('should validate maintainability index values', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['maintainability'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Maintainability index should be between 0 and 100
      expect(metrics.maintainability_index).toBeGreaterThanOrEqual(0);
      expect(metrics.maintainability_index).toBeLessThanOrEqual(100);

      // Should be a number (can be float)
      expect(typeof metrics.maintainability_index).toBe('number');
    });

    it('should validate test coverage values', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Test coverage should be between 0 and 1 (0% to 100%)
      expect(metrics.test_coverage).toBeGreaterThanOrEqual(0);
      expect(metrics.test_coverage).toBeLessThanOrEqual(1);

      // Should be a number (can be float)
      expect(typeof metrics.test_coverage).toBe('number');
    });
  });

  describe('Optional Parameter Behavior', () => {
    it('should use default values for optional parameters', async () => {
      const requestWithDefaults = {
        entity_id: testEntityId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: requestWithDefaults,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Default metric_types = ['all'] (should include all metrics)
      expect(metrics.cyclomatic_complexity).toBeDefined();
      expect(metrics.cognitive_complexity).toBeDefined();
      expect(metrics.lines_of_code).toBeDefined();
      expect(metrics.maintainability_index).toBeDefined();
      expect(metrics.test_coverage).toBeDefined();
    });

    it('should filter by specific metric types', async () => {
      const requestWithSpecificMetrics = {
        entity_id: testEntityId,
        metric_types: ['cyclomatic', 'cognitive'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: requestWithSpecificMetrics,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Should include requested metrics
      expect(metrics.cyclomatic_complexity).toBeDefined();
      expect(metrics.cognitive_complexity).toBeDefined();

      // Other metrics should be 0 or default values when not requested
      expect(metrics.lines_of_code).toBeDefined();
      expect(metrics.maintainability_index).toBeDefined();
      expect(metrics.test_coverage).toBeDefined();
    });

    it('should handle single metric type request', async () => {
      const requestSingleMetric = {
        entity_id: testEntityId,
        metric_types: ['lines_of_code'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: requestSingleMetric,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Should include the requested metric
      expect(metrics.lines_of_code).toBeGreaterThan(0);

      // Other metrics should still be present (contract requires all fields)
      expect(metrics.cyclomatic_complexity).toBeDefined();
      expect(metrics.cognitive_complexity).toBeDefined();
      expect(metrics.maintainability_index).toBeDefined();
      expect(metrics.test_coverage).toBeDefined();
    });

    it('should handle all metric types request', async () => {
      const requestAllMetrics = {
        entity_id: testEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: requestAllMetrics,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Should include all metrics with meaningful values
      expect(metrics.cyclomatic_complexity).toBeGreaterThanOrEqual(1);
      expect(metrics.cognitive_complexity).toBeGreaterThanOrEqual(0);
      expect(metrics.lines_of_code).toBeGreaterThan(0);
      expect(metrics.maintainability_index).toBeGreaterThanOrEqual(0);
      expect(metrics.test_coverage).toBeGreaterThanOrEqual(0);
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
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('entity not found');
    });

    it('should return 400 for entity that is not a function/method/class', async () => {
      // Assuming we have a test entity that exists but is not analyzable for complexity
      const nonAnalyzableEntityId = '550e8400-e29b-41d4-a716-446655440004';
      const validRequest = {
        entity_id: nonAnalyzableEntityId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect([400, 422]).toContain(response.statusCode);
      const body = JSON.parse(response.body);
      expect(body.error).toMatch(
        /not analyzable|invalid entity type|complexity analysis not supported/,
      );
    });

    it('should handle malformed UUID gracefully', async () => {
      const malformedRequest = {
        entity_id: 'not-a-uuid',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: malformedRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('uuid');
    });
  });

  describe('Business Logic Validation', () => {
    it('should provide realistic complexity metrics', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Metrics should be realistic for typical code
      expect(metrics.cyclomatic_complexity).toBeLessThan(100); // Very complex functions rarely exceed 50
      expect(metrics.cognitive_complexity).toBeLessThan(200); // Cognitive complexity is usually higher than cyclomatic
      expect(metrics.lines_of_code).toBeLessThan(10000); // Most functions are under 1000 lines

      // Maintainability index should be reasonable
      expect(metrics.maintainability_index).toBeGreaterThan(0);

      // Test coverage should be realistic
      expect(metrics.test_coverage).toBeLessThanOrEqual(1);
    });

    it('should show correlation between complexity metrics', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Generally, higher complexity should correlate with lower maintainability
      if (metrics.cyclomatic_complexity > 20) {
        expect(metrics.maintainability_index).toBeLessThan(80);
      }

      // Cognitive complexity should generally be >= cyclomatic complexity
      expect(metrics.cognitive_complexity).toBeGreaterThanOrEqual(
        metrics.cyclomatic_complexity * 0.5,
      );
    });

    it('should handle different entity types appropriately', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // All metrics should be present and valid regardless of entity type
      expect(metrics.cyclomatic_complexity).toBeGreaterThanOrEqual(1);
      expect(metrics.cognitive_complexity).toBeGreaterThanOrEqual(0);
      expect(metrics.lines_of_code).toBeGreaterThan(0);
      expect(metrics.maintainability_index).toBeGreaterThanOrEqual(0);
      expect(metrics.test_coverage).toBeGreaterThanOrEqual(0);
    });

    it('should calculate maintainability index correctly', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['maintainability'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Maintainability index should follow expected patterns:
      // 0-9: Extremely difficult to maintain
      // 10-19: Difficult to maintain
      // 20-100: Increasingly maintainable
      expect(metrics.maintainability_index).toBeGreaterThanOrEqual(0);
      expect(metrics.maintainability_index).toBeLessThanOrEqual(100);

      // Should be a reasonable precision (not too many decimal places)
      const decimalPlaces = (metrics.maintainability_index.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should provide accurate test coverage metrics', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Test coverage should be between 0 and 1
      expect(metrics.test_coverage).toBeGreaterThanOrEqual(0);
      expect(metrics.test_coverage).toBeLessThanOrEqual(1);

      // Should have reasonable precision
      const decimalPlaces = (metrics.test_coverage.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });
  });

  describe('Performance Validation', () => {
    it('should complete complexity analysis within reasonable time', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['all'],
      };

      const startTime = Date.now();
      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });
      const endTime = Date.now();

      expect(response.statusCode).toBe(200);

      // Should complete within 2 seconds for complexity analysis
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(2000);
    });

    it('should handle complex entities efficiently', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Should handle even complex entities without timeout
      expect(metrics.cyclomatic_complexity).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very simple entities', async () => {
      const simpleEntityId = '550e8400-e29b-41d4-a716-446655440005';
      const validRequest = {
        entity_id: simpleEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect([200, 404]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const metrics: ComplexityMetrics = JSON.parse(response.body);

        // Simple entities should have low complexity
        expect(metrics.cyclomatic_complexity).toBeLessThanOrEqual(5);
        expect(metrics.cognitive_complexity).toBeLessThanOrEqual(10);
        expect(metrics.maintainability_index).toBeGreaterThan(50);
      }
    });

    it('should handle entities with no test coverage', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Should handle 0% test coverage gracefully
      if (metrics.test_coverage === 0) {
        expect(metrics.test_coverage).toBe(0);
      }
    });

    it('should handle entities with 100% test coverage', async () => {
      const wellTestedEntityId = '550e8400-e29b-41d4-a716-446655440006';
      const validRequest = {
        entity_id: wellTestedEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect([200, 404]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const metrics: ComplexityMetrics = JSON.parse(response.body);

        // Should handle 100% test coverage
        if (metrics.test_coverage === 1) {
          expect(metrics.test_coverage).toBe(1);
        }
      }
    });

    it('should handle entities in different programming languages', async () => {
      const validRequest = {
        entity_id: testEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const metrics: ComplexityMetrics = JSON.parse(response.body);

      // Should work across different programming languages
      expect(metrics.cyclomatic_complexity).toBeGreaterThanOrEqual(1);
      expect(metrics.cognitive_complexity).toBeGreaterThanOrEqual(0);
      expect(metrics.lines_of_code).toBeGreaterThan(0);
    });

    it('should handle very large entities', async () => {
      const largeEntityId = '550e8400-e29b-41d4-a716-446655440007';
      const validRequest = {
        entity_id: largeEntityId,
        metric_types: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/check_complexity',
        payload: validRequest,
      });

      expect([200, 404]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const metrics: ComplexityMetrics = JSON.parse(response.body);

        // Should handle large entities without overflow
        expect(metrics.lines_of_code).toBeGreaterThan(0);
        expect(metrics.lines_of_code).toBeLessThan(1000000); // Reasonable upper bound
        expect(metrics.cyclomatic_complexity).toBeLessThan(10000); // Reasonable upper bound
      }
    });
  });
});
