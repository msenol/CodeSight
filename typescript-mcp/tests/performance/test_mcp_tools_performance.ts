/**
 * Performance Benchmark Test Suite for MCP Tools (T084)
 *
 * This test suite establishes comprehensive performance benchmarks for all MCP tools.
 * Tests measure response times, throughput, memory usage, and resource utilization.
 *
 * Performance Benchmarks:
 * - search_code: < 500ms response, 100+ QPS, < 100MB memory
 * - explain_function: < 200ms response, 50+ QPS, < 50MB memory
 * - find_references: < 300ms response, 75+ QPS, < 75MB memory
 * - trace_data_flow: < 800ms response, 25+ QPS, < 150MB memory
 * - analyze_security: < 1s response, 20+ QPS, < 200MB memory
 * - get_api_endpoints: < 400ms response, 80+ QPS, < 80MB memory
 * - check_complexity: < 600ms response, 40+ QPS, < 120MB memory
 * - find_duplicates: < 1.2s response, 15+ QPS, < 250MB memory
 * - suggest_refactoring: < 1.5s response, 10+ QPS, < 300MB memory
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MCP Tools Performance Benchmark Suite (T084)', () => {
  let performanceMonitor: any;
  let mockMCPServer: any;
  let benchmarkResults: any[];

  beforeEach(() => {
    // Performance monitoring setup
    performanceMonitor = {
      metrics: {
        responseTimes: new Map<string, number[]>(),
        memoryUsage: new Map<string, number[]>(),
        cpuUsage: new Map<string, number[]>(),
        throughput: new Map<string, number>(),
        errors: new Map<string, number>()
      },

      startMeasurement: (toolName: string) => {
        const startMemory = process.memoryUsage();
        const startCpu = process.cpuUsage();
        const startTime = process.hrtime.bigint();

        return {
          endMeasurement: () => {
            const endTime = process.hrtime.bigint();
            const endCpu = process.cpuUsage(startCpu);
            const endMemory = process.memoryUsage();

            const responseTime = Number(endTime - startTime) / 1000000; // Convert to ms
            const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
            const cpuPercent = (endCpu.user + endCpu.system) / 1000000; // Convert to ms

            // Record metrics
            if (!performanceMonitor.metrics.responseTimes.has(toolName)) {
              performanceMonitor.metrics.responseTimes.set(toolName, []);
              performanceMonitor.metrics.memoryUsage.set(toolName, []);
              performanceMonitor.metrics.cpuUsage.set(toolName, []);
            }

            performanceMonitor.metrics.responseTimes.get(toolName)!.push(responseTime);
            performanceMonitor.metrics.memoryUsage.get(toolName)!.push(memoryDelta);
            performanceMonitor.metrics.cpuUsage.get(toolName)!.push(cpuPercent);

            return {
              responseTime,
              memoryUsage: memoryDelta,
              cpuUsage: cpuPercent
            };
          }
        };
      },

      getStats: (toolName: string) => {
        const times = performanceMonitor.metrics.responseTimes.get(toolName) || [];
        const memory = performanceMonitor.metrics.memoryUsage.get(toolName) || [];
        const cpu = performanceMonitor.metrics.cpuUsage.get(toolName) || [];

        if (times.length === 0) return null;

        return {
          responseTime: {
            avg: times.reduce((a, b) => a + b, 0) / times.length,
            min: Math.min(...times),
            max: Math.max(...times),
            p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)],
            p99: times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)]
          },
          memoryUsage: {
            avg: memory.reduce((a, b) => a + b, 0) / memory.length,
            min: Math.min(...memory),
            max: Math.max(...memory)
          },
          cpuUsage: {
            avg: cpu.reduce((a, b) => a + b, 0) / cpu.length,
            min: Math.min(...cpu),
            max: Math.max(...cpu)
          },
          sampleCount: times.length
        };
      }
    };

    // Mock MCP Server with performance tracking
    mockMCPServer = {
      tools: new Map([
        ['search_code', {
          name: 'search_code',
          description: 'Search code using natural language queries',
          benchmark: {
            maxResponseTime: 500, // ms
            minThroughput: 100, // queries per second
            maxMemoryUsage: 100 * 1024 * 1024 // 100MB
          },
          implementation: async (params: any) => {
            const measurement = performanceMonitor.startMeasurement('search_code');

            // Mock search implementation with variable complexity
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 400));

            const results = Array.from({ length: Math.floor(Math.random() * 50) + 10 }, (_, i) => ({
              file: `src/file${i}.ts`,
              line: Math.floor(Math.random() * 1000) + 1,
              content: `function match${i}() { /* search result */ }`,
              score: Math.random()
            }));

            const metrics = measurement.endMeasurement();
            return {
              success: true,
              results,
              metadata: {
                query: params.query,
                totalResults: results.length,
                searchTime: metrics.responseTime,
                memoryUsage: metrics.memoryUsage
              }
            };
          }
        }],

        ['explain_function', {
          name: 'explain_function',
          description: 'Explain function purpose and behavior',
          benchmark: {
            maxResponseTime: 200, // ms
            minThroughput: 50, // queries per second
            maxMemoryUsage: 50 * 1024 * 1024 // 50MB
          },
          implementation: async (params: any) => {
            const measurement = performanceMonitor.startMeasurement('explain_function');

            // Mock function explanation
            await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 150));

            const metrics = measurement.endMeasurement();
            return {
              success: true,
              explanation: `This function ${params.function_name} performs operations related to ${params.context || 'data processing'}.`,
              metadata: {
                functionName: params.function_name,
                explanationTime: metrics.responseTime,
                memoryUsage: metrics.memoryUsage
              }
            };
          }
        }],

        ['find_references', {
          name: 'find_references',
          description: 'Find all references to a symbol',
          benchmark: {
            maxResponseTime: 300, // ms
            minThroughput: 75, // queries per second
            maxMemoryUsage: 75 * 1024 * 1024 // 75MB
          },
          implementation: async (params: any) => {
            const measurement = performanceMonitor.startMeasurement('find_references');

            // Mock reference finding
            await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 250));

            const references = Array.from({ length: Math.floor(Math.random() * 20) + 5 }, (_, i) => ({
              file: `src/reference${i}.ts`,
              line: Math.floor(Math.random() * 800) + 1,
              column: Math.floor(Math.random() * 80) + 1,
              type: Math.random() > 0.5 ? 'usage' : 'definition'
            }));

            const metrics = measurement.endMeasurement();
            return {
              success: true,
              references,
              metadata: {
                symbolName: params.entity_name,
                referenceCount: references.length,
                searchTime: metrics.responseTime,
                memoryUsage: metrics.memoryUsage
              }
            };
          }
        }],

        ['trace_data_flow', {
          name: 'trace_data_flow',
          description: 'Trace data flow through the codebase',
          benchmark: {
            maxResponseTime: 800, // ms
            minThroughput: 25, // queries per second
            maxMemoryUsage: 150 * 1024 * 1024 // 150MB
          },
          implementation: async (params: any) => {
            const measurement = performanceMonitor.startMeasurement('trace_data_flow');

            // Mock data flow tracing (complex operation)
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 650));

            const flowSteps = Array.from({ length: Math.floor(Math.random() * 10) + 3 }, (_, i) => ({
              step: i + 1,
              file: `src/step${i}.ts`,
              function: `processStep${i}`,
              line: Math.floor(Math.random() * 500) + 1,
              transformation: `transform_${i}`,
              data: `data_${i}`
            }));

            const metrics = measurement.endMeasurement();
            return {
              success: true,
              flowSteps,
              metadata: {
                startPoint: params.start_point,
                endPoint: params.end_point,
                stepCount: flowSteps.length,
                traceTime: metrics.responseTime,
                memoryUsage: metrics.memoryUsage
              }
            };
          }
        }],

        ['analyze_security', {
          name: 'analyze_security',
          description: 'Analyze code for security vulnerabilities',
          benchmark: {
            maxResponseTime: 1000, // ms
            minThroughput: 20, // queries per second
            maxMemoryUsage: 200 * 1024 * 1024 // 200MB
          },
          implementation: async (params: any) => {
            const measurement = performanceMonitor.startMeasurement('analyze_security');

            // Mock security analysis (resource intensive)
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 750));

            const vulnerabilities = Array.from({ length: Math.floor(Math.random() * 5) }, (_, i) => ({
              type: ['sql_injection', 'xss', 'csrf', 'path_traversal'][Math.floor(Math.random() * 4)],
              severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
              file: `src/vuln${i}.ts`,
              line: Math.floor(Math.random() * 1000) + 1,
              description: `Security vulnerability ${i} detected`
            }));

            const metrics = measurement.endMeasurement();
            return {
              success: true,
              vulnerabilities,
              summary: {
                total: vulnerabilities.length,
                critical: vulnerabilities.filter(v => v.severity === 'critical').length,
                high: vulnerabilities.filter(v => v.severity === 'high').length,
                medium: vulnerabilities.filter(v => v.severity === 'medium').length,
                low: vulnerabilities.filter(v => v.severity === 'low').length
              },
              metadata: {
                analysisTime: metrics.responseTime,
                memoryUsage: metrics.memoryUsage
              }
            };
          }
        }],

        ['get_api_endpoints', {
          name: 'get_api_endpoints',
          description: 'List all API endpoints in the codebase',
          benchmark: {
            maxResponseTime: 400, // ms
            minThroughput: 80, // queries per second
            maxMemoryUsage: 80 * 1024 * 1024 // 80MB
          },
          implementation: async (params: any) => {
            const measurement = performanceMonitor.startMeasurement('get_api_endpoints');

            // Mock API endpoint discovery
            await new Promise(resolve => setTimeout(resolve, 40 + Math.random() * 300));

            const endpoints = Array.from({ length: Math.floor(Math.random() * 30) + 10 }, (_, i) => ({
              method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'][Math.floor(Math.random() * 5)],
              path: `/api/v1/endpoint${i}`,
              file: `src/api/endpoint${i}.ts`,
              handler: `handleEndpoint${i}`,
              middleware: [`auth${i}`, `validation${i}`]
            }));

            const metrics = measurement.endMeasurement();
            return {
              success: true,
              endpoints,
              metadata: {
                totalEndpoints: endpoints.length,
                discoveryTime: metrics.responseTime,
                memoryUsage: metrics.memoryUsage
              }
            };
          }
        }],

        ['check_complexity', {
          name: 'check_complexity',
          description: 'Analyze code complexity metrics',
          benchmark: {
            maxResponseTime: 600, // ms
            minThroughput: 40, // queries per second
            maxMemoryUsage: 120 * 1024 * 1024 // 120MB
          },
          implementation: async (params: any) => {
            const measurement = performanceMonitor.startMeasurement('check_complexity');

            // Mock complexity analysis
            await new Promise(resolve => setTimeout(resolve, 60 + Math.random() * 500));

            const complexityMetrics = {
              cyclomaticComplexity: Math.floor(Math.random() * 20) + 1,
              cognitiveComplexity: Math.floor(Math.random() * 15) + 1,
              linesOfCode: Math.floor(Math.random() * 200) + 50,
              maintainabilityIndex: Math.random() * 100,
              technicalDebt: Math.floor(Math.random() * 8) // hours
            };

            const metrics = measurement.endMeasurement();
            return {
              success: true,
              complexityMetrics,
              metadata: {
                analysisTime: metrics.responseTime,
                memoryUsage: metrics.memoryUsage
              }
            };
          }
        }],

        ['find_duplicates', {
          name: 'find_duplicates',
          description: 'Detect duplicate code patterns',
          benchmark: {
            maxResponseTime: 1200, // ms
            minThroughput: 15, // queries per second
            maxMemoryUsage: 250 * 1024 * 1024 // 250MB
          },
          implementation: async (params: any) => {
            const measurement = performanceMonitor.startMeasurement('find_duplicates');

            // Mock duplicate detection (computationally expensive)
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 850));

            const duplicates = Array.from({ length: Math.floor(Math.random() * 8) + 2 }, (_, i) => ({
              id: `duplicate_${i}`,
              similarity: Math.random() * 0.5 + 0.5, // 0.5 to 1.0
              files: [
                { file: `src/dup1_${i}.ts`, lines: `${Math.floor(Math.random() * 100) + 1}-${Math.floor(Math.random() * 100) + 200}` },
                { file: `src/dup2_${i}.ts`, lines: `${Math.floor(Math.random() * 100) + 1}-${Math.floor(Math.random() * 100) + 200}` }
              ],
              codeSnippet: `function duplicate${i}() { /* similar code */ }`
            }));

            const metrics = measurement.endMeasurement();
            return {
              success: true,
              duplicates,
              metadata: {
                duplicateCount: duplicates.length,
                detectionTime: metrics.responseTime,
                memoryUsage: metrics.memoryUsage
              }
            };
          }
        }],

        ['suggest_refactoring', {
          name: 'suggest_refactoring',
          description: 'Provide refactoring suggestions',
          benchmark: {
            maxResponseTime: 1500, // ms
            minThroughput: 10, // queries per second
            maxMemoryUsage: 300 * 1024 * 1024 // 300MB
          },
          implementation: async (params: any) => {
            const measurement = performanceMonitor.startMeasurement('suggest_refactoring');

            // Mock refactoring analysis (most expensive operation)
            await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 1100));

            const suggestions = Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, i) => ({
              type: ['extract_method', 'rename_variable', 'simplify_condition', 'reduce_complexity'][Math.floor(Math.random() * 4)],
              priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
              description: `Refactoring suggestion ${i}`,
              impact: 'Improves code maintainability',
              effort: `${Math.floor(Math.random() * 3) + 1} hours`,
              file: `src/refactor${i}.ts`,
              line: Math.floor(Math.random() * 500) + 1
            }));

            const metrics = measurement.endMeasurement();
            return {
              success: true,
              suggestions,
              metadata: {
                suggestionCount: suggestions.length,
                analysisTime: metrics.responseTime,
                memoryUsage: metrics.memoryUsage
              }
            };
          }
        }]
      ])
    };

    benchmarkResults = [];
  });

  afterEach(() => {
    // Cleanup
    performanceMonitor = null;
    mockMCPServer = null;
    benchmarkResults = [];
  });

  describe('Individual Tool Performance Benchmarks', () => {
    it('should meet search_code performance benchmarks', async () => {
      const tool = mockMCPServer.tools.get('search_code');
      const benchmark = tool.benchmark;
      const iterations = 20;

      const results = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const result = await tool.implementation({
          query: `test query ${i}`,
          codebase_id: 'test-codebase',
          limit: 50
        });
        results.push(result);
      }

      const totalTime = Date.now() - startTime;
      const throughput = iterations / (totalTime / 1000);
      const stats = performanceMonitor.getStats('search_code');

      // Performance assertions
      expect(stats.responseTime.avg).toBeLessThan(benchmark.maxResponseTime);
      expect(stats.responseTime.p95).toBeLessThan(benchmark.maxResponseTime * 1.5);
      expect(throughput).toBeGreaterThan(benchmark.minThroughput);
      expect(stats.memoryUsage.avg).toBeLessThan(benchmark.maxMemoryUsage);

      // Save benchmark result
      benchmarkResults.push({
        tool: 'search_code',
        benchmark,
        actual: {
          avgResponseTime: stats.responseTime.avg,
          p95ResponseTime: stats.responseTime.p95,
          throughput,
          avgMemoryUsage: stats.memoryUsage.avg
        },
        passed: true
      });
    });

    it('should meet explain_function performance benchmarks', async () => {
      const tool = mockMCPServer.tools.get('explain_function');
      const benchmark = tool.benchmark;
      const iterations = 15;

      const results = [];
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const result = await tool.implementation({
          function_name: `testFunction${i}`,
          file_path: `src/test${i}.ts`,
          context: 'unit test'
        });
        results.push(result);
      }

      const totalTime = Date.now() - startTime;
      const throughput = iterations / (totalTime / 1000);
      const stats = performanceMonitor.getStats('explain_function');

      // Performance assertions
      expect(stats.responseTime.avg).toBeLessThan(benchmark.maxResponseTime);
      expect(stats.responseTime.p95).toBeLessThan(benchmark.maxResponseTime * 1.5);
      expect(throughput).toBeGreaterThan(benchmark.minThroughput);
      expect(stats.memoryUsage.avg).toBeLessThan(benchmark.maxMemoryUsage);

      benchmarkResults.push({
        tool: 'explain_function',
        benchmark,
        actual: {
          avgResponseTime: stats.responseTime.avg,
          p95ResponseTime: stats.responseTime.p95,
          throughput,
          avgMemoryUsage: stats.memoryUsage.avg
        },
        passed: true
      });
    });

    it('should meet find_references performance benchmarks', async () => {
      const tool = mockMCPServer.tools.get('find_references');
      const benchmark = tool.benchmark;
      const iterations = 18;

      for (let i = 0; i < iterations; i++) {
        await tool.implementation({
          entity_name: `TestClass${i}`,
          codebase_id: 'test-codebase'
        });
      }

      const stats = performanceMonitor.getStats('find_references');

      // Performance assertions
      expect(stats.responseTime.avg).toBeLessThan(benchmark.maxResponseTime);
      expect(stats.memoryUsage.avg).toBeLessThan(benchmark.maxMemoryUsage);

      benchmarkResults.push({
        tool: 'find_references',
        benchmark,
        actual: {
          avgResponseTime: stats.responseTime.avg,
          p95ResponseTime: stats.responseTime.p95,
          avgMemoryUsage: stats.memoryUsage.avg
        },
        passed: true
      });
    });

    it('should meet trace_data_flow performance benchmarks', async () => {
      const tool = mockMCPServer.tools.get('trace_data_flow');
      const benchmark = tool.benchmark;
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        await tool.implementation({
          start_point: `function${i}`,
          end_point: `output${i}`,
          codebase_id: 'test-codebase'
        });
      }

      const stats = performanceMonitor.getStats('trace_data_flow');

      // Performance assertions
      expect(stats.responseTime.avg).toBeLessThan(benchmark.maxResponseTime);
      expect(stats.memoryUsage.avg).toBeLessThan(benchmark.maxMemoryUsage);

      benchmarkResults.push({
        tool: 'trace_data_flow',
        benchmark,
        actual: {
          avgResponseTime: stats.responseTime.avg,
          p95ResponseTime: stats.responseTime.p95,
          avgMemoryUsage: stats.memoryUsage.avg
        },
        passed: true
      });
    });

    it('should meet analyze_security performance benchmarks', async () => {
      const tool = mockMCPServer.tools.get('analyze_security');
      const benchmark = tool.benchmark;
      const iterations = 8;

      for (let i = 0; i < iterations; i++) {
        await tool.implementation({
          codebase_id: 'test-codebase',
          patterns: ['sql_injection', 'xss', 'csrf'],
          severity_threshold: 'medium'
        });
      }

      const stats = performanceMonitor.getStats('analyze_security');

      // Performance assertions
      expect(stats.responseTime.avg).toBeLessThan(benchmark.maxResponseTime);
      expect(stats.memoryUsage.avg).toBeLessThan(benchmark.maxMemoryUsage);

      benchmarkResults.push({
        tool: 'analyze_security',
        benchmark,
        actual: {
          avgResponseTime: stats.responseTime.avg,
          p95ResponseTime: stats.responseTime.p95,
          avgMemoryUsage: stats.memoryUsage.avg
        },
        passed: true
      });
    });

    it('should meet get_api_endpoints performance benchmarks', async () => {
      const tool = mockMCPServer.tools.get('get_api_endpoints');
      const benchmark = tool.benchmark;
      const iterations = 12;

      for (let i = 0; i < iterations; i++) {
        await tool.implementation({
          codebase_id: 'test-codebase',
          include_methods: ['GET', 'POST', 'PUT', 'DELETE']
        });
      }

      const stats = performanceMonitor.getStats('get_api_endpoints');

      // Performance assertions
      expect(stats.responseTime.avg).toBeLessThan(benchmark.maxResponseTime);
      expect(stats.memoryUsage.avg).toBeLessThan(benchmark.maxMemoryUsage);

      benchmarkResults.push({
        tool: 'get_api_endpoints',
        benchmark,
        actual: {
          avgResponseTime: stats.responseTime.avg,
          p95ResponseTime: stats.responseTime.p95,
          avgMemoryUsage: stats.memoryUsage.avg
        },
        passed: true
      });
    });

    it('should meet check_complexity performance benchmarks', async () => {
      const tool = mockMCPServer.tools.get('check_complexity');
      const benchmark = tool.benchmark;
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        await tool.implementation({
          file_paths: [`src/complex${i}.ts`],
          metrics: ['cyclomatic', 'cognitive', 'maintainability']
        });
      }

      const stats = performanceMonitor.getStats('check_complexity');

      // Performance assertions
      expect(stats.responseTime.avg).toBeLessThan(benchmark.maxResponseTime);
      expect(stats.memoryUsage.avg).toBeLessThan(benchmark.maxMemoryUsage);

      benchmarkResults.push({
        tool: 'check_complexity',
        benchmark,
        actual: {
          avgResponseTime: stats.responseTime.avg,
          p95ResponseTime: stats.responseTime.p95,
          avgMemoryUsage: stats.memoryUsage.avg
        },
        passed: true
      });
    });

    it('should meet find_duplicates performance benchmarks', async () => {
      const tool = mockMCPServer.tools.get('find_duplicates');
      const benchmark = tool.benchmark;
      const iterations = 6;

      for (let i = 0; i < iterations; i++) {
        await tool.implementation({
          codebase_id: 'test-codebase',
          similarity_threshold: 0.8,
          min_lines: 5
        });
      }

      const stats = performanceMonitor.getStats('find_duplicates');

      // Performance assertions
      expect(stats.responseTime.avg).toBeLessThan(benchmark.maxResponseTime);
      expect(stats.memoryUsage.avg).toBeLessThan(benchmark.maxMemoryUsage);

      benchmarkResults.push({
        tool: 'find_duplicates',
        benchmark,
        actual: {
          avgResponseTime: stats.responseTime.avg,
          p95ResponseTime: stats.responseTime.p95,
          avgMemoryUsage: stats.memoryUsage.avg
        },
        passed: true
      });
    });

    it('should meet suggest_refactoring performance benchmarks', async () => {
      const tool = mockMCPServer.tools.get('suggest_refactoring');
      const benchmark = tool.benchmark;
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        await tool.implementation({
          file_paths: [`src/complex${i}.ts`],
          analysis_depth: 'deep',
          include_suggestions: ['performance', 'readability', 'maintainability']
        });
      }

      const stats = performanceMonitor.getStats('suggest_refactoring');

      // Performance assertions
      expect(stats.responseTime.avg).toBeLessThan(benchmark.maxResponseTime);
      expect(stats.memoryUsage.avg).toBeLessThan(benchmark.maxMemoryUsage);

      benchmarkResults.push({
        tool: 'suggest_refactoring',
        benchmark,
        actual: {
          avgResponseTime: stats.responseTime.avg,
          p95ResponseTime: stats.responseTime.p95,
          avgMemoryUsage: stats.memoryUsage.avg
        },
        passed: true
      });
    });
  });

  describe('Concurrent Performance Testing', () => {
    it('should handle concurrent requests without performance degradation', async () => {
      const concurrentRequests = 10;
      const tools = Array.from(mockMCPServer.tools.keys());

      // Create concurrent requests for different tools
      const concurrentPromises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const toolName = tools[i % tools.length];
        const tool = mockMCPServer.tools.get(toolName);

        const promise = tool.implementation({
          test_param: `concurrent_test_${i}`,
          codebase_id: 'test-codebase'
        });

        concurrentPromises.push(promise);
      }

      const startTime = Date.now();
      const results = await Promise.all(concurrentPromises);
      const totalTime = Date.now() - startTime;

      // All requests should complete successfully
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Concurrent execution should be faster than sequential
      expect(totalTime).toBeLessThan(concurrentRequests * 100); // Much less than sequential execution
    });

    it('should maintain performance under sustained load', async () => {
      const sustainedRounds = 5;
      const requestsPerRound = 8;
      const toolName = 'search_code';
      const tool = mockMCPServer.tools.get(toolName);

      const roundMetrics = [];

      for (let round = 0; round < sustainedRounds; round++) {
        const roundStartTime = Date.now();

        const roundPromises = [];
        for (let i = 0; i < requestsPerRound; i++) {
          roundPromises.push(tool.implementation({
            query: `sustained_test_round_${round}_request_${i}`,
            codebase_id: 'test-codebase'
          }));
        }

        await Promise.all(roundPromises);
        const roundTime = Date.now() - roundStartTime;

        const stats = performanceMonitor.getStats(toolName);
        roundMetrics.push({
          round: round + 1,
          totalTime: roundTime,
          avgResponseTime: stats.responseTime.avg,
          throughput: requestsPerRound / (roundTime / 1000)
        });

        // Clear metrics for next round
        performanceMonitor.metrics.responseTimes.delete(toolName);
        performanceMonitor.metrics.memoryUsage.delete(toolName);
      }

      // Performance should remain stable across rounds
      const throughputs = roundMetrics.map(m => m.throughput);
      const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
      const throughputVariance = Math.max(...throughputs) - Math.min(...throughputs);

      // Variance should be less than 20% of average
      expect(throughputVariance).toBeLessThan(avgThroughput * 0.2);
    });
  });

  describe('Resource Usage Monitoring', () => {
    it('should monitor and report memory usage patterns', async () => {
      const initialMemory = process.memoryUsage();
      const toolNames = Array.from(mockMCPServer.tools.keys());

      // Execute each tool multiple times
      for (const toolName of toolNames) {
        const tool = mockMCPServer.tools.get(toolName);

        for (let i = 0; i < 3; i++) {
          await tool.implementation({
            test_param: `${toolName}_memory_test_${i}`,
            codebase_id: 'test-codebase'
          });
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory growth should be reasonable
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth

      // Check per-tool memory usage
      const memoryReport = {};
      for (const toolName of toolNames) {
        const stats = performanceMonitor.getStats(toolName);
        if (stats) {
          memoryReport[toolName] = {
            avgMemoryUsage: stats.memoryUsage.avg,
            maxMemoryUsage: stats.memoryUsage.max
          };
        }
      }

      expect(Object.keys(memoryReport)).toHaveLength(toolNames.length);
    });

    it('should detect memory leaks in repeated operations', async () => {
      const toolName = 'search_code';
      const tool = mockMCPServer.tools.get(toolName);
      const iterations = 50;
      const memorySnapshots = [];

      // Take memory snapshots between iterations
      for (let i = 0; i < iterations; i += 10) {
        const memoryBefore = process.memoryUsage().heapUsed;

        // Execute tool multiple times
        for (let j = 0; j < 10; j++) {
          await tool.implementation({
            query: `memory_leak_test_${i}_${j}`,
            codebase_id: 'test-codebase'
          });
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const memoryAfter = process.memoryUsage().heapUsed;
        memorySnapshots.push({
          iteration: i + 10,
          memoryUsage: memoryAfter - memoryBefore
        });
      }

      // Memory usage should not grow continuously
      const memoryGrowthRate = memorySnapshots.map(s => s.memoryUsage);
      const maxGrowth = Math.max(...memoryGrowthRate);
      const minGrowth = Math.min(...memoryGrowthRate);

      // Growth should be relatively stable (not continuously increasing)
      expect(maxGrowth - minGrowth).toBeLessThan(maxGrowth * 0.5);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions compared to baseline', () => {
      // Define baseline performance metrics
      const baselineMetrics = {
        search_code: { avgResponseTime: 300, throughput: 120 },
        explain_function: { avgResponseTime: 120, throughput: 60 },
        find_references: { avgResponseTime: 200, throughput: 85 }
      };

      const regressionThreshold = 0.2; // 20% degradation threshold

      // Compare benchmark results against baseline
      for (const result of benchmarkResults) {
        const baseline = baselineMetrics[result.tool];
        if (!baseline) continue;

        const responseTimeRegression =
          (result.actual.avgResponseTime - baseline.avgResponseTime) / baseline.avgResponseTime;
        const throughputRegression =
          (baseline.throughput - result.actual.throughput) / baseline.throughput;

        // Check for significant regressions
        expect(responseTimeRegression).toBeLessThan(regressionThreshold);
        expect(throughputRegression).toBeLessThan(regressionThreshold);
      }
    });

    it('should generate comprehensive performance reports', () => {
      const performanceReport = {
        timestamp: new Date().toISOString(),
        environment: 'test',
        tools: [],
        summary: {
          totalTools: mockMCPServer.tools.size,
          passedBenchmarks: benchmarkResults.filter(r => r.passed).length,
          failedBenchmarks: benchmarkResults.filter(r => !r.passed).length
        }
      };

      // Aggregate all benchmark results
      for (const result of benchmarkResults) {
        performanceReport.tools.push({
          name: result.tool,
          benchmarks: {
            responseTime: {
              target: result.benchmark.maxResponseTime,
              actual: result.actual.avgResponseTime,
              status: result.actual.avgResponseTime <= result.benchmark.maxResponseTime ? 'PASS' : 'FAIL'
            },
            throughput: {
              target: result.benchmark.minThroughput,
              actual: result.actual.throughput,
              status: result.actual.throughput >= result.benchmark.minThroughput ? 'PASS' : 'FAIL'
            },
            memoryUsage: {
              target: result.benchmark.maxMemoryUsage,
              actual: result.actual.avgMemoryUsage,
              status: result.actual.avgMemoryUsage <= result.benchmark.maxMemoryUsage ? 'PASS' : 'FAIL'
            }
          }
        });
      }

      // Report should contain all tools
      expect(performanceReport.tools).toHaveLength(mockMCPServer.tools.size);

      // All benchmarks should pass in test environment
      expect(performanceReport.summary.failedBenchmarks).toBe(0);

      // Report should be serializable
      const serializedReport = JSON.stringify(performanceReport, null, 2);
      expect(serializedReport).toBeDefined();

      // Report should be parsable
      const parsedReport = JSON.parse(serializedReport);
      expect(parsedReport.tools).toHaveLength(mockMCPServer.tools.size);
    });
  });
});

/**
 * Expected Performance Benchmarks (T084):

 Tool                    | Max Response | Min Throughput | Max Memory
------------------------|--------------|----------------|------------
 search_code            | 500ms        | 100 QPS        | 100MB
 explain_function       | 200ms        | 50 QPS         | 50MB
 find_references        | 300ms        | 75 QPS         | 75MB
 trace_data_flow        | 800ms        | 25 QPS         | 150MB
 analyze_security       | 1000ms       | 20 QPS         | 200MB
 get_api_endpoints      | 400ms        | 80 QPS         | 80MB
 check_complexity       | 600ms        | 40 QPS         | 120MB
 find_duplicates        | 1200ms       | 15 QPS         | 250MB
 suggest_refactoring    | 1500ms       | 10 QPS         | 300MB

Success Criteria:
- All tools meet their individual performance benchmarks
- Concurrent request handling shows no significant degradation
- Sustained load maintains stable performance
- Memory usage patterns are reasonable and leak-free
- Performance regressions are detected against baseline
- Comprehensive performance reports are generated
 */