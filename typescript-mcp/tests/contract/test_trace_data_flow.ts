/**
 * Contract Test for trace_data_flow MCP Tool (T012)
 *
 * This test validates the trace_data_flow tool contract implementation.
 * According to TDD principles, this test must FAIL before implementation.
 *
 * Test validates:
 * - Tool exists and is registered
 * - Data flow tracing and analysis
 * - Variable/parameter tracking through functions
 * - Cross-module data flow visualization
 * - Error handling for invalid inputs
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('trace_data_flow MCP Tool - Contract Test (T012)', () => {
  let mockServer: any;
  let traceDataFlowTool: any;

  beforeEach(() => {
    // Mock server setup - this will fail because tool doesn't exist yet
    mockServer = {
      tools: new Map(),
      hasTool: (name: string) => mockServer.tools.has(name),
      getTool: (name: string) => mockServer.tools.get(name),
    };
  });

  it('should have trace_data_flow tool registered', () => {
    // This should fail - tool not implemented yet
    expect(mockServer.hasTool('trace_data_flow')).toBe(true);
  });

  it('should validate input schema correctly', async () => {
    const tool = mockServer.getTool('trace_data_flow');
    expect(tool).toBeDefined();
    expect(tool.inputSchema).toBeDefined();

    const schema = tool.inputSchema;

    // Required properties
    expect(schema.required).toContain('entry_point');
    expect(schema.properties.entry_point).toBeDefined();
    expect(schema.properties.entry_point.type).toBe('string');

    // Optional properties
    expect(schema.properties.codebase_id).toBeDefined();
    expect(schema.properties.codebase_id.type).toBe('string');
    expect(schema.properties.trace_depth).toBeDefined();
    expect(schema.properties.trace_depth.type).toBe('number');
    expect(schema.properties.include_libraries).toBeDefined();
    expect(schema.properties.include_libraries.type).toBe('boolean');
    expect(schema.properties.flow_direction).toBeDefined();
    expect(schema.properties.flow_direction.type).toBe('string');
    expect(schema.properties.target_variables).toBeDefined();
    expect(schema.properties.target_variables.type).toBe('array');
  });

  it('should trace data flow from function entry point', async () => {
    const tool = mockServer.getTool('trace_data_flow');
    const result = await tool.call({
      entry_point: 'processUserData',
      codebase_id: 'test-codebase-uuid',
      trace_depth: 5,
      include_libraries: false
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data_flow).toBeDefined();
    expect(Array.isArray(result.data_flow.steps)).toBe(true);

    // Entry point info should be included
    expect(result.entry_point_info).toBeDefined();
    expect(result.entry_point_info.name).toBe('processUserData');
    expect(result.entry_point_info.location).toBeDefined();

    if (result.data_flow.steps.length > 0) {
      const firstStep = result.data_flow.steps[0];
      expect(firstStep.operation).toBeDefined();
      expect(firstStep.location).toBeDefined();
      expect(firstStep.data_transformations).toBeDefined();
      expect(Array.isArray(firstStep.data_transformations)).toBe(true);
    }
  });

  it('should trace data flow through variable transformations', async () => {
    const tool = mockServer.getTool('trace_data_flow');
    const result = await tool.call({
      entry_point: 'calculateTotal',
      target_variables: ['price', 'quantity', 'total'],
      trace_depth: 3
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data_flow).toBeDefined();

    // Should track variable transformations
    if (result.data_flow.steps.length > 0) {
      result.data_flow.steps.forEach((step: any) => {
        if (step.data_transformations.length > 0) {
          step.data_transformations.forEach((transform: any) => {
            expect(transform.variable_name).toBeDefined();
            expect(transform.before_value).toBeDefined();
            expect(transform.after_value).toBeDefined();
            expect(transform.operation).toBeDefined();
          });
        }
      });

      // Should include final variable states
      expect(result.final_state).toBeDefined();
      expect(Array.isArray(result.final_state.variables)).toBe(true);
    }
  });

  it('should handle bidirectional flow tracing', async () => {
    const tool = mockServer.getTool('trace_data_flow');
    const directions = ['forward', 'backward', 'bidirectional'];

    for (const direction of directions) {
      const result = await tool.call({
        entry_point: 'dataProcessor',
        flow_direction: direction,
        trace_depth: 3
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data_flow.direction).toBe(direction);

      // Flow steps should be ordered appropriately based on direction
      if (result.data_flow.steps.length > 1) {
        if (direction === 'forward') {
          // Forward flow should follow execution order
          for (let i = 1; i < result.data_flow.steps.length; i++) {
            expect(result.data_flow.steps[i].sequence_number).toBeGreaterThan(
              result.data_flow.steps[i-1].sequence_number
            );
          }
        }
      }
    }
  });

  it('should include or exclude library functions based on parameter', async () => {
    const tool = mockServer.getTool('trace_data_flow');

    const resultWithLibraries = await tool.call({
      entry_point: 'processRequest',
      include_libraries: true,
      trace_depth: 5
    });

    const resultWithoutLibraries = await tool.call({
      entry_point: 'processRequest',
      include_libraries: false,
      trace_depth: 5
    });

    // Both should succeed
    expect(resultWithLibraries.success).toBe(true);
    expect(resultWithoutLibraries.success).toBe(true);

    // Results should differ based on library inclusion
    if (resultWithLibraries.data_flow.steps.length !== resultWithoutLibraries.data_flow.steps.length) {
      // At least one of them should include library calls
      const hasLibrarySteps = (result: any) => 
        result.data_flow.steps.some((step: any) => step.is_library_function);

      if (resultWithLibraries.data_flow.steps.length > resultWithoutLibraries.data_flow.steps.length) {
        expect(hasLibrarySteps(resultWithLibraries)).toBe(true);
      }
    }
  });

  it('should respect trace_depth parameter', async () => {
    const tool = mockServer.getTool('trace_data_flow');
    const maxDepth = 3;

    const result = await tool.call({
      entry_point: 'deeplyNestedFunction',
      trace_depth: maxDepth
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Should not exceed specified depth
    if (result.data_flow.steps.length > 0) {
      const maxStepDepth = Math.max(...result.data_flow.steps.map((step: any) => step.depth));
      expect(maxStepDepth).toBeLessThanOrEqual(maxDepth);
    }
  });

  it('should trace data flow across multiple files', async () => {
    const tool = mockServer.getTool('trace_data_flow');
    const result = await tool.call({
      entry_point: 'orchestratorFunction',
      trace_depth: 4,
      include_libraries: false
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.data_flow.steps.length > 1) {
      const files = result.data_flow.steps.map((step: any) => step.location.file_path);
      const uniqueFiles = [...new Set(files)];

      // Should potentially trace across multiple files
      expect(uniqueFiles.length).toBeGreaterThanOrEqual(1);

      // Should include cross-file data flow information
      if (uniqueFiles.length > 1) {
        expect(result.data_flow.cross_file_flows).toBeDefined();
        expect(Array.isArray(result.data_flow.cross_file_flows)).toBe(true);

        result.data_flow.cross_file_flows.forEach((flow: any) => {
          expect(flow.from_file).toBeDefined();
          expect(flow.to_file).toBeDefined();
          expect(flow.data_transferred).toBeDefined();
          expect(flow.transfer_point).toBeDefined();
        });
      }
    }
  });

  it('should identify data transformations and operations', async () => {
    const tool = mockServer.getTool('trace_data_flow');
    const result = await tool.call({
      entry_point: 'dataTransformer',
      target_variables: ['input', 'output'],
      trace_depth: 3
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.data_flow.steps.length > 0) {
      result.data_flow.steps.forEach((step: any) => {
        // Should identify operation types
        expect(step.operation_type).toBeDefined();
        expect(['assignment', 'function_call', 'arithmetic', 'conditional', 'loop', 'return'])
          .toContain(step.operation_type);

        // Should track data transformations
        if (step.data_transformations.length > 0) {
          step.data_transformations.forEach((transform: any) => {
            expect(transform.operation).toBeDefined();
            expect(transform.operation_category).toBeDefined();
            expect(['data_manipulation', 'type_conversion', 'validation', 'formatting'])
              .toContain(transform.operation_category);
          });
        }
      });
    }
  });

  it('should provide data flow visualization metadata', async () => {
    const tool = mockServer.getTool('trace_data_flow');
    const result = await tool.call({
      entry_point: 'complexFlowFunction',
      trace_depth: 5
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.visualization_data).toBeDefined();

    // Should include graph information for visualization
    expect(result.visualization_data.nodes).toBeDefined();
    expect(Array.isArray(result.visualization_data.nodes)).toBe(true);
    expect(result.visualization_data.edges).toBeDefined();
    expect(Array.isArray(result.visualization_data.edges)).toBe(true);

    if (result.visualization_data.nodes.length > 0) {
      result.visualization_data.nodes.forEach((node: any) => {
        expect(node.id).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.label).toBeDefined();
        expect(node.position).toBeDefined();
      });
    }

    if (result.visualization_data.edges.length > 0) {
      result.visualization_data.edges.forEach((edge: any) => {
        expect(edge.from).toBeDefined();
        expect(edge.to).toBeDefined();
        expect(edge.data_flow).toBeDefined();
      });
    }
  });

  it('should validate required entry_point parameter', async () => {
    const tool = mockServer.getTool('trace_data_flow');

    // Should fail when entry_point is missing
    await expect(tool.call({
      trace_depth: 5
    })).rejects.toThrow('entry_point is required');

    // Should fail when entry_point is empty
    await expect(tool.call({
      entry_point: '',
      trace_depth: 5
    })).rejects.toThrow('entry_point cannot be empty');

    // Should fail when entry_point is not a string
    await expect(tool.call({
      entry_point: 123,
      trace_depth: 5
    })).rejects.toThrow('entry_point must be a string');
  });

  it('should validate flow_direction parameter', async () => {
    const tool = mockServer.getTool('trace_data_flow');

    // Should fail for invalid flow directions
    await expect(tool.call({
      entry_point: 'test',
      flow_direction: 'invalid'
    })).rejects.toThrow('flow_direction must be one of: forward, backward, bidirectional');

    // Should accept valid directions
    const validDirections = ['forward', 'backward', 'bidirectional'];
    for (const direction of validDirections) {
      const result = await tool.call({
        entry_point: 'test',
        flow_direction: direction
      });
      expect(result).toBeDefined();
    }
  });

  it('should validate trace_depth parameter', async () => {
    const tool = mockServer.getTool('trace_data_flow');

    // Should fail for invalid trace depths
    await expect(tool.call({
      entry_point: 'test',
      trace_depth: 0
    })).rejects.toThrow('trace_depth must be a positive integer');

    await expect(tool.call({
      entry_point: 'test',
      trace_depth: -1
    })).rejects.toThrow('trace_depth must be a positive integer');

    await expect(tool.call({
      entry_point: 'test',
      trace_depth: 21
    })).rejects.toThrow('trace_depth cannot exceed 20');
  });

  it('should handle non-existent entry point gracefully', async () => {
    const tool = mockServer.getTool('trace_data_flow');
    const result = await tool.call({
      entry_point: 'nonExistentFunction12345',
      codebase_id: 'test-codebase-uuid'
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('entry point not found');
  });

  it('should detect data flow patterns and anti-patterns', async () => {
    const tool = mockServer.getTool('trace_data_flow');
    const result = await tool.call({
      entry_point: 'patternAnalysisFunction',
      trace_depth: 6
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Should identify patterns in data flow
    expect(result.data_flow.patterns).toBeDefined();
    expect(Array.isArray(result.data_flow.patterns)).toBe(true);

    if (result.data_flow.patterns.length > 0) {
      result.data_flow.patterns.forEach((pattern: any) => {
        expect(pattern.name).toBeDefined();
        expect(pattern.type).toBeDefined();
        expect(['pipeline', 'fan_out', 'fan_in', 'circular_dependency', 'data_aggregation'])
          .toContain(pattern.type);
        expect(pattern.locations).toBeDefined();
        expect(Array.isArray(pattern.locations)).toBe(true);
      });
    }

    // Should identify potential anti-patterns
    expect(result.data_flow.anti_patterns).toBeDefined();
    expect(Array.isArray(result.data_flow.anti_patterns)).toBe(true);
  });

  it('should provide comprehensive execution metrics', async () => {
    const tool = mockServer.getTool('trace_data_flow');
    const result = await tool.call({
      entry_point: 'performanceTestFunction',
      trace_depth: 5
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();

    // Should include performance metrics
    expect(result.metadata.trace_time_ms).toBeDefined();
    expect(typeof result.metadata.trace_time_ms).toBe('number');
    expect(result.metadata.functions_analyzed).toBeDefined();
    expect(typeof result.metadata.functions_analyzed).toBe('number');
    expect(result.metadata.data_transformations).toBeDefined();
    expect(typeof result.metadata.data_transformations).toBe('number');
    expect(result.metadata.max_depth_reached).toBeDefined();
    expect(typeof result.metadata.max_depth_reached).toBe('number');

    // Should include complexity metrics
    expect(result.metadata.complexity_metrics).toBeDefined();
    expect(result.metadata.complexity_metrics.cyclomatic_complexity).toBeDefined();
    expect(result.metadata.complexity_metrics.data_flow_complexity).toBeDefined();
  });

  it('should handle circular dependencies in data flow', async () => {
    const tool = mockServer.getTool('trace_data_flow');
    const result = await tool.call({
      entry_point: 'recursiveFunction',
      trace_depth: 10,
      flow_direction: 'bidirectional'
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Should detect and handle circular dependencies
    if (result.data_flow.circular_dependencies) {
      expect(Array.isArray(result.data_flow.circular_dependencies)).toBe(true);
      
      result.data_flow.circular_dependencies.forEach((cycle: any) => {
        expect(cycle.cycle_path).toBeDefined();
        expect(Array.isArray(cycle.cycle_path)).toBe(true);
        expect(cycle.entry_point).toBeDefined();
        expect(cycle.severity).toBeDefined();
      });
    }
  });
});

/**
 * Expected Error Messages (for implementation reference):
 *
 * - "Tool 'trace_data_flow' not found"
 * - "entry_point is required"
 * - "entry_point cannot be empty"
 * - "entry_point must be a string"
 * - "flow_direction must be one of: forward, backward, bidirectional"
 * - "trace_depth must be a positive integer"
 * - "trace_depth cannot exceed 20"
 * - "target_variables must be an array of strings"
 * - "entry point not found"
 *
 * Expected Success Response Structure:
 *
 * {
 *   success: true,
 *   entry_point_info: {
 *     name: string,
 *     location: {file_path: string, line_number: number},
 *     signature: string
 *   },
 *   data_flow: {
 *     direction: 'forward' | 'backward' | 'bidirectional',
 *     steps: Array<{
 *       sequence_number: number,
 *       depth: number,
 *       operation: string,
 *       operation_type: string,
 *       location: {file_path: string, line_number: number},
 *       data_transformations: Array<{
 *         variable_name: string,
 *         before_value: any,
 *         after_value: any,
 *         operation: string,
 *         operation_category: string
 *       }>,
 *       is_library_function: boolean
 *     }>,
 *     cross_file_flows?: Array<{
 *       from_file: string,
 *       to_file: string,
 *       data_transferred: string[],
 *       transfer_point: {file_path: string, line_number: number}
 *     }>,
 *     patterns: Array<{name: string, type: string, locations: Array<any>}>,
 *     anti_patterns: Array<{name: string, severity: string, locations: Array<any>}>,
 *     circular_dependencies?: Array<{
 *       cycle_path: Array<string>,
 *       entry_point: string,
 *       severity: string
 *     }>
 *   },
 *   final_state?: {
 *     variables: Array<{name: string, value: any, type: string}>
 *   },
 *   visualization_data: {
 *     nodes: Array<{id: string, type: string, label: string, position: any}>,
 *     edges: Array<{from: string, to: string, data_flow: any}>
 *   },
 *   metadata: {
 *     trace_time_ms: number,
 *     functions_analyzed: number,
 *     data_transformations: number,
 *     max_depth_reached: number,
 *     complexity_metrics: {
 *       cyclomatic_complexity: number,
 *       data_flow_complexity: number
 *     }
 *   }
 * }
 */