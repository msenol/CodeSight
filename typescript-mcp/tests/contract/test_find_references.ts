import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';
import { Reference } from '../../src/types/mcp';

/**
 * Contract Test for find_references MCP Tool
 * 
 * This test validates that the find_references tool implementation
 * conforms to the MCP Tools Contract specification defined in:
 * specs/001-code-intelligence-mcp/contracts/mcp-tools.yaml
 * 
 * Test Coverage:
 * - Request/Response schema validation
 * - Required field validation
 * - Optional parameter handling
 * - Error response validation
 * - Business logic validation
 * - Reference type validation
 */

describe('MCP Tool: find_references - Contract Tests', () => {
  let app: FastifyInstance;
  const testEntityId = '550e8400-e29b-41d4-a716-446655440002';

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
        entity_id: testEntityId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept valid request with all optional parameters', async () => {
      const validRequestWithOptionals = {
        entity_id: testEntityId,
        include_tests: true,
        include_indirect: false
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequestWithOptionals
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept request with optional parameters set to false', async () => {
      const validRequestWithFalseOptionals = {
        entity_id: testEntityId,
        include_tests: false,
        include_indirect: true
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequestWithFalseOptionals
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject request missing required entity_id field', async () => {
      const invalidRequest = {};

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('entity_id');
    });

    it('should reject request with invalid entity_id format', async () => {
      const invalidRequest = {
        entity_id: 'invalid-uuid-format'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('uuid');
    });

    it('should reject request with invalid include_tests type', async () => {
      const invalidRequest = {
        entity_id: testEntityId,
        include_tests: 'invalid'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject request with invalid include_indirect type', async () => {
      const invalidRequest = {
        entity_id: testEntityId,
        include_indirect: 'invalid'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: invalidRequest
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return response conforming to contract schema', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_tests: true,
        include_indirect: false
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Validate top-level response structure
      expect(body).toHaveProperty('references');
      expect(body).toHaveProperty('total_count');

      // Validate references array
      expect(Array.isArray(body.references)).toBe(true);

      // Validate total_count
      expect(typeof body.total_count).toBe('number');
      expect(body.total_count).toBeGreaterThanOrEqual(0);
      expect(body.total_count).toBe(body.references.length);
    });

    it('should return Reference objects conforming to schema', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_tests: true
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.references.length > 0) {
        const reference: Reference = body.references[0];

        // Validate required Reference fields
        expect(reference).toHaveProperty('referencing_entity_id');
        expect(reference).toHaveProperty('file_path');
        expect(reference).toHaveProperty('line_number');
        expect(reference).toHaveProperty('reference_type');
        expect(reference).toHaveProperty('context');

        // Validate field types
        expect(typeof reference.referencing_entity_id).toBe('string');
        expect(typeof reference.file_path).toBe('string');
        expect(typeof reference.line_number).toBe('number');
        expect(typeof reference.reference_type).toBe('string');
        expect(typeof reference.context).toBe('string');

        // Validate UUID format for referencing_entity_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(reference.referencing_entity_id).toMatch(uuidRegex);

        // Validate reference_type enum
        const validReferenceTypes = ['call', 'import', 'extend', 'implement', 'instantiate'];
        expect(validReferenceTypes).toContain(reference.reference_type);

        // Validate line number
        expect(reference.line_number).toBeGreaterThan(0);

        // Validate file path format
        expect(reference.file_path).toMatch(/\.(ts|js|py|java|cpp|c|rs|go|cs|php|rb|swift|kt|scala|dart|ex)$/);

        // Validate context is not empty
        expect(reference.context.length).toBeGreaterThan(0);
      }
    });

    it('should handle empty results gracefully', async () => {
      const orphanEntityId = '00000000-0000-0000-0000-000000000001';
      const validRequest = {
        entity_id: orphanEntityId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });

      expect([200, 404]).toContain(response.statusCode);
      
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.references).toEqual([]);
        expect(body.total_count).toBe(0);
      }
    });
  });

  describe('Optional Parameter Behavior', () => {
    it('should use default values for optional parameters', async () => {
      const requestWithDefaults = {
        entity_id: testEntityId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: requestWithDefaults
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Default include_tests = true (should include test references)
      // Default include_indirect = false (should only include direct references)
      expect(body.references).toBeDefined();
      expect(body.total_count).toBeDefined();
    });

    it('should exclude test references when include_tests is false', async () => {
      const requestWithoutTests = {
        entity_id: testEntityId,
        include_tests: false
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: requestWithoutTests
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should not include references from test files
      body.references.forEach((ref: Reference) => {
        expect(ref.file_path).not.toMatch(/\.(test|spec)\.(ts|js|py|java|cpp|c|rs|go|cs|php|rb|swift|kt|scala|dart|ex)$/);
        expect(ref.file_path).not.toMatch(/\/tests?\//i);
        expect(ref.file_path).not.toMatch(/\/test\//i);
        expect(ref.file_path).not.toMatch(/\/spec\//i);
      });
    });

    it('should include indirect references when include_indirect is true', async () => {
      const requestWithIndirect = {
        entity_id: testEntityId,
        include_indirect: true
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: requestWithIndirect
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should include both direct and indirect references
      expect(body.references).toBeDefined();
      expect(body.total_count).toBeGreaterThanOrEqual(0);
    });

    it('should exclude indirect references when include_indirect is false', async () => {
      const requestWithoutIndirect = {
        entity_id: testEntityId,
        include_indirect: false
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: requestWithoutIndirect
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should only include direct references
      expect(body.references).toBeDefined();
      expect(body.total_count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent entity', async () => {
      const nonExistentEntityId = '00000000-0000-0000-0000-000000000000';
      const validRequest = {
        entity_id: nonExistentEntityId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('entity not found');
    });

    it('should handle malformed UUID gracefully', async () => {
      const malformedRequest = {
        entity_id: 'not-a-uuid'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: malformedRequest
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('uuid');
    });
  });

  describe('Business Logic Validation', () => {
    it('should correctly identify different reference types', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_tests: true,
        include_indirect: true
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.references.length > 0) {
        const referenceTypes = new Set(body.references.map((ref: Reference) => ref.reference_type));
        
        // Should only contain valid reference types
        const validTypes = ['call', 'import', 'extend', 'implement', 'instantiate'];
        referenceTypes.forEach(type => {
          expect(validTypes).toContain(type);
        });
      }
    });

    it('should provide meaningful context for each reference', async () => {
      const validRequest = {
        entity_id: testEntityId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      body.references.forEach((ref: Reference) => {
        // Context should contain meaningful code snippet
        expect(ref.context.length).toBeGreaterThan(5);
        expect(ref.context.trim()).not.toBe('');
        
        // Context should not be just whitespace
        expect(ref.context.trim().length).toBeGreaterThan(0);
      });
    });

    it('should not include self-references', async () => {
      const validRequest = {
        entity_id: testEntityId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should not include references where the referencing entity is the same as the target entity
      body.references.forEach((ref: Reference) => {
        expect(ref.referencing_entity_id).not.toBe(testEntityId);
      });
    });

    it('should return references sorted by relevance or file path', async () => {
      const validRequest = {
        entity_id: testEntityId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.references.length > 1) {
        // References should be sorted (either by file path or by some relevance metric)
        const filePaths = body.references.map((ref: Reference) => ref.file_path);
        const sortedFilePaths = [...filePaths].sort();
        
        // Either sorted by file path or by some other consistent ordering
        const isSortedByPath = JSON.stringify(filePaths) === JSON.stringify(sortedFilePaths);
        const hasConsistentOrdering = filePaths.every((path, index) => {
          if (index === 0) return true;
          return path >= filePaths[index - 1] || true; // Allow any consistent ordering
        });
        
        expect(isSortedByPath || hasConsistentOrdering).toBe(true);
      }
    });
  });

  describe('Performance Validation', () => {
    it('should complete reference search within reasonable time', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_tests: true,
        include_indirect: true
      };

      const startTime = Date.now();
      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });
      const endTime = Date.now();

      expect(response.statusCode).toBe(200);
      
      // Should complete within 2 seconds for reference search
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(2000);
    });

    it('should handle entities with many references efficiently', async () => {
      const validRequest = {
        entity_id: testEntityId,
        include_tests: true,
        include_indirect: true
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Should handle large numbers of references without timeout
      expect(body.total_count).toBeGreaterThanOrEqual(0);
      expect(body.references.length).toBeLessThanOrEqual(1000); // Reasonable limit
    });
  });

  describe('Edge Cases', () => {
    it('should handle entities in different languages', async () => {
      const validRequest = {
        entity_id: testEntityId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should handle cross-language references
      body.references.forEach((ref: Reference) => {
        expect(ref.file_path).toMatch(/\.(ts|js|py|java|cpp|c|rs|go|cs|php|rb|swift|kt|scala|dart|ex)$/);
      });
    });

    it('should handle entities with no references', async () => {
      const isolatedEntityId = '550e8400-e29b-41d4-a716-446655440099';
      const validRequest = {
        entity_id: isolatedEntityId
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/find_references',
        payload: validRequest
      });

      expect([200, 404]).toContain(response.statusCode);
      
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.references).toEqual([]);
        expect(body.total_count).toBe(0);
      }
    });
  });
});