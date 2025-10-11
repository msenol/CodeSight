/**
 * Memory Profiling Tool for CodeSight MCP Server (T086)
 *
 * Node.js memory profiling utility that monitors memory usage patterns,
 * identifies leaks, and provides optimization recommendations.
 */

const fs = require('fs');
const path = require('path');
const { performance, memoryUsage } = require('perf_hooks');

class MemoryProfiler {
  constructor(options = {}) {
    this.options = {
      interval: options.interval || 1000, // ms
      maxSamples: options.maxSamples || 1000,
      outputDir: options.outputDir || './memory-reports',
      detailed: options.detailed || false,
      gcLogging: options.gcLogging || false,
      ...options
    };

    this.samples = [];
    this.baseline = null;
    this.isRunning = false;
    this.intervalId = null;
    this.gcStats = { count: 0, duration: 0 };

    this.ensureOutputDirectory();

    if (this.options.gcLogging) {
      this.enableGCLogging();
    }
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }
  }

  enableGCLogging() {
    const originalGC = global.gc;

    global.gc = () => {
      const start = performance.now();
      if (originalGC) originalGC();
      const end = performance.now();

      this.gcStats.count++;
      this.gcStats.duration += (end - start);

      if (this.options.verbose) {
        console.log(`GC #${this.gcStats.count}: ${(end - start).toFixed(2)}ms`);
      }
    };
  }

  start() {
    if (this.isRunning) {
      console.warn('Memory profiler is already running');
      return;
    }

    console.log('🔍 Starting memory profiler...');
    this.isRunning = true;
    this.samples = [];

    // Capture baseline
    this.baseline = this.captureMemorySnapshot('baseline');

    // Start sampling
    this.intervalId = setInterval(() => {
      this.sample();
    }, this.options.interval);

    // Handle process exit
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop() {
    if (!this.isRunning) return;

    console.log('\n🛑 Stopping memory profiler...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Generate final report
    this.generateReport();

    // Remove process listeners
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  }

  sample() {
    const snapshot = this.captureMemorySnapshot();

    // Limit samples to prevent memory issues
    if (this.samples.length >= this.options.maxSamples) {
      this.samples.shift();
    }

    this.samples.push(snapshot);

    // Check for potential memory issues
    this.checkMemoryIssues(snapshot);
  }

  captureMemorySnapshot(label = '') {
    const memUsage = memoryUsage();
    const timestamp = Date.now();

    const snapshot = {
      timestamp,
      label,
      rss: memUsage.rss,        // Resident Set Size
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers
    };

    // Add detailed information if enabled
    if (this.options.detailed) {
      snapshot.process = {
        pid: process.pid,
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage(),
        hrtime: process.hrtime.bigint()
      };

      // Add V8 heap statistics if available
      if (global.v8) {
        try {
          const heapStats = global.v8.getHeapStatistics();
          snapshot.heapStats = heapStats;
        } catch (e) {
          // V8 heap stats not available
        }
      }
    }

    return snapshot;
  }

  checkMemoryIssues(current) {
    if (!this.baseline) return;

    const rssIncrease = current.rss - this.baseline.rss;
    const heapIncrease = current.heapUsed - this.baseline.heapUsed;
    const heapUtilization = (current.heapUsed / current.heapTotal) * 100;

    // Check for significant memory increases
    if (rssIncrease > 100 * 1024 * 1024) { // 100MB increase
      console.warn(`⚠️  High RSS increase: ${(rssIncrease / 1024 / 1024).toFixed(2)}MB`);
    }

    if (heapIncrease > 50 * 1024 * 1024) { // 50MB increase
      console.warn(`⚠️  High heap increase: ${(heapIncrease / 1024 / 1024).toFixed(2)}MB`);
    }

    // Check heap utilization
    if (heapUtilization > 85) {
      console.warn(`⚠️  High heap utilization: ${heapUtilization.toFixed(1)}%`);
    }

    // Check for memory leak patterns
    if (this.samples.length > 10) {
      const recentSamples = this.samples.slice(-10);
      const isIncreasing = recentSamples.every((sample, i) => {
        if (i === 0) return true;
        return sample.heapUsed > recentSamples[i - 1].heapUsed;
      });

      if (isIncreasing) {
        console.warn('🚨 Potential memory leak detected - consistent memory increase');
      }
    }
  }

  generateReport() {
    if (this.samples.length === 0) {
      console.log('No memory samples collected');
      return;
    }

    const report = this.analyzeMemoryUsage();
    const reportPath = path.join(this.options.outputDir, `memory-report-${Date.now()}.json`);

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 Memory report generated: ${reportPath}`);
    this.printSummary(report);
  }

  analyzeMemoryUsage() {
    const samples = this.samples;
    const baseline = this.baseline;

    // Calculate statistics
    const rssValues = samples.map(s => s.rss);
    const heapValues = samples.map(s => s.heapUsed);
    const externalValues = samples.map(s => s.external);

    const stats = {
      rss: this.calculateStats(rssValues),
      heapUsed: this.calculateStats(heapValues),
      external: this.calculateStats(externalValues)
    };

    // Memory growth analysis
    const growth = this.analyzeGrowth(samples, baseline);

    // GC analysis
    const gcAnalysis = {
      totalCollections: this.gcStats.count,
      totalDuration: this.gcStats.duration,
      averageDuration: this.gcStats.count > 0 ? this.gcStats.duration / this.gcStats.count : 0
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(stats, growth, gcAnalysis);

    return {
      timestamp: new Date().toISOString(),
      duration: samples.length * this.options.interval,
      sampleCount: samples.length,
      baseline,
      statistics: stats,
      growth,
      gc: gcAnalysis,
      recommendations,
      samples: this.options.includeRawSamples ? samples : undefined
    };
  }

  calculateStats(values) {
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length)
    };
  }

  analyzeGrowth(samples, baseline) {
    if (!baseline || samples.length < 2) return null;

    const first = samples[0];
    const last = samples[samples.length - 1];
    const duration = last.timestamp - first.timestamp;

    return {
      rss: {
        absolute: last.rss - baseline.rss,
        relative: ((last.rss - baseline.rss) / baseline.rss) * 100,
        rate: duration > 0 ? (last.rss - first.rss) / (duration / 1000) : 0 // bytes/second
      },
      heapUsed: {
        absolute: last.heapUsed - baseline.heapUsed,
        relative: ((last.heapUsed - baseline.heapUsed) / baseline.heapUsed) * 100,
        rate: duration > 0 ? (last.heapUsed - first.heapUsed) / (duration / 1000) : 0
      },
      external: {
        absolute: last.external - baseline.external,
        relative: ((last.external - baseline.external) / baseline.external) * 100
      }
    };
  }

  generateRecommendations(stats, growth, gcAnalysis) {
    const recommendations = [];

    // Heap size recommendations
    if (stats.heapUsed) {
      const maxHeapMB = stats.heapUsed.max / 1024 / 1024;
      const avgHeapMB = stats.heapUsed.mean / 1024 / 1024;

      if (maxHeapMB > 500) {
        recommendations.push({
          type: 'memory',
          priority: 'high',
          message: `High peak heap usage (${maxHeapMB.toFixed(1)}MB). Consider implementing memory pooling or streaming for large data processing.`,
          suggestion: 'Implement object pooling, stream processing, or increase available memory.'
        });
      }

      if (avgHeapMB > 200) {
        recommendations.push({
          type: 'memory',
          priority: 'medium',
          message: `High average heap usage (${avgHeapMB.toFixed(1)}MB). Review memory allocation patterns.`,
          suggestion: 'Check for unnecessary object creation and implement proper cleanup.'
        });
      }
    }

    // Growth recommendations
    if (growth && growth.heapUsed) {
      if (growth.heapUsed.relative > 50) {
        recommendations.push({
          type: 'leak',
          priority: 'high',
          message: `Significant heap growth detected (${growth.heapUsed.relative.toFixed(1)}%). Potential memory leak.`,
          suggestion: 'Investigate object lifecycle, remove event listeners, and clear references.'
        });
      }

      if (growth.heapUsed.rate > 1024 * 1024) { // > 1MB/s
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          message: `High memory growth rate (${(growth.heapUsed.rate / 1024 / 1024).toFixed(2)}MB/s).`,
          suggestion: 'Implement streaming or batch processing for large datasets.'
        });
      }
    }

    // GC recommendations
    if (gcAnalysis.totalCollections > 0) {
      if (gcAnalysis.averageDuration > 10) {
        recommendations.push({
          type: 'gc',
          priority: 'medium',
          message: `Long GC pauses detected (avg: ${gcAnalysis.averageDuration.toFixed(2)}ms).`,
          suggestion: 'Reduce object allocation rate, implement object pooling, or tune GC settings.'
        });
      }

      if (gcAnalysis.totalCollections > 100) {
        recommendations.push({
          type: 'gc',
          priority: 'low',
          message: `High GC frequency (${gcAnalysis.totalCollections} collections).`,
          suggestion: 'Consider generational GC tuning or reducing temporary object allocation.'
        });
      }
    }

    // External memory recommendations
    if (stats.external && stats.external.max > 100 * 1024 * 1024) { // > 100MB
      recommendations.push({
        type: 'external',
        priority: 'medium',
        message: `High external memory usage (${(stats.external.max / 1024 / 1024).toFixed(1)}MB).`,
        suggestion: 'Check for Buffer, TypedArray, or native module memory leaks.'
      });
    }

    return recommendations;
  }

  printSummary(report) {
    console.log('\n📊 Memory Profiling Summary');
    console.log('========================');
    console.log(`Duration: ${(report.duration / 1000).toFixed(1)}s`);
    console.log(`Samples: ${report.sampleCount}`);

    if (report.statistics.heapUsed) {
      const heap = report.statistics.heapUsed;
      console.log(`\nHeap Usage:`);
      console.log(`  Average: ${(heap.mean / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  Peak: ${(heap.max / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  P95: ${(heap.p95 / 1024 / 1024).toFixed(1)}MB`);
    }

    if (report.growth && report.growth.heapUsed) {
      const growth = report.growth.heapUsed;
      console.log(`\nMemory Growth:`);
      console.log(`  Total: ${(growth.absolute / 1024 / 1024).toFixed(1)}MB (${growth.relative.toFixed(1)}%)`);
      console.log(`  Rate: ${(growth.rate / 1024).toFixed(1)}KB/s`);
    }

    if (report.gc.totalCollections > 0) {
      console.log(`\nGarbage Collection:`);
      console.log(`  Collections: ${report.gc.totalCollections}`);
      console.log(`  Avg Duration: ${report.gc.averageDuration.toFixed(2)}ms`);
      console.log(`  Total Duration: ${report.gc.totalDuration.toFixed(2)}ms`);
    }

    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations (${report.recommendations.length}):`);
      report.recommendations.forEach((rec, i) => {
        const icon = rec.priority === 'high' ? '🚨' : rec.priority === 'medium' ? '⚠️' : '💡';
        console.log(`  ${icon} ${rec.message}`);
        console.log(`     → ${rec.suggestion}`);
      });
    } else {
      console.log('\n✅ No memory issues detected!');
    }
  }

  // Profile a specific function
  async profileFunction(fn, label = 'function') {
    console.log(`🔍 Profiling function: ${label}`);

    const startMemory = this.captureMemorySnapshot(`start_${label}`);
    const startTime = performance.now();

    try {
      const result = await fn();

      const endMemory = this.captureMemorySnapshot(`end_${label}`);
      const endTime = performance.now();

      const delta = {
        executionTime: endTime - startTime,
        memoryDelta: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external
        }
      };

      console.log(`✅ Function ${label} completed:`);
      console.log(`   Execution time: ${delta.executionTime.toFixed(2)}ms`);
      console.log(`   RSS delta: ${(delta.memoryDelta.rss / 1024).toFixed(1)}KB`);
      console.log(`   Heap delta: ${(delta.memoryDelta.heapUsed / 1024).toFixed(1)}KB`);

      return { result, profile: delta };
    } catch (error) {
      console.error(`❌ Function ${label} failed:`, error);
      throw error;
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--interval':
        options.interval = parseInt(value);
        break;
      case '--max-samples':
        options.maxSamples = parseInt(value);
        break;
      case '--output':
        options.outputDir = value;
        break;
      case '--detailed':
        options.detailed = true;
        i--; // No value for this flag
        break;
      case '--gc':
        options.gcLogging = true;
        i--; // No value for this flag
        break;
      case '--help':
        console.log(`
Memory Profiler for CodeSight MCP Server

Usage: node memory-profiler.js [options]

Options:
  --interval <ms>        Sampling interval in milliseconds (default: 1000)
  --max-samples <num>    Maximum number of samples to keep (default: 1000)
  --output <dir>         Output directory for reports (default: ./memory-reports)
  --detailed             Include detailed memory statistics
  --gc                   Enable garbage collection logging
  --help                 Show this help message

Examples:
  node memory-profiler.js --interval 500 --detailed
  node memory-profiler.js --output ./reports --gc
        `);
        process.exit(0);
    }
  }

  const profiler = new MemoryProfiler(options);

  console.log('Starting memory profiler...');
  console.log('Press Ctrl+C to stop and generate report');

  profiler.start();
}

module.exports = MemoryProfiler;