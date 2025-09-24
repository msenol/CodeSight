/**
 * MCP Tools registration
 */
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../services/logger.js';

/**
 * Register all MCP tools with the server
 */
export async function registerMCPTools(server: Server): Promise<void> {
  try {
    // Register list_tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_code',
            description: 'Search for code patterns in the codebase',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query'
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier'
                }
              },
              required: ['query', 'codebase_id']
            }
          },
          {
            name: 'explain_function',
            description: 'Explain what a function does',
            inputSchema: {
              type: 'object',
              properties: {
                function_name: {
                  type: 'string',
                  description: 'Name of the function to explain'
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier'
                }
              },
              required: ['function_name', 'codebase_id']
            }
          }
        ]
      };
    });

    // Register call_tool handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'search_code':
          return {
            content: [
              {
                type: 'text',
                text: `Searching for: ${(args as any).query} in codebase: ${(args as any).codebase_id}`
              }
            ]
          };
          
        case 'explain_function':
          return {
            content: [
              {
                type: 'text',
                text: `Explaining function: ${(args as any).function_name} in codebase: ${(args as any).codebase_id}`
              }
            ]
          };
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    logger.info('MCP tools registered successfully');
  } catch (error) {
    logger.error('Failed to register MCP tools:', error);
    throw error;
  }
}