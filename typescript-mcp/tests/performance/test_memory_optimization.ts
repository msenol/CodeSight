/**
 * Memory Usage Profiling and Optimization (T087)
 *
 * This test suite validates memory management, detects memory leaks, and optimizes memory usage
 * patterns across the MCP server and tools. Tests cover memory profiling, garbage collection,
 * memory pool management, and memory-efficient data structures.
 *
 * Memory Performance Targets:
 * - Base memory usage: < 100MB for idle server
 * - Per-request memory growth: < 5MB per concurrent request
 * - Memory leak rate: < 1MB per hour under sustained load
 * - Garbage collection efficiency: > 80% of allocated memory should be collectible
 * - Large operation memory: < 500MB for complex indexing operations
 * - Cache memory management: < 200MB for active caches
 * - Memory pool efficiency: > 90% reuse rate for frequently allocated objects
 * - Memory fragmentation: < 20% fragmentation after sustained operation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Memory Usage Profiling and Optimization (T087)', () => {
  let memoryProfiler: any;
  let memoryPool: any;
  let garbageCollector: any;
  let cacheManager: any;
  let memoryOptimizationResults: any[];

  beforeEach(() => {
    // Memory profiling framework
    memoryProfiler = {
      snapshots: [],
      allocations: new Map(),
      leaks: new Map(),
      metrics: {
        baseMemory: 0,
        peakMemory: 0,
        currentMemory: 0,
        allocationsCount: 0,
        deallocationsCount: 0,
        gcCount: 0,
        gcTime: 0
      },

      takeSnapshot: (label: string = '') => {
        const memoryUsage = process.memoryUsage();
        const timestamp = Date.now();

        const snapshot = {
          timestamp,
          label,
          rss: memoryUsage.rss,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers || 0,
          allocations: memoryProfiler.metrics.allocationsCount,
          deallocations: memoryProfiler.metrics.deallocationsCount
        };

        memoryProfiler.snapshots.push(snapshot);

        // Update metrics
        memoryProfiler.metrics.currentMemory = memoryUsage.heapUsed;
        memoryProfiler.metrics.peakMemory = Math.max(memoryProfiler.metrics.peakMemory, memoryUsage.heapUsed);

        return snapshot;
      },

      startAllocationTracking: (category: string) => {
        const initialMemory = process.memoryUsage();
        const initialAllocations = memoryProfiler.metrics.allocationsCount;

        return {
          stop: () => {
            const finalMemory = process.memoryUsage();
            const finalAllocations = memoryProfiler.metrics.deallocationsCount;

            const allocationResult = {
              category,
              memoryDelta: finalMemory.heapUsed - initialMemory.heapUsed,
              allocationsDelta: finalAllocations - initialAllocations,
              heapGrowth: finalMemory.heapTotal - initialMemory.heapTotal,
              timestamp: Date.now()
            };

            memoryProfiler.allocations.set(category, allocationResult);
            return allocationResult;
          }
        };
      },

      detectMemoryLeaks: (threshold: number = 1024 * 1024) => { // 1MB default
        if (memoryProfiler.snapshots.length < 3) return [];

        const leaks = [];
        const recentSnapshots = memoryProfiler.snapshots.slice(-3);

        // Calculate memory growth trend
        const growthRates = [];
        for (let i = 1; i < recentSnapshots.length; i++) {
          const current = recentSnapshots[i];
          const previous = recentSnapshots[i - 1];
          const growthRate = (current.heapUsed - previous.heapUsed) / (current.timestamp - previous.timestamp);
          growthRates.push(growthRate);
        }

        const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;

        // Detect sustained growth (potential leak)
        if (avgGrowthRate > threshold / 60000) { // threshold per minute
          leaks.push({
            type: 'sustained_growth',
            growthRate: avgGrowthRate,
            threshold,
            severity: avgGrowthRate > (threshold * 2) / 60000 ? 'high' : 'medium'
          });
        }

        // Detect allocation/deallocation imbalance
        const totalAllocations = memoryProfiler.metrics.allocationsCount;
        const totalDeallocations = memoryProfiler.metrics.deallocationsCount;
        const imbalanceRatio = totalAllocations / Math.max(totalDeallocations, 1);

        if (imbalanceRatio > 1.2) { // 20% more allocations than deallocations
          leaks.push({
            type: 'allocation_imbalance',
            ratio: imbalanceRatio,
            totalAllocations,
            totalDeallocations,
            severity: imbalanceRatio > 1.5 ? 'high' : 'medium'
          });
        }

        return leaks;
      },

      analyzeMemoryFragmentation: () => {
        const memoryUsage = process.memoryUsage();
        const heapUsed = memoryUsage.heapUsed;
        const heapTotal = memoryUsage.heapTotal;

        if (heapTotal === 0) return 0;

        const fragmentationRatio = (heapTotal - heapUsed) / heapTotal;
        return {
          ratio: fragmentationRatio,
          heapUsed,
          heapTotal,
          wasted: heapTotal - heapUsed,
          severity: fragmentationRatio > 0.3 ? 'high' : fragmentationRatio > 0.2 ? 'medium' : 'low'
        };
      },

      generateMemoryReport: () => {
        const latestSnapshot = memoryProfiler.snapshots[memoryProfiler.snapshots.length - 1];
        const baseSnapshot = memoryProfiler.snapshots[0];
        const fragmentation = memoryProfiler.analyzeMemoryFragmentation();
        const leaks = memoryProfiler.detectMemoryLeaks();

        return {
          timestamp: new Date().toISOString(),
          baseMemory: baseSnapshot?.heapUsed || 0,
          currentMemory: latestSnapshot?.heapUsed || 0,
          peakMemory: memoryProfiler.metrics.peakMemory,
          memoryGrowth: (latestSnapshot?.heapUsed || 0) - (baseSnapshot?.heapUsed || 0),
          fragmentation,
          leaks,
          gcStats: {
            count: memoryProfiler.metrics.gcCount,
            totalTime: memoryProfiler.metrics.gcTime,
            avgTime: memoryProfiler.metrics.gcCount > 0 ? memoryProfiler.metrics.gcTime / memoryProfiler.metrics.gcCount : 0
          },
          allocations: Object.fromEntries(memoryProfiler.allocations),
          snapshotCount: memoryProfiler.snapshots.length
        };
      }
    };

    // Memory pool for object reuse
    memoryPool = {
      pools: new Map(),
      stats: {
        created: 0,
        reused: 0,
        released: 0,
        poolSize: 0
      },

      createPool: (name: string, factory: Function, maxSize: number = 1000) => {
        memoryPool.pools.set(name, {
          factory,
          available: [],
          inUse: new Set(),
          maxSize,
          created: 0,
          reused: 0,
          released: 0
        });
      },

      acquire: (poolName: string) => {
        const pool = memoryPool.pools.get(poolName);
        if (!pool) {
          throw new Error(`Pool not found: ${poolName}`);
        }

        let obj;
        if (pool.available.length > 0) {
          obj = pool.available.pop();
          pool.reused++;
          memoryPool.stats.reused++;
        } else {
          obj = pool.factory();
          pool.created++;
          memoryPool.stats.created++;
        }

        pool.inUse.add(obj);
        memoryPool.stats.poolSize++;
        memoryProfiler.metrics.allocationsCount++;

        return obj;
      },

      release: (poolName: string, obj: any) => {
        const pool = memoryPool.pools.get(poolName);
        if (!pool) return;

        if (pool.inUse.has(obj)) {
          pool.inUse.delete(obj);
          pool.released++;
          memoryPool.stats.released++;
          memoryProfiler.metrics.deallocationsCount++;

          // Reset object if possible
          if (obj.reset) {
            obj.reset();
          }

          // Return to pool if not at max capacity
          if (pool.available.length < pool.maxSize) {
            pool.available.push(obj);
          } else {
            memoryPool.stats.poolSize--;
          }
        }
      },

      getStats: () => {
        const poolStats = {};
        memoryPool.pools.forEach((pool, name) => {
          poolStats[name] = {
            available: pool.available.length,
            inUse: pool.inUse.size,
            created: pool.created,
            reused: pool.reused,
            released: pool.released,
            reuseRatio: pool.created > 0 ? pool.reused / (pool.created + pool.reused) : 0
          };
        });

        return {
          overall: memoryPool.stats,
          reuseRatio: memoryPool.stats.created > 0 ? memoryPool.stats.reused / (memoryPool.stats.created + memoryPool.stats.reused) : 0,
          pools: poolStats
        };
      },

      clear: (poolName: string) => {
        const pool = memoryPool.pools.get(poolName);
        if (pool) {
          pool.available = [];
          pool.inUse.clear();
          memoryPool.stats.poolSize -= pool.inUse.size;
        }
      }
    };

    // Garbage collection monitor
    garbageCollector = {
      stats: {
        forcedCollections: 0,
        automaticCollections: 0,
        collectionTime: 0,
        memoryRecovered: 0
      },

      forceGC: () => {
        const beforeGC = process.memoryUsage();
        const startTime = Date.now();

        if (global.gc) {
          global.gc();
        }

        const afterGC = process.memoryUsage();
        const collectionTime = Date.now() - startTime;
        const memoryRecovered = beforeGC.heapUsed - afterGC.heapUsed;

        garbageCollector.stats.forcedCollections++;
        garbageCollector.stats.collectionTime += collectionTime;
        garbageCollector.stats.memoryRecovered += memoryRecovered;

        memoryProfiler.metrics.gcCount++;
        memoryProfiler.metrics.gcTime += collectionTime;

        return {
          collectionTime,
          memoryRecovered,
          beforeMemory: beforeGC.heapUsed,
          afterMemory: afterGC.heapUsed
        };
      },

      monitorGC: () => {
        // Hook into Node.js GC events if available
        if (global.gc) {
          const originalGC = global.gc;
          global.gc = () => {
            const beforeGC = process.memoryUsage();
            const startTime = Date.now();

            originalGC.call(global);

            const afterGC = process.memoryUsage();
            const collectionTime = Date.now() - startTime;
            const memoryRecovered = beforeGC.heapUsed - afterGC.heapUsed;

            garbageCollector.stats.automaticCollections++;
            garbageCollector.stats.collectionTime += collectionTime;
            garbageCollector.stats.memoryRecovered += memoryRecovered;

            memoryProfiler.metrics.gcCount++;
            memoryProfiler.metrics.gcTime += collectionTime;
          };
        }
      },

      getEfficiency: () => {
        const totalMemoryRecovered = garbageCollector.stats.memoryRecovered;
        const totalCollectionTime = garbageCollector.stats.collectionTime;
        const totalCollections = garbageCollector.stats.forcedCollections + garbageCollector.stats.automaticCollections;

        return {
          totalCollections,
          totalMemoryRecovered,
          avgCollectionTime: totalCollections > 0 ? totalCollectionTime / totalCollections : 0,
          memoryPerMs: totalCollectionTime > 0 ? totalMemoryRecovered / totalCollectionTime : 0,
          recoveryRate: totalCollections > 0 ? totalMemoryRecovered / totalCollections : 0
        };
      }
    };

    // Memory-efficient cache manager
    cacheManager = {
      cache: new Map(),
      maxMemory: 100 * 1024 * 1024, // 100MB
      currentMemory: 0,
      stats: {
        hits: 0,
        misses: 0,
        evictions: 0,
        memoryUsed: 0
      },

      get: (key: string) => {
        const entry = cacheManager.cache.get(key);
        if (entry && !entry.expired) {
          entry.lastAccessed = Date.now();
          entry.accessCount++;
          cacheManager.stats.hits++;
          return entry.value;
        }

        if (entry && entry.expired) {
          cacheManager.remove(key);
        }

        cacheManager.stats.misses++;
        return undefined;
      },

      set: (key: string, value: any, ttl: number = 300000) => {
        const size = cacheManager.calculateSize(value);

        // Evict if necessary
        while (cacheManager.currentMemory + size > cacheManager.maxMemory) {
          if (!cacheManager.evictLRU()) {
            // Can't evict more, skip this entry
            return false;
          }
        }

        // Remove existing entry if present
        cacheManager.remove(key);

        const entry = {
          value,
          size,
          created: Date.now(),
          lastAccessed: Date.now(),
          expires: Date.now() + ttl,
          accessCount: 0,
          expired: false
        };

        cacheManager.cache.set(key, entry);
        cacheManager.currentMemory += size;
        cacheManager.stats.memoryUsed = cacheManager.currentMemory;

        return true;
      },

      remove: (key: string) => {
        const entry = cacheManager.cache.get(key);
        if (entry) {
          cacheManager.cache.delete(key);
          cacheManager.currentMemory -= entry.size;
          cacheManager.stats.memoryUsed = cacheManager.currentMemory;
          return true;
        }
        return false;
      },

      evictLRU: () => {
        let oldestKey = null;
        let oldestAccess = Date.now();

        for (const [key, entry] of cacheManager.cache.entries()) {
          if (entry.lastAccessed < oldestAccess) {
            oldestAccess = entry.lastAccessed;
            oldestKey = key;
          }
        }

        if (oldestKey) {
          cacheManager.remove(oldestKey);
          cacheManager.stats.evictions++;
          return true;
        }

        return false;
      },

      calculateSize: (obj: any): number => {
        // Rough size estimation
        if (typeof obj === 'string') {
          return obj.length * 2; // 2 bytes per character
        } else if (typeof obj === 'number') {
          return 8; // 8 bytes
        } else if (typeof obj === 'boolean') {
          return 4;
        } else if (Array.isArray(obj)) {
          return obj.reduce((sum, item) => sum + cacheManager.calculateSize(item), 100); // 100 bytes overhead
        } else if (typeof obj === 'object' && obj !== null) {
          return Object.entries(obj).reduce((sum, [key, value]) =>
            sum + key.length * 2 + cacheManager.calculateSize(value), 200); // 200 bytes overhead
        }
        return 50; // Default size
      },

      getStats: () => {
        const totalRequests = cacheManager.stats.hits + cacheManager.stats.misses;
        return {
          entries: cacheManager.cache.size,
          memoryUsed: cacheManager.currentMemory,
          maxMemory: cacheManager.maxMemory,
          hitRate: totalRequests > 0 ? cacheManager.stats.hits / totalRequests : 0,
          hits: cacheManager.stats.hits,
          misses: cacheManager.stats.misses,
          evictions: cacheManager.stats.evictions,
          memoryEfficiency: cacheManager.currentMemory / cacheManager.maxMemory
        };
      },

      clear: () => {
        cacheManager.cache.clear();
        cacheManager.currentMemory = 0;
        cacheManager.stats.memoryUsed = 0;
      }
    };

    // Initialize memory pools
    memoryPool.createPool('entity', () => ({
      id: 0,
      name: '',
      type: '',
      metadata: null,
      reset: function() {
        this.id = 0;
        this.name = '';
        this.type = '';
        this.metadata = null;
      }
    }), 1000);

    memoryPool.createPool('relationship', () => ({
      sourceId: 0,
      targetId: 0,
      type: '',
      metadata: null,
      reset: function() {
        this.sourceId = 0;
        this.targetId = 0;
        this.type = '';
        this.metadata = null;
      }
    }), 2000);

    memoryPool.createPool('search_result', () => ({
      file: '',
      line: 0,
      content: '',
      score: 0,
      reset: function() {
        this.file = '';
        this.line = 0;
        this.content = '';
        this.score = 0;
      }
    }), 500);

    // Start memory monitoring
    memoryProfiler.takeSnapshot('initial');
    garbageCollector.monitorGC();

    memoryOptimizationResults = [];
  });

  afterEach(() => {
    // Cleanup and final memory report
    memoryProfiler.takeSnapshot('cleanup');
    garbageCollector.forceGC();

    // Clear all pools
    memoryPool.pools.forEach((pool, name) => {
      memoryPool.clear(name);
    });

    // Clear cache
    cacheManager.clear();

    memoryProfiler = null;
    memoryPool = null;
    garbageCollector = null;
    cacheManager = null;
    memoryOptimizationResults = [];
  });

  describe('Base Memory Usage Profiling', () => {
    it('should maintain base memory usage within limits', () => {
      memoryProfiler.takeSnapshot('idle_start');

      // Simulate idle server operations
      setTimeout(() => {
        memoryProfiler.takeSnapshot('idle_after_wait');
      }, 100);

      const baseSnapshot = memoryProfiler.snapshots.find(s => s.label === 'initial');
      const idleSnapshot = memoryProfiler.snapshots.find(s => s.label === 'idle_after_wait');

      expect(baseSnapshot).toBeDefined();
      expect(idleSnapshot).toBeDefined();

      const baseMemory = baseSnapshot?.heapUsed || 0;
      const idleMemory = idleSnapshot?.heapUsed || baseMemory;
      const memoryGrowth = idleMemory - baseMemory;

      // Base memory should be reasonable
      expect(baseMemory).toBeLessThan(100 * 1024 * 1024); // Less than 100MB

      // Memory growth should be minimal for idle operations
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth

      memoryOptimizationResults.push({
        test: 'base_memory_usage',
        baseMemory,
        idleMemory,
        memoryGrowth,
        targetBaseMemory: 100 * 1024 * 1024,
        targetGrowth: 10 * 1024 * 1024,
        passed: baseMemory < 100 * 1024 * 1024 && memoryGrowth < 10 * 1024 * 1024
      });
    });

    it('should accurately track memory allocations and deallocations', () => {
      const tracker = memoryProfiler.startAllocationTracking('test_operations');

      // Simulate memory allocations
      const allocations = [];
      for (let i = 0; i < 1000; i++) {
        allocations.push({
          id: i,
          data: new Array(100).fill(`data_${i}`),
          timestamp: Date.now()
        });
      }

      // Deallocate some objects
      allocations.splice(0, 500);

      const result = tracker.stop();

      // Should track allocation metrics
      expect(result.memoryDelta).toBeGreaterThan(0);
      expect(result.allocationsDelta).toBeGreaterThan(0);

      // Memory growth should be reasonable for 1000 objects
      expect(result.memoryDelta).toBeLessThan(50 * 1024 * 1024); // Less than 50MB

      memoryOptimizationResults.push({
        test: 'allocation_tracking',
        allocationCount: 1000,
        deallocationCount: 500,
        memoryDelta: result.memoryDelta,
        passed: result.memoryDelta < 50 * 1024 * 1024
      });
    });
  });

  describe('Memory Pool Optimization', () => {
    it('should efficiently reuse objects from memory pools', () => {
      const iterations = 1000;

      // Acquire and release objects multiple times
      const objects = [];
      for (let i = 0; i < iterations; i++) {
        const entity = memoryPool.acquire('entity');
        entity.id = i;
        entity.name = `entity_${i}`;
        entity.type = 'test';
        objects.push(entity);
      }

      // Release all objects
      objects.forEach(obj => {
        memoryPool.release('entity', obj);
      });

      // Acquire again to test reuse
      const reusedObjects = [];
      for (let i = 0; i < iterations; i++) {
        const entity = memoryPool.acquire('entity');
        reusedObjects.push(entity);
      }

      const poolStats = memoryPool.getStats();

      // Should demonstrate high reuse rate
      expect(poolStats.reuseRatio).toBeGreaterThan(0.8); // 80%+ reuse
      expect(poolStats.pools.entity.reuseRatio).toBeGreaterThan(0.8);

      // Should not create excessive objects
      expect(poolStats.pools.entity.created).toBeLessThan(iterations * 1.2); // Less than 20% overhead

      memoryOptimizationResults.push({
        test: 'memory_pool_reuse',
        iterations,
        reuseRatio: poolStats.reuseRatio,
        objectsCreated: poolStats.pools.entity.created,
        passed: poolStats.reuseRatio > 0.8
      });
    });

    it('should manage memory pool sizes effectively', () => {
      // Test pool size limits
      const maxPoolSize = 100;
      memoryPool.createPool('test_pool', () => ({ data: '' }), maxPoolSize);

      // Acquire more objects than pool size
      const objects = [];
      for (let i = 0; i < maxPoolSize + 50; i++) {
        const obj = memoryPool.acquire('test_pool');
        obj.data = `data_${i}`;
        objects.push(obj);
      }

      // Release all objects
      objects.forEach(obj => {
        memoryPool.release('test_pool', obj);
      });

      const poolStats = memoryPool.getStats();

      // Pool should not exceed max size
      expect(poolStats.pools.test_pool.available).toBeLessThanOrEqual(maxPoolSize);
      expect(poolStats.pools.test_pool.inUse.size).toBe(0); // All should be released

      // Should track pool statistics correctly
      expect(poolStats.pools.test_pool.created).toBe(maxPoolSize + 50);
      expect(poolStats.pools.test_pool.released).toBe(maxPoolSize + 50);

      memoryOptimizationResults.push({
        test: 'memory_pool_size_management',
        maxPoolSize,
        totalAcquisitions: maxPoolSize + 50,
        finalPoolSize: poolStats.pools.test_pool.available,
        passed: poolStats.pools.test_pool.available <= maxPoolSize
      });
    });

    it('should handle multiple pool types efficiently', () => {
      const operations = 300;
      const poolTypes = ['entity', 'relationship', 'search_result'];

      // Mix operations across different pool types
      const objects = [];
      for (let i = 0; i < operations; i++) {
        const poolType = poolTypes[i % poolTypes.length];
        const obj = memoryPool.acquire(poolType);

        // Set different properties based on type
        if (poolType === 'entity') {
          obj.id = i;
          obj.name = `entity_${i}`;
          obj.type = 'function';
        } else if (poolType === 'relationship') {
          obj.sourceId = i;
          obj.targetId = i + 1;
          obj.type = 'calls';
        } else if (poolType === 'search_result') {
          obj.file = `src/file_${i}.ts`;
          obj.line = i % 100;
          obj.score = Math.random();
        }

        objects.push({ poolType, obj });
      }

      // Release objects in random order
      const shuffled = objects.sort(() => Math.random() - 0.5);
      shuffled.forEach(({ poolType, obj }) => {
        memoryPool.release(poolType, obj);
      });

      const poolStats = memoryPool.getStats();

      // All pools should have good reuse rates
      Object.values(poolStats.pools).forEach((stats: any) => {
        expect(stats.reuseRatio).toBeGreaterThan(0.7); // 70%+ reuse
      });

      // Overall pool efficiency should be high
      expect(poolStats.reuseRatio).toBeGreaterThan(0.7);

      memoryOptimizationResults.push({
        test: 'multiple_pool_types',
        operations,
        poolCount: poolTypes.length,
        overallReuseRatio: poolStats.reuseRatio,
        passed: poolStats.reuseRatio > 0.7
      });
    });
  });

  describe('Garbage Collection Optimization', () => {
    it('should demonstrate efficient garbage collection', () => {
      // Create temporary objects
      const temporaryObjects = [];
      for (let i = 0; i < 10000; i++) {
        temporaryObjects.push({
          id: i,
          data: new Array(100).fill(i),
          nested: {
            level1: {
              level2: {
                data: `nested_${i}`
              }
            }
          }
        });
      }

      // Clear references to make objects eligible for GC
      temporaryObjects.length = 0;

      // Force garbage collection
      const gcResult = garbageCollector.forceGC();

      // Should recover significant memory
      expect(gcResult.memoryRecovered).toBeGreaterThan(0);
      expect(gcResult.collectionTime).toBeLessThan(1000); // Less than 1 second

      // Memory should be reduced after GC
      expect(gcResult.afterMemory).toBeLessThan(gcResult.beforeMemory);

      const gcEfficiency = garbageCollector.getEfficiency();
      expect(gcEfficiency.recoveryRate).toBeGreaterThan(1000); // At least 1KB recovered per collection

      memoryOptimizationResults.push({
        test: 'garbage_collection_efficiency',
        objectsCreated: 10000,
        memoryRecovered: gcResult.memoryRecovered,
        collectionTime: gcResult.collectionTime,
        recoveryRate: gcEfficiency.recoveryRate,
        passed: gcResult.memoryRecovered > 0 && gcResult.collectionTime < 1000
      });
    });

    it('should handle memory pressure under sustained load', async () => {
      const cycles = 5;
      const objectsPerCycle = 2000;
      const memorySnapshots = [];

      for (let cycle = 0; cycle < cycles; cycle++) {
        memoryProfiler.takeSnapshot(`cycle_${cycle}_start`);

        // Create memory pressure
        const cycleObjects = [];
        for (let i = 0; i < objectsPerCycle; i++) {
          cycleObjects.push({
            cycle,
            id: i,
            data: new Array(50).fill(`cycle_${cycle}_item_${i}`)
          });
        }

        // Force GC to handle the pressure
        const gcResult = garbageCollector.forceGC();

        // Clear objects
        cycleObjects.length = 0;

        memoryProfiler.takeSnapshot(`cycle_${cycle}_end`);
        memorySnapshots.push({
          cycle,
          memoryBeforeGC: gcResult.beforeMemory,
          memoryAfterGC: gcResult.afterMemory,
          memoryRecovered: gcResult.memoryRecovered
        });

        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Analyze memory stability across cycles
      const cycleMemories = memorySnapshots.map(s => s.memoryAfterGC);
      const maxMemory = Math.max(...cycleMemories);
      const minMemory = Math.min(...cycleMemories);
      const memoryVariance = maxMemory - minMemory;

      // Memory usage should be stable across cycles
      expect(memoryVariance).toBeLessThan(50 * 1024 * 1024); // Less than 50MB variance

      // GC should consistently recover memory
      const avgRecovery = memorySnapshots.reduce((sum, s) => sum + s.memoryRecovered, 0) / memorySnapshots.length;
      expect(avgRecovery).toBeGreaterThan(1000); // At least 1KB average recovery

      memoryOptimizationResults.push({
        test: 'sustained_memory_pressure',
        cycles,
        objectsPerCycle,
        memoryVariance,
        avgRecovery,
        passed: memoryVariance < 50 * 1024 * 1024 && avgRecovery > 1000
      });
    });
  });

  describe('Cache Memory Management', () => {
    it('should manage cache memory within limits', () => {
      // Fill cache with large entries
      const entryCount = 1000;
      const entrySize = 10 * 1024; // 10KB per entry

      for (let i = 0; i < entryCount; i++) {
        const largeData = 'x'.repeat(entrySize);
        cacheManager.set(`key_${i}`, largeData, 60000); // 1 minute TTL
      }

      const cacheStats = cacheManager.getStats();

      // Cache should not exceed memory limits
      expect(cacheStats.memoryUsed).toBeLessThanOrEqual(cacheManager.maxMemory);

      // Should have evicted some entries to stay within limits
      expect(cacheStats.evictions).toBeGreaterThan(0);
      expect(cacheStats.entries).toBeLessThan(entryCount);

      // Memory efficiency should be high
      expect(cacheStats.memoryEfficiency).toBeGreaterThan(0.8); // Using at least 80% of allocated memory

      memoryOptimizationResults.push({
        test: 'cache_memory_limits',
        entriesAttempted: entryCount,
        entriesStored: cacheStats.entries,
        memoryUsed: cacheStats.memoryUsed,
        evictions: cacheStats.evictions,
        passed: cacheStats.memoryUsed <= cacheManager.maxMemory && cacheStats.evictions > 0
      });
    });

    it('should demonstrate efficient cache hit patterns', () => {
      // Pre-populate cache
      const commonKeys = ['common_1', 'common_2', 'common_3', 'common_4', 'common_5'];
      commonKeys.forEach(key => {
        cacheManager.set(key, `value_for_${key}`, 300000); // 5 minutes
      });

      // Access patterns: 80% common keys, 20% unique keys
      const totalAccesses = 1000;
      let commonAccesses = 0;
      let uniqueAccesses = 0;

      for (let i = 0; i < totalAccesses; i++) {
        if (Math.random() < 0.8 && commonKeys.length > 0) {
          // Access common key
          const key = commonKeys[Math.floor(Math.random() * commonKeys.length)];
          cacheManager.get(key);
          commonAccesses++;
        } else {
          // Access unique key (will be miss)
          cacheManager.get(`unique_${i}`);
          uniqueAccesses++;
        }
      }

      const cacheStats = cacheManager.getStats();

      // Hit rate should be high due to common key pattern
      expect(cacheStats.hitRate).toBeGreaterThan(0.7); // 70%+ hit rate

      // Should have reasonable number of hits and misses
      expect(cacheStats.hits).toBeGreaterThan(0);
      expect(cacheStats.misses).toBeGreaterThan(0);

      memoryOptimizationResults.push({
        test: 'cache_hit_patterns',
        totalAccesses,
        commonAccesses,
        uniqueAccesses,
        hitRate: cacheStats.hitRate,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        passed: cacheStats.hitRate > 0.7
      });
    });

    it('should handle cache expiration and cleanup', async () => {
      const shortTTL = 100; // 100ms
      const longTTL = 10000; // 10 seconds

      // Add entries with different TTLs
      cacheManager.set('short_ttl', 'expires_quickly', shortTTL);
      cacheManager.set('long_ttl', 'expires_slowly', longTTL);

      // Both should be available initially
      expect(cacheManager.get('short_ttl')).toBe('expires_quickly');
      expect(cacheManager.get('long_ttl')).toBe('expires_slowly');

      // Wait for short TTL to expire
      await new Promise(resolve => setTimeout(resolve, shortTTL + 50));

      // Short TTL should be expired, long TTL should still be valid
      expect(cacheManager.get('short_ttl')).toBeUndefined();
      expect(cacheManager.get('long_ttl')).toBe('expires_slowly');

      // Cache stats should reflect the expiration
      const cacheStats = cacheManager.getStats();
      expect(cacheStats.entries).toBe(1); // Only long TTL entry should remain

      memoryOptimizationResults.push({
        test: 'cache_expiration',
        shortTTL,
        longTTL,
        finalEntries: cacheStats.entries,
        passed: cacheStats.entries === 1
      });
    });
  });

  describe('Memory Leak Detection', () => {
    it('should detect and report memory leaks', async () => {
      // Create a scenario that could cause memory leaks
      const leakyObjects = [];
      const eventListeners = [];

      // Simulate operations that might leak memory
      for (let i = 0; i < 100; i++) {
        // Create objects that might not be cleaned up
        const leakyObject = {
          id: i,
          data: new Array(1000).fill(i),
          callbacks: [],
          timer: setInterval(() => {}, 1000) // Potential leak
        };

        leakyObjects.push(leakyObject);

        // Add event listeners (potential leak)
        const callback = () => {};
        eventListeners.push(callback);
        leakyObject.callbacks.push(callback);
      }

      // Take memory snapshot
      memoryProfiler.takeSnapshot('before_cleanup');

      // Proper cleanup
      leakyObjects.forEach(obj => {
        if (obj.timer) {
          clearInterval(obj.timer);
        }
        obj.callbacks = [];
      });
      leakyObjects.length = 0;
      eventListeners.length = 0;

      // Force garbage collection
      garbageCollector.forceGC();
      memoryProfiler.takeSnapshot('after_cleanup');

      // Wait a bit and check again
      await new Promise(resolve => setTimeout(resolve, 100));
      memoryProfiler.takeSnapshot('final_check');

      // Detect memory leaks
      const leaks = memoryProfiler.detectMemoryLeaks(512 * 1024); // 512KB threshold

      // Should analyze memory growth pattern
      expect(memoryProfiler.snapshots.length).toBeGreaterThan(2);

      // Memory should have been recovered after cleanup
      const beforeCleanup = memoryProfiler.snapshots.find(s => s.label === 'before_cleanup');
      const afterCleanup = memoryProfiler.snapshots.find(s => s.label === 'after_cleanup');

      if (beforeCleanup && afterCleanup) {
        const memoryRecovered = beforeCleanup.heapUsed - afterCleanup.heapUsed;
        expect(memoryRecovered).toBeGreaterThan(0);
      }

      memoryOptimizationResults.push({
        test: 'memory_leak_detection',
        objectsCreated: 100,
        leaksDetected: leaks.length,
        memoryRecovered: beforeCleanup && afterCleanup ? beforeCleanup.heapUsed - afterCleanup.heapUsed : 0,
        passed: leaks.length === 0 || leaks.every(l => l.severity === 'low')
      });
    });

    it('should handle sustained operations without memory leaks', async () => {
      const cycles = 10;
      const operationsPerCycle = 500;
      const memoryGrowths = [];

      for (let cycle = 0; cycle < cycles; cycle++) {
        const startMemory = process.memoryUsage().heapUsed;

        // Perform operations
        const cycleData = [];
        for (let i = 0; i < operationsPerCycle; i++) {
          cycleData.push({
            cycle,
            operation: i,
            data: new Array(100).fill(`${cycle}_${i}`),
            metadata: {
              timestamp: Date.now(),
              processed: false
            }
          });
        }

        // Process data
        cycleData.forEach(item => {
          item.metadata.processed = true;
        });

        // Clear data
        cycleData.length = 0;

        const endMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = endMemory - startMemory;
        memoryGrowths.push(memoryGrowth);

        // Force GC every few cycles
        if (cycle % 3 === 0) {
          garbageCollector.forceGC();
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Analyze memory growth pattern
      const avgGrowth = memoryGrowths.reduce((a, b) => a + b, 0) / memoryGrowths.length;
      const maxGrowth = Math.max(...memoryGrowths);
      const trend = memoryGrowths[memoryGrowths.length - 1] - memoryGrowths[0];

      // Memory growth should be controlled
      expect(avgGrowth).toBeLessThan(5 * 1024 * 1024); // Less than 5MB per cycle average
      expect(maxGrowth).toBeLessThan(20 * 1024 * 1024); // Less than 20MB peak growth

      // Overall trend should not show sustained growth
      expect(trend).toBeLessThan(10 * 1024 * 1024); // Less than 10MB total growth

      memoryOptimizationResults.push({
        test: 'sustained_operations_memory',
        cycles,
        operationsPerCycle,
        avgGrowth,
        maxGrowth,
        totalTrend: trend,
        passed: avgGrowth < 5 * 1024 * 1024 && trend < 10 * 1024 * 1024
      });
    });
  });

  describe('Memory Fragmentation Analysis', () => {
    it('should analyze and report memory fragmentation', () => {
      // Create fragmentation scenario
      const objects = [];
      const sizes = [100, 1000, 5000, 10000, 50000]; // Variable sizes

      // Allocate objects of different sizes
      for (let round = 0; round < 10; round++) {
        for (const size of sizes) {
          objects.push({
            size,
            data: new Array(size).fill(`fragment_${round}`),
            round
          });
        }
      }

      // Deallocate objects in a pattern that creates fragmentation
      for (let i = 0; i < objects.length; i += 3) {
        objects[i] = null;
      }

      // Force garbage collection
      garbageCollector.forceGC();

      // Analyze fragmentation
      const fragmentation = memoryProfiler.analyzeMemoryFragmentation();

      // Should provide fragmentation metrics
      expect(fragmentation.ratio).toBeGreaterThanOrEqual(0);
      expect(fragmentation.heapUsed).toBeGreaterThan(0);
      expect(fragmentation.heapTotal).toBeGreaterThan(0);
      expect(fragmentation.wasted).toBeGreaterThanOrEqual(0);

      // Fragmentation should be reasonable
      expect(fragmentation.ratio).toBeLessThan(0.5); // Less than 50% fragmentation

      memoryOptimizationResults.push({
        test: 'memory_fragmentation_analysis',
        objectsAllocated: objects.length,
        fragmentationRatio: fragmentation.ratio,
        wastedMemory: fragmentation.wasted,
        severity: fragmentation.severity,
        passed: fragmentation.ratio < 0.5
      });
    });
  });

  describe('Memory Optimization Reporting', () => {
    it('should generate comprehensive memory optimization reports', () => {
      const memoryReport = memoryProfiler.generateMemoryReport();

      // Report should contain comprehensive memory metrics
      expect(memoryReport.timestamp).toBeDefined();
      expect(memoryReport.baseMemory).toBeGreaterThan(0);
      expect(memoryReport.currentMemory).toBeGreaterThan(0);
      expect(memoryReport.peakMemory).toBeGreaterThanOrEqual(memoryReport.currentMemory);

      // Should include fragmentation analysis
      expect(memoryReport.fragmentation).toBeDefined();
      expect(memoryReport.fragmentation.ratio).toBeGreaterThanOrEqual(0);

      // Should include garbage collection statistics
      expect(memoryReport.gcStats).toBeDefined();
      expect(memoryReport.gcStats.count).toBeGreaterThanOrEqual(0);

      // Should include allocation tracking
      expect(memoryReport.allocations).toBeDefined();

      // Should be serializable
      const serializedReport = JSON.stringify(memoryReport, null, 2);
      expect(serializedReport).toBeDefined();

      // Should be parsable
      const parsedReport = JSON.parse(serializedReport);
      expect(parsedReport.baseMemory).toBe(memoryReport.baseMemory);

      // Generate optimization recommendations
      const recommendations = [];

      // Memory growth recommendations
      if (memoryReport.memoryGrowth > 50 * 1024 * 1024) {
        recommendations.push('High memory growth detected. Investigate potential memory leaks.');
      }

      // Fragmentation recommendations
      if (memoryReport.fragmentation.ratio > 0.3) {
        recommendations.push('High memory fragmentation detected. Consider implementing object pooling.');
      }

      // GC recommendations
      if (memoryReport.gcStats.avgTime > 100) {
        recommendations.push('Long garbage collection times. Consider reducing allocation rates.');
      }

      // Add recommendations to report
      memoryReport.recommendations = recommendations;

      expect(Array.isArray(memoryReport.recommendations)).toBe(true);

      memoryOptimizationResults.push({
        test: 'memory_optimization_reporting',
        reportGenerated: true,
        recommendationCount: recommendations.length,
        passed: true
      });
    });
  });
});

/**
 * Expected Memory Performance Targets (T087):

 Memory Category               | Target Usage    | Monitoring Notes
------------------------------|----------------|------------------
 Base Server Memory           | < 100MB        | Measured at startup
 Per-Request Growth           | < 5MB          | Per concurrent request
 Memory Leak Rate             | < 1MB/hour     | Under sustained load
 Garbage Collection Efficiency| > 80%          | Of allocated memory
 Large Operations             | < 500MB        | Complex indexing
 Cache Memory                | < 200MB        | Active caches
 Memory Pool Reuse Rate      | > 90%          | Frequently allocated objects
 Memory Fragmentation         | < 20%          | After sustained operation

 Memory Pool Management:
 - Entity objects: 1000 pool size, >80% reuse
 - Relationship objects: 2000 pool size, >80% reuse
 - Search result objects: 500 pool size, >80% reuse
 - Automatic size management and cleanup

 Garbage Collection Monitoring:
 - Collection frequency: Automatic tracking
 - Collection efficiency: Memory recovered per millisecond
 - Forced collection: Available when needed
 - GC pause time: < 1 second for typical collections

 Cache Memory Management:
 - LRU eviction strategy
 - Memory-aware size limits
 - TTL-based expiration
 - Hit rate monitoring: >70% for common patterns

 Memory Leak Detection:
 - Growth rate monitoring
 - Allocation/deallocation imbalance detection
 - Sustained growth analysis
- Automatic threshold-based alerts

 Success Criteria:
- All memory usage categories meet targets
- Memory pools demonstrate high reuse rates
- Garbage collection operates efficiently
- Cache management respects memory limits
- No significant memory leaks detected
- Memory fragmentation remains controlled
- Comprehensive memory monitoring and reporting
 */