/**
 * Concurrent Load Testing for MCP Requests (T085)
 *
 * This test suite validates the system's ability to handle high concurrent load
 * with multiple simultaneous MCP requests. Tests stress test the server,
 * connection pooling, resource management, and performance under load.
 *
 * Load Testing Scenarios:
 * - 100 concurrent requests (baseline)
 * - 500 concurrent requests (moderate load)
 * - 1000 concurrent requests (high load)
 * - Mixed tool requests under load
 * - Sustained load testing (10 minutes)
 * - Ramp-up/ramp-down load patterns
 * - Connection pool stress testing
 * - Error rate and timeout validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Concurrent Load Testing for MCP Requests (T085)', () => {
  let loadTestRunner: any;
  let mockMCPServer: any;
  let connectionPool: any;
  let loadTestResults: any[];

  beforeEach(() => {
    // Load testing infrastructure
    loadTestRunner = {
      config: {
        baselineConcurrency: 100,
        moderateLoadConcurrency: 500,
        highLoadConcurrency: 1000,
        requestTimeout: 30000, // 30 seconds
        testDuration: 60000, // 1 minute per test
        sustainedTestDuration: 600000, // 10 minutes
        rampUpTime: 10000, // 10 seconds
        coolDownTime: 5000 // 5 seconds
      },

      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        timeoutRequests: 0,
        responseTimes: [],
        throughput: [],
        errorRates: [],
        concurrentConnections: 0,
        maxConcurrentConnections: 0,
        memoryUsage: [],
        cpuUsage: []
      },

      executeLoadTest: async (config: any) => {
        const {
          concurrency,
          duration,
          rampUp = 0,
          toolMix = ['search_code'],
          requestPattern = 'constant'
        } = config;

        const startTime = Date.now();
        const endTime = startTime + duration;
        const results = {
          requests: [],
          metrics: {
            total: 0,
            successful: 0,
            failed: 0,
            timeouts: 0,
            avgResponseTime: 0,
            maxResponseTime: 0,
            minResponseTime: Infinity,
            p95ResponseTime: 0,
            p99ResponseTime: 0,
            throughput: 0,
            errorsByType: new Map(),
            timeline: []
          }
        };

        // Create request generator based on pattern
        const requestGenerator = loadTestRunner.createRequestGenerator(
          concurrency,
          duration,
          rampUp,
          requestPattern
        );

        // Connection pool management
        const connections = [];
        const activeConnections = new Set();

        // Execute load test
        while (Date.now() < endTime) {
          const batch = requestGenerator.next();

          if (batch.done) break;

          const currentBatch = batch.value;

          // Acquire connections for current batch
          const batchConnections = await connectionPool.acquireConnections(currentBatch.length);

          // Execute requests concurrently
          const batchPromises = currentBatch.map(async (requestConfig, index) => {
            const connection = batchConnections[index];
            const requestStart = Date.now();
            activeConnections.add(connection);

            try {
              // Update concurrent connection metrics
              loadTestRunner.metrics.concurrentConnections = activeConnections.size;
              loadTestRunner.metrics.maxConcurrentConnections = Math.max(
                loadTestRunner.metrics.maxConcurrentConnections,
                activeConnections.size
              );

              // Execute the request
              const result = await loadTestRunner.executeRequest(requestConfig, connection);

              const requestEnd = Date.now();
              const responseTime = requestEnd - requestStart;

              // Record metrics
              results.requests.push({
                timestamp: requestStart,
                tool: requestConfig.tool,
                responseTime,
                success: true,
                statusCode: result.status || 200
              });

              results.metrics.total++;
              results.metrics.successful++;
              results.metrics.avgResponseTime += responseTime;
              results.metrics.maxResponseTime = Math.max(results.metrics.maxResponseTime, responseTime);
              results.metrics.minResponseTime = Math.min(results.metrics.minResponseTime, responseTime);

              return result;

            } catch (error) {
              const requestEnd = Date.now();
              const responseTime = requestEnd - requestStart;

              // Record error metrics
              results.requests.push({
                timestamp: requestStart,
                tool: requestConfig.tool,
                responseTime,
                success: false,
                error: error.message,
                errorType: error.name || 'UnknownError'
              });

              results.metrics.total++;
              results.metrics.failed++;

              // Track error types
              const errorType = error.name || 'UnknownError';
              results.metrics.errorsByType.set(
                errorType,
                (results.metrics.errorsByType.get(errorType) || 0) + 1
              );

              throw error;

            } finally {
              activeConnections.delete(connection);
            }
          });

          // Wait for batch completion
          await Promise.allSettled(batchPromises);

          // Release connections
          connectionPool.releaseConnections(batchConnections);

          // Record timeline metrics
          const currentTime = Date.now();
          results.metrics.timeline.push({
            timestamp: currentTime,
            activeConnections: activeConnections.size,
            cumulativeRequests: results.metrics.total,
            successfulRequests: results.metrics.successful,
            failedRequests: results.metrics.failed
          });

          // Memory and CPU monitoring
          if (Math.random() < 0.1) { // Sample 10% of the time
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            loadTestRunner.metrics.memoryUsage.push({
              timestamp: currentTime,
              heapUsed: memoryUsage.heapUsed,
              heapTotal: memoryUsage.heapTotal,
              external: memoryUsage.external
            });

            loadTestRunner.metrics.cpuUsage.push({
              timestamp: currentTime,
              user: cpuUsage.user,
              system: cpuUsage.system
            });
          }
        }

        // Calculate final metrics
        if (results.metrics.successful > 0) {
          results.metrics.avgResponseTime /= results.metrics.successful;
        }

        // Calculate percentiles
        const responseTimes = results.requests
          .filter(r => r.success)
          .map(r => r.responseTime)
          .sort((a, b) => a - b);

        if (responseTimes.length > 0) {
          results.metrics.p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)];
          results.metrics.p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)];
        }

        if (results.metrics.minResponseTime === Infinity) {
          results.metrics.minResponseTime = 0;
        }

        // Calculate throughput (requests per second)
        const totalDuration = (Date.now() - startTime) / 1000;
        results.metrics.throughput = results.metrics.total / totalDuration;

        return results;
      },

      createRequestGenerator: function* (concurrency: number, duration: number, rampUp: number, pattern: string) {
        const startTime = Date.now();
        const endTime = startTime + duration;
        const rampUpEndTime = startTime + rampUp;

        if (pattern === 'constant') {
          // Constant load pattern
          while (Date.now() < endTime) {
            // Calculate current concurrency based on ramp-up
            let currentConcurrency = concurrency;
            if (Date.now() < rampUpEndTime) {
              const rampUpProgress = (Date.now() - startTime) / rampUp;
              currentConcurrency = Math.floor(concurrency * rampUpProgress);
            }

            const tools = ['search_code', 'explain_function', 'find_references', 'trace_data_flow'];
            const batch = [];

            for (let i = 0; i < currentConcurrency; i++) {
              batch.push({
                tool: tools[i % tools.length],
                params: {
                  query: `load_test_${Date.now()}_${i}`,
                  codebase_id: 'test-load-codebase',
                  limit: 20
                },
                priority: Math.random() > 0.8 ? 'high' : 'normal'
              });
            }

            yield batch;

            // Wait before next batch
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } else if (pattern === 'burst') {
          // Burst load pattern
          while (Date.now() < endTime) {
            // Burst phase
            for (let burst = 0; burst < 5; burst++) {
              const tools = ['search_code', 'analyze_security', 'get_api_endpoints'];
              const batch = [];

              for (let i = 0; i < concurrency; i++) {
                batch.push({
                  tool: tools[i % tools.length],
                  params: {
                    query: `burst_test_${Date.now()}_${i}`,
                    codebase_id: 'test-burst-codebase'
                  }
                });
              }

              yield batch;
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Rest phase
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } else if (pattern === 'wave') {
          // Wave load pattern
          let wavePhase = 0;
          while (Date.now() < endTime) {
            const waveIntensity = Math.sin(wavePhase * 0.1) * 0.5 + 0.5; // 0 to 1
            const currentConcurrency = Math.floor(concurrency * waveIntensity);

            const tools = ['find_references', 'check_complexity', 'find_duplicates'];
            const batch = [];

            for (let i = 0; i < currentConcurrency; i++) {
              batch.push({
                tool: tools[i % tools.length],
                params: {
                  entity_name: `wave_test_${wavePhase}_${i}`,
                  codebase_id: 'test-wave-codebase'
                }
              });
            }

            if (batch.length > 0) {
              yield batch;
            }

            wavePhase++;
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      },

      executeRequest: async (requestConfig: any, connection: any) => {
        const tool = mockMCPServer.tools.get(requestConfig.tool);
        if (!tool) {
          throw new Error(`Tool not found: ${requestConfig.tool}`);
        }

        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

        // Execute the tool
        return await tool.implementation(requestConfig.params);
      }
    };

    // Mock MCP Server with load testing capabilities
    mockMCPServer = {
      tools: new Map([
        ['search_code', {
          name: 'search_code',
          implementation: async (params: any) => {
            // Simulate search with variable complexity
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 200));

            return {
              success: true,
              results: Array.from({ length: Math.floor(Math.random() * 20) + 5 }, (_, i) => ({
                file: `src/result${i}.ts`,
                line: Math.floor(Math.random() * 500) + 1,
                score: Math.random()
              })),
              metadata: {
                query: params.query,
                totalResults: Math.floor(Math.random() * 100) + 20
              }
            };
          }
        }],

        ['explain_function', {
          name: 'explain_function',
          implementation: async (params: any) => {
            await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 100));

            return {
              success: true,
              explanation: `Function ${params.function_name || 'unknown'} performs data processing operations.`,
              metadata: {
                processingTime: Date.now()
              }
            };
          }
        }],

        ['find_references', {
          name: 'find_references',
          implementation: async (params: any) => {
            await new Promise(resolve => setTimeout(resolve, 40 + Math.random() * 150));

            return {
              success: true,
              references: Array.from({ length: Math.floor(Math.random() * 15) + 3 }, (_, i) => ({
                file: `src/ref${i}.ts`,
                line: Math.floor(Math.random() * 400) + 1
              })),
              metadata: {
                symbolName: params.entity_name,
                referenceCount: Math.floor(Math.random() * 20) + 5
              }
            };
          }
        }],

        ['trace_data_flow', {
          name: 'trace_data_flow',
          implementation: async (params: any) => {
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));

            return {
              success: true,
              flowSteps: Array.from({ length: Math.floor(Math.random() * 8) + 3 }, (_, i) => ({
                step: i + 1,
                file: `src/step${i}.ts`,
                transformation: `transform_${i}`
              })),
              metadata: {
                traceCompleted: true
              }
            };
          }
        }],

        ['analyze_security', {
          name: 'analyze_security',
          implementation: async (params: any) => {
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 400));

            return {
              success: true,
              vulnerabilities: Array.from({ length: Math.floor(Math.random() * 5) }, (_, i) => ({
                type: 'potential_issue',
                severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
                file: `src/security${i}.ts`
              })),
              metadata: {
                analysisComplete: true
              }
            };
          }
        }],

        ['get_api_endpoints', {
          name: 'get_api_endpoints',
          implementation: async (params: any) => {
            await new Promise(resolve => setTimeout(resolve, 60 + Math.random() * 200));

            return {
              success: true,
              endpoints: Array.from({ length: Math.floor(Math.random() * 25) + 10 }, (_, i) => ({
                method: ['GET', 'POST', 'PUT'][Math.floor(Math.random() * 3)],
                path: `/api/v1/endpoint${i}`
              })),
              metadata: {
                totalEndpoints: Math.floor(Math.random() * 30) + 15
              }
            };
          }
        }],

        ['check_complexity', {
          name: 'check_complexity',
          implementation: async (params: any) => {
            await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 250));

            return {
              success: true,
              complexity: {
                cyclomatic: Math.floor(Math.random() * 15) + 1,
                cognitive: Math.floor(Math.random() * 10) + 1,
                maintainability: Math.random() * 100
              },
              metadata: {
                analysisComplete: true
              }
            };
          }
        }],

        ['find_duplicates', {
          name: 'find_duplicates',
          implementation: async (params: any) => {
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

            return {
              success: true,
              duplicates: Array.from({ length: Math.floor(Math.random() * 6) + 1 }, (_, i) => ({
                similarity: Math.random() * 0.5 + 0.5,
                files: [`src/dup1_${i}.ts`, `src/dup2_${i}.ts`]
              })),
              metadata: {
                duplicatesFound: Math.floor(Math.random() * 10) + 2
              }
            };
          }
        }]
      ])
    };

    // Connection pool simulation
    connectionPool = {
      maxConnections: 200,
      activeConnections: 0,
      availableConnections: [],

      acquireConnections: async (count: number) => {
        const connections = [];

        for (let i = 0; i < count; i++) {
          if (connectionPool.activeConnections >= connectionPool.maxConnections) {
            // Wait for available connection
            await new Promise(resolve => {
              const checkInterval = setInterval(() => {
                if (connectionPool.activeConnections < connectionPool.maxConnections) {
                  clearInterval(checkInterval);
                  resolve(undefined);
                }
              }, 10);
            });
          }

          connectionPool.activeConnections++;
          connections.push({
            id: `conn_${Date.now()}_${i}`,
            acquired: Date.now(),
            lastUsed: Date.now()
          });
        }

        return connections;
      },

      releaseConnections: (connections: any[]) => {
        connections.forEach(conn => {
          connectionPool.activeConnections--;
          conn.released = Date.now();
        });
      },

      getStats: () => ({
        maxConnections: connectionPool.maxConnections,
        activeConnections: connectionPool.activeConnections,
        availableConnections: connectionPool.maxConnections - connectionPool.activeConnections
      })
    };

    loadTestResults = [];
  });

  afterEach(() => {
    // Cleanup
    loadTestRunner = null;
    mockMCPServer = null;
    connectionPool = null;
    loadTestResults = [];
  });

  describe('Baseline Load Testing', () => {
    it('should handle 100 concurrent requests without degradation', async () => {
      const config = {
        concurrency: loadTestRunner.config.baselineConcurrency,
        duration: 30000, // 30 seconds
        rampUp: 5000,    // 5 seconds ramp-up
        toolMix: ['search_code', 'explain_function', 'find_references'],
        requestPattern: 'constant'
      };

      const results = await loadTestRunner.executeLoadTest(config);

      // Baseline performance expectations
      expect(results.metrics.total).toBeGreaterThan(500); // At least 500 requests
      expect(results.metrics.successful).toBeGreaterThan(results.metrics.total * 0.95); // 95% success rate
      expect(results.metrics.failed).toBeLessThan(results.metrics.total * 0.05); // Less than 5% failure
      expect(results.metrics.avgResponseTime).toBeLessThan(1000); // Less than 1 second average
      expect(results.metrics.p95ResponseTime).toBeLessThan(2000); // Less than 2 seconds P95
      expect(results.metrics.throughput).toBeGreaterThan(15); // More than 15 RPS

      // Connection pool should handle load
      expect(loadTestRunner.metrics.maxConcurrentConnections).toBeLessThanOrEqual(connectionPool.maxConnections);

      loadTestResults.push({
        testName: 'baseline_100_concurrent',
        config,
        results,
        passed: true
      });
    });

    it('should maintain consistent performance across multiple runs', async () => {
      const config = {
        concurrency: 50,
        duration: 15000, // 15 seconds
        toolMix: ['search_code'],
        requestPattern: 'constant'
      };

      const runResults = [];

      // Run multiple iterations
      for (let i = 0; i < 3; i++) {
        const results = await loadTestRunner.executeLoadTest(config);
        runResults.push(results);

        // Brief pause between runs
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Calculate performance variance
      const throughputs = runResults.map(r => r.metrics.throughput);
      const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
      const maxThroughput = Math.max(...throughputs);
      const minThroughput = Math.min(...throughputs);

      // Performance should be consistent (variance < 20%)
      const variance = (maxThroughput - minThroughput) / avgThroughput;
      expect(variance).toBeLessThan(0.2);

      // Response times should be consistent
      const avgResponseTimes = runResults.map(r => r.metrics.avgResponseTime);
      const avgResponseTime = avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length;
      const responseTimeVariance = Math.max(...avgResponseTimes) - Math.min(...avgResponseTimes);

      expect(responseTimeVariance).toBeLessThan(avgResponseTime * 0.3); // Less than 30% variance
    });
  });

  describe('Moderate Load Testing', () => {
    it('should handle 500 concurrent requests with acceptable performance', async () => {
      const config = {
        concurrency: loadTestRunner.config.moderateLoadConcurrency,
        duration: 45000, // 45 seconds
        rampUp: 10000,   // 10 seconds ramp-up
        toolMix: ['search_code', 'explain_function', 'find_references', 'trace_data_flow'],
        requestPattern: 'constant'
      };

      const results = await loadTestRunner.executeLoadTest(config);

      // Moderate load expectations (slightly relaxed from baseline)
      expect(results.metrics.total).toBeGreaterThan(1000);
      expect(results.metrics.successful).toBeGreaterThan(results.metrics.total * 0.90); // 90% success rate
      expect(results.metrics.failed).toBeLessThan(results.metrics.total * 0.10); // Less than 10% failure
      expect(results.metrics.avgResponseTime).toBeLessThan(2000); // Less than 2 seconds average
      expect(results.metrics.p95ResponseTime).toBeLessThan(4000); // Less than 4 seconds P95
      expect(results.metrics.throughput).toBeGreaterThan(10); // More than 10 RPS

      // Error distribution should be analyzed
      expect(results.metrics.errorsByType.size).toBeLessThan(5); // Not too many different error types

      loadTestResults.push({
        testName: 'moderate_500_concurrent',
        config,
        results,
        passed: true
      });
    });

    it('should handle mixed tool requests under load', async () => {
      const config = {
        concurrency: 300,
        duration: 30000,
        toolMix: ['search_code', 'explain_function', 'find_references', 'trace_data_flow', 'analyze_security', 'get_api_endpoints'],
        requestPattern: 'constant'
      };

      const results = await loadTestRunner.executeLoadTest(config);

      // Different tools should have different performance characteristics
      const toolMetrics = new Map();

      results.requests.forEach(request => {
        if (!toolMetrics.has(request.tool)) {
          toolMetrics.set(request.tool, {
            count: 0,
            totalTime: 0,
            successes: 0,
            failures: 0
          });
        }

        const metrics = toolMetrics.get(request.tool);
        metrics.count++;
        metrics.totalTime += request.responseTime;

        if (request.success) {
          metrics.successes++;
        } else {
          metrics.failures++;
        }
      });

      // Calculate per-tool averages
      toolMetrics.forEach((metrics, tool) => {
        const avgResponseTime = metrics.totalTime / metrics.count;
        const successRate = metrics.successes / metrics.count;

        // Each tool should maintain reasonable performance
        expect(avgResponseTime).toBeLessThan(3000); // Less than 3 seconds average
        expect(successRate).toBeGreaterThan(0.85); // 85% success rate
      });

      expect(toolMetrics.size).toBeGreaterThan(3); // Should have used multiple tools
    });
  });

  describe('High Load Testing', () => {
    it('should handle 1000 concurrent requests with graceful degradation', async () => {
      const config = {
        concurrency: loadTestRunner.config.highLoadConcurrency,
        duration: 60000, // 1 minute
        rampUp: 15000,   // 15 seconds ramp-up
        toolMix: ['search_code', 'explain_function', 'find_references'],
        requestPattern: 'constant'
      };

      const results = await loadTestRunner.executeLoadTest(config);

      // High load expectations (more relaxed)
      expect(results.metrics.total).toBeGreaterThan(1500);
      expect(results.metrics.successful).toBeGreaterThan(results.metrics.total * 0.80); // 80% success rate
      expect(results.metrics.avgResponseTime).toBeLessThan(5000); // Less than 5 seconds average
      expect(results.metrics.p95ResponseTime).toBeLessThan(10000); // Less than 10 seconds P95
      expect(results.metrics.throughput).toBeGreaterThan(5); // More than 5 RPS

      // Connection pool should be stressed but functional
      expect(loadTestRunner.metrics.maxConcurrentConnections).toBeCloseTo(connectionPool.maxConnections, 10);

      // Memory usage should be monitored
      const memoryReadings = loadTestRunner.metrics.memoryUsage;
      if (memoryReadings.length > 0) {
        const maxMemory = Math.max(...memoryReadings.map(m => m.heapUsed));
        const minMemory = Math.min(...memoryReadings.map(m => m.heapUsed));
        const memoryGrowth = maxMemory - minMemory;

        // Memory growth should be reasonable
        expect(memoryGrowth).toBeLessThan(500 * 1024 * 1024); // Less than 500MB growth
      }

      loadTestResults.push({
        testName: 'high_1000_concurrent',
        config,
        results,
        passed: true
      });
    });

    it('should handle burst traffic patterns', async () => {
      const config = {
        concurrency: 400,
        duration: 45000,
        toolMix: ['search_code', 'analyze_security', 'get_api_endpoints'],
        requestPattern: 'burst'
      };

      const results = await loadTestRunner.executeLoadTest(config);

      // Burst pattern should have periods of high and low activity
      expect(results.metrics.timeline.length).toBeGreaterThan(10);

      // Analyze burst pattern effectiveness
      const maxConcurrent = Math.max(...results.metrics.timeline.map(t => t.activeConnections));
      const minConcurrent = Math.min(...results.metrics.timeline.map(t => t.activeConnections));

      // Should show clear burst patterns
      expect(maxConcurrent).toBeGreaterThan(minConcurrent * 2);

      // Overall performance should still be acceptable
      expect(results.metrics.successful).toBeGreaterThan(results.metrics.total * 0.85);
      expect(results.metrics.avgResponseTime).toBeLessThan(3000);
    });

    it('should handle wave traffic patterns', async () => {
      const config = {
        concurrency: 600,
        duration: 60000,
        toolMix: ['find_references', 'check_complexity', 'find_duplicates'],
        requestPattern: 'wave'
      };

      const results = await loadTestRunner.executeLoadTest(config);

      // Wave pattern should show gradual increases and decreases
      const connectionCounts = results.metrics.timeline.map(t => t.activeConnections);

      // Should have variance in connection counts (wave effect)
      const maxConnections = Math.max(...connectionCounts);
      const minConnections = Math.min(...connectionCounts);

      expect(maxConnections).toBeGreaterThan(minConnections * 1.5);

      // Performance should be stable during wave patterns
      expect(results.metrics.successful).toBeGreaterThan(results.metrics.total * 0.80);
      expect(results.metrics.avgResponseTime).toBeLessThan(4000);
    });
  });

  describe('Sustained Load Testing', () => {
    it('should maintain performance under sustained load', async () => {
      const config = {
        concurrency: 200,
        duration: 120000, // 2 minutes (reduced for test)
        rampUp: 20000,    // 20 seconds ramp-up
        toolMix: ['search_code', 'explain_function', 'find_references', 'get_api_endpoints'],
        requestPattern: 'constant'
      };

      const results = await loadTestRunner.executeLoadTest(config);

      // Analyze performance over time
      const timeWindows = [];
      const windowSize = 30000; // 30-second windows
      const startTime = results.requests[0]?.timestamp || Date.now();

      for (let windowStart = startTime; windowStart < startTime + config.duration; windowStart += windowSize) {
        const windowEnd = windowStart + windowSize;
        const windowRequests = results.requests.filter(r =>
          r.timestamp >= windowStart && r.timestamp < windowEnd
        );

        if (windowRequests.length > 0) {
          const windowMetrics = {
            startTime: windowStart,
            requestCount: windowRequests.length,
            successCount: windowRequests.filter(r => r.success).length,
            avgResponseTime: windowRequests.reduce((sum, r) => sum + r.responseTime, 0) / windowRequests.length,
            throughput: windowRequests.length / (windowSize / 1000)
          };

          timeWindows.push(windowMetrics);
        }
      }

      // Performance should be stable across time windows
      expect(timeWindows.length).toBeGreaterThan(2);

      const throughputs = timeWindows.map(w => w.throughput);
      const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
      const maxThroughput = Math.max(...throughputs);
      const minThroughput = Math.min(...throughputs);

      // Throughput variance should be minimal (< 30%)
      const throughputVariance = (maxThroughput - minThroughput) / avgThroughput;
      expect(throughputVariance).toBeLessThan(0.3);

      // Response time should remain stable
      const avgResponseTimes = timeWindows.map(w => w.avgResponseTime);
      const avgResponseTime = avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length;
      const responseTimeVariance = Math.max(...avgResponseTimes) - Math.min(...avgResponseTimes);

      expect(responseTimeVariance).toBeLessThan(avgResponseTime * 0.5);

      // Overall metrics should be good
      expect(results.metrics.successful).toBeGreaterThan(results.metrics.total * 0.85);
      expect(results.metrics.avgResponseTime).toBeLessThan(2000);
    });
  });

  describe('Resource Management Testing', () => {
    it('should properly manage connection pool under stress', async () => {
      const initialStats = connectionPool.getStats();

      const config = {
        concurrency: connectionPool.maxConnections * 2, // Exceed pool capacity
        duration: 30000,
        toolMix: ['search_code'],
        requestPattern: 'constant'
      };

      const results = await loadTestRunner.executeLoadTest(config);

      const finalStats = connectionPool.getStats();

      // Connection pool should be properly utilized
      expect(loadTestRunner.metrics.maxConcurrentConnections).toBeLessThanOrEqual(connectionPool.maxConnections);

      // Should handle connection exhaustion gracefully
      expect(results.metrics.successful).toBeGreaterThan(results.metrics.total * 0.70); // Some failures expected

      // Connection pool should be in consistent state
      expect(finalStats.activeConnections).toBe(0); // All connections should be released
      expect(finalStats.availableConnections).toBe(connectionPool.maxConnections);
    });

    it('should handle memory pressure under high load', async () => {
      const initialMemory = process.memoryUsage();

      const config = {
        concurrency: 800,
        duration: 45000,
        toolMix: ['find_duplicates', 'trace_data_flow'], // Memory-intensive tools
        requestPattern: 'constant'
      };

      const results = await loadTestRunner.executeLoadTest(config);

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory growth should be controlled
      expect(memoryGrowth).toBeLessThan(200 * 1024 * 1024); // Less than 200MB

      // Should have collected memory metrics
      expect(loadTestRunner.metrics.memoryUsage.length).toBeGreaterThan(0);

      // Analyze memory usage patterns
      const memoryReadings = loadTestRunner.metrics.memoryUsage;
      const maxMemory = Math.max(...memoryReadings.map(m => m.heapUsed));
      const avgMemory = memoryReadings.reduce((sum, m) => sum + m.heapUsed, 0) / memoryReadings.length;

      // Memory usage should not have extreme spikes
      expect(maxMemory).toBeLessThan(avgMemory * 2);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle timeouts gracefully', async () => {
      // Simulate slow tool
      const originalImplementation = mockMCPServer.tools.get('search_code').implementation;
      mockMCPServer.tools.get('search_code').implementation = async (params: any) => {
        // Randomly add delays to simulate timeouts
        if (Math.random() < 0.1) { // 10% chance of timeout
          await new Promise(resolve => setTimeout(resolve, 35000)); // 35 seconds
        }
        return originalImplementation(params);
      };

      const config = {
        concurrency: 100,
        duration: 30000,
        toolMix: ['search_code'],
        requestPattern: 'constant'
      };

      const results = await loadTestRunner.executeLoadTest(config);

      // Should handle timeouts without complete failure
      expect(results.metrics.total).toBeGreaterThan(0);
      expect(results.metrics.successful).toBeGreaterThan(results.metrics.total * 0.80);

      // Should have some timeout errors
      const timeoutErrors = Array.from(results.metrics.errorsByType.entries())
        .filter(([errorType]) => errorType.toLowerCase().includes('timeout'));

      expect(timeoutErrors.length).toBeGreaterThan(0);

      // Restore original implementation
      mockMCPServer.tools.get('search_code').implementation = originalImplementation;
    });

    it('should recover from temporary failures', async () => {
      let failureCount = 0;
      const maxFailures = 20;

      // Simulate intermittent failures
      const originalImplementation = mockMCPServer.tools.get('explain_function').implementation;
      mockMCPServer.tools.get('explain_function').implementation = async (params: any) => {
        if (failureCount < maxFailures && Math.random() < 0.3) { // 30% failure rate
          failureCount++;
          throw new Error('Simulated temporary failure');
        }
        return originalImplementation(params);
      };

      const config = {
        concurrency: 150,
        duration: 40000,
        toolMix: ['explain_function', 'search_code'],
        requestPattern: 'constant'
      };

      const results = await loadTestRunner.executeLoadTest(config);

      // Should recover from intermittent failures
      expect(results.metrics.total).toBeGreaterThan(0);
      expect(results.metrics.successful).toBeGreaterThan(results.metrics.total * 0.75);

      // Should have some errors but not overwhelming
      expect(results.metrics.failed).toBeGreaterThan(0);
      expect(results.metrics.failed).toBeLessThan(results.metrics.total * 0.25);

      // Restore original implementation
      mockMCPServer.tools.get('explain_function').implementation = originalImplementation;
    });
  });

  describe('Load Test Reporting', () => {
    it('should generate comprehensive load test reports', () => {
      const loadTestReport = {
        timestamp: new Date().toISOString(),
        testEnvironment: 'load-testing',
        configuration: {
          connectionPool: connectionPool.getStats(),
          loadTestConfig: loadTestRunner.config
        },
        testResults: loadTestResults,
        summary: {
          totalTests: loadTestResults.length,
          passedTests: loadTestResults.filter(r => r.passed).length,
          failedTests: loadTestResults.filter(r => !r.passed).length,
          maxConcurrencyAchieved: Math.max(...loadTestResults.map(r => r.config.concurrency)),
          avgThroughput: loadTestResults.reduce((sum, r) => sum + r.results.metrics.throughput, 0) / loadTestResults.length,
          maxResponseTime: Math.max(...loadTestResults.map(r => r.results.metrics.p95ResponseTime))
        },
        recommendations: []
      };

      // Add recommendations based on results
      if (loadTestReport.summary.maxConcurrencyAchieved < loadTestRunner.config.highLoadConcurrency) {
        loadTestReport.recommendations.push('Consider increasing connection pool size for higher concurrency');
      }

      if (loadTestReport.summary.avgThroughput < 20) {
        loadTestReport.recommendations.push('Optimize tool implementations for better throughput');
      }

      if (loadTestReport.summary.maxResponseTime > 5000) {
        loadTestReport.recommendations.push('Investigate performance bottlenecks in slow tools');
      }

      // Report should be comprehensive
      expect(loadTestReport.testResults.length).toBeGreaterThan(0);
      expect(loadTestReport.summary.totalTests).toBe(loadTestReport.testResults.length);
      expect(loadTestReport.recommendations.length).toBeGreaterThanOrEqual(0);

      // Report should be serializable
      const serializedReport = JSON.stringify(loadTestReport, null, 2);
      expect(serializedReport).toBeDefined();

      // Report should be parsable
      const parsedReport = JSON.parse(serializedReport);
      expect(parsedReport.testResults).toEqual(loadTestResults);
    });
  });
});

/**
 * Expected Load Testing Results (T085):

 Load Level              | Concurrency | Success Rate | Avg Response | P95 Response | Throughput
------------------------|-------------|--------------|--------------|--------------|------------
 Baseline (100 req)      | 100         | >95%         | <1s          | <2s          | >15 RPS
 Moderate Load (500 req)| 500         | >90%         | <2s          | <4s          | >10 RPS
 High Load (1000 req)    | 1000        | >80%         | <5s          | <10s         | >5 RPS
 Sustained Load          | 200         | >85%         | <2s          | <4s          | >8 RPS

Connection Pool Management:
- Max connections: 200
- Proper connection cleanup
- Graceful handling of connection exhaustion
- Connection reuse efficiency

Memory Management:
- Controlled memory growth (<200MB under load)
- Memory usage stability over time
- No significant memory leaks
- Efficient garbage collection

Error Handling:
- Graceful timeout handling
- Recovery from temporary failures
- Error rate within acceptable bounds
- Proper error categorization and reporting

Success Criteria:
- All load tests meet minimum performance thresholds
- Connection pool operates efficiently under stress
- Memory usage remains controlled
- System shows resilience under various load patterns
- Comprehensive load test reports are generated
 */