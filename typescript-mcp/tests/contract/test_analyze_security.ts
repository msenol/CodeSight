import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';
import { Vulnerability } from '../../src/types/mcp';

/**
 * Contract Test for analyze_security MCP Tool
 *
 * This test validates that the analyze_security tool implementation
 * conforms to the MCP Tools Contract specification defined in:
 * specs/001-code-intelligence-mcp/contracts/mcp-tools.yaml
 *
 * Test Coverage:
 * - Request/Response schema validation
 * - Required field validation
 * - Optional parameter handling
 * - Error response validation
 * - Business logic validation
 * - Security pattern validation
 * - Vulnerability severity validation
 */

describe('MCP Tool: analyze_security - Contract Tests', () => {
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
    it('should accept valid request with required fields only', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept valid request with all optional parameters', async () => {
      const validRequestWithOptionals = {
        codebase_id: testCodebaseId,
        patterns: ['sql_injection', 'xss', 'csrf'],
        severity_threshold: 'medium',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequestWithOptionals,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept request with single pattern', async () => {
      const validRequestSinglePattern = {
        codebase_id: testCodebaseId,
        patterns: ['sql_injection'],
        severity_threshold: 'high',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequestSinglePattern,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept request with all patterns', async () => {
      const validRequestAllPatterns = {
        codebase_id: testCodebaseId,
        patterns: ['all'],
        severity_threshold: 'low',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequestAllPatterns,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject request missing required codebase_id field', async () => {
      const invalidRequest = {};

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
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
        url: '/tools/analyze_security',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('uuid');
    });

    it('should reject request with invalid patterns enum', async () => {
      const invalidRequest = {
        codebase_id: testCodebaseId,
        patterns: ['invalid_pattern'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('pattern');
    });

    it('should reject request with invalid severity_threshold enum', async () => {
      const invalidRequest = {
        codebase_id: testCodebaseId,
        severity_threshold: 'invalid_severity',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('severity');
    });

    it('should reject request with non-array patterns', async () => {
      const invalidRequest = {
        codebase_id: testCodebaseId,
        patterns: 'sql_injection',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject request with empty patterns array', async () => {
      const invalidRequest = {
        codebase_id: testCodebaseId,
        patterns: [],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return response conforming to contract schema', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        patterns: ['sql_injection', 'xss'],
        severity_threshold: 'low',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Validate top-level response structure
      expect(body).toHaveProperty('vulnerabilities');
      expect(body).toHaveProperty('summary');

      // Validate vulnerabilities array
      expect(Array.isArray(body.vulnerabilities)).toBe(true);

      // Validate summary object
      expect(typeof body.summary).toBe('object');
      expect(body.summary).toHaveProperty('total');
      expect(body.summary).toHaveProperty('by_severity');
      expect(typeof body.summary.total).toBe('number');
      expect(typeof body.summary.by_severity).toBe('object');
    });

    it('should return Vulnerability objects conforming to schema', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        patterns: ['all'],
        severity_threshold: 'low',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.vulnerabilities.length > 0) {
        const vulnerability: Vulnerability = body.vulnerabilities[0];

        // Validate required Vulnerability fields
        expect(vulnerability).toHaveProperty('type');
        expect(vulnerability).toHaveProperty('severity');
        expect(vulnerability).toHaveProperty('entity_id');
        expect(vulnerability).toHaveProperty('file_path');
        expect(vulnerability).toHaveProperty('line_number');
        expect(vulnerability).toHaveProperty('description');
        expect(vulnerability).toHaveProperty('recommendation');
        expect(vulnerability).toHaveProperty('code_snippet');

        // Validate field types
        expect(typeof vulnerability.type).toBe('string');
        expect(typeof vulnerability.severity).toBe('string');
        expect(typeof vulnerability.entity_id).toBe('string');
        expect(typeof vulnerability.file_path).toBe('string');
        expect(typeof vulnerability.line_number).toBe('number');
        expect(typeof vulnerability.description).toBe('string');
        expect(typeof vulnerability.recommendation).toBe('string');
        expect(typeof vulnerability.code_snippet).toBe('string');

        // Validate type enum
        const validTypes = [
          'sql_injection',
          'xss',
          'csrf',
          'path_traversal',
          'command_injection',
          'other',
        ];
        expect(validTypes).toContain(vulnerability.type);

        // Validate severity enum
        const validSeverities = ['low', 'medium', 'high', 'critical'];
        expect(validSeverities).toContain(vulnerability.severity);

        // Validate UUID format for entity_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(vulnerability.entity_id).toMatch(uuidRegex);

        // Validate line number
        expect(vulnerability.line_number).toBeGreaterThan(0);

        // Validate file path format
        expect(vulnerability.file_path).toMatch(
          /\.(ts|js|py|java|cpp|c|rs|go|cs|php|rb|swift|kt|scala|dart|ex)$/,
        );

        // Validate content is not empty
        expect(vulnerability.description.length).toBeGreaterThan(0);
        expect(vulnerability.recommendation.length).toBeGreaterThan(0);
        expect(vulnerability.code_snippet.length).toBeGreaterThan(0);
      }
    });

    it('should validate summary statistics', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        patterns: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const summary = body.summary;

      // Validate total matches vulnerabilities count
      expect(summary.total).toBe(body.vulnerabilities.length);

      // Validate by_severity breakdown
      expect(typeof summary.by_severity).toBe('object');

      const severityKeys = Object.keys(summary.by_severity);
      const validSeverities = ['low', 'medium', 'high', 'critical'];

      severityKeys.forEach(severity => {
        expect(validSeverities).toContain(severity);
        expect(typeof summary.by_severity[severity]).toBe('number');
        expect(summary.by_severity[severity]).toBeGreaterThanOrEqual(0);
      });

      // Validate severity counts sum to total
      const severitySum = Object.values(summary.by_severity).reduce(
        (sum: number, count: any) => sum + count,
        0,
      );
      expect(severitySum).toBe(summary.total);
    });

    it('should handle empty results gracefully', async () => {
      const cleanCodebaseId = '550e8400-e29b-41d4-a716-446655440099';
      const validRequest = {
        codebase_id: cleanCodebaseId,
        patterns: ['sql_injection'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect([200, 404]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.vulnerabilities).toEqual([]);
        expect(body.summary.total).toBe(0);
        expect(Object.values(body.summary.by_severity).every((count: any) => count === 0)).toBe(
          true,
        );
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
        url: '/tools/analyze_security',
        payload: requestWithDefaults,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Default patterns = ['all'] (should check all vulnerability types)
      // Default severity_threshold = 'low' (should include all severities)
      expect(body.vulnerabilities).toBeDefined();
      expect(body.summary).toBeDefined();
    });

    it('should filter by specific patterns', async () => {
      const requestWithSpecificPatterns = {
        codebase_id: testCodebaseId,
        patterns: ['sql_injection'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: requestWithSpecificPatterns,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should only include SQL injection vulnerabilities
      body.vulnerabilities.forEach((vuln: Vulnerability) => {
        expect(vuln.type).toBe('sql_injection');
      });
    });

    it('should filter by severity threshold', async () => {
      const requestWithHighSeverity = {
        codebase_id: testCodebaseId,
        patterns: ['all'],
        severity_threshold: 'high',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: requestWithHighSeverity,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should only include high and critical severity vulnerabilities
      const allowedSeverities = ['high', 'critical'];
      body.vulnerabilities.forEach((vuln: Vulnerability) => {
        expect(allowedSeverities).toContain(vuln.severity);
      });
    });

    it('should filter by medium severity threshold', async () => {
      const requestWithMediumSeverity = {
        codebase_id: testCodebaseId,
        patterns: ['all'],
        severity_threshold: 'medium',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: requestWithMediumSeverity,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should include medium, high, and critical severity vulnerabilities
      const allowedSeverities = ['medium', 'high', 'critical'];
      body.vulnerabilities.forEach((vuln: Vulnerability) => {
        expect(allowedSeverities).toContain(vuln.severity);
      });
    });

    it('should handle multiple specific patterns', async () => {
      const requestWithMultiplePatterns = {
        codebase_id: testCodebaseId,
        patterns: ['sql_injection', 'xss', 'csrf'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: requestWithMultiplePatterns,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should only include specified vulnerability types
      const allowedTypes = ['sql_injection', 'xss', 'csrf'];
      body.vulnerabilities.forEach((vuln: Vulnerability) => {
        expect(allowedTypes).toContain(vuln.type);
      });
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
        url: '/tools/analyze_security',
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
        url: '/tools/analyze_security',
        payload: malformedRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('uuid');
    });
  });

  describe('Business Logic Validation', () => {
    it('should identify different vulnerability types correctly', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        patterns: ['all'],
        severity_threshold: 'low',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.vulnerabilities.length > 0) {
        const vulnerabilityTypes = new Set(
          body.vulnerabilities.map((vuln: Vulnerability) => vuln.type),
        );

        // Should only contain valid vulnerability types
        const validTypes = [
          'sql_injection',
          'xss',
          'csrf',
          'path_traversal',
          'command_injection',
          'other',
        ];
        vulnerabilityTypes.forEach(type => {
          expect(validTypes).toContain(type);
        });
      }
    });

    it('should provide meaningful descriptions and recommendations', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        patterns: ['sql_injection', 'xss'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      body.vulnerabilities.forEach((vuln: Vulnerability) => {
        // Description should be meaningful
        expect(vuln.description.length).toBeGreaterThan(10);
        expect(vuln.description).not.toBe('vulnerability found');

        // Recommendation should be actionable
        expect(vuln.recommendation.length).toBeGreaterThan(10);
        expect(vuln.recommendation).not.toBe('fix this issue');

        // Code snippet should contain actual code
        expect(vuln.code_snippet.length).toBeGreaterThan(5);
        expect(vuln.code_snippet.trim()).not.toBe('');
      });
    });

    it('should assign appropriate severity levels', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        patterns: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      body.vulnerabilities.forEach((vuln: Vulnerability) => {
        // Severity should be appropriate for vulnerability type
        if (vuln.type === 'sql_injection' || vuln.type === 'command_injection') {
          expect(['medium', 'high', 'critical']).toContain(vuln.severity);
        }

        if (vuln.type === 'xss') {
          expect(['low', 'medium', 'high']).toContain(vuln.severity);
        }
      });
    });

    it('should provide relevant code snippets', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        patterns: ['sql_injection'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      body.vulnerabilities.forEach((vuln: Vulnerability) => {
        // Code snippet should contain relevant code
        expect(vuln.code_snippet).not.toMatch(/^\s*$/);

        // For SQL injection, might contain SQL-related keywords
        if (vuln.type === 'sql_injection') {
          const snippet = vuln.code_snippet.toLowerCase();
void 0; // hasSqlKeywords reserved for future use
            snippet.includes('select') ||
            snippet.includes('insert') ||
            snippet.includes('update') ||
            snippet.includes('delete') ||
            snippet.includes('query') ||
            snippet.includes('sql');

          // Not all SQL injections will have these keywords, but many will
          // This is a heuristic check
        }
      });
    });

    it('should not report false positives for safe code patterns', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        patterns: ['sql_injection'],
        severity_threshold: 'medium',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should not flag parameterized queries or prepared statements as vulnerabilities
      body.vulnerabilities.forEach((vuln: Vulnerability) => {
        const snippet = vuln.code_snippet.toLowerCase();

        // These patterns should generally be safe
        const hasSafePatterns =
          snippet.includes('prepared') || snippet.includes('parameter') || snippet.includes('bind');

        // If safe patterns are present, severity should not be critical
        if (hasSafePatterns) {
          expect(vuln.severity).not.toBe('critical');
        }
      });
    });
  });

  describe('Performance Validation', () => {
    it('should complete security analysis within reasonable time', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        patterns: ['all'],
        severity_threshold: 'low',
      };

      const startTime = Date.now();
      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });
      const endTime = Date.now();

      expect(response.statusCode).toBe(200);

      // Should complete within 10 seconds for comprehensive security analysis
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(10000);
    });

    it('should handle large codebases efficiently', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        patterns: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should handle large numbers of vulnerabilities without timeout
      expect(body.summary.total).toBeGreaterThanOrEqual(0);
      expect(body.vulnerabilities.length).toBeLessThanOrEqual(10000); // Reasonable limit
    });
  });

  describe('Edge Cases', () => {
    it('should handle codebases with no security issues', async () => {
      const cleanCodebaseId = '550e8400-e29b-41d4-a716-446655440098';
      const validRequest = {
        codebase_id: cleanCodebaseId,
        patterns: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect([200, 404]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.vulnerabilities).toEqual([]);
        expect(body.summary.total).toBe(0);
      }
    });

    it('should handle mixed language codebases', async () => {
      const validRequest = {
        codebase_id: testCodebaseId,
        patterns: ['all'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should handle vulnerabilities across different languages
      if (body.vulnerabilities.length > 0) {
        const fileExtensions = new Set(
          body.vulnerabilities.map((vuln: Vulnerability) => {
            const match = vuln.file_path.match(/\.(\w+)$/);
            return match ? match[1] : '';
          }),
        );

        // Should support multiple file types
        expect(fileExtensions.size).toBeGreaterThanOrEqual(1);
      }
    });

    it('should handle critical severity threshold', async () => {
      const criticalRequest = {
        codebase_id: testCodebaseId,
        patterns: ['all'],
        severity_threshold: 'critical',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/tools/analyze_security',
        payload: criticalRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should only include critical vulnerabilities
      body.vulnerabilities.forEach((vuln: Vulnerability) => {
        expect(vuln.severity).toBe('critical');
      });
    });
  });
});
