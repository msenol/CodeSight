/**
 * Prometheus Metrics Exporter for CodeSight MCP Server
 * Provides comprehensive metrics collection and exposition
 */

import { register, Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';
import { Request, Response } from 'express';
import { performance } from 'perf_hooks';

// Custom metrics registry for CodeSight
export const metricsRegistry = new Registry();

// Enable collection of default metrics
collectDefaultMetrics({ register: metricsRegistry });

// Request metrics
export const httpRequestsTotal = new Counter({
  name: 'codesight_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry]
});

export const httpRequestDurationMs = new Histogram({
  name: 'codesight_http_request_duration_ms',
  help: 'Duration of HTTP requests in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [metricsRegistry]
});

export const httpRequestSizeBytes = new Histogram({
  name: 'codesight_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [metricsRegistry]
});

export const httpResponseSizeBytes = new Histogram({
  name: 'codesight_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [metricsRegistry]
});

// Search and indexing metrics
export const searchOperationsTotal = new Counter({
  name: 'codesight_search_operations_total',
  help: 'Total number of search operations',
  labelNames: ['codebase_id', 'query_type', 'status'],
  registers: [metricsRegistry]
});

export const searchDurationMs = new Histogram({
  name: 'codesight_search_duration_ms',
  help: 'Duration of search operations in milliseconds',
  labelNames: ['codebase_id', 'query_type', 'result_count'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [metricsRegistry]
});

export const searchResultCount = new Histogram({
  name: 'codesight_search_result_count',
  help: 'Number of results returned by search operations',
  labelNames: ['codebase_id', 'query_type'],
  buckets: [0, 1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [metricsRegistry]
});

export const indexingOperationsTotal = new Counter({
  name: 'codesight_indexing_operations_total',
  help: 'Total number of indexing operations',
  labelNames: ['codebase_id', 'status'],
  registers: [metricsRegistry]
});

export const indexingDurationMs = new Histogram({
  name: 'codesight_indexing_duration_ms',
  help: 'Duration of indexing operations in milliseconds',
  labelNames: ['codebase_id', 'file_count'],
  buckets: [1000, 5000, 10000, 30000, 60000, 120000, 300000, 600000],
  registers: [metricsRegistry]
});

export const indexingFilesTotal = new Histogram({
  name: 'codesight_indexing_files_total',
  help: 'Number of files indexed in indexing operations',
  labelNames: ['codebase_id', 'language'],
  buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000, 50000],
  registers: [metricsRegistry]
});

// Database metrics
export const databaseConnectionsActive = new Gauge({
  name: 'codesight_database_connections_active',
  help: 'Number of active database connections',
  registers: [metricsRegistry]
});

export const databaseQueriesTotal = new Counter({
  name: 'codesight_database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [metricsRegistry]
});

export const databaseQueryDurationMs = new Histogram({
  name: 'codesight_database_query_duration_ms',
  help: 'Duration of database queries in milliseconds',
  labelNames: ['operation', 'table'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  registers: [metricsRegistry]
});

// MCP Tools metrics
export const mcpToolCallsTotal = new Counter({
  name: 'codesight_mcp_tool_calls_total',
  help: 'Total number of MCP tool calls',
  labelNames: ['tool_name', 'status'],
  registers: [metricsRegistry]
});

export const mcpToolDurationMs = new Histogram({
  name: 'codesight_mcp_tool_duration_ms',
  help: 'Duration of MCP tool calls in milliseconds',
  labelNames: ['tool_name'],
  buckets: [100, 500, 1000, 2500, 5000, 10000, 30000, 60000],
  registers: [metricsRegistry]
});

// Rust FFI metrics
export const rustFFICallsTotal = new Counter({
  name: 'codesight_rust_ffi_calls_total',
  help: 'Total number of Rust FFI calls',
  labelNames: ['function', 'status'],
  registers: [metricsRegistry]
});

export const rustFFIDurationMs = new Histogram({
  name: 'codesight_rust_ffi_duration_ms',
  help: 'Duration of Rust FFI calls in milliseconds',
  labelNames: ['function'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  registers: [metricsRegistry]
});

export const rustFFIFallbacksTotal = new Counter({
  name: 'codesight_rust_ffi_fallbacks_total',
  help: 'Total number of Rust FFI fallbacks to TypeScript',
  labelNames: ['function', 'reason'],
  registers: [metricsRegistry]
});

// System metrics
export const systemMemoryUsageBytes = new Gauge({
  name: 'codesight_system_memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'], // heap, external, rss
  registers: [metricsRegistry]
});

export const systemCpuUsagePercent = new Gauge({
  name: 'codesight_system_cpu_usage_percent',
  help: 'CPU usage percentage',
  registers: [metricsRegistry]
});

export const codebaseEntityCount = new Gauge({
  name: 'codesight_codebase_entity_count',
  help: 'Number of entities in codebases',
  labelNames: ['codebase_id', 'entity_type'],
  registers: [metricsRegistry]
});

export const codebaseSizeBytes = new Gauge({
  name: 'codesight_codebase_size_bytes',
  help: 'Size of codebases in bytes',
  labelNames: ['codebase_id'],
  registers: [metricsRegistry]
});

// Cache metrics
export const cacheHitsTotal = new Counter({
  name: 'codesight_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
  registers: [metricsRegistry]
});

export const cacheMissesTotal = new Counter({
  name: 'codesight_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
  registers: [metricsRegistry]
});

export const cacheSizeBytes = new Gauge({
  name: 'codesight_cache_size_bytes',
  help: 'Size of cache in bytes',
  labelNames: ['cache_type'],
  registers: [metricsRegistry]
});

// Error metrics
export const errorsTotal = new Counter({
  name: 'codesight_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'component'],
  registers: [metricsRegistry]
});

/**
 * Metrics middleware for Express applications
 */
export function metricsMiddleware(req: Request, res: Response, next: () => void) {
  const start = performance.now();

  // Record response size
  const originalSend = res.send;
  let responseSize = 0;

  res.send = function(data: any) {
    if (data) {
      responseSize = Buffer.byteLength(typeof data === 'string' ? data : JSON.stringify(data));
    }
    return originalSend.call(this, data);
  };

  res.on('finish', () => {
    const duration = Math.round(performance.now() - start);
    const route = req.route ? req.route.path : req.path;

    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();

    httpRequestDurationMs
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);

    httpResponseSizeBytes
      .labels(req.method, route, res.statusCode.toString())
      .observe(responseSize);
  });

  next();
}

/**
 * Metrics collector for search operations
 */
export class SearchMetricsCollector {
  static startSearch(codebaseId: string, queryType: string = 'standard'): () => void {
    const start = performance.now();

    return (resultCount: number = 0, status: string = 'success') => {
      const duration = Math.round(performance.now() - start);

      searchOperationsTotal
        .labels(codebaseId, queryType, status)
        .inc();

      searchDurationMs
        .labels(codebaseId, queryType, resultCount.toString())
        .observe(duration);

      searchResultCount
        .labels(codebaseId, queryType)
        .observe(resultCount);
    };
  }
}

/**
 * Metrics collector for indexing operations
 */
export class IndexingMetricsCollector {
  static startIndexing(codebaseId: string): (fileCount: number, language?: string, status?: string) => void {
    const start = performance.now();

    return (fileCount: number, language: string = 'unknown', status: string = 'success') => {
      const duration = Math.round(performance.now() - start);

      indexingOperationsTotal
        .labels(codebaseId, status)
        .inc();

      indexingDurationMs
        .labels(codebaseId, fileCount.toString())
        .observe(duration);

      indexingFilesTotal
        .labels(codebaseId, language)
        .observe(fileCount);
    };
  }
}

/**
 * Metrics collector for MCP tools
 */
export class MCPToolMetricsCollector {
  static startToolCall(toolName: string): () => void {
    const start = performance.now();

    return (status: string = 'success') => {
      const duration = Math.round(performance.now() - start);

      mcpToolCallsTotal
        .labels(toolName, status)
        .inc();

      mcpToolDurationMs
        .labels(toolName)
        .observe(duration);
    };
  }
}

/**
 * Metrics collector for Rust FFI
 */
export class RustFFIMetricsCollector {
  static startFFICall(functionName: string): () => void {
    const start = performance.now();

    return (status: string = 'success', fallbackReason?: string) => {
      const duration = Math.round(performance.now() - start);

      rustFFICallsTotal
        .labels(functionName, status)
        .inc();

      rustFFIDurationMs
        .labels(functionName)
        .observe(duration);

      if (status === 'fallback' && fallbackReason) {
        rustFFIFallbacksTotal
          .labels(functionName, fallbackReason)
          .inc();
      }
    };
  }
}

/**
 * System metrics collector
 */
export class SystemMetricsCollector {
  private static interval: NodeJS.Timeout | null = null;

  static startCollecting(intervalMs: number = 30000): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      this.updateSystemMetrics();
    }, intervalMs);

    // Initial collection
    this.updateSystemMetrics();
  }

  static stopCollecting(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private static updateSystemMetrics(): void {
    try {
      const memUsage = process.memoryUsage();

      systemMemoryUsageBytes
        .labels('heap')
        .set(memUsage.heapUsed);

      systemMemoryUsageBytes
        .labels('external')
        .set(memUsage.external);

      systemMemoryUsageBytes
        .labels('rss')
        .set(memUsage.rss);

      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
      systemCpuUsagePercent.set(cpuPercent);

    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }
}

/**
 * Error metrics collector
 */
export class ErrorMetricsCollector {
  static recordError(errorType: string, component: string, error: Error): void {
    errorsTotal
      .labels(errorType, component)
      .inc();
  }
}

/**
 * Database metrics collector
 */
export class DatabaseMetricsCollector {
  static startQuery(operation: string, table: string): () => void {
    const start = performance.now();

    return (status: string = 'success') => {
      const duration = Math.round(performance.now() - start);

      databaseQueriesTotal
        .labels(operation, table, status)
        .inc();

      databaseQueryDurationMs
        .labels(operation, table)
        .observe(duration);
    };
  }

  static setActiveConnections(count: number): void {
    databaseConnectionsActive.set(count);
  }
}

/**
 * Cache metrics collector
 */
export class CacheMetricsCollector {
  static recordHit(cacheType: string): void {
    cacheHitsTotal.labels(cacheType).inc();
  }

  static recordMiss(cacheType: string): void {
    cacheMissesTotal.labels(cacheType).inc();
  }

  static setSize(cacheType: string, sizeBytes: number): void {
    cacheSizeBytes.labels(cacheType).set(sizeBytes);
  }
}

/**
 * Codebase metrics collector
 */
export class CodebaseMetricsCollector {
  static updateEntityCount(codebaseId: string, entityType: string, count: number): void {
    codebaseEntityCount
      .labels(codebaseId, entityType)
      .set(count);
  }

  static updateSize(codebaseId: string, sizeBytes: number): void {
    codebaseSizeBytes
      .labels(codebaseId)
      .set(sizeBytes);
  }
}

/**
 * Express route handler for metrics endpoint
 */
export function metricsHandler(req: Request, res: Response): void {
  res.set('Content-Type', metricsRegistry.contentType);
  res.end(metricsRegistry.metrics());
}

/**
 * Get all available metrics as a JSON object
 */
export async function getMetricsAsJSON(): Promise<Record<string, any>> {
  const metrics = await metricsRegistry.metrics();
  const result: Record<string, any> = {};

  // This is a simplified version - in production you might want to parse the Prometheus format
  result.available_metrics = [
    'codesight_http_requests_total',
    'codesight_http_request_duration_ms',
    'codesight_search_operations_total',
    'codesight_search_duration_ms',
    'codesight_indexing_operations_total',
    'codesight_indexing_duration_ms',
    'codesight_mcp_tool_calls_total',
    'codesight_rust_ffi_calls_total',
    'codesight_system_memory_usage_bytes',
    'codesight_errors_total'
  ];

  result.registry_size = metricsRegistry.getMetricsAsJSON().length;
  result.timestamp = new Date().toISOString();

  return result;
}