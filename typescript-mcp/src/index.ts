#!/usr/bin/env node

/**
 * Code Intelligence MCP Server - TypeScript Interface
 * 
 * This is the main entry point for the Code Intelligence MCP Server.
 * It provides both MCP protocol support and REST API endpoints.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { createFastifyServer } from './server.js';
import { logger } from './services/logger.js';
import { config } from './config.js';
import { registerMCPTools } from './tools/index.js';
import { initializeRustCore } from './ffi/rust-bridge.js';

/**
 * Initialize the MCP Server
 */
async function initializeMCPServer(): Promise<Server> {
  const server = new Server({
    name: 'code-intelligence-mcp',
    version: '0.1.0',
  });

  // Register MCP tools
  await registerMCPTools(server);

  // Error handling
  server.onerror = (error) => {
    logger.error('MCP Server error:', error);
  };

  process.on('SIGINT', async () => {
    logger.info('Shutting down MCP server...');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down MCP server...');
    await server.close();
    process.exit(0);
  });

  // Keep process alive in MCP mode
  process.stdin.resume();
  process.stdin.on('end', () => {
    logger.info('stdin closed, shutting down...');
    process.exit(0);
  });

  return server;
}

/**
 * Initialize the REST API Server
 */
async function initializeRESTServer() {
  const fastify = await createFastifyServer();
  
  try {
    const address = await fastify.listen({ 
      port: config.server.port, 
      host: config.server.host 
    });
    logger.info(`REST API server listening at ${address}`);
    return fastify;
  } catch (err) {
    logger.error('Error starting REST API server:', err);
    process.exit(1);
  }
}

/**
 * Main application entry point
 */
async function main() {
  try {
    logger.info('Starting Code Intelligence MCP Server...');
    
    // Initialize Rust core
    await initializeRustCore();
    logger.info('Rust core initialized successfully');

    // Determine mode based on command line arguments
    const args = process.argv.slice(2);
    const mode = args[0] || 'mcp';

    switch (mode) {
      case 'mcp':
        // MCP mode - stdio transport
        const mcpServer = await initializeMCPServer();
        const transport = new StdioServerTransport();
        await mcpServer.connect(transport);
        logger.info('MCP server started in stdio mode');
        
        // Keep the process alive
        await new Promise(() => {});
        break;

      case 'rest':
        // REST API mode
        await initializeRESTServer();
        break;

      case 'hybrid':
        // Both MCP and REST
        const [mcpSrv] = await Promise.all([
          initializeMCPServer(),
          initializeRESTServer()
        ]);
        
        // For hybrid mode, we need a different transport (e.g., WebSocket)
        logger.info('Hybrid mode started - MCP and REST API available');
        break;

      default:
        logger.error(`Unknown mode: ${mode}`);
        logger.info('Available modes: mcp, rest, hybrid');
        process.exit(1);
    }

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
// Always run main when this file is executed directly
main().catch((error) => {
  console.error('Application startup failed:', error);
  logger.error('Application startup failed:', error);
  process.exit(1);
});

export { main };