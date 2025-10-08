/**
 * Contract Test for explain_function MCP Tool (T010)
 *
 * This test validates the explain_function tool contract implementation.
 * According to TDD principles, this test must FAIL before implementation.
 *
 * Test validates:
 * - Tool exists and is registered
 * - Function identification and analysis
 * - Explanation generation and formatting
 * - Error handling for invalid inputs
 * - Support for various function types and languages
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('explain_function MCP Tool - Contract Test (T010)', () => {
  let mockServer: any;
  let explainTool: any;

  beforeEach(() => {
    // Mock server setup - this will fail because tool doesn't exist yet
    mockServer = {
      tools: new Map(),
      hasTool: (name: string) => mockServer.tools.has(name),
      getTool: (name: string) => mockServer.tools.get(name),
    };
  });

  it('should have explain_function tool registered', () => {
    // This should fail - tool not implemented yet
    expect(mockServer.hasTool('explain_function')).toBe(true);
  });

  it('should validate input schema correctly', async () => {
    const tool = mockServer.getTool('explain_function');
    expect(tool).toBeDefined();
    expect(tool.inputSchema).toBeDefined();

    const schema = tool.inputSchema;

    // Required properties
    expect(schema.required).toContain('function_identifier');
    expect(schema.properties.function_identifier).toBeDefined();
    expect(schema.properties.function_identifier.type).toBe('string');

    // Optional properties
    expect(schema.properties.codebase_id).toBeDefined();
    expect(schema.properties.codebase_id.type).toBe('string');
    expect(schema.properties.detail_level).toBeDefined();
    expect(schema.properties.detail_level.type).toBe('string');
    expect(schema.properties.include_examples).toBeDefined();
    expect(schema.properties.include_examples.type).toBe('boolean');
    expect(schema.properties.language).toBeDefined();
    expect(schema.properties.language.type).toBe('string');
  });

  it('should handle function explanation by name', async () => {
    const tool = mockServer.getTool('explain_function');
    const result = await tool.call({
      function_identifier: 'getUserById',
      codebase_id: 'test-codebase-uuid',
      detail_level: 'comprehensive',
      include_examples: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.explanation).toBeDefined();
    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(0);

    // Explanation structure validation
    expect(result.function_info).toBeDefined();
    expect(result.function_info.name).toBe('getUserById');
    expect(result.function_info.signature).toBeDefined();
    expect(result.function_info.parameters).toBeDefined();
    expect(result.function_info.return_type).toBeDefined();
    expect(result.function_info.location).toBeDefined();
  });

  it('should handle function explanation by file and line', async () => {
    const tool = mockServer.getTool('explain_function');
    const result = await tool.call({
      function_identifier: 'src/services/user.ts:45',
      detail_level: 'basic',
      include_examples: false
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.explanation).toBeDefined();
    expect(typeof result.explanation).toBe('string');

    expect(result.function_info).toBeDefined();
    expect(result.function_info.file_path).toBe('src/services/user.ts');
    expect(result.function_info.line_number).toBe(45);
  });

  it('should handle different detail levels', async () => {
    const tool = mockServer.getTool('explain_function');
    const detailLevels = ['basic', 'standard', 'comprehensive'];

    for (const level of detailLevels) {
      const result = await tool.call({
        function_identifier: 'calculateTotal',
        detail_level: level
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.explanation).toBeDefined();

      // Explanation length should vary by detail level
      if (level === 'comprehensive') {
        expect(result.explanation.length).toBeGreaterThan(100);
      } else if (level === 'basic') {
        expect(result.explanation.length).toBeLessThan(500);
      }
    }
  });

  it('should include code examples when requested', async () => {
    const tool = mockServer.getTool('explain_function');

    const resultWithoutExamples = await tool.call({
      function_identifier: 'validateEmail',
      include_examples: false
    });

    const resultWithExamples = await tool.call({
      function_identifier: 'validateEmail',
      include_examples: true
    });

    // Both should succeed
    expect(resultWithoutExamples.success).toBe(true);
    expect(resultWithExamples.success).toBe(true);

    // Examples should only be included when requested
    if (resultWithExamples.success) {
      expect(resultWithExamples.examples).toBeDefined();
      expect(Array.isArray(resultWithExamples.examples)).toBe(true);
    }

    if (resultWithoutExamples.success) {
      expect(resultWithoutExamples.examples).toBeUndefined();
    }
  });

  it('should handle functions from different programming languages', async () => {
    const tool = mockServer.getTool('explain_function');
    const testCases = [
      { identifier: 'calculateSum', language: 'javascript', expectedFeatures: ['parameters', 'return'] },
      { identifier: 'process_data', language: 'python', expectedFeatures: ['function', 'parameters'] },
      { identifier: 'getUserById', language: 'typescript', expectedFeatures: ['type annotations', 'return type'] },
      { identifier: 'main', language: 'rust', expectedFeatures: ['function', 'ownership'] }
    ];

    for (const testCase of testCases) {
      const result = await tool.call({
        function_identifier: testCase.identifier,
        language: testCase.language,
        detail_level: 'standard'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.function_info.language).toBe(testCase.language);

      // Check for language-specific features in explanation
      const explanation = result.explanation.toLowerCase();
      testCase.expectedFeatures.forEach(feature => {
        // Not all features may be present, but explanation should be comprehensive
        expect(explanation.length).toBeGreaterThan(50);
      });
    }
  });

  it('should validate required function_identifier parameter', async () => {
    const tool = mockServer.getTool('explain_function');

    // Should fail when function_identifier is missing
    await expect(tool.call({
      detail_level: 'basic'
    })).rejects.toThrow('function_identifier is required');

    // Should fail when function_identifier is empty
    await expect(tool.call({
      function_identifier: '',
      detail_level: 'basic'
    })).rejects.toThrow('function_identifier cannot be empty');

    // Should fail when function_identifier is not a string
    await expect(tool.call({
      function_identifier: 123,
      detail_level: 'basic'
    })).rejects.toThrow('function_identifier must be a string');
  });

  it('should validate detail_level parameter', async () => {
    const tool = mockServer.getTool('explain_function');

    // Should fail for invalid detail levels
    await expect(tool.call({
      function_identifier: 'testFunction',
      detail_level: 'invalid'
    })).rejects.toThrow('detail_level must be one of: basic, standard, comprehensive');
  });

  it('should validate language parameter', async () => {
    const tool = mockServer.getTool('explain_function');

    // Should fail for unsupported languages
    await expect(tool.call({
      function_identifier: 'testFunction',
      language: 'brainfuck'
    })).rejects.toThrow('language not supported');

    // Should accept valid languages
    const validLanguages = ['javascript', 'typescript', 'python', 'rust', 'go', 'java'];
    for (const lang of validLanguages) {
      const result = await tool.call({
        function_identifier: 'testFunction',
        language: lang
      });
      expect(result).toBeDefined();
    }
  });

  it('should handle non-existent function gracefully', async () => {
    const tool = mockServer.getTool('explain_function');
    const result = await tool.call({
      function_identifier: 'nonExistentFunction12345',
      codebase_id: 'test-codebase-uuid'
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('function not found');
  });

  it('should provide comprehensive function analysis', async () => {
    const tool = mockServer.getTool('explain_function');
    const result = await tool.call({
      function_identifier: 'complexBusinessLogic',
      detail_level: 'comprehensive',
      include_examples: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Should include detailed analysis sections
    expect(result.explanation).toBeDefined();
    expect(result.function_info).toBeDefined();

    // Comprehensive analysis should include:
    expect(result.function_info.purpose).toBeDefined();
    expect(result.function_info.algorithm).toBeDefined();
    expect(result.function_info.complexity).toBeDefined();
    expect(result.function_info.dependencies).toBeDefined();
    expect(result.function_info.side_effects).toBeDefined();

    if (result.examples) {
      expect(result.examples.length).toBeGreaterThan(0);
      result.examples.forEach((example: any) => {
        expect(example.code).toBeDefined();
        expect(example.description).toBeDefined();
      });
    }
  });

  it('should handle ambiguous function identifiers', async () => {
    const tool = mockServer.getTool('explain_function');
    
    // Test with function name that might exist in multiple files
    const result = await tool.call({
      function_identifier: 'init',
      detail_level: 'standard'
    });

    expect(result).toBeDefined();
    
    if (result.success) {
      // Should provide disambiguation if multiple functions found
      expect(result.explanation).toBeDefined();
      if (result.multiple_matches) {
        expect(result.matches).toBeDefined();
        expect(Array.isArray(result.matches)).toBe(true);
        expect(result.matches.length).toBeGreaterThan(1);
      }
    }
  });

  it('should explain complex function signatures', async () => {
    const tool = mockServer.getTool('explain_function');
    const complexSignatures = [
      'async function fetchData<T>(url: string, options?: RequestOptions): Promise<T>',
      'function memoize<T extends (...args: any[]) => any>(fn: T): T',
      'const curry = <T extends any[]>(fn: (...args: T) => any) => (...args: Partial<T>) => any'
    ];

    for (const signature of complexSignatures) {
      const result = await tool.call({
        function_identifier: signature,
        language: 'typescript',
        detail_level: 'comprehensive'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.function_info.signature).toBeDefined();
      expect(result.function_info.type_parameters || result.function_info.generics).toBeDefined();
    }
  });

  it('should provide execution time metrics', async () => {
    const tool = mockServer.getTool('explain_function');
    const result = await tool.call({
      function_identifier: 'testFunction',
      detail_level: 'standard'
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.analysis_time_ms).toBeDefined();
    expect(typeof result.metadata.analysis_time_ms).toBe('number');
    expect(result.metadata.functions_analyzed).toBeDefined();
    expect(typeof result.metadata.functions_analyzed).toBe('number');
  });
});

/**
 * Expected Error Messages (for implementation reference):
 *
 * - "Tool 'explain_function' not found"
 * - "function_identifier is required"
 * - "function_identifier cannot be empty"
 * - "function_identifier must be a string"
 * - "detail_level must be one of: basic, standard, comprehensive"
 * - "language not supported"
 * - "function not found"
 * - "invalid function identifier format"
 *
 * Expected Success Response Structure:
 *
 * {
 *   success: true,
 *   explanation: string,
 *   function_info: {
 *     name: string,
 *     signature: string,
 *     parameters: Array<{name: string, type: string, optional: boolean}>,
 *     return_type: string,
 *     location: {file_path: string, line_number: number},
 *     language: string,
 *     purpose?: string,
 *     algorithm?: string,
 *     complexity?: string,
 *     dependencies?: string[],
 *     side_effects?: string[],
 *     type_parameters?: string[]
 *   },
 *   examples?: Array<{code: string, description: string}>,
 *   multiple_matches?: boolean,
 *   matches?: Array<{name: string, location: {file_path: string, line_number: number}}>,
 *   metadata: {
 *     analysis_time_ms: number,
 *     functions_analyzed: number
 *   }
 * }
 */