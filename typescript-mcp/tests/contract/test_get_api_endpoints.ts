 
 
 
 
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createFastifyServer } from '../../src/server';
import { APIEndpoint } from '../../src/types';

/**
 * Contract Test for get_api_endpoints MCP Tool
 *
 * This test validates that the get_api_endpoints tool implementation
 * conforms to the MCP Tools Contract specification defined in:
 * specs/001-code-intelligence-mcp/contracts/mcp-tools.yaml
 *
 * Test Coverage:
 * - Request/Response schema validation
 * - Required field validation
 * - Optional parameter handling
 * - Error response validation
 * - Business logic validation
 * - API endpoint discovery validation
 * - HTTP method filtering
 */

describe('MCP Tool: get_api_endpoints - Contract Tests', () => {
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
    it('should accept valid request with required fields only', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept valid request with all optional parameters', async () => {
      const validRequestWithOptionals = {
        codebase_id: testCodebaseId,
        filter_method: 'GET',
        include_schemas: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequestWithOptionals,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept request with different HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'all'];

      for (const method of methods) {
        const validRequest = {
          codebase_id: testCodebaseId,
          filter_method: method,
          include_schemas: false,
        };

        const response = await app.inject({
          method: 'POST',
          url: '/tools/get_api_endpoints',
          payload: validRequest,
        });

        expect(response.statusCode).toBe(200);
      }
    });

    it('should reject request missing required codebase_id field', async () => {
      const invalidRequest = {};

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('codebase_id');
    });

    it('should reject request with invalid codebase_id format', async () => {
      const invalidRequest = {
        codebase_id: 'invalid-uuid-format',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('uuid');
    });

    it('should reject request with invalid filter_method enum', async () => {
      const invalidRequest = {
        codebase_id: testCodebaseId,
        filter_method: 'INVALID_METHOD',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('method');
    });

    it('should reject request with invalid include_schemas type', async () => {
      const invalidRequest = {
        codebase_id: testCodebaseId,
        include_schemas: 'invalid',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return response conforming to contract schema', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        filter_method: 'all',
        include_schemas: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Validate top-level response structure
      expect(body).toHaveProperty('endpoints');
      expect(body).toHaveProperty('total_count');

      // Validate endpoints array
      expect(Array.isArray(body.endpoints)).toBe(true);

      // Validate total_count
      expect(typeof body.total_count).toBe('number');
      expect(body.total_count).toBeGreaterThanOrEqual(0);
      expect(body.total_count).toBe(body.endpoints.length);
    });

    it('should return APIEndpoint objects conforming to schema', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        include_schemas: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.endpoints.length > 0) {
        const endpoint: APIEndpoint = body.endpoints[0];

        // Validate required APIEndpoint fields
        expect(endpoint).toHaveProperty('id');
        expect(endpoint).toHaveProperty('path');
        expect(endpoint).toHaveProperty('method');
        expect(endpoint).toHaveProperty('handler_entity_id');
        expect(endpoint).toHaveProperty('request_schema');
        expect(endpoint).toHaveProperty('response_schema');
        expect(endpoint).toHaveProperty('authentication_required');
        expect(endpoint).toHaveProperty('file_path');
        expect(endpoint).toHaveProperty('line_number');

        // Validate field types
        expect(typeof endpoint.id).toBe('string');
        expect(typeof endpoint.path).toBe('string');
        expect(typeof endpoint.method).toBe('string');
        expect(typeof endpoint.handler_entity_id).toBe('string');
        expect(typeof endpoint.request_schema).toBe('object');
        expect(typeof endpoint.response_schema).toBe('object');
        expect(typeof endpoint.authentication_required).toBe('boolean');
        expect(typeof endpoint.file_path).toBe('string');
        expect(typeof endpoint.line_number).toBe('number');

        // Validate UUID format for id and handler_entity_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(endpoint.id).toMatch(uuidRegex);
        expect(endpoint.handler_entity_id).toMatch(uuidRegex);

        // Validate method enum
        const validMethods = [
          'GET',
          'POST',
          'PUT',
          'DELETE',
          'PATCH',
          'OPTIONS',
          'HEAD',
          'GraphQL',
        ];
        expect(validMethods).toContain(endpoint.method);

        // Validate line number
        expect(endpoint.line_number).toBeGreaterThan(0);

        // Validate file path format
        expect(endpoint.file_path).toMatch(
          /\.(ts|js|py|java|cpp|c|rs|go|cs|php|rb|swift|kt|scala|dart|ex)$/,
        );

        // Validate path format (should start with / for REST APIs)
        if (endpoint.method !== 'GraphQL') {
          expect(endpoint.path).toMatch(/^\//);
        }
      }
    });

    it('should handle schemas when include_schemas is true', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        include_schemas: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      body.endpoints.forEach((endpoint: APIEndpoint) => {
        // When include_schemas is true, schemas should be populated
        expect(endpoint.request_schema).toBeDefined();
        expect(endpoint.response_schema).toBeDefined();

        // Schemas should be objects (can be empty)
        expect(typeof endpoint.request_schema).toBe('object');
        expect(typeof endpoint.response_schema).toBe('object');
      });
    });

    it('should handle schemas when include_schemas is false', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        include_schemas: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      body.endpoints.forEach((endpoint: APIEndpoint) => {
        // When include_schemas is false, schemas should be empty or minimal
        expect(endpoint.request_schema).toBeDefined();
        expect(endpoint.response_schema).toBeDefined();
      });
    });

    it('should handle empty results gracefully', async () => {
      const emptyCodebaseId = '550e8400-e29b-41d4-a716-446655440099';
      const validRequest = {
        codebase_id: emptyCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect([200, 404]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.endpoints).toEqual([]);
        expect(body.total_count).toBe(0);
      }
    });
  });

  describe('Optional Parameter Behavior', () => {
    it('should use default values for optional parameters', async () => {
      const requestWithDefaults = {
        codebase_id: testCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: requestWithDefaults,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Default filter_method = 'all' (should include all HTTP methods)
      // Default include_schemas = true (should include schema information)
      expect(body.endpoints).toBeDefined();
      expect(body.total_count).toBeDefined();
    });

    it('should filter by specific HTTP method', async () => {
      const requestWithGetFilter = {
        codebase_id: testCodebaseId,
        filter_method: 'GET',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: requestWithGetFilter,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should only include GET endpoints
      body.endpoints.forEach((endpoint: APIEndpoint) => {
        expect(endpoint.method).toBe('GET');
      });
    });

    it('should filter by POST method', async () => {
      const requestWithPostFilter = {
        codebase_id: testCodebaseId,
        filter_method: 'POST',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: requestWithPostFilter,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should only include POST endpoints
      body.endpoints.forEach((endpoint: APIEndpoint) => {
        expect(endpoint.method).toBe('POST');
      });
    });

    it('should include all methods when filter_method is all', async () => {
      const requestWithAllFilter = {
        codebase_id: testCodebaseId,
        filter_method: 'all',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: requestWithAllFilter,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should include endpoints with any HTTP method
      if (body.endpoints.length > 0) {
        const methods = new Set(body.endpoints.map((endpoint: APIEndpoint) => endpoint.method));
        const validMethods = [
          'GET',
          'POST',
          'PUT',
          'DELETE',
          'PATCH',
          'OPTIONS',
          'HEAD',
          'GraphQL',
        ];

        methods.forEach(method => {
          expect(validMethods).toContain(method);
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent codebase', async () => {
      const nonExistentCodebaseId = '00000000-0000-0000-0000-000000000000';
      const validRequest = {
        codebase_id: nonExistentCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('codebase not found');
    });

    it('should handle malformed UUID gracefully', async () => {
      const malformedRequest = {
        codebase_id: 'not-a-uuid',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: malformedRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('uuid');
    });
  });

  describe('Business Logic Validation', () => {
    it('should discover REST API endpoints correctly', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        filter_method: 'all',
        include_schemas: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      body.endpoints.forEach((endpoint: APIEndpoint) => {
        if (endpoint.method !== 'GraphQL') {
          // REST endpoints should have valid path patterns
          expect(endpoint.path).toMatch(/^\/[\w\-\/{}:]*$/);

          // Should have reasonable path structure
          expect(endpoint.path.length).toBeGreaterThan(0);
          expect(endpoint.path).not.toBe('/');
        }
      });
    });

    it('should identify authentication requirements correctly', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        include_schemas: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      body.endpoints.forEach((endpoint: APIEndpoint) => {
        // Authentication requirement should be a boolean
        expect(typeof endpoint.authentication_required).toBe('boolean');

        // Certain paths typically require authentication
        if (
          endpoint.path.includes('/admin') ||
          endpoint.path.includes('/private') ||
          endpoint.path.includes('/auth') ||
          endpoint.method === 'DELETE' ||
          endpoint.method === 'PUT'
        ) {
          // These might require authentication (heuristic)
        }
      });
    });

    it('should provide meaningful endpoint paths', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      body.endpoints.forEach((endpoint: APIEndpoint) => {
        // Paths should be meaningful
        expect(endpoint.path.length).toBeGreaterThan(1);
        expect(endpoint.path).not.toMatch(/^\/(endpoint|api|route)\d+$/);

        // Should not contain obvious placeholder text
        expect(endpoint.path.toLowerCase()).not.toContain('placeholder');
        expect(endpoint.path.toLowerCase()).not.toContain('example');
      });
    });

    it('should link endpoints to correct handler entities', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      body.endpoints.forEach((endpoint: APIEndpoint) => {
        // Handler entity ID should be valid UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(endpoint.handler_entity_id).toMatch(uuidRegex);

        // Should have valid file path and line number
        expect(endpoint.file_path.length).toBeGreaterThan(0);
        expect(endpoint.line_number).toBeGreaterThan(0);
      });
    });

    it('should handle different API frameworks', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        filter_method: 'all',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should handle various API frameworks (Express, Fastify, Spring, etc.)
      if (body.endpoints.length > 0) {
        const methods = new Set(body.endpoints.map((endpoint: APIEndpoint) => endpoint.method));

        // Should support standard HTTP methods
        const standardMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        const hasStandardMethods = standardMethods.some(method => methods.has(method));

        if (methods.size > 0) {
          expect(hasStandardMethods || methods.has('GraphQL')).toBe(true);
        }
      }
    });

    it('should provide appropriate schema information', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        include_schemas: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      body.endpoints.forEach((endpoint: APIEndpoint) => {
        // Schemas should be objects
        expect(typeof endpoint.request_schema).toBe('object');
        expect(typeof endpoint.response_schema).toBe('object');

        // POST/PUT endpoints should typically have request schemas
        if (
          endpoint.method === 'POST' ||
          endpoint.method === 'PUT' ||
          endpoint.method === 'PATCH'
        ) {
          // Request schema might be populated for these methods
          expect(endpoint.request_schema).toBeDefined();
        }

        // All endpoints should have response schemas
        expect(endpoint.response_schema).toBeDefined();
      });
    });
  });

  describe('Performance Validation', () => {
    it('should complete endpoint discovery within reasonable time', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        filter_method: 'all',
        include_schemas: true,
      };

      const startTime = Date.now();
      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });
      const endTime = Date.now();

      expect(response.statusCode).toBe(200);

      // Should complete within 5 seconds for endpoint discovery
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000);
    });

    it('should handle large numbers of endpoints efficiently', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        filter_method: 'all',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should handle large numbers of endpoints without timeout
      expect(body.total_count).toBeGreaterThanOrEqual(0);
      expect(body.endpoints.length).toBeLessThanOrEqual(1000); // Reasonable limit
    });
  });

  describe('Edge Cases', () => {
    it('should handle codebases with no API endpoints', async () => {
      const noApiCodebaseId = '550e8400-e29b-41d4-a716-446655440098';
      const validRequest = {
        codebase_id: noApiCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect([200, 404]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.endpoints).toEqual([]);
        expect(body.total_count).toBe(0);
      }
    });

    it('should handle GraphQL endpoints', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        filter_method: 'all',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      const graphqlEndpoints = body.endpoints.filter(
        (endpoint: APIEndpoint) => endpoint.method === 'GraphQL',
      );

      graphqlEndpoints.forEach((endpoint: APIEndpoint) => {
        // GraphQL endpoints might have different path patterns
        expect(endpoint.path).toBeDefined();
        expect(endpoint.path.length).toBeGreaterThan(0);

        // GraphQL typically uses POST method internally but is marked as GraphQL
        expect(endpoint.method).toBe('GraphQL');
      });
    });

    it('should handle mixed REST and GraphQL APIs', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        filter_method: 'all',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.endpoints.length > 0) {
        const methods = new Set(body.endpoints.map((endpoint: APIEndpoint) => endpoint.method));

        // Should handle both REST and GraphQL endpoints
        const hasRest = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].some(method =>
          methods.has(method),
        );
        const hasGraphQL = methods.has('GraphQL');

        // Should have at least one type of API
        expect(hasRest || hasGraphQL).toBe(true);
      }
    });

    it('should handle endpoints with complex path parameters', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_api_endpoints',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      body.endpoints.forEach((endpoint: APIEndpoint) => {
        // Should handle path parameters like /users/{id} or /users/:id
        if (endpoint.path.includes('{') || endpoint.path.includes(':')) {
          expect(endpoint.path).toMatch(/\/[\w\-{}:]+/);
        }
      });
    });
  });
});
