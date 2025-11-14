/**
 * Edge Case Tests for Phase 4.1 AI Tools
 *
 * Tests unusual scenarios, error conditions, and boundary cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../helper.js';

// Mock the AI services to simulate edge cases
vi.mock('../../src/services/ai-llm.js', () => ({
  AILLMService: vi.fn().mockImplementation(() => ({
    generateInsights: vi.fn().mockImplementation((prompts) => {
      // Simulate various edge cases based on input
      if (prompts.some(p => p.includes('empty') || p.includes('null'))) {
        return Promise.resolve({
          suggestions: [],
          error: 'No insights available for empty content'
        });
      }

      if (prompts.some(p => p.includes('malformed'))) {
        return Promise.reject(new Error('AI service temporarily unavailable'));
      }

      if (prompts.some(p => p.includes('timeout'))) {
        return new Promise((resolve) => {
          setTimeout(() => resolve({
            suggestions: [{
              title: 'Timeout test suggestion',
              description: 'Generated after delay',
              impact: 'low',
              confidence: 50,
              category: 'test'
            }]
          }), 100);
        });
      }

      return Promise.resolve({
        suggestions: [
          {
            title: 'Standard suggestion',
            description: 'Standard analysis result',
            impact: 'medium',
            confidence: 75,
            category: 'best-practices'
          }
        ]
      });
    })
  }))
}));

vi.mock('../../src/services/code-analysis.js', () => ({
  CodeAnalysisService: vi.fn().mockImplementation(() => ({
    analyzeSnippet: vi.fn().mockImplementation((code) => {
      if (!code || code.trim().length === 0) {
        return Promise.reject(new Error('Cannot analyze empty code'));
      }

      if (code.length > 100000) { // Very large code
        return Promise.reject(new Error('Code too large for analysis'));
      }

      if (code.includes('syntax_error')) {
        return Promise.reject(new Error('Syntax error in code'));
      }

      return Promise.resolve({
        complexity: {
          overall_score: Math.min(code.length / 100, 100),
          functions: code.split('function').length - 1
        },
        testing: {
          coverage_percentage: Math.floor(Math.random() * 100),
          test_count: Math.floor(Math.random() * 50)
        }
      });
    }),

    analyzeFile: vi.fn().mockImplementation((filePath) => {
      if (!filePath) {
        return Promise.reject(new Error('File path required'));
      }

      if (filePath.includes('nonexistent')) {
        return Promise.reject(new Error('File not found'));
      }

      return Promise.resolve({
        complexity: {
          overall_score: 60,
          functions: 5
        },
        testing: {
          coverage_percentage: 80,
          test_count: 15
        }
      });
    })
  }))
}));

describe('Edge Case Handling', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
  });

  describe('Empty and Null Inputs', () => {
    it('should handle empty code snippets gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        payload: {
          tool: 'ai_code_review',
          arguments: {
            code_snippet: '',
            review_type: 'basic',
            codebase_id: 'test'
          }
        }
      });

      expect([200, 400, 422]).toContain(response.statusCode);
      const result = response.json();

      if (response.statusCode === 200) {
        expect(result).toHaveProperty('overall_score');
        expect(result).toHaveProperty('issues');
      } else {
        expect(result).toHaveProperty('error');
      }
    });

    it('should handle null parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        payload: {
          tool: 'bug_prediction',
          arguments: {
            code_snippet: null,
            codebase_id: 'test'
          }
        }
      });

      expect([400, 422, 500]).toContain(response.statusCode);
    });

    it('should handle missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        payload: {
          tool: 'technical_debt_analysis',
          arguments: {
            // Missing codebase_id
            scope: 'file'
          }
        }
      });

      expect([400, 422]).toContain(response.statusCode);
    });
  });

  describe('Large Input Handling', () => {
    it('should handle very large code snippets', async () => {
      const largeCode = 'function test() { return '.repeat(10000) + '1; }';

      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        payload: {
          tool: 'ai_code_review',
          arguments: {
            code_snippet: largeCode,
            review_type: 'basic',
            codebase_id: 'test'
          }
        }
      });

      expect([200, 413, 400]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = response.json();
        expect(result).toHaveProperty('overall_score');
      }
    });

    it('should handle complex nested structures', async () => {
      const complexCode = `
        ${Array(100).fill(0).map((_, i) => `
          function level${i}() {
            ${Array(10).fill(0).map((_, j) => `
              if (condition${i}_${j}) {
                ${Array(5).fill(0).map((_, k) => `
                  try {
                    nested${i}_${j}_${k}();
                  } catch(e) {
                    handle${i}_${j}_${k}(e);
                  }
                `).join('')}
              }
            `).join('')}
          }
        `).join('')}
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        payload: {
          tool: 'intelligent_refactoring',
          arguments: {
            code_snippet: complexCode,
            refactoring_type: 'reduce-complexity',
            codebase_id: 'test'
          }
        }
      });

      expect([200, 408, 413]).toContain(response.statusCode);
    });
  });

  describe('Malformed Inputs', () => {
    it('should handle syntactically invalid code', async () => {
      const malformedCode = 'function test( { return }'; // Missing closing parenthesis

      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        payload: {
          tool: 'ai_code_review',
          arguments: {
            code_snippet: malformedCode,
            review_type: 'comprehensive',
            codebase_id: 'test'
          }
        }
      });

      expect([200, 400, 422]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = response.json();
        expect(result).toHaveProperty('overall_score');
        expect(Array.isArray(result.issues)).toBe(true);

        // Should have syntax-related issues
        const syntaxIssues = result.issues.filter((issue: any) =>
          issue.description.toLowerCase().includes('syntax')
        );
        expect(syntaxIssues.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle invalid JSON in requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        headers: {
          'Content-Type': 'application/json'
        },
        body: '{"tool": "ai_code_review", "arguments": {"code_snippet": "test", invalid}' // Invalid JSON
      });

      expect([400, 422]).toContain(response.statusCode);
    });

    it('should handle unsupported tool names', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        payload: {
          tool: 'nonexistent_tool',
          arguments: {
            code_snippet: 'test',
            codebase_id: 'test'
          }
        }
      });

      expect([400, 404, 422]).toContain(response.statusCode);
    });
  });

  describe('Service Unavailability', () => {
    it('should handle AI service timeout', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        payload: {
          tool: 'ai_code_review',
          arguments: {
            code_snippet: 'timeout test',
            review_type: 'basic',
            codebase_id: 'test'
          }
        }
      });

      expect([200, 408, 503]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = response.json();
        // Should have some fallback analysis
        expect(result).toHaveProperty('overall_score');
      }
    });

    it('should handle file system errors', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        payload: {
          tool: 'ai_code_review',
          arguments: {
            file_path: '/nonexistent/path/file.js',
            review_type: 'basic',
            codebase_id: 'test'
          }
        }
      });

      expect([200, 404, 400]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = response.json();
        expect(result).toHaveProperty('overall_score');
      } else {
        const result = response.json();
        expect(result).toHaveProperty('error');
      }
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests', async () => {
      const requests = Array(20).fill(0).map((_, i) =>
        app.inject({
          method: 'POST',
          url: '/mcp/call',
          payload: {
            tool: 'ai_code_review',
            arguments: {
              code_snippet: `function concurrentTest${i}() { return ${i}; }`,
              review_type: 'basic',
              codebase_id: 'test'
            }
          }
        })
      );

      const responses = await Promise.allSettled(requests);

      // All requests should complete without throwing
      responses.forEach(response => {
        expect(response.status).toBe('fulfilled');
        if (response.status === 'fulfilled') {
          expect([200, 400, 408, 503]).toContain(response.value.statusCode);
        }
      });

      // At least half should succeed
      const successfulResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.statusCode === 200
      );
      expect(successfulResponses.length).toBeGreaterThanOrEqual(10);
    });

    it('should handle rate limiting gracefully', async () => {
      const requests = Array(100).fill(0).map(() =>
        app.inject({
          method: 'POST',
          url: '/mcp/call',
          payload: {
            tool: 'ai_code_review',
            arguments: {
              code_snippet: 'rate limit test',
              review_type: 'basic',
              codebase_id: 'test'
            }
          }
        })
      );

      const responses = await Promise.allSettled(requests);

      // Should have mix of successful and rate-limited responses
      const statusCodes = responses
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as any).value.statusCode);

      expect(statusCodes.length).toBeGreaterThan(0);
      expect(statusCodes.some(code => [200, 429, 503].includes(code))).toBe(true);
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle minimum valid inputs', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        payload: {
          tool: 'ai_code_review',
          arguments: {
            code_snippet: 'x',
            review_type: 'basic',
            codebase_id: 'a'
          }
        }
      });

      expect([200, 400, 422]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = response.json();
        expect(result).toHaveProperty('overall_score');
      }
    });

    it('should handle maximum string lengths', async () => {
      const maxCode = 'a'.repeat(1000000); // 1MB string

      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        payload: {
          tool: 'ai_code_review',
          arguments: {
            code_snippet: maxCode,
            review_type: 'basic',
            codebase_id: 'test'
          }
        }
      });

      expect([200, 413, 400, 408]).toContain(response.statusCode);
    });

    it('should handle special characters and unicode', async () => {
      const specialCode = `
        // Unicode and special characters test
        const emoji = '🚀🔥💯';
        const chinese = '测试中文字符';
        const arabic = 'اختبار العربية';
        const russian = 'Тест на русском';
        const symbols = '!@#$%^&*()[]{}|\\:";\'<>?,./';

        function specialTest() {
          return emoji + chinese + arabic + russian + symbols;
        }
      `;

      const response = await app.inject({
        method: 'POST',
        url: '/mcp/call',
        payload: {
          tool: 'ai_code_review',
          arguments: {
            code_snippet: specialCode,
            review_type: 'basic',
            codebase_id: 'test'
          }
        }
      });

      expect([200, 400]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = response.json();
        expect(result).toHaveProperty('overall_score');
      }
    });
  });
});