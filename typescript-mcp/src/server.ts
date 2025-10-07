 
 
 
 
/**
 * Fastify server configuration
 */
import Fastify from 'fastify';
import { config } from './config.js';
import {
  healthCheckHandler,
  simpleHealthCheckHandler,
  readinessCheckHandler,
  livenessCheckHandler,
  metricsHandler,
} from './health-check.js';

export async function createFastifyServer() {
  const fastify = Fastify({
    logger: false, // Use our custom logger
  });

  // Simple health check endpoint for load balancers
  fastify.get('/health', simpleHealthCheckHandler);

  // Comprehensive health check endpoint
  fastify.get('/health/detailed', healthCheckHandler);

  // Readiness check endpoint
  fastify.get('/health/ready', readinessCheckHandler);

  // Liveness check endpoint
  fastify.get('/health/live', livenessCheckHandler);

  // Prometheus metrics endpoint
  fastify.get('/metrics', metricsHandler);

  // API routes
  fastify.get('/api/health', async () => {
    return {
      success: true,
      message: 'Code Intelligence MCP Server is running',
      version: config.version || '0.1.0',
    };
  });

  return fastify;
}
