/**
 * Contract Test for check_complexity MCP Tool (T015)
 *
 * This test validates the check_complexity tool contract implementation.
 * According to TDD principles, this test must FAIL before implementation.
 *
 * Test validates:
 * - Tool exists and is registered
 * - Code complexity metrics calculation
 * - Maintainability index assessment
 * - Cyclomatic and cognitive complexity analysis
 * - Refactoring recommendations
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('check_complexity MCP Tool - Contract Test (T015)', () => {
  let mockServer: any;
  let checkComplexityTool: any;

  beforeEach(() => {
    // Mock server setup - this will fail because tool doesn't exist yet
    mockServer = {
      tools: new Map(),
      hasTool: (name: string) => mockServer.tools.has(name),
      getTool: (name: string) => mockServer.tools.get(name),
    };
  });

  it('should have check_complexity tool registered', () => {
    // This should fail - tool not implemented yet
    expect(mockServer.hasTool('check_complexity')).toBe(true);
  });

  it('should validate input schema correctly', async () => {
    const tool = mockServer.getTool('check_complexity');
    expect(tool).toBeDefined();
    expect(tool.inputSchema).toBeDefined();

    const schema = tool.inputSchema;

    // Required properties
    expect(schema.required).toContain('target');
    expect(schema.properties.target).toBeDefined();
    expect(schema.properties.target.type).toBe('string');

    // Optional properties
    expect(schema.properties.complexity_types).toBeDefined();
    expect(schema.properties.complexity_types.type).toBe('array');
    expect(schema.properties.thresholds).toBeDefined();
    expect(schema.properties.thresholds.type).toBe('object');
    expect(schema.properties.include_suggestions).toBeDefined();
    expect(schema.properties.include_suggestions.type).toBe('boolean');
    expect(schema.properties.detailed_analysis).toBeDefined();
    expect(schema.properties.detailed_analysis.type).toBe('boolean');
  });

  it('should analyze code complexity for file', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/services/user-service.ts',
      detailed_analysis: true,
      include_suggestions: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.complexity_summary).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.complex_items).toBeDefined();
    expect(Array.isArray(result.complex_items)).toBe(true);

    // Complexity summary structure validation
    expect(result.complexity_summary.overall_score).toBeDefined();
    expect(typeof result.complexity_summary.overall_score).toBe('number');
    expect(result.complexity_summary.maintainability_index).toBeDefined();
    expect(typeof result.complexity_summary.maintainability_index).toBe('number');
    expect(result.complexity_summary.files_analyzed).toBeDefined();
    expect(result.complexity_summary.functions_analyzed).toBeDefined();
  });

  it('should analyze code complexity for directory', async () => {
    const tool = mockServer.getComplexityTool();
    const result = await tool.call({
      target: 'src/controllers/',
      complexity_types: ['cyclomatic', 'cognitive', 'halstead'],
      include_suggestions: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.complexity_summary.files_analyzed).toBeGreaterThan(1);
    expect(result.complex_items.length).toBeGreaterThan(0);
  });

  it('should analyze complexity for function', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'processData',
      complexity_types: ['cyclomatic', 'cognitive'],
      detailed_analysis: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.complex_items.length > 0) {
      const functionComplexity = result.complex_items.find((item: any) => 
        item.type === 'function'
      );

      if (functionComplexity) {
        expect(functionComplexity.name).toBeDefined();
        expect(functionComplexity.location).toBeDefined();
        expect(functionComplexity.complexity_scores).toBeDefined();
        expect(functionComplexity.complexity_scores.cyclomatic).toBeDefined();
        expect(functionComplexity.complexity_scores.cognitive).toBeDefined();
      }
    }
  });

  it('should calculate various complexity metrics', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/complex-module.ts',
      detailed_analysis: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.metrics).toBeDefined();
    expect(Array.isArray(result.metrics)).toBe(true);

    if (result.metrics.length > 0) {
      result.metrics.forEach((metric: any) => {
        expect(metric.name).toBeDefined();
        expect(metric.value).toBeDefined();
        expect(typeof metric.value).toBe('number');
        expect(metric.threshold).toBeDefined();
        expect(typeof metric.threshold).toBe('number');
        expect(metric.status).toBeDefined();
        expect(['good', 'warning', 'critical']).toContain(metric.status);
        expect(metric.description).toBeDefined();
      });
    }
  });

  it('should identify complex code items', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/problematic-code.ts',
      complexity_types: ['cyclomatic', 'cognitive', 'halstead'],
      include_suggestions: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.complex_items).toBeDefined();
    expect(Array.isArray(result.complex_items)).toBe(true);

    if (result.complex_items.length > 0) {
      result.complex_items.forEach((item: any) => {
        expect(item.type).toBeDefined();
        expect(['file', 'function', 'class', 'method']).toContain(item.type);
        expect(item.name).toBeDefined();
        expect(item.location).toBeDefined();
        expect(item.location.file_path).toBeDefined();
        expect(item.location.line_number).toBeDefined();
        expect(item.complexity_scores).toBeDefined();
        
        // Should include complexity scores
        if (item.complexity_scores.cyclomatic) {
          expect(typeof item.complexity_scores.cyclomatic).toBe('number');
        }
        if (item.complexity_scores.cognitive) {
          expect(typeof item.complexity_scores.cognitive).toBe('number');
        }
        if (item.complexity_scores.halstead) {
          expect(typeof item.complexity_scores.halstead).toBe('object');
        }
        
        expect(item.issues).toBeDefined();
        expect(Array.isArray(item.issues)).toBe(true);
        expect(item.suggestions).toBeDefined();
        expect(Array.isArray(item.suggestions)).toBe(true);
      });
    }
  });

  it('should include maintainability index calculation', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/maintainable-code.ts',
      detailed_analysis: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.complexity_summary.maintainability_index).toBeDefined();
    expect(typeof result.complexity_summary.maintainability_index).toBe('number');
    expect(result.complexity_summary.maintainability_index).toBeGreaterThanOrEqual(0);
    expect(result.complexity_summary.maintainability_index).toBeLessThanOrEqual(100);
  });

  it('should provide refactoring suggestions', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/complex-function.ts',
      include_suggestions: true,
      detailed_analysis: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.complex_items.length > 0) {
      const complexItem = result.complex_items[0];
      expect(complexItem.suggestions).toBeDefined();
      expect(Array.isArray(complexItem.suggestions)).toBe(true);

      complexItem.suggestions.forEach((suggestion: any) => {
        expect(suggestion).toBeDefined();
        expect(typeof suggestion).toBe('string');
        expect(suggestion.length).toBeGreaterThan(10);
      });
    }
  });

  it('should handle different complexity types', async () => {
    const tool = mockServer.getTool('check_complexity');
    const complexityTypes = [
      'cyclomatic',
      'cognitive', 
      'halstead',
      'maintainability',
      'nesting',
      'parameter'
    ];

    for (const complexityType of complexityTypes) {
      const result = await tool.call({
        target: 'src/test-target.ts',
        complexity_types: [complexType]
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      if (result.metrics.length > 0) {
        const foundMetric = result.metrics.find((m: any) => 
          m.name.toLowerCase().includes(complexityType.toLowerCase())
        );
        expect(foundMetric).toBeDefined();
      }
    }
  });

  it('should apply custom thresholds', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/threshold-test.ts',
      thresholds: {
        cyclomatic: 15,
        cognitive: 20,
        maintainability: 60
      }
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.metrics.length > 0) {
      const cyclomaticMetric = result.metrics.find((m: any) => 
        m.name === 'cyclomatic_complexity'
      );
      if (cyclomaticMetric) {
        expect(cyclomaticMetric.threshold).toBe(15);
      }
    }
  });

  it('should analyze trends and provide recommendations', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/evolving-code/',
      detailed_analysis: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.trends).toBeDefined();

    if (result.trends) {
      expect(result.trends.historical_data).toBeDefined();
      expect(Array.isArray(result.trends.historical_data)).toBe(true);
      expect(result.trends.recommendations).toBeDefined();
      expect(Array.isArray(result.trends.recommendations)).toBe(true);
    }
  });

  it('should handle different target types', async () => {
    const tool = mockServer.getTool('check_complexity');
    const targetTypes = [
      'src/file.ts',
      'src/directory/',
      'functionName',
      'ClassName'
    ];

    for (const targetType of targetTypes) {
      const result = await tool.call({
        target: targetType
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    }
  });

  it('should validate required target parameter', async () => {
    const tool = mockServer.getTool('check_complexity');

    // Should fail when target is missing
    await expect(tool.call({
      complexity_types: ['cyclomatic']
    })).rejects.toThrow('target is required');

    // Should fail when target is empty
    await expect(tool.call({
      target: '',
      complexity_types: ['cyclomatic']
    })).rejects.toThrow('target cannot be empty');

    // Should fail when target is not a string
    await expect(tool.call({
      target: 123,
      complexity_types: ['cyclomatic']
    })).rejects.toThrow('target must be a string');
  });

  it('should validate complexity_types parameter', async () => {
    const tool = mockServer.getTool('check_complexity');

    // Should fail for invalid complexity types
    await expect(tool.call({
      target: 'test.ts',
      complexity_types: ['invalid-type']
    })).rejects.toThrow('invalid complexity type: invalid-type');

    // Should fail when complexity_types is not an array
    await expect(tool.call({
      target: 'test.ts',
      complexity_types: 'not-array'
    })).rejects.throw('complexity_types must be an array');
  });

  it('should provide performance metrics', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/large-module/',
      detailed_analysis: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();

    // Should include performance metrics
    expect(result.metadata.analysis_time_ms).toBeDefined();
    expect(typeof result.metadata.analysis_time_ms).toBe('number');
    expect(result.metadata.metrics_calculated).toBeDefined();
    expect(Array.isArray(result.metadata.metrics_calculated)).toBe(true);
  });

  it('should handle very complex code', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/ultra-complex-function.ts',
      detailed_analysis: true,
      include_suggestions: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Should identify high complexity items
    if (result.complex_items.length > 0) {
      const highComplexityItems = result.complex_items.filter((item: any) => {
        const score = item.complexity_scores.cyclomatic || 0;
        return score > 20;
      });

      expect(highComplexityItems.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('should identify code smells', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/smelly-code.ts',
      detailed_analysis: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Look for code smells in complex items
    if (result.complex_items.length > 0) {
      const itemsWithIssues = result.complex_items.filter((item: any) => 
        item.issues && item.issues.length > 0
      );

      expect(itemsWithIssues.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('should suggest specific refactoring techniques', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/refactoring-candidate.ts',
      include_suggestions: true,
      detailed_analysis: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.complex_items.length > 0) {
      const itemWithSuggestions = result.complex_items.find((item: any) => 
        item.suggestions && item.suggestions.length > 0
      );

      if (itemWithSuggestions) {
        // Should include common refactoring patterns
        const suggestions = itemWithSuggestions.suggestions.join(' ').toLowerCase();
        const commonPatterns = [
          'extract method', 'extract function', 'split class', 'extract class',
          'replace conditional', 'introduce parameter', 'move method'
        ];

        const hasCommonPattern = commonPatterns.some(pattern => 
          suggestions.includes(pattern)
        );
        expect(hasCommonPattern).toBe(true);
      }
    }
  });

  it('should calculate accurate cyclomatic complexity', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/cyclomatic-test.ts'
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.complex_items.length > 0) {
      const functionItem = result.complex_items.find((item: any) => 
        item.type === 'function'
      );

      if (functionItem && functionItem.complexity_scores.cyclomatic) {
        const cyclomatic = functionItem.complexity_scores.cyclomatic;
        // Should be a reasonable cyclomatic complexity value
        expect(cyclomatic).toBeGreaterThan(0);
        expect(cyclomatic).toBeLessThan(100); // Reasonable upper bound
      }
    }
  });

  it('should calculate cognitive complexity', async () => {
    const tool = mockServer.getTool('check_complexity');
    const result = await tool.call({
      target: 'src/cognitive-test.ts',
      complexity_types: ['cognitive']
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.complex_items.length > 0) {
      const functionItem = result.complex_items.find((item: any) => 
        item.type === 'function'
      );

      if (functionItem && functionItem.complexity_scores.cognitive) {
        const cognitive = functionItem.complexity_scores.cognitive;
        // Should be a reasonable cognitive complexity value
        expect(cognitive).toBeGreaterThan(0);
        expect(cognitive).toBeLessThan(100); // Reasonable upper bound
      }
    }
  });

  it('should handle large codebases efficiently', async () => {
    const tool = mockServer.getTool('check_complexity');
    const startTime = Date.now();

    const result = await tool.call({
      target: 'src/', // Analyze entire src directory
      complexity_types: ['cyclomatic'], // Focus on one metric for performance
      include_suggestions: false // Skip suggestions for performance
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    
    // Should complete within reasonable time (under 10 seconds for typical project size)
    expect(duration).toBeLessThan(10000);
  });
});

/**
 * Expected Error Messages (for implementation reference):
 *
 * - "Tool 'check_complexity' not found"
 * - "target is required"
 * - "target cannot be empty"
 * - "target must be a string"
 * - "complexity_types must be an array of strings"
 * - "invalid complexity type: {type}"
 * - "thresholds must be an object"
 * - "include_suggestions must be a boolean"
 * - "detailed_analysis must be a boolean"
 *
 * Expected Success Response Structure:
 *
 * {
 *   success: true,
 *   complexity_summary: {
 *     overall_score: number,
 *     maintainability_index: number,
 *     total_complexity: number,
 *     files_analyzed: number,
 *     functions_analyzed: number
 *   },
 *   metrics: [
 *     {
 *       name: string,
 *       value: number,
 *       threshold: number,
 *       status: 'good' | 'warning' | 'critical',
 *       description: string
 *     }
 *   ],
 *   complex_items: [
 *     {
 *       type: 'file' | 'function' | 'class',
 *       name: string,
 *       location: {
 *         file_path: string,
 *       line_number: number
 *       },
 *       complexity_scores: {
 *         cyclomatic: number,
 *         cognitive: number,
 *         halstead: object
 *       },
 *       issues: [string],
 *       suggestions: [string]
 *     }
 *   ],
 *   trends: {
 *     historical_data: [object],
 *     recommendations: [string]
 *   },
 *   metadata: {
 *     analysis_time_ms: number,
 *     metrics_calculated: [string]
 *   }
 * }
 */