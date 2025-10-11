# Memory Profiling and Optimization Suite (T086)

Comprehensive memory profiling and optimization toolkit for the CodeSight MCP Server. Provides tools for memory monitoring, leak detection, heap analysis, and automatic memory management.

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Install lru-cache globally (required)
npm install -g lru-cache
```

### Basic Usage

```bash
# Start memory profiler with default settings
npm run profile

# Run detailed profiling with GC logging
npm run profile:detailed

# Monitor heap usage (requires --inspect flag)
npm run heap:monitor

# Long-term heap monitoring (5 minutes)
npm run heap:monitor:long

# Test all profiling tools
npm run test
```

## 📊 Tools Overview

### 1. Memory Profiler (`memory-profiler.js`)

Real-time memory monitoring and analysis tool.

**Features:**
- Continuous memory sampling
- Memory leak detection
- GC performance monitoring
- Growth trend analysis
- Automated recommendations

**Usage:**
```bash
node memory-profiler.js [options]

Options:
  --interval <ms>        Sampling interval (default: 1000)
  --max-samples <num>    Maximum samples to keep (default: 1000)
  --output <dir>         Output directory (default: ./memory-reports)
  --detailed             Include detailed statistics
  --gc                   Enable GC logging
  --help                 Show help
```

**Example:**
```bash
# Detailed profiling with 500ms intervals
node memory-profiler.js --interval 500 --detailed --gc

# Custom output directory
node memory-profiler.js --output ./custom-reports
```

### 2. Heap Analyzer (`heap-analyzer.js`)

Advanced heap snapshot analysis for leak detection.

**Features:**
- Heap snapshot comparison
- Object retention analysis
- Type-specific leak detection
- Growth pattern identification
- Comprehensive reporting

**Usage:**
```bash
# Start with --inspect flag for heap snapshots
node --inspect heap-analyzer.js monitor [duration] [interval]

# Monitor for 60 seconds
node --inspect heap-analyzer.js monitor 60000

# Long-term monitoring (5 minutes, 1s intervals)
node --inspect heap-analyzer.js monitor 300000 1000
```

### 3. Memory Optimizer (`memory-optimizer.js`)

Automatic memory management and optimization.

**Features:**
- Object pooling for common types
- LRU caching with intelligent eviction
- Memory pressure monitoring
- Automatic cleanup
- Performance recommendations

**Usage:**
```javascript
const { MemoryOptimizer } = require('./memory-optimizer');

// Initialize optimizer
const optimizer = new MemoryOptimizer({
  maxHeapSize: 512 * 1024 * 1024, // 512MB
  gcThreshold: 0.8, // 80% of max heap
  pooling: true,
  caching: true,
  monitoring: true
});

// Use object pools
const buffer = optimizer.getFromPool('buffer', 1024);
optimizer.returnToPool('buffer', buffer);

// Use caches
optimizer.cacheSet('parsing', 'file1.ts', parsedData);
const cached = optimizer.cacheGet('parsing', 'file1.ts');

// Get memory statistics
const stats = optimizer.getMemoryStats();
console.log(stats);
```

## 🎯 Memory Optimization Strategies

### 1. Object Pooling

Reduce allocation overhead by reusing objects:

```javascript
const { BufferPool, ArrayPool, ObjectPool } = require('./memory-optimizer');

// Buffer pooling
const bufferPool = new BufferPool(100);
const buffer = bufferPool.acquire(1024);
bufferPool.release(buffer);

// Array pooling
const arrayPool = new ArrayPool(50);
const array = arrayPool.acquire(100, 0);
arrayPool.release(array);

// Object pooling
const objectPool = new ObjectPool(100);
const obj = objectPool.acquire();
objectPool.release(obj);
```

### 2. Intelligent Caching

Implement LRU caching with automatic eviction:

```javascript
const optimizer = new MemoryOptimizer();

// Cache parsed results with TTL
optimizer.cacheSet('parsing', 'complex-file.ts', astData, 1000 * 60 * 15); // 15 minutes

// Cache search results
optimizer.cacheSet('search', 'function authentication', searchResults);

// Get cached data
const cached = optimizer.cacheGet('parsing', 'complex-file.ts');
if (cached) {
  return cached; // Avoid re-parsing
}
```

### 3. Memory Monitoring

Real-time memory usage tracking:

```javascript
const optimizer = new MemoryOptimizer({ monitoring: true });

// Listen to memory events
optimizer.on('memoryPressure', (memUsage) => {
  console.warn('Memory pressure detected:', memUsage);
  optimizer.performOptimization();
});

optimizer.on('gc', (gcInfo) => {
  console.log('GC completed:', gcInfo);
});

optimizer.on('optimization', (result) => {
  console.log('Memory optimization performed:', result);
});
```

### 4. Automatic Cleanup

Implement cleanup patterns for long-running processes:

```javascript
class CodeProcessor {
  constructor() {
    this.optimizer = new MemoryOptimizer();
    this.processing = false;
  }

  async processCode(code) {
    this.processing = true;

    try {
      // Use pooled objects
      const buffer = this.optimizer.getFromPool('buffer', code.length);

      // Process code
      const result = await this.parseAndAnalyze(code, buffer);

      // Return buffer to pool
      this.optimizer.returnToPool('buffer', buffer);

      return result;
    } finally {
      this.processing = false;

      // Cleanup if memory pressure
      if (this.optimizer.shouldOptimize()) {
        this.optimizer.performOptimization();
      }
    }
  }
}
```

## 📈 Memory Metrics and Analysis

### Key Metrics

1. **RSS (Resident Set Size)**: Total memory occupied by process
2. **Heap Used**: Actual memory used for JavaScript objects
3. **Heap Total**: Total memory allocated for heap
4. **External**: Memory used by C++ objects bound to JavaScript
5. **Array Buffers**: Memory used by ArrayBuffer objects

### Performance Indicators

- **Heap Utilization**: `heapUsed / heapTotal`
- **Memory Growth Rate**: Change over time
- **GC Frequency**: Number of garbage collections
- **GC Duration**: Time spent in garbage collection

### Thresholds and Alerts

```javascript
const optimizer = new MemoryOptimizer({
  maxHeapSize: 512 * 1024 * 1024, // 512MB
  gcThreshold: 0.8, // Alert at 80% heap usage
});

optimizer.on('memoryPressure', (memUsage) => {
  const utilization = memUsage.heapUsed / memUsage.heapTotal;

  if (utilization > 0.9) {
    console.error('CRITICAL: Memory usage at', (utilization * 100).toFixed(1) + '%');
    optimizer.performAggressiveOptimization();
  } else if (utilization > 0.8) {
    console.warn('WARNING: Memory usage at', (utilization * 100).toFixed(1) + '%');
    optimizer.performOptimization();
  }
});
```

## 🔧 Integration with CodeSight MCP

### Server Integration

```javascript
// In your main server file
const { MemoryOptimizer } = require('./scripts/memory-profiling/memory-optimizer');

// Initialize optimizer
const memoryOptimizer = new MemoryOptimizer({
  maxHeapSize: 1024 * 1024 * 1024, // 1GB for server
  monitoring: true,
  pooling: true,
  caching: true
});

// Use in parsing service
class ParsingService {
  constructor() {
    this.optimizer = memoryOptimizer;
  }

  async parseFile(filePath, content) {
    // Check cache first
    const cacheKey = `${filePath}:${content.length}`;
    let cached = this.optimizer.cacheGet('parsing', cacheKey);

    if (cached) {
      return cached;
    }

    // Parse file
    const ast = this.parseContent(content);

    // Cache result
    this.optimizer.cacheSet('parsing', cacheKey, ast, 1000 * 60 * 30); // 30 minutes

    return ast;
  }
}

// Use in search service
class SearchService {
  constructor() {
    this.optimizer = memoryOptimizer;
  }

  async search(query, codebaseId) {
    const cacheKey = `${codebaseId}:${query}`;
    let cached = this.optimizer.cacheGet('search', cacheKey);

    if (cached) {
      return cached;
    }

    const results = await this.performSearch(query, codebaseId);
    this.optimizer.cacheSet('search', cacheKey, results, 1000 * 60 * 15); // 15 minutes

    return results;
  }
}
```

### Background Monitoring

```javascript
// Set up periodic memory reports
setInterval(() => {
  const report = memoryOptimizer.generateMemoryReport();

  // Log to file
  fs.writeFileSync(
    `./reports/memory-${Date.now()}.json`,
    JSON.stringify(report, null, 2)
  );

  // Check for critical issues
  const criticalIssues = report.recommendations.filter(r => r.priority === 'high');
  if (criticalIssues.length > 0) {
    console.error('CRITICAL memory issues detected:', criticalIssues);
  }
}, 1000 * 60 * 5); // Every 5 minutes
```

## 📊 Reports and Analysis

### Report Structure

```javascript
{
  "timestamp": "2025-01-20T15:30:00.000Z",
  "memory": {
    "current": { "rss": 123456789, "heapUsed": 98765432, ... },
    "heap": { "totalHeapSize": 134217728, "usedHeapSize": 98765432, ... },
    "monitoring": { "samples": 50, "gcCount": 12, "optimizations": 3 },
    "caches": { "parsing": { "size": 150, "maxSize": 1000 }, ... },
    "pools": { "buffer": { "size": 25, "maxSize": 100 }, ... }
  },
  "recommendations": [
    {
      "type": "memory",
      "priority": "medium",
      "message": "High heap utilization: 85.2%",
      "actions": ["Perform optimization", "Review allocation patterns"]
    }
  ]
}
```

### Automated Analysis

The suite provides automated analysis and recommendations:

1. **Memory Leak Detection**: Identifies consistent memory growth patterns
2. **Performance Optimization**: Suggests caching and pooling strategies
3. **Resource Management**: Recommends cleanup procedures
4. **Capacity Planning**: Provides scaling guidance

## 🚨 Troubleshooting

### Common Memory Issues

**High Heap Usage**
```bash
# Run detailed profiling
npm run profile:detailed

# Check for leaks
npm run heap:monitor
```

**Frequent Garbage Collection**
```javascript
// Increase object pool sizes
const optimizer = new MemoryOptimizer({
  pooling: true,
  cacheSize: 2000 // Increase cache sizes
});
```

**Memory Leaks**
```bash
# Long-term monitoring
npm run heap:monitor:long

# Analyze heap snapshots
node --inspect heap-analyzer.js monitor 600000
```

### Performance Tuning

1. **Adjust Heap Size**: Increase `maxHeapSize` for larger workloads
2. **Optimize Caches**: Tune cache sizes and TTL values
3. **Pool Configuration**: Adjust pool sizes based on usage patterns
4. **GC Threshold**: Modify `gcThreshold` for earlier intervention

## 📚 Best Practices

1. **Regular Monitoring**: Set up automated memory monitoring
2. **Object Lifecycle**: Always return objects to pools
3. **Cache Management**: Implement proper cache eviction policies
4. **Error Handling**: Ensure cleanup in error scenarios
5. **Performance Testing**: Regular load testing with memory profiling

## 🔗 Integration Examples

See the integration examples in the `/examples` directory for complete implementations with:
- Express.js server integration
- TypeScript application integration
- Background job processing
- Microservices memory management

---

**For advanced usage and custom configurations**, see the API documentation in each tool file.