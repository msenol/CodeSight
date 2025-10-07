#!/usr/bin/env node

/**
 * Test Integration MCP Server
 * Simplified MCP server for integration testing with proper stdio transport
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  InitializeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Create MCP server
const server = new Server({
  name: 'codesight-test',
  version: '0.1.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_code',
        description: 'Search for code patterns in the codebase',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            codebase: { type: 'string', description: 'Codebase path' },
            language: { type: 'string', description: 'Programming language' },
          },
          required: ['query', 'codebase'],
        },
      },
      {
        name: 'explain_function',
        description: 'Explain what a function does',
        inputSchema: {
          type: 'object',
          properties: {
            function_name: { type: 'string', description: 'Function name' },
            file_path: { type: 'string', description: 'File path' },
            codebase: { type: 'string', description: 'Codebase path' },
          },
          required: ['function_name', 'file_path', 'codebase'],
        },
      },
      {
        name: 'find_references',
        description: 'Find references to a symbol',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Symbol to find' },
            file_path: { type: 'string', description: 'File path' },
            codebase: { type: 'string', description: 'Codebase path' },
          },
          required: ['symbol', 'file_path', 'codebase'],
        },
      },
      {
        name: 'trace_data_flow',
        description: 'Trace data flow for a variable',
        inputSchema: {
          type: 'object',
          properties: {
            variable: { type: 'string', description: 'Variable name' },
            function_name: { type: 'string', description: 'Function name' },
            file_path: { type: 'string', description: 'File path' },
            codebase: { type: 'string', description: 'Codebase path' },
          },
          required: ['variable', 'function_name', 'file_path', 'codebase'],
        },
      },
      {
        name: 'analyze_security',
        description: 'Analyze security vulnerabilities',
        inputSchema: {
          type: 'object',
          properties: {
            codebase: { type: 'string', description: 'Codebase path' },
            severity: { type: 'string', description: 'Severity level' },
          },
          required: ['codebase'],
        },
      },
      {
        name: 'get_api_endpoints',
        description: 'Get API endpoints from codebase',
        inputSchema: {
          type: 'object',
          properties: {
            codebase: { type: 'string', description: 'Codebase path' },
            language: { type: 'string', description: 'Programming language' },
          },
          required: ['codebase'],
        },
      },
      {
        name: 'check_complexity',
        description: 'Check code complexity',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'File path' },
            codebase: { type: 'string', description: 'Codebase path' },
          },
          required: ['file_path', 'codebase'],
        },
      },
      {
        name: 'find_duplicates',
        description: 'Find duplicate code',
        inputSchema: {
          type: 'object',
          properties: {
            codebase: { type: 'string', description: 'Codebase path' },
            min_lines: { type: 'number', description: 'Minimum lines for duplication' },
          },
          required: ['codebase'],
        },
      },
      {
        name: 'suggest_refactoring',
        description: 'Suggest refactoring improvements',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'File path' },
            codebase: { type: 'string', description: 'Codebase path' },
          },
          required: ['file_path', 'codebase'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_code':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              results: [
                {
                  file: `${args.codebase}/src/example.ts`,
                  line: 10,
                  function: 'exampleFunction',
                  code: 'function exampleFunction() { /* implementation */ }',
                  description: `Example function matching "${args.query}"`,
                },
              ],
            }, null, 2),
          }],
        };

      case 'explain_function':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              function: args.function_name,
              signature: `${args.function_name}(): void`,
              description: 'This function performs the main logic for processing data',
              parameters: [],
              returns: 'void',
              complexity: 'O(1)',
              usage: 'Used throughout the application',
            }, null, 2),
          }],
        };

      case 'find_references':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              symbol: args.symbol,
              references: [
                {
                  file: args.file_path,
                  line: 15,
                  context: `const result = ${args.symbol}();`,
                },
              ],
            }, null, 2),
          }],
        };

      case 'trace_data_flow':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              variable: args.variable,
              flow: [
                {
                  file: args.file_path,
                  line: 10,
                  action: 'declaration',
                  code: `let ${args.variable} = {};`,
                },
                {
                  file: args.file_path,
                  line: 15,
                  action: 'modification',
                  code: `${args.variable}.value = 42;`,
                },
              ],
            }, null, 2),
          }],
        };

      case 'analyze_security':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              issues: [
                {
                  severity: args.severity || 'medium',
                  type: 'Hardcoded credentials',
                  file: `${args.codebase}/src/config.ts`,
                  line: 5,
                  description: 'Potential hardcoded secret detected',
                },
              ],
            }, null, 2),
          }],
        };

      case 'get_api_endpoints':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              endpoints: [
                {
                  method: 'GET',
                  path: '/api/users',
                  file: `${args.codebase}/src/routes/users.ts`,
                  description: 'Get all users',
                },
              ],
            }, null, 2),
          }],
        };

      case 'check_complexity':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              file: args.file_path,
              complexity: {
                cyclomatic: 5,
                cognitive: 8,
                lines: 45,
                maintainability: 'B',
              },
            }, null, 2),
          }],
        };

      case 'find_duplicates':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              duplicates: [
                {
                  files: [
                    `${args.codebase}/src/utils.ts`,
                    `${args.codebase}/src/helpers.ts`,
                  ],
                  lines: 10,
                  similarity: '85%',
                },
              ],
            }, null, 2),
          }],
        };

      case 'suggest_refactoring':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              suggestions: [
                {
                  type: 'Extract Method',
                  file: args.file_path,
                  line: 20,
                  description: 'Extract repeated logic into a separate method',
                },
              ],
            }, null, 2),
          }],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }, null, 2),
      }],
    };
  }
});

// Handle initialize request
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  console.log('MCP server initialized with client:', request.params.clientInfo);
  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: 'codesight-test',
      version: '0.1.0',
    },
  };
});

// Start server
async function main() {
  console.log('🚀 CodeSight Test MCP Server starting...');

  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('✅ MCP server started on stdio');

    // Keep process alive
    process.stdin.resume();
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down MCP server...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down...');
  await server.close();
  process.exit(0);
});

// Handle stdin close
process.stdin.on('end', () => {
  console.log('📡 stdin closed, shutting down...');
  process.exit(0);
});

main().catch(console.error);