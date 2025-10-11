/**
 * Memory Optimization Strategies for CodeSight MCP Server (T086)
 *
 * Provides memory optimization techniques, object pooling, caching strategies,
 * and automatic memory management for improved performance.
 */

const EventEmitter = require('events');
const LRU = require('lru-cache');

class MemoryOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxHeapSize: options.maxHeapSize || 512 * 1024 * 1024, // 512MB
      gcThreshold: options.gcThreshold || 0.8, // 80% of max heap
      pooling: options.pooling !== false,
      caching: options.caching !== false,
      monitoring: options.monitoring || false,
      ...options
    };

    this.objectPools = new Map();
    this.caches = new Map();
    this.monitoringData = {
      samples: [],
      gcCount: 0,
      optimizations: 0
    };

    this.initialize();
  }

  initialize() {
    if (this.options.monitoring) {
      this.startMonitoring();
    }

    if (this.options.pooling) {
      this.initializeObjectPools();
    }

    if (this.options.caching) {
      this.initializeCaches();
    }

    // Setup GC monitoring
    this.setupGCMonitoring();

    console.log('🔧 Memory optimizer initialized');
    console.log(`   Max heap: ${(this.options.maxHeapSize / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   GC threshold: ${(this.options.gcThreshold * 100).toFixed(1)}%`);
  }

  initializeObjectPools() {
    // Initialize common object pools
    this.objectPools.set('buffer', new BufferPool());
    this.objectPools.set('string', new StringPool());
    this.objectPools.set('array', new ArrayPool());
    this.objectPools.set('object', new ObjectPool());

    console.log('🏊 Object pools initialized');
  }

  initializeCaches() {
    // Initialize LRU caches for different data types
    this.caches.set('parsing', new LRU({
      max: 1000,
      ttl: 1000 * 60 * 15, // 15 minutes
      updateAgeOnGet: true
    }));

    this.caches.set('search', new LRU({
      max: 500,
      ttl: 1000 * 60 * 30, // 30 minutes
      updateAgeOnGet: true
    }));

    this.caches.set('indexing', new LRU({
      max: 200,
      ttl: 1000 * 60 * 60, // 1 hour
      updateAgeOnGet: true
    }));

    console.log('💾 Caches initialized');
  }

  setupGCMonitoring() {
    const originalGC = global.gc;

    if (originalGC) {
      global.gc = () => {
        const before = process.memoryUsage();
        originalGC();
        const after = process.memoryUsage();

        this.monitoringData.gcCount++;
        this.emit('gc', {
          before,
          after,
          freed: before.heapUsed - after.heapUsed,
          count: this.monitoringData.gcCount
        });

        // Check if we need aggressive optimization
        if (after.heapUsed > this.options.maxHeapSize * this.options.gcThreshold) {
          this.performAggressiveOptimization();
        }
      };
    }
  }

  startMonitoring() {
    const interval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const sample = {
        timestamp: Date.now(),
        ...memUsage
      };

      this.monitoringData.samples.push(sample);

      // Keep only last 100 samples
      if (this.monitoringData.samples.length > 100) {
        this.monitoringData.samples.shift();
      }

      this.emit('memorySample', sample);

      // Check memory pressure
      if (memUsage.heapUsed > this.options.maxHeapSize * this.options.gcThreshold) {
        this.emit('memoryPressure', memUsage);
        this.performOptimization();
      }
    }, 1000);

    // Cleanup on process exit
    process.on('exit', () => clearInterval(interval));
  }

  // Get object from pool
  getFromPool(type, ...args) {
    const pool = this.objectPools.get(type);
    return pool ? pool.acquire(...args) : null;
  }

  // Return object to pool
  returnToPool(type, object) {
    const pool = this.objectPools.get(type);
    if (pool) {
      pool.release(object);
    }
  }

  // Cache operations
  cacheSet(category, key, value, ttl) {
    const cache = this.caches.get(category);
    if (cache) {
      return cache.set(key, value, ttl);
    }
    return false;
  }

  cacheGet(category, key) {
    const cache = this.caches.get(category);
    return cache ? cache.get(key) : undefined;
  }

  cacheDelete(category, key) {
    const cache = this.caches.get(category);
    if (cache) {
      return cache.delete(key);
    }
    return false;
  }

  cacheClear(category) {
    const cache = this.caches.get(category);
    if (cache) {
      cache.clear();
      return true;
    }
    return false;
  }

  // Memory optimization strategies
  performOptimization() {
    console.log('🧹 Performing memory optimization...');
    let optimized = 0;

    // Clear old cache entries
    optimized += this.clearOldCacheEntries();

    // Trim object pools
    optimized += this.trimObjectPools();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      optimized++;
    }

    this.monitoringData.optimizations += optimized;
    this.emit('optimization', { optimized, timestamp: Date.now() });

    console.log(`✅ Optimization completed: ${optimized} operations`);
  }

  performAggressiveOptimization() {
    console.log('🚨 Performing aggressive memory optimization...');

    // Clear all caches
    let cleared = 0;
    for (const [name, cache] of this.caches) {
      const size = cache.size;
      cache.clear();
      cleared += size;
      console.log(`   Cleared ${name} cache: ${size} entries`);
    }

    // Trim all object pools
    let trimmed = 0;
    for (const [name, pool] of this.objectPools) {
      if (pool.trim) {
        const trimmedCount = pool.trim();
        trimmed += trimmedCount;
        console.log(`   Trimmed ${name} pool: ${trimmedCount} objects`);
      }
    }

    // Force multiple GC cycles
    let gcCycles = 3;
    for (let i = 0; i < gcCycles; i++) {
      if (global.gc) {
        global.gc();
        // Small delay between GC cycles
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      }
    }

    console.log(`🔥 Aggressive optimization: ${cleared} caches cleared, ${trimmed} objects trimmed, ${gcCycles} GC cycles`);
  }

  clearOldCacheEntries() {
    let cleared = 0;

    for (const [name, cache] of this.caches) {
      const size = cache.size;

      // Remove expired entries
      if (cache.purge) {
        cache.purge();
      }

      cleared += size - cache.size;
    }

    return cleared;
  }

  trimObjectPools() {
    let trimmed = 0;

    for (const [name, pool] of this.objectPools) {
      if (pool.trim) {
        trimmed += pool.trim();
      }
    }

    return trimmed;
  }

  // Memory-efficient string operations
  createSharedString(str) {
    const stringPool = this.objectPools.get('string');
    return stringPool ? stringPool.intern(str) : str;
  }

  // Memory-efficient array operations
  createSharedArray(size, fillValue) {
    const arrayPool = this.objectPools.get('array');
    return arrayPool ? arrayPool.acquire(size, fillValue) : new Array(size).fill(fillValue);
  }

  // Memory monitoring and reporting
  getMemoryStats() {
    const memUsage = process.memoryUsage();
    const heapStats = this.getHeapStats();

    return {
      current: memUsage,
      heap: heapStats,
      monitoring: {
        samples: this.monitoringData.samples.length,
        gcCount: this.monitoringData.gcCount,
        optimizations: this.monitoringData.optimizations
      },
      caches: this.getCacheStats(),
      pools: this.getPoolStats()
    };
  }

  getHeapStats() {
    try {
      if (global.v8 && global.v8.getHeapStatistics) {
        return global.v8.getHeapStatistics();
      }
    } catch (e) {
      // V8 heap stats not available
    }

    return null;
  }

  getCacheStats() {
    const stats = {};

    for (const [name, cache] of this.caches) {
      stats[name] = {
        size: cache.size,
        maxSize: cache.max,
        itemCount: cache.itemCount || cache.size
      };
    }

    return stats;
  }

  getPoolStats() {
    const stats = {};

    for (const [name, pool] of this.objectPools) {
      stats[name] = {
        size: pool.size || 0,
        maxSize: pool.maxSize || 0,
        acquired: pool.acquired || 0,
        released: pool.released || 0
      };
    }

    return stats;
  }

  generateMemoryReport() {
    const stats = this.getMemoryStats();
    const report = {
      timestamp: new Date().toISOString(),
      memory: stats,
      recommendations: this.generateRecommendations(stats)
    };

    return report;
  }

  generateRecommendations(stats) {
    const recommendations = [];

    const { current, heap, caches, pools } = stats;

    // Memory usage recommendations
    const heapUtilization = current.heapUsed / current.heapTotal;
    if (heapUtilization > 0.8) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: `High heap utilization: ${(heapUtilization * 100).toFixed(1)}%`,
        actions: ['Perform aggressive optimization', 'Increase heap size', 'Review memory allocation patterns']
      });
    }

    // Cache recommendations
    let totalCacheSize = 0;
    for (const [name, cache] of Object.entries(caches)) {
      totalCacheSize += cache.size;

      if (cache.size > cache.maxSize * 0.9) {
        recommendations.push({
          type: 'cache',
          priority: 'medium',
          message: `${name} cache is nearly full (${cache.size}/${cache.maxSize})`,
          actions: ['Increase cache size', 'Reduce TTL', 'Implement cache eviction policies']
        });
      }
    }

    if (totalCacheSize > 10000) {
      recommendations.push({
        type: 'cache',
        priority: 'low',
        message: `Large total cache size: ${totalCacheSize} entries`,
        actions: ['Review cache hit rates', 'Optimize cache keys', 'Consider cache partitioning']
      });
    }

    // Pool recommendations
    for (const [name, pool] of Object.entries(pools)) {
      if (pool.size > pool.maxSize * 0.8) {
        recommendations.push({
          type: 'pool',
          priority: 'low',
          message: `${name} pool utilization is high (${pool.size}/${pool.maxSize})`,
          actions: ['Increase pool size', 'Review object lifecycle', 'Check for pool leaks']
        });
      }
    }

    return recommendations;
  }

  // Cleanup
  destroy() {
    // Clear all caches
    for (const cache of this.caches.values()) {
      cache.clear();
    }

    // Clear all object pools
    for (const pool of this.objectPools.values()) {
      if (pool.clear) {
        pool.clear();
      }
    }

    // Remove all listeners
    this.removeAllListeners();

    console.log('🗑️ Memory optimizer destroyed');
  }
}

// Object Pool implementations
class BufferPool {
  constructor(maxSize = 100) {
    this.pool = [];
    this.maxSize = maxSize;
    this.created = 0;
    this.acquired = 0;
    this.released = 0;
  }

  acquire(size = 1024) {
    this.acquired++;

    for (let i = 0; i < this.pool.length; i++) {
      const buffer = this.pool[i];
      if (buffer.length >= size) {
        this.pool.splice(i, 1);
        return buffer;
      }
    }

    this.created++;
    return Buffer.allocUnsafe(size);
  }

  release(buffer) {
    this.released++;

    if (this.pool.length < this.maxSize) {
      buffer.fill(0); // Clear sensitive data
      this.pool.push(buffer);
    }
  }

  trim() {
    const originalSize = this.pool.length;
    this.pool.splice(Math.floor(this.maxSize / 2));
    return originalSize - this.pool.length;
  }

  get size() {
    return this.pool.length;
  }

  get maxSize() {
    return this.maxSize;
  }

  clear() {
    this.pool = [];
  }
}

class StringPool {
  constructor(maxSize = 1000) {
    this.pool = new Map();
    this.maxSize = maxSize;
    this.hits = 0;
    this.misses = 0;
  }

  intern(str) {
    if (this.pool.has(str)) {
      this.hits++;
      return this.pool.get(str);
    }

    if (this.pool.size >= this.maxSize) {
      // Remove oldest entries (simplified LRU)
      const firstKey = this.pool.keys().next().value;
      this.pool.delete(firstKey);
    }

    this.misses++;
    this.pool.set(str, str);
    return str;
  }

  get size() {
    return this.pool.size;
  }

  get maxSize() {
    return this.maxSize;
  }

  clear() {
    this.pool.clear();
  }
}

class ArrayPool {
  constructor(maxSize = 50) {
    this.pool = [];
    this.maxSize = maxSize;
    this.created = 0;
    this.acquired = 0;
    this.released = 0;
  }

  acquire(size = 0, fillValue) {
    this.acquired++;

    for (let i = 0; i < this.pool.length; i++) {
      const array = this.pool[i];
      if (array.length >= size) {
        this.pool.splice(i, 1);
        if (size > 0) {
          array.length = size;
          array.fill(fillValue);
        }
        return array;
      }
    }

    this.created++;
    return new Array(size).fill(fillValue);
  }

  release(array) {
    this.released++;

    if (this.pool.length < this.maxSize) {
      array.length = 0; // Clear array
      this.pool.push(array);
    }
  }

  trim() {
    const originalSize = this.pool.length;
    this.pool.splice(Math.floor(this.maxSize / 2));
    return originalSize - this.pool.length;
  }

  get size() {
    return this.pool.length;
  }

  get maxSize() {
    return this.maxSize;
  }

  clear() {
    this.pool = [];
  }
}

class ObjectPool {
  constructor(maxSize = 100) {
    this.pool = [];
    this.maxSize = maxSize;
    this.created = 0;
    this.acquired = 0;
    this.released = 0;
  }

  acquire() {
    this.acquired++;

    if (this.pool.length > 0) {
      return this.pool.pop();
    }

    this.created++;
    return {};
  }

  release(obj) {
    this.released++;

    if (this.pool.length < this.maxSize) {
      // Clear object properties
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          delete obj[key];
        }
      }
      this.pool.push(obj);
    }
  }

  trim() {
    const originalSize = this.pool.length;
    this.pool.splice(Math.floor(this.maxSize / 2));
    return originalSize - this.pool.length;
  }

  get size() {
    return this.pool.length;
  }

  get maxSize() {
    return this.maxSize;
  }

  clear() {
    this.pool = [];
  }
}

module.exports = {
  MemoryOptimizer,
  BufferPool,
  StringPool,
  ArrayPool,
  ObjectPool
};