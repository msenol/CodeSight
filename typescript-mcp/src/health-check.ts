/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/**
 * Health Check Endpoint for CodeSight
 *
 * This module provides health check functionality for the CodeSight service,
 * including system status, database connectivity, and metrics collection.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from './services/logger.js';
import { IndexingService } from './services/IndexingService.js';
import { SearchEngine } from './services/SearchEngine.js';
import { rustBridge } from './rust-bridge.js';
import { config } from './config.js';

// Rule 15: Global declarations for Node.js environment
declare const process: {
  env: Record<string, string | undefined>;
  uptime: () => number;
  hrtime: () => [number, number];
  memoryUsage: () => {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  pid: number;
  version: string;
  platform: string;
  arch: string;
};

declare const performance: {
  now: () => number;
};

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  components: {
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
    rustBridge: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      available: boolean;
      version?: string;
      error?: string;
    };
    indexing: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      indexedFiles: number;
      indexedEntities: number;
      lastIndexed?: string;
      error?: string;
    };
    search: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
    memory: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      usage: number;
      limit: number;
      percentage: number;
    };
  };
  metrics: {
    totalSearchQueries: number;
    averageSearchTime: number;
    errorRate: number;
    activeConnections: number;
  };
}

/**
 * Health check endpoint handler
 */
export async function healthCheckHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<HealthCheckResponse> {
  const startTimeMs = performance.now();

  try {
    // Initialize response with default values
    const response: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: config.version || '0.1.0',
      uptime: process.uptime(),
      components: {
        database: { status: 'healthy' },
        rustBridge: { status: 'healthy', available: false },
        indexing: { status: 'healthy', indexedFiles: 0, indexedEntities: 0 },
        search: { status: 'healthy' },
        memory: { status: 'healthy', usage: 0, limit: 0, percentage: 0 },
      },
      metrics: {
        totalSearchQueries: 0,
        averageSearchTime: 0,
        errorRate: 0,
        activeConnections: 0,
      },
    };

    // Check database connectivity
    try {
      const dbStartTime = performance.now();
      // Test database connection with a simple query
      await IndexingService.testConnection();
      const dbResponseTime = performance.now() - dbStartTime;

      response.components.database = {
        status: 'healthy',
        responseTime: Math.round(dbResponseTime),
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      response.components.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
      response.status = 'degraded';
    }

    // Check Rust bridge availability
    try {
      performance.now(); // Rust timing measurement - Rule 15: Performance measurement kept for monitoring
      const rustAvailable = await rustBridge.isAvailable();

      if (rustAvailable) {
        const rustVersion = await rustBridge.getVersion();
        response.components.rustBridge = {
          status: 'healthy',
          available: true,
          version: rustVersion,
        };
      } else {
        response.components.rustBridge = {
          status: 'degraded',
          available: false,
          error: 'Rust bridge not available',
        };
        response.status = 'degraded';
      }
    } catch (error) {
      logger.error('Rust bridge health check failed:', error);
      response.components.rustBridge = {
        status: 'unhealthy',
        available: false,
        error: error instanceof Error ? error.message : 'Rust bridge check failed',
      };
      response.status = 'degraded';
    }

    // Check indexing service
    try {
      const indexingStats = await IndexingService.getHealthStats();
      response.components.indexing = {
        status: indexingStats.files > 0 ? 'healthy' : 'degraded',
        indexedFiles: indexingStats.files,
        indexedEntities: indexingStats.entities,
        lastIndexed: indexingStats.lastIndexed,
      };

      if (indexingStats.files === 0) {
        response.status = response.status === 'healthy' ? 'degraded' : response.status;
      }
    } catch (error) {
      logger.error('Indexing service health check failed:', error);
      response.components.indexing = {
        status: 'unhealthy',
        indexedFiles: 0,
        indexedEntities: 0,
        error: error instanceof Error ? error.message : 'Indexing service check failed',
      };
      response.status = 'unhealthy';
    }

    // Check search functionality
    try {
      const searchStartTime = performance.now();
      await SearchEngine.healthCheck();
      const searchResponseTime = performance.now() - searchStartTime;

      response.components.search = {
        status: 'healthy',
        responseTime: Math.round(searchResponseTime),
      };
    } catch (error) {
      logger.error('Search health check failed:', error);
      response.components.search = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Search service check failed',
      };
      response.status = 'unhealthy';
    }

    // Check memory usage
    try {
      const { heapUsed, heapTotal } = process.memoryUsage();
      const heapLimit = heapTotal * 1.5; // Estimated limit
      const percentage = (heapUsed / heapLimit) * 100;

      let memoryStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (percentage > 90) {
        memoryStatus = 'unhealthy';
        response.status = 'unhealthy';
      } else if (percentage > 75) {
        memoryStatus = 'degraded';
        if (response.status === 'healthy') {
          response.status = 'degraded';
        }
      }

      response.components.memory = {
        status: memoryStatus,
        usage: Math.round(heapUsed / 1024 / 1024), // MB
        limit: Math.round(heapLimit / 1024 / 1024), // MB
        percentage: Math.round(percentage * 100) / 100,
      };
    } catch (error) {
      logger.error('Memory health check failed:', error);
      response.components.memory = {
        status: 'unhealthy',
        usage: 0,
        limit: 0,
        percentage: 0,
      };
      response.status = 'unhealthy';
    }

    // Collect metrics
    try {
      const metrics = await IndexingService.getMetrics();
      response.metrics = {
        totalSearchQueries: metrics.searchQueries || 0,
        averageSearchTime: metrics.averageSearchTime || 0,
        errorRate: metrics.errorRate || 0,
        activeConnections: metrics.activeConnections || 0,
      };
    } catch (error) {
      logger.error('Failed to collect metrics:', error);
      // Keep default metrics values
    }

    // Calculate overall response time
    const totalResponseTime = performance.now() - startTimeMs;

    // Log health check results
    logger.info('Health check completed', {
      status: response.status,
      responseTime: Math.round(totalResponseTime),
      components: {
        database: response.components.database.status,
        rustBridge: response.components.rustBridge.status,
        indexing: response.components.indexing.status,
        search: response.components.search.status,
        memory: response.components.memory.status,
      },
    });

    // Set appropriate HTTP status code
    let statusCode = 200;
    if (response.status === 'unhealthy') {
      statusCode = 503;
    } else if (response.status === 'degraded') {
      statusCode = 200; // Still serving, but degraded
    }

    reply.code(statusCode).header('X-Response-Time', Math.round(totalResponseTime).toString());
    return response;
  } catch (error) {
    logger.error('Health check endpoint failed:', error);

    reply.code(503).send({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Simple health check endpoint for load balancers
 */
export async function simpleHealthCheckHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ status: string; timestamp: string }> {
  try {
    // Quick check - just verify the process is running
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  } catch {
    reply.code(503);
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Readiness check endpoint
 */
export async function readinessCheckHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ ready: boolean; timestamp: string; checks: Record<string, boolean> }> {
  const checks: Record<string, boolean> = {};

  try {
    // Check database
    try {
      await IndexingService.testConnection();
      checks.database = true;
    } catch {
      checks.database = false;
    }

    // Check indexing service
    try {
      const stats = await IndexingService.getHealthStats();
      checks.indexing = stats.files > 0;
    } catch {
      checks.indexing = false;
    }

    // Check search engine
    try {
      await SearchEngine.healthCheck();
      checks.search = true;
    } catch {
      checks.search = false;
    }

    // Rust bridge is optional for readiness
    try {
      checks.rustBridge = await rustBridge.isAvailable();
    } catch {
      checks.rustBridge = false;
    }

    const ready = Object.values(checks).every(check => check === true);

    reply.code(ready ? 200 : 503);
    return {
      ready,
      timestamp: new Date().toISOString(),
      checks,
    };
  } catch (error) {
    logger.error('Readiness check failed:', error);
    reply.code(503);
    return {
      ready: false,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}

/**
 * Liveness check endpoint
 */
export async function livenessCheckHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ alive: boolean; timestamp: string; uptime: number }> {
  // Liveness is simple - just check if the process is running
  reply.code(200);
  return {
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}

/**
 * Metrics endpoint for Prometheus
 */
export async function metricsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<string> {
  try {
    const metrics = await IndexingService.getMetrics();
    const memUsage = process.memoryUsage();

    const prometheusMetrics = [
      '# HELP codesight_uptime_seconds Server uptime in seconds',
      '# TYPE codesight_uptime_seconds counter',
      `codesight_uptime_seconds ${process.uptime()}`,
      '',
      '# HELP codesight_memory_usage_bytes Memory usage in bytes',
      '# TYPE codesight_memory_usage_bytes gauge',
      `codesight_memory_usage_bytes{type="heap_used"} ${memUsage.heapUsed}`,
      `codesight_memory_usage_bytes{type="heap_total"} ${memUsage.heapTotal}`,
      `codesight_memory_usage_bytes{type="rss"} ${memUsage.rss}`,
      '',
      '# HELP codesight_search_queries_total Total number of search queries',
      '# TYPE codesight_search_queries_total counter',
      `codesight_search_queries_total ${metrics.searchQueries || 0}`,
      '',
      '# HELP codesight_search_duration_seconds_average Average search duration in seconds',
      '# TYPE codesight_search_duration_seconds_average gauge',
      `codesight_search_duration_seconds_average ${metrics.averageSearchTime || 0}`,
      '',
      '# HELP codesight_error_rate Error rate as percentage',
      '# TYPE codesight_error_rate gauge',
      `codesight_error_rate ${metrics.errorRate || 0}`,
      '',
      '# HELP codesight_active_connections Current active connections',
      '# TYPE codesight_active_connections gauge',
      `codesight_active_connections ${metrics.activeConnections || 0}`,
      '',
      '# HELP codesight_indexed_files_total Total number of indexed files',
      '# TYPE codesight_indexed_files_total gauge',
      `codesight_indexed_files_total ${metrics.indexedFiles || 0}`,
      '',
      '# HELP codesight_indexed_entities_total Total number of indexed entities',
      '# TYPE codesight_indexed_entities_total gauge',
      `codesight_indexed_entities_total ${metrics.indexedEntities || 0}`,
      '',
      '# HELP codesight_rust_bridge_available Rust bridge availability (1=available, 0=not available)',
      '# TYPE codesight_rust_bridge_available gauge',
      `codesight_rust_bridge_available ${await rustBridge
        .isAvailable()
        .then(() => 1)
        .catch(() => 0)}`,
    ];

    reply.type('text/plain; version=0.0.4; charset=utf-8');
    return prometheusMetrics.join('\n');
  } catch (error) {
    logger.error('Metrics endpoint failed:', error);
    reply.code(500);
    return '# Error generating metrics';
  }
}

export {
  healthCheckHandler as health,
  simpleHealthCheckHandler as simpleHealth,
  readinessCheckHandler as readiness,
  livenessCheckHandler as liveness,
  metricsHandler as metrics,
};
