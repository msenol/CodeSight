/**
 * Fastify server configuration
 */
import Fastify from 'fastify';
import { logger } from './services/logger.js';
import { config } from './config.js';

export async function createFastifyServer() {
  const fastify = Fastify({
    logger: false // Use our custom logger
  });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // API routes
  fastify.get('/api/health', async (request, reply) => {
    return { 
      success: true, 
      message: 'Code Intelligence MCP Server is running',
      version: '0.1.0'
    };
  });

  return fastify;
}