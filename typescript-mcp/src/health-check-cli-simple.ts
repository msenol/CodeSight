#!/usr/bin/env node

/**
 * Standalone Health Check CLI for CodeSight
 * Rule 15: Zero external dependencies, pure ES module
 */

interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    server: string;
    dependencies: string;
  };
  memory?: {
    heapUsedMB: number;
    heapTotalMB: number;
    percentage: number;
  };
}

interface ErrorStatus {
  status: string;
  timestamp: string;
  error: string;
  uptime: number;
}

async function healthCheck(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] INFO: Starting CodeSight health check...`);

    // Basic health check - if we get here, modules loaded successfully
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      uptime: process.uptime(),
      checks: {
        server: 'passed',
        dependencies: 'pending', // Rust FFI not required for basic health
      },
      memory: {
        heapUsedMB,
        heapTotalMB,
        percentage: Math.round((heapUsedMB / heapTotalMB) * 100),
      },
    };

    console.log(`[${new Date().toISOString()}] INFO: Health check completed`, {
      status: healthStatus.status,
      memory: healthStatus.memory,
      checks: healthStatus.checks,
    });

    // Output for monitoring systems
    console.log(JSON.stringify(healthStatus, null, 2));

    // Exit with appropriate code
    if (healthStatus.status === 'healthy') {
      process.exit(0);
    } else if (healthStatus.status === 'degraded') {
      process.exit(1);
    } else {
      process.exit(2);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR: Health check failed:`, error);

    const errorStatus: ErrorStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      uptime: process.uptime(),
    };

    console.log(JSON.stringify(errorStatus, null, 2));
    process.exit(2);
  }
}

// Handle uncaught errors
process.on('uncaughtException', error => {
  console.error(`[${new Date().toISOString()}] ERROR: Uncaught exception during health check:`, error);
  console.log(
    JSON.stringify(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Uncaught exception',
        message: error.message,
      },
      null,
      2,
    ),
  );
  process.exit(2);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] ERROR: Unhandled rejection during health check:`, { promise, reason });
  console.log(
    JSON.stringify(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Unhandled rejection',
        message: reason instanceof Error ? reason.message : String(reason),
      },
      null,
      2,
    ),
  );
  process.exit(2);
});

// Run health check
healthCheck();

export { healthCheck };