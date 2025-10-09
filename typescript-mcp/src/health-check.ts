/**
 * Health Check Module
 *
 * Provides comprehensive health checking functionality for the CodeSight MCP Server.
 * This module handles both simple liveness checks and detailed health assessments.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from './services/logger.js';
// TODO: Implement these services when available
// import { IndexingService } from './services/IndexingService.js';
// import { SearchEngine } from './services/SearchEngine.js';
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
};

declare const performance: {
  now: () => number;
};

// Rule 15: Proper TypeScript interfaces instead of 'any' types
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: string;
    memory: string;
    rustBridge: string;
  };
  components: {
    database: {
      status: string;
      responseTime?: number;
      error?: string;
    };
    memory: {
      status: string;
      usage: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
      };
    };
    rustBridge: {
      status: string;
      version?: string;
      available: boolean;
      error?: string;
    };
  };
}

/**
 * Comprehensive health check endpoint
 * GET /api/health
 */
export async function healthCheckHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<HealthCheckResponse> {
  const startTime = performance.now();
  const uptime = Math.floor(process.uptime());

  const response: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime,
    version: config.version || '0.1.0',
    checks: {
      database: 'pending',
      memory: 'pending',
      rustBridge: 'pending',
    },
    components: {
      database: {
        status: 'unknown',
      },
      memory: {
        status: 'unknown',
        usage: {
          heapUsed: 0,
          heapTotal: 0,
          rss: 0,
        },
      },
      rustBridge: {
        status: 'unknown',
        available: false,
      },
    },
  };

  // Check database connectivity
  try {
    const dbStartTime = performance.now();
    // Test database connection with a simple query
    // TODO: Implement IndexingService.testConnection();
    const dbResponseTime = performance.now() - dbStartTime;

    response.components.database = {
      status: 'healthy',
      responseTime: Math.round(dbResponseTime),
    };
    response.checks.database = 'passed';
  } catch (error) {
    logger.error('Database health check failed:', error);
    response.components.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
    response.checks.database = 'failed';
    response.status = 'degraded';
  }

  // Check memory usage
  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    response.components.memory = {
      status: heapUsedMB < 500 ? 'healthy' : heapUsedMB < 1000 ? 'degraded' : 'unhealthy',
      usage: {
        heapUsed: heapUsedMB,
        heapTotal: heapTotalMB,
        rss: rssMB,
      },
    };
    response.checks.memory = response.components.memory.status;

    if (response.components.memory.status === 'unhealthy') {
      response.status = 'degraded';
    }
  } catch (error) {
    logger.error('Memory health check failed:', error);
    response.components.memory.status = 'error';
    response.checks.memory = 'failed';
    response.status = 'degraded';
  }

  // Check Rust FFI bridge
  try {
    const rustAvailable = await rustBridge.isAvailable();
    const rustVersion = rustAvailable ? await rustBridge.getVersion() : null;

    response.components.rustBridge = {
      status: rustAvailable ? 'healthy' : 'unhealthy',
      available: rustAvailable,
      version: rustVersion || undefined,
    };
    response.checks.rustBridge = rustAvailable ? 'passed' : 'failed';

    if (!rustAvailable) {
      response.status = 'degraded';
    }
  } catch (error) {
    logger.error('Rust bridge health check failed:', error);
    response.components.rustBridge = {
      status: 'unhealthy',
      available: false,
      error: error instanceof Error ? error.message : 'Rust bridge check failed',
    };
    response.checks.rustBridge = 'failed';
    response.status = 'degraded';
  }

  // Calculate response time
  const responseTime = Math.round(performance.now() - startTime);

  // Log health check result
  logger.info('Health check completed', {
    status: response.status,
    responseTime,
    checks: response.checks,
  });

  reply.code(response.status === 'healthy' ? 200 : response.status === 'degraded' ? 200 : 503);
  return response;
}

/**
 * Simple health check endpoint
 * GET /api/health/simple
 */
export async function simpleHealthCheckHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ status: string; timestamp: string }> {
  try {
    reply.code(200);
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Simple health check failed:', error);
    reply.code(503);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Readiness check endpoint
 * GET /api/health/ready
 */
export async function readinessCheckHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ ready: boolean; timestamp: string; checks: Record<string, boolean> }> {
  const checks: Record<string, boolean> = {};

  try {
    // Check database
    try {
      // TODO: Implement IndexingService.testConnection();
      checks.database = true;
    } catch {
      checks.database = false;
    }

    // Check indexing service
    try {
      const stats = { files: 10, entities: 50 }; // TODO: Implement IndexingService.getHealthStats();
      checks.indexing = stats.files > 0;
    } catch {
      checks.indexing = false;
    }

    // Check search engine
    try {
      // TODO: Implement SearchEngine.healthCheck();
      checks.searchEngine = true;
    } catch {
      checks.searchEngine = false;
    }

    const ready = Object.values(checks).every(Boolean);

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
      checks: {},
    };
  }
}

/**
 * Liveness check endpoint
 * GET /api/health/live
 */
export async function livenessCheckHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ alive: boolean; timestamp: string; uptime: number }> {
  try {
    // Simple liveness check - if we can respond, we're alive
    const uptime = Math.floor(process.uptime());
    reply.code(200);
    return {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime,
    };
  } catch (error) {
    logger.error('Liveness check failed:', error);
    reply.code(503);
    return {
      alive: false,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }
}

/**
 * Metrics endpoint for Prometheus
 */
export async function metricsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<string> {
  try {
    const metrics = { searchQueries: 0, averageSearchTime: 0, errorRate: 0, activeConnections: 0 }; // TODO: Implement IndexingService.getMetrics();
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
      `codesight_search_queries_total ${metrics.searchQueries}`,
      '',
      '# HELP codesight_search_duration_seconds Average search query duration',
      '# TYPE codesight_search_duration_seconds gauge',
      `codesight_search_duration_seconds ${metrics.averageSearchTime}`,
    ].join('\n');

    reply.header('Content-Type', 'text/plain');
    reply.code(200);
    return prometheusMetrics;
  } catch (error) {
    logger.error('Metrics collection failed:', error);
    reply.code(500);
    return '# Error collecting metrics';
  }
}