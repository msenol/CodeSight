/**
 * Contract Test for find_references MCP Tool (T011)
 *
 * This test validates the find_references tool contract implementation.
 * According to TDD principles, this test must FAIL before implementation.
 *
 * Test validates:
 * - Tool exists and is registered
 * - Reference finding and analysis
 * - Reference categorization (read/write/call)
 * - Cross-file reference tracking
 * - Error handling for invalid inputs
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('find_references MCP Tool - Contract Test (T011)', () => {
  let mockServer: any;
  let findReferencesTool: any;

  beforeEach(() => {
    // Mock server setup - this will fail because tool doesn't exist yet
    mockServer = {
      tools: new Map(),
      hasTool: (name: string) => mockServer.tools.has(name),
      getTool: (name: string) => mockServer.tools.get(name),
    };
  });

  it('should have find_references tool registered', () => {
    // This should fail - tool not implemented yet
    expect(mockServer.hasTool('find_references')).toBe(true);
  });

  it('should validate input schema correctly', async () => {
    const tool = mockServer.getTool('find_references');
    expect(tool).toBeDefined();
    expect(tool.inputSchema).toBeDefined();

    const schema = tool.inputSchema;

    // Required properties
    expect(schema.required).toContain('target_identifier');
    expect(schema.properties.target_identifier).toBeDefined();
    expect(schema.properties.target_identifier.type).toBe('string');

    // Optional properties
    expect(schema.properties.codebase_id).toBeDefined();
    expect(schema.properties.codebase_id.type).toBe('string');
    expect(schema.properties.reference_types).toBeDefined();
    expect(schema.properties.reference_types.type).toBe('array');
    expect(schema.properties.include_declarations).toBeDefined();
    expect(schema.properties.include_declarations.type).toBe('boolean');
    expect(schema.properties.max_results).toBeDefined();
    expect(schema.properties.max_results.type).toBe('number');
    expect(schema.properties.file_patterns).toBeDefined();
    expect(schema.properties.file_patterns.type).toBe('array');
  });

  it('should find function references', async () => {
    const tool = mockServer.getTool('find_references');
    const result = await tool.call({
      target_identifier: 'getUserById',
      codebase_id: 'test-codebase-uuid',
      include_declarations: true,
      max_results: 20
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.references).toBeDefined();
    expect(Array.isArray(result.references)).toBe(true);

    // Target info should be included
    expect(result.target_info).toBeDefined();
    expect(result.target_info.name).toBe('getUserById');
    expect(result.target_info.type).toBeDefined();

    if (result.references.length > 0) {
      const firstRef = result.references[0];
      expect(firstRef.file_path).toBeDefined();
      expect(firstRef.line_number).toBeDefined();
      expect(firstRef.reference_type).toBeDefined();
      expect(firstRef.context).toBeDefined();
      expect(typeof firstRef.context).toBe('string');
    }
  });

  it('should find variable references', async () => {
    const tool = mockServer.getTool('find_references');
    const result = await tool.call({
      target_identifier: 'currentUser',
      reference_types: ['read', 'write'],
      include_declarations: false
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.references).toBeDefined();

    // Should only include read/write references, no declarations
    expect(result.references.every((ref: any) => 
      ['read', 'write'].includes(ref.reference_type)
    )).toBe(true);
  });

  it('should find class/type references', async () => {
    const tool = mockServer.getTool('find_references');
    const result = await tool.call({
      target_identifier: 'UserService',
      reference_types: ['instantiation', 'inheritance', 'import'],
      max_results: 15
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.references.length > 0) {
      result.references.forEach((ref: any) => {
        expect(['instantiation', 'inheritance', 'import'].includes(ref.reference_type)).toBe(true);
      });
    }
  });

  it('should handle different reference types', async () => {
    const tool = mockServer.getTool('find_references');
    const referenceTypes = ['read', 'write', 'call', 'declaration', 'import', 'instantiation', 'inheritance'];

    for (const refType of referenceTypes) {
      const result = await tool.call({
        target_identifier: 'testTarget',
        reference_types: [refType]
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      if (result.references.length > 0) {
        expect(result.references.every((ref: any) => ref.reference_type === refType)).toBe(true);
      }
    }
  });

  it('should include or exclude declarations based on parameter', async () => {
    const tool = mockServer.getTool('find_references');

    const resultWithDeclarations = await tool.call({
      target_identifier: 'CONFIG',
      include_declarations: true
    });

    const resultWithoutDeclarations = await tool.call({
      target_identifier: 'CONFIG',
      include_declarations: false
    });

    // Both should succeed
    expect(resultWithDeclarations.success).toBe(true);
    expect(resultWithoutDeclarations.success).toBe(true);

    // With declarations should have more or equal references
    expect(resultWithDeclarations.references.length).toBeGreaterThanOrEqual(
      resultWithoutDeclarations.references.length
    );

    // Check that declarations are properly categorized
    if (resultWithDeclarations.references.length > 0) {
      const hasDeclarations = resultWithDeclarations.references.some((ref: any) => 
        ref.reference_type === 'declaration'
      );
      expect(hasDeclarations).toBe(true);
    }

    if (resultWithoutDeclarations.references.length > 0) {
      const hasDeclarations = resultWithoutDeclarations.references.some((ref: any) => 
        ref.reference_type === 'declaration'
      );
      expect(hasDeclarations).toBe(false);
    }
  });

  it('should respect max_results parameter', async () => {
    const tool = mockServer.getTool('find_references');
    const maxResults = 10;

    const result = await tool.call({
      target_identifier: 'commonlyUsedFunction',
      max_results: maxResults
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.references.length).toBeLessThanOrEqual(maxResults);
  });

  it('should filter by file patterns', async () => {
    const tool = mockServer.getTool('find_references');

    const resultWithPattern = await tool.call({
      target_identifier: 'apiFunction',
      file_patterns: ['src/api/**/*.ts', 'src/services/**/*.ts']
    });

    const resultWithoutPattern = await tool.call({
      target_identifier: 'apiFunction'
    });

    expect(resultWithPattern.success).toBe(true);
    expect(resultWithoutPattern.success).toBe(true);

    // Results with pattern should only match specified files
    if (resultWithPattern.references.length > 0) {
      resultWithPattern.references.forEach((ref: any) => {
        expect(ref.file_path).toMatch(/^\/?(src\/api|src\/services)/);
      });
    }
  });

  it('should provide context for each reference', async () => {
    const tool = mockServer.getTool('find_references');
    const result = await tool.call({
      target_identifier: 'processData',
      include_declarations: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.references.length > 0) {
      result.references.forEach((ref: any) => {
        // Should include context lines
        expect(ref.context).toBeDefined();
        expect(typeof ref.context).toBe('string');
        expect(ref.context.length).toBeGreaterThan(0);

        // Should include target in context (highlighted)
        expect(ref.context.toLowerCase()).toContain(
          ref.target_name?.toLowerCase() || 'processData'.toLowerCase()
        );

        // Should include line and column information
        expect(ref.line_number).toBeDefined();
        expect(typeof ref.line_number).toBe('number');
        expect(ref.column_number).toBeDefined();
        expect(typeof ref.column_number).toBe('number');
      });
    }
  });

  it('should handle cross-file references', async () => {
    const tool = mockServer.getTool('find_references');
    const result = await tool.call({
      target_identifier: 'exportedFunction',
      include_declarations: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.references.length > 1) {
      const files = result.references.map((ref: any) => ref.file_path);
      const uniqueFiles = [...new Set(files)];
      
      // Should have references from multiple files
      expect(uniqueFiles.length).toBeGreaterThan(1);

      // Should include declaration file
      const declarationRefs = result.references.filter((ref: any) => 
        ref.reference_type === 'declaration'
      );
      expect(declarationRefs.length).toBeGreaterThan(0);
    }
  });

  it('should validate required target_identifier parameter', async () => {
    const tool = mockServer.getTool('find_references');

    // Should fail when target_identifier is missing
    await expect(tool.call({
      max_results: 10
    })).rejects.toThrow('target_identifier is required');

    // Should fail when target_identifier is empty
    await expect(tool.call({
      target_identifier: '',
      max_results: 10
    })).rejects.toThrow('target_identifier cannot be empty');

    // Should fail when target_identifier is not a string
    await expect(tool.call({
      target_identifier: 123,
      max_results: 10
    })).rejects.toThrow('target_identifier must be a string');
  });

  it('should validate reference_types parameter', async () => {
    const tool = mockServer.getTool('find_references');

    // Should fail for invalid reference types
    await expect(tool.call({
      target_identifier: 'test',
      reference_types: ['invalid_type']
    })).rejects.toThrow('invalid reference type: invalid_type');

    // Should fail when reference_types is not an array
    await expect(tool.call({
      target_identifier: 'test',
      reference_types: 'not_array'
    })).rejects.toThrow('reference_types must be an array');
  });

  it('should validate file_patterns parameter', async () => {
    const tool = mockServer.getTool('find_references');

    // Should fail for invalid file patterns
    await expect(tool.call({
      target_identifier: 'test',
      file_patterns: ['invalid[pattern']
    })).rejects.toThrow('invalid file pattern');

    // Should accept valid glob patterns
    const validPatterns = ['src/**/*.ts', 'test/*.spec.js', '**/*.tsx'];
    for (const pattern of validPatterns) {
      const result = await tool.call({
        target_identifier: 'test',
        file_patterns: [pattern]
      });
      expect(result).toBeDefined();
    }
  });

  it('should handle non-existent target gracefully', async () => {
    const tool = mockServer.getTool('find_references');
    const result = await tool.call({
      target_identifier: 'nonExistentIdentifier12345',
      codebase_id: 'test-codebase-uuid'
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true); // Should still succeed but with empty results
    expect(result.references).toEqual([]);
    expect(result.metadata.total_references).toBe(0);
  });

  it('should categorize references by type and usage', async () => {
    const tool = mockServer.getTool('find_references');
    const result = await tool.call({
      target_identifier: 'dataProcessor',
      include_declarations: true
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.references.length > 0) {
      // Should have reference type distribution
      expect(result.summary).toBeDefined();
      expect(result.summary.by_type).toBeDefined();
      expect(result.summary.by_file).toBeDefined();

      // Each reference should have proper categorization
      result.references.forEach((ref: any) => {
        expect(ref.reference_type).toBeDefined();
        expect(['read', 'write', 'call', 'declaration', 'import', 'instantiation', 'inheritance'])
          .toContain(ref.reference_type);
        
        // Should have confidence score for automated categorization
        expect(ref.confidence).toBeDefined();
        expect(typeof ref.confidence).toBe('number');
        expect(ref.confidence).toBeGreaterThanOrEqual(0);
        expect(ref.confidence).toBeLessThanOrEqual(1);
      });
    }
  });

  it('should provide execution metrics and summary', async () => {
    const tool = mockServer.getTool('find_references');
    const result = await tool.call({
      target_identifier: 'analyzePerformance',
      max_results: 50
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();

    // Should include performance metrics
    expect(result.metadata.search_time_ms).toBeDefined();
    expect(typeof result.metadata.search_time_ms).toBe('number');
    expect(result.metadata.files_searched).toBeDefined();
    expect(typeof result.metadata.files_searched).toBe('number');
    expect(result.metadata.total_references).toBeDefined();
    expect(typeof result.metadata.total_references).toBe('number');

    // Should include summary statistics
    expect(result.summary.total_references).toBe(result.metadata.total_references);
    expect(result.summary.unique_files).toBeDefined();
    expect(result.summary.reference_types).toBeDefined();
  });

  it('should handle ambiguous target identifiers', async () => {
    const tool = mockServer.getTool('find_references');
    
    // Test with identifier that might exist in multiple contexts
    const result = await tool.call({
      target_identifier: 'init'
    });

    expect(result).toBeDefined();
    
    if (result.success) {
      // Should provide disambiguation if multiple targets found
      if (result.multiple_targets) {
        expect(result.targets).toBeDefined();
        expect(Array.isArray(result.targets)).toBe(true);
        expect(result.targets.length).toBeGreaterThan(1);
        
        result.targets.forEach((target: any) => {
          expect(target.name).toBeDefined();
          expect(target.type).toBeDefined();
          expect(target.location).toBeDefined();
          expect(target.preview).toBeDefined();
        });
      }
    }
  });
});

/**
 * Expected Error Messages (for implementation reference):
 *
 * - "Tool 'find_references' not found"
 * - "target_identifier is required"
 * - "target_identifier cannot be empty"
 * - "target_identifier must be a string"
 * - "invalid reference type: {type}"
 * - "reference_types must be an array"
 * - "invalid file pattern: {pattern}"
 * - "max_results must be a positive integer"
 *
 * Expected Success Response Structure:
 *
 * {
 *   success: true,
 *   target_info: {
 *     name: string,
 *     type: string,
 *     location: {file_path: string, line_number: number}
 *   },
 *   references: Array<{
 *     file_path: string,
 *     line_number: number,
 *     column_number: number,
 *     reference_type: 'read' | 'write' | 'call' | 'declaration' | 'import' | 'instantiation' | 'inheritance',
 *     context: string,
 *     target_name: string,
 *     confidence: number
 *   }>,
 *   multiple_targets?: boolean,
 *   targets?: Array<{name: string, type: string, location: object, preview: string}>,
 *   summary: {
 *     total_references: number,
 *     unique_files: number,
 *     reference_types: Record<string, number>,
 *     by_type: Record<string, number>,
 *     by_file: Record<string, number>
 *   },
 *   metadata: {
 *     search_time_ms: number,
 *     files_searched: number,
 *     total_references: number
 *   }
 * }
 */