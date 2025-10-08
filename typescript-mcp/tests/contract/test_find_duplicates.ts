/**
 * Contract Test for find_duplicates MCP Tool (T016)
 *
 * This test validates the find_duplicates tool contract implementation.
 * According to TDD principles, this test must FAIL before implementation.
 *
 * Test validates:
 * - Tool exists and is registered
 * - Duplicate code detection and analysis
 * - Similarity scoring and threshold handling
 * - File-level and function-level duplicate detection
 * - Cross-language duplicate detection capabilities
 * - Performance optimization for large codebases
 * - Error handling for invalid inputs
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('find_duplicates MCP Tool - Contract Test (T016)', () => {
  let mockServer: any;
  let findDuplicatesTool: any;

  beforeEach(() => {
    // Mock server setup - this will fail because tool doesn't exist yet
    mockServer = {
      tools: new Map(),
      hasTool: (name: string) => mockServer.tools.has(name),
      getTool: (name: string) => mockServer.tools.get(name),
    };
  });

  it('should have find_duplicates tool registered', () => {
    // This should fail - tool not implemented yet
    expect(mockServer.hasTool('find_duplicates')).toBe(true);
  });

  it('should validate input schema correctly', async () => {
    const tool = mockServer.getTool('find_duplicates');
    expect(tool).toBeDefined();
    expect(tool.inputSchema).toBeDefined();

    const schema = tool.inputSchema;

    // Optional properties (all are optional for flexible usage)
    expect(schema.properties.codebase_id).toBeDefined();
    expect(schema.properties.codebase_id.type).toBe('string');

    expect(schema.properties.similarity_threshold).toBeDefined();
    expect(schema.properties.similarity_threshold.type).toBe('number');

    expect(schema.properties.min_lines).toBeDefined();
    expect(schema.properties.min_lines.type).toBe('number');

    expect(schema.properties.max_results).toBeDefined();
    expect(schema.properties.max_results.type).toBe('number');

    expect(schema.properties.file_types).toBeDefined();
    expect(schema.properties.file_types.type).toBe('array');

    expect(schema.properties.ignore_whitespace).toBeDefined();
    expect(schema.properties.ignore_whitespace.type).toBe('boolean');

    expect(schema.properties.ignore_comments).toBeDefined();
    expect(schema.properties.ignore_comments.type).toBe('boolean');

    expect(schema.properties.detection_mode).toBeDefined();
    expect(schema.properties.detection_mode.type).toBe('string');

    expect(schema.properties.include_tests).toBeDefined();
    expect(schema.properties.include_tests.type).toBe('boolean');
  });

  it('should find exact duplicate functions', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const result = await tool.call({
      codebase_id: 'test-codebase-uuid',
      similarity_threshold: 1.0, // Exact duplicates only
      min_lines: 3,
      max_results: 10
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.duplicates).toBeDefined();
    expect(Array.isArray(result.duplicates.groups)).toBe(true);

    if (result.duplicates.groups.length > 0) {
      const firstGroup = result.duplicates.groups[0];
      expect(firstGroup.similarity_score).toBe(1.0); // Exact match
      expect(firstGroup.duplicate_type).toBe('exact');
      expect(firstGroup.files).toBeDefined();
      expect(Array.isArray(firstGroup.files)).toBe(true);
      expect(firstGroup.files.length).toBeGreaterThanOrEqual(2); // At least 2 duplicates

      // Check duplicate files info
      firstGroup.files.forEach((file: any) => {
        expect(file.file_path).toBeDefined();
        expect(file.start_line).toBeDefined();
        expect(file.end_line).toBeDefined();
        expect(file.content_preview).toBeDefined();
      });
    }
  });

  it('should find similar code with configurable threshold', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const thresholds = [0.9, 0.8, 0.7, 0.5];

    for (const threshold of thresholds) {
      const result = await tool.call({
        codebase_id: 'test-codebase-uuid',
        similarity_threshold: threshold,
        min_lines: 5,
        max_results: 5
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.duplicates.groups).toBeDefined();

      // All results should meet the threshold
      if (result.duplicates.groups.length > 0) {
        result.duplicates.groups.forEach((group: any) => {
          expect(group.similarity_score).toBeGreaterThanOrEqual(threshold);
          expect(group.similarity_score).toBeLessThanOrEqual(1.0);
          expect(group.duplicate_type).toBe('similar');
        });
      }
    }
  });

  it('should detect duplicate patterns across different files', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const result = await tool.call({
      codebase_id: 'test-codebase-uuid',
      similarity_threshold: 0.8,
      min_lines: 3,
      detection_mode: 'cross_file'
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.duplicates.groups.length > 0) {
      // Check that duplicates span multiple files
      result.duplicates.groups.forEach((group: any) => {
        const uniqueFiles = new Set(group.files.map((f: any) => f.file_path));
        expect(uniqueFiles.size).toBeGreaterThanOrEqual(2); // At least 2 different files

        // Should include cross-file metadata
        expect(group.cross_file_analysis).toBeDefined();
        expect(group.cross_file_analysis.total_files_involved).toBe(uniqueFiles.size);
        expect(group.cross_file_analysis.file_paths).toEqual(Array.from(uniqueFiles));
      });
    }
  });

  it('should provide detailed duplicate analysis metrics', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const result = await tool.call({
      codebase_id: 'test-codebase-uuid',
      similarity_threshold: 0.7,
      min_lines: 3,
      max_results: 20
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();

    // Analysis metrics
    expect(result.metadata.total_files_scanned).toBeDefined();
    expect(typeof result.metadata.total_files_scanned).toBe('number');
    expect(result.metadata.lines_analyzed).toBeDefined();
    expect(typeof result.metadata.lines_analyzed).toBe('number');
    expect(result.metadata.potential_duplicates_found).toBeDefined();
    expect(typeof result.metadata.potential_duplicates_found).toBe('number');
    expect(result.metadata.analysis_time_ms).toBeDefined();
    expect(typeof result.metadata.analysis_time_ms).toBe('number');

    // Duplicate statistics
    expect(result.metadata.duplicate_statistics).toBeDefined();
    expect(result.metadata.duplicate_statistics.exact_duplicates).toBeDefined();
    expect(result.metadata.duplicate_statistics.similar_duplicates).toBeDefined();
    expect(result.metadata.duplicate_statistics.total_duplicate_lines).toBeDefined();
    expect(result.metadata.duplicate_statistics.duplication_percentage).toBeDefined();

    // Quality metrics
    expect(result.metadata.quality_metrics).toBeDefined();
    expect(result.metadata.quality_metrics.maintainability_impact).toBeDefined();
    expect(result.metadata.quality_metrics.refactoring_priority).toBeDefined();
    expect(Array.isArray(result.metadata.quality_metrics.recommendations)).toBe(true);
  });

  it('should support different detection modes', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const modes = ['exact', 'similar', 'structural', 'semantic'];

    for (const mode of modes) {
      const result = await tool.call({
        codebase_id: 'test-codebase-uuid',
        detection_mode: mode,
        similarity_threshold: 0.8,
        max_results: 5
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.duplicates.detection_mode).toBe(mode);

      // Different modes may produce different result types
      if (result.duplicates.groups.length > 0) {
        result.duplicates.groups.forEach((group: any) => {
          expect(group.detection_mode).toBe(mode);
          expect(group.similarity_score).toBeDefined();
          expect(group.duplicate_type).toBeDefined();
        });
      }
    }
  });

  it('should filter by file types correctly', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const fileTypes = [['ts', 'js'], ['py'], ['java', 'cpp']];

    for (const types of fileTypes) {
      const result = await tool.call({
        codebase_id: 'test-codebase-uuid',
        file_types: types,
        similarity_threshold: 0.8,
        max_results: 10
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      if (result.duplicates.groups.length > 0) {
        // All duplicates should be in specified file types
        result.duplicates.groups.forEach((group: any) => {
          group.files.forEach((file: any) => {
            const fileExtension = file.file_path.split('.').pop();
            expect(types).toContain(fileExtension);
          });
        });
      }
    }
  });

  it('should handle whitespace and comment filtering options', async () => {
    const tool = mockServer.getTool('find_duplicates');

    // Test with different filtering options
    const testCases = [
      { ignore_whitespace: true, ignore_comments: true },
      { ignore_whitespace: false, ignore_comments: true },
      { ignore_whitespace: true, ignore_comments: false },
      { ignore_whitespace: false, ignore_comments: false }
    ];

    for (const testCase of testCases) {
      const result = await tool.call({
        codebase_id: 'test-codebase-uuid',
        similarity_threshold: 0.9,
        min_lines: 3,
        ...testCase
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.duplicates.filtering_options).toEqual(testCase);

      // Results may vary based on filtering options
      if (result.duplicates.groups.length > 0) {
        result.duplicates.groups.forEach((group: any) => {
          expect(group.filtering_applied).toBeDefined();
          expect(group.filtering_applied).toEqual(testCase);
        });
      }
    }
  });

  it('should include or exclude test files based on parameter', async () => {
    const tool = mockServer.getTool('find_duplicates');

    const resultWithTests = await tool.call({
      codebase_id: 'test-codebase-uuid',
      include_tests: true,
      similarity_threshold: 0.8,
      max_results: 10
    });

    const resultWithoutTests = await tool.call({
      codebase_id: 'test-codebase-uuid',
      include_tests: false,
      similarity_threshold: 0.8,
      max_results: 10
    });

    expect(resultWithTests.success).toBe(true);
    expect(resultWithoutTests.success).toBe(true);

    // Results should differ based on test file inclusion
    const hasTestFiles = (result: any) =>
      result.duplicates.groups.some((group: any) =>
        group.files.some((file: any) =>
          file.file_path.includes('.test.') ||
          file.file_path.includes('.spec.') ||
          file.file_path.includes('/test/') ||
          file.file_path.includes('/tests/')
        )
      );

    if (resultWithTests.duplicates.groups.length !== resultWithoutTests.duplicates.groups.length) {
      expect(hasTestFiles(resultWithTests)).toBe(true);
    }
  });

  it('should respect min_lines parameter', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const minLines = [5, 10, 20];

    for (const minLine of minLines) {
      const result = await tool.call({
        codebase_id: 'test-codebase-uuid',
        min_lines: minLine,
        similarity_threshold: 0.8,
        max_results: 10
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      if (result.duplicates.groups.length > 0) {
        result.duplicates.groups.forEach((group: any) => {
          // All duplicates should meet minimum line requirement
          expect(group.line_count).toBeGreaterThanOrEqual(minLine);

          group.files.forEach((file: any) => {
            const lineCount = file.end_line - file.start_line + 1;
            expect(lineCount).toBeGreaterThanOrEqual(minLine);
          });
        });
      }
    }
  });

  it('should respect max_results parameter', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const maxResults = [5, 10, 20];

    for (const maxResult of maxResults) {
      const result = await tool.call({
        codebase_id: 'test-codebase-uuid',
        similarity_threshold: 0.7,
        max_results: maxResult
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.duplicates.groups.length).toBeLessThanOrEqual(maxResult);

      // Should include pagination info if more results exist
      if (result.metadata.more_results_available) {
        expect(result.metadata.total_duplicates_found).toBeGreaterThan(maxResult);
        expect(result.metadata.next_page_token).toBeDefined();
      }
    }
  });

  it('should provide duplicate refactoring suggestions', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const result = await tool.call({
      codebase_id: 'test-codebase-uuid',
      similarity_threshold: 0.8,
      min_lines: 5,
      max_results: 10
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.duplicates.groups.length > 0) {
      result.duplicates.groups.forEach((group: any) => {
        expect(group.refactoring_suggestions).toBeDefined();
        expect(Array.isArray(group.refactoring_suggestions)).toBe(true);

        if (group.refactoring_suggestions.length > 0) {
          group.refactoring_suggestions.forEach((suggestion: any) => {
            expect(suggestion.type).toBeDefined();
            expect(['extract_function', 'extract_class', 'template_method', 'share_constants'])
              .toContain(suggestion.type);
            expect(suggestion.description).toBeDefined();
            expect(suggestion.effort_estimate).toBeDefined();
            expect(suggestion.impact_assessment).toBeDefined();
          });
        }
      });
    }
  });

  it('should detect structural code patterns', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const result = await tool.call({
      codebase_id: 'test-codebase-uuid',
      detection_mode: 'structural',
      similarity_threshold: 0.7,
      max_results: 10
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.duplicates.groups.length > 0) {
      result.duplicates.groups.forEach((group: any) => {
        expect(group.detection_mode).toBe('structural');
        expect(group.structural_pattern).toBeDefined();
        expect(group.structural_pattern.control_flow).toBeDefined();
        expect(group.structural_pattern.data_flow).toBeDefined();
        expect(group.structural_pattern.nesting_level).toBeDefined();
        expect(group.structural_pattern.complexity_metrics).toBeDefined();
      });
    }
  });

  it('should handle semantic similarity detection', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const result = await tool.call({
      codebase_id: 'test-codebase-uuid',
      detection_mode: 'semantic',
      similarity_threshold: 0.6, // Lower threshold for semantic matches
      max_results: 10
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.duplicates.groups.length > 0) {
      result.duplicates.groups.forEach((group: any) => {
        expect(group.detection_mode).toBe('semantic');
        expect(group.semantic_analysis).toBeDefined();
        expect(group.semantic_analysis.intent_similarity).toBeDefined();
        expect(group.semantic_analysis.variable_mapping).toBeDefined();
        expect(group.semantic_analysis.equivalent_operations).toBeDefined();
      });
    }
  });

  it('should provide duplicate visualization data', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const result = await tool.call({
      codebase_id: 'test-codebase-uuid',
      similarity_threshold: 0.8,
      max_results: 10
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.visualization_data).toBeDefined();

    // Should include visualization for duplicate groups
    expect(result.visualization_data.groups).toBeDefined();
    expect(Array.isArray(result.visualization_data.groups)).toBe(true);

    if (result.visualization_data.groups.length > 0) {
      result.visualization_data.groups.forEach((group: any) => {
        expect(group.group_id).toBeDefined();
        expect(group.similarity_score).toBeDefined();
        expect(group.file_connections).toBeDefined();
        expect(Array.isArray(group.file_connections)).toBe(true);

        // File connections for visualization
        group.file_connections.forEach((connection: any) => {
          expect(connection.from_file).toBeDefined();
          expect(connection.to_file).toBeDefined();
          expect(connection.similarity).toBeDefined();
          expect(connection.line_ranges).toBeDefined();
        });
      });
    }

    // Summary visualization data
    expect(result.visualization_data.summary).toBeDefined();
    expect(result.visualization_data.summary.total_duplicates).toBeDefined();
    expect(result.visualization_data.summary.duplication_hotspots).toBeDefined();
    expect(result.visualization_data.summary.file_duplication_matrix).toBeDefined();
  });

  it('should validate similarity_threshold parameter', async () => {
    const tool = mockServer.getTool('find_duplicates');

    // Should fail for invalid thresholds
    await expect(tool.call({
      codebase_id: 'test',
      similarity_threshold: -0.1
    })).rejects.toThrow('similarity_threshold must be between 0 and 1');

    await expect(tool.call({
      codebase_id: 'test',
      similarity_threshold: 1.1
    })).rejects.toThrow('similarity_threshold must be between 0 and 1');

    // Should accept valid thresholds
    const validThresholds = [0.0, 0.5, 0.8, 1.0];
    for (const threshold of validThresholds) {
      const result = await tool.call({
        codebase_id: 'test',
        similarity_threshold: threshold
      });
      expect(result).toBeDefined();
    }
  });

  it('should validate min_lines parameter', async () => {
    const tool = mockServer.getTool('find_duplicates');

    // Should fail for invalid values
    await expect(tool.call({
      codebase_id: 'test',
      min_lines: 0
    })).rejects.toThrow('min_lines must be a positive integer');

    await expect(tool.call({
      codebase_id: 'test',
      min_lines: -1
    })).rejects.toThrow('min_lines must be a positive integer');

    await expect(tool.call({
      codebase_id: 'test',
      min_lines: 1001
    })).rejects.toThrow('min_lines cannot exceed 1000');
  });

  it('should validate max_results parameter', async () => {
    const tool = mockServer.getTool('find_duplicates');

    // Should fail for invalid values
    await expect(tool.call({
      codebase_id: 'test',
      max_results: 0
    })).rejects.toThrow('max_results must be a positive integer');

    await expect(tool.call({
      codebase_id: 'test',
      max_results: -1
    })).rejects.toThrow('max_results must be a positive integer');

    await expect(tool.call({
      codebase_id: 'test',
      max_results: 501
    })).rejects.toThrow('max_results cannot exceed 500');
  });

  it('should validate detection_mode parameter', async () => {
    const tool = mockServer.getTool('find_duplicates');

    // Should fail for invalid modes
    await expect(tool.call({
      codebase_id: 'test',
      detection_mode: 'invalid'
    })).rejects.toThrow('detection_mode must be one of: exact, similar, structural, semantic');

    // Should accept valid modes
    const validModes = ['exact', 'similar', 'structural', 'semantic'];
    for (const mode of validModes) {
      const result = await tool.call({
        codebase_id: 'test',
        detection_mode: mode
      });
      expect(result).toBeDefined();
    }
  });

  it('should validate file_types parameter', async () => {
    const tool = mockServer.getTool('find_duplicates');

    // Should fail for invalid file types
    await expect(tool.call({
      codebase_id: 'test',
      file_types: ['invalid_extension']
    })).rejects.toThrow('file_types contains invalid file extensions');

    await expect(tool.call({
      codebase_id: 'test',
      file_types: [123]
    })).rejects.toThrow('file_types must be an array of strings');

    // Should accept valid file types
    const validTypes = ['js', 'ts', 'py', 'java', 'cpp', 'go'];
    const result = await tool.call({
      codebase_id: 'test',
      file_types: validTypes
    });
    expect(result).toBeDefined();
  });

  it('should handle empty or non-existent codebase gracefully', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const result = await tool.call({
      codebase_id: 'non-existent-codebase-uuid',
      similarity_threshold: 0.8
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('codebase not found');
  });

  it('should provide performance analysis for large codebases', async () => {
    const tool = mockServer.getTool('find_duplicates');
    const result = await tool.call({
      codebase_id: 'large-test-codebase',
      similarity_threshold: 0.7,
      max_results: 50
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();

    // Performance metrics for large codebases
    expect(result.metadata.performance_metrics).toBeDefined();
    expect(result.metadata.performance_metrics.scanning_rate_mb_per_sec).toBeDefined();
    expect(result.metadata.performance_metrics.comparison_operations).toBeDefined();
    expect(result.metadata.performance_queries.memory_usage_mb).toBeDefined();
    expect(result.metadata.performance_metrics.parallelization_efficiency).toBeDefined();

    // Should include optimization suggestions for large codebases
    if (result.metadata.performance_optimizations) {
      expect(Array.isArray(result.metadata.performance_optimizations)).toBe(true);
      result.metadata.performance_optimizations.forEach((optimization: any) => {
        expect(optimization.type).toBeDefined();
        expect(optimization.description).toBeDefined();
        expect(optimization.expected_improvement).toBeDefined();
      });
    }
  });

  it('should handle timeout and resource limits gracefully', async () => {
    const tool = mockServer.getTool('find_duplicates');

    // Test with very large codebase that might timeout
    const result = await tool.call({
      codebase_id: 'very-large-codebase',
      similarity_threshold: 0.5,
      max_results: 100,
      timeout_ms: 30000 // 30 second timeout
    });

    expect(result).toBeDefined();

    if (result.timeout_occurred) {
      expect(result.success).toBe(false);
      expect(result.error).toContain('analysis timeout');
      expect(result.partial_results).toBeDefined();
      expect(result.metadata.analysis_progress).toBeDefined();
    } else {
      expect(result.success).toBe(true);
    }
  });
});

/**
 * Expected Error Messages (for implementation reference):
 *
 * - "Tool 'find_duplicates' not found"
 * - "similarity_threshold must be between 0 and 1"
 * - "min_lines must be a positive integer"
 * - "min_lines cannot exceed 1000"
 * - "max_results must be a positive integer"
 * - "max_results cannot exceed 500"
 * - "detection_mode must be one of: exact, similar, structural, semantic"
 * - "file_types must be an array of strings"
 * - "file_types contains invalid file extensions"
 * - "codebase not found"
 * - "analysis timeout"
 *
 * Expected Success Response Structure:
 *
 * {
 *   success: true,
 *   duplicates: {
 *     detection_mode: 'exact' | 'similar' | 'structural' | 'semantic',
 *     groups: Array<{
 *       group_id: string,
 *       similarity_score: number,
 *       duplicate_type: 'exact' | 'similar',
 *       line_count: number,
 *       detection_mode: string,
 *       files: Array<{
 *         file_path: string,
 *         start_line: number,
 *         end_line: number,
 *         content_preview: string,
 *         checksum: string
 *       }>,
 *       filtering_applied: {
 *         ignore_whitespace: boolean,
 *         ignore_comments: boolean
 *       },
 *       refactoring_suggestions: Array<{
 *         type: string,
 *         description: string,
 *         effort_estimate: string,
 *         impact_assessment: string
 *       }>,
 *       structural_pattern?: {
 *         control_flow: any,
 *         data_flow: any,
 *         nesting_level: number,
 *         complexity_metrics: any
 *       },
 *       semantic_analysis?: {
 *         intent_similarity: number,
 *         variable_mapping: any,
 *         equivalent_operations: any
 *       },
 *       cross_file_analysis?: {
 *         total_files_involved: number,
 *         file_paths: string[]
 *       }
 *     }>,
 *     cross_file_flows?: Array<any>
 *   },
 *   visualization_data: {
 *     groups: Array<{
 *       group_id: string,
 *       similarity_score: number,
 *       file_connections: Array<{
 *         from_file: string,
 *         to_file: string,
 *         similarity: number,
 *         line_ranges: any
 *       }>
 *     }>,
 *     summary: {
 *       total_duplicates: number,
 *       duplication_hotspots: any,
 *       file_duplication_matrix: any
 *     }
 *   },
 *   metadata: {
 *     total_files_scanned: number,
 *     lines_analyzed: number,
 *     potential_duplicates_found: number,
 *     analysis_time_ms: number,
 *     duplicate_statistics: {
 *       exact_duplicates: number,
 *       similar_duplicates: number,
 *       total_duplicate_lines: number,
 *       duplication_percentage: number
 *     },
 *     quality_metrics: {
 *       maintainability_impact: string,
 *       refactoring_priority: string,
 *       recommendations: string[]
 *     },
 *     performance_metrics?: {
 *       scanning_rate_mb_per_sec: number,
 *       comparison_operations: number,
 *       memory_usage_mb: number,
 *       parallelization_efficiency: number
 *     },
 *     performance_optimizations?: Array<any>,
 *     more_results_available?: boolean,
 *     total_duplicates_found?: number,
 *     next_page_token?: string
 *   }
 * }
 */