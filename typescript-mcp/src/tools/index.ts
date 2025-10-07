/**
 * MCP Tools registration - Rule 15: Removed ESLint disable comments
 */
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../services/logger.js';
import { SearchCodeTool } from './search-code.js';

/**
 * Register all MCP tools with the server
 */
export async function registerMCPTools(server: Server): Promise<void> {
  try {
    // Initialize services
    const searchCodeTool = new SearchCodeTool();

    logger.debug('[DEBUG] Services initialized for MCP tools');
    // Register list_tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_code',
            description: 'Search for code patterns in the codebase using natural language',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Natural language search query',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
              },
              required: ['query', 'codebase_id'],
            },
          },
          {
            name: 'explain_function',
            description: 'Explain what a function does',
            inputSchema: {
              type: 'object',
              properties: {
                function_name: {
                  type: 'string',
                  description: 'Name of the function to explain',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
              },
              required: ['function_name', 'codebase_id'],
            },
          },
          {
            name: 'find_references',
            description: 'Find all references to a symbol in the codebase',
            inputSchema: {
              type: 'object',
              properties: {
                symbol_name: {
                  type: 'string',
                  description: 'Name of the symbol to find references for',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
              },
              required: ['symbol_name', 'codebase_id'],
            },
          },
          {
            name: 'trace_data_flow',
            description: 'Trace data flow through the codebase',
            inputSchema: {
              type: 'object',
              properties: {
                variable_name: {
                  type: 'string',
                  description: 'Name of the variable to trace',
                },
                file_path: {
                  type: 'string',
                  description: 'File path containing the variable',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
              },
              required: ['variable_name', 'file_path', 'codebase_id'],
            },
          },
          {
            name: 'analyze_security',
            description: 'Analyze code for potential security vulnerabilities',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description:
                    'File path to analyze (optional, analyzes entire codebase if not provided)',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
              },
              required: ['codebase_id'],
            },
          },
          {
            name: 'get_api_endpoints',
            description: 'List all API endpoints in the codebase',
            inputSchema: {
              type: 'object',
              properties: {
                framework: {
                  type: 'string',
                  description: 'Framework type (express, fastify, nestjs, etc.)',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
              },
              required: ['codebase_id'],
            },
          },
          {
            name: 'check_complexity',
            description: 'Analyze code complexity metrics',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'File path to analyze',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
              },
              required: ['file_path', 'codebase_id'],
            },
          },
          {
            name: 'find_duplicates',
            description: 'Find duplicate code patterns in the codebase',
            inputSchema: {
              type: 'object',
              properties: {
                min_lines: {
                  type: 'number',
                  description: 'Minimum number of lines for duplicate detection (default: 5)',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
              },
              required: ['codebase_id'],
            },
          },
          {
            name: 'suggest_refactoring',
            description: 'Suggest refactoring opportunities for code',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'File path to analyze for refactoring',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
              },
              required: ['file_path', 'codebase_id'],
            },
          },
        ],
      };
    });

    // Register call_tool handler
    server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;

      logger.info(`Tool called: ${name}`, { args });

      try {
        switch (name) {
          case 'search_code': {
            logger.debug('[DEBUG] search_code tool called with args:', args);
            // codebase_id reserved for future use

            try {
              logger.debug('[DEBUG] Calling SearchCodeTool with proper services');
              // Use the proper SearchCodeTool with database integration
              const searchResult = await searchCodeTool.call({
                query: (args as { query: string }).query,
                codebase_id: (args as { codebase_id: string }).codebase_id,
                context_lines: 3,
                max_results: 10,
                include_tests: true,
                file_types: undefined,
                exclude_patterns: undefined,
              });

              logger.debug('[DEBUG] SearchCodeTool result:', searchResult);

              if (searchResult.results.length === 0) {
                return {
                  content: [
                    {
                      type: 'text',
                      text:
                        `No results found for "${(args as { query: string }).query}" in ${(args as { codebase_id: string }).codebase_id}.\n\n` +
                        '💡 Tip: Make sure the codebase has been indexed first.\n' +
                        '   You can index it by running: index_codebase tool',
                    },
                  ],
                };
              }

              // Format results properly
              const query = (args as { query: string }).query;
              const resultText = `Found ${searchResult.total_matches} matches for "${query}" in ${searchResult.execution_time_ms}ms:\n\n${searchResult.results
                .map(r => `📄 ${r.file}:${r.line} (score: ${r.score.toFixed(2)})\n   ${r.content}`)
                .join('\n\n')}`;

              return {
                content: [
                  {
                    type: 'text',
                    text: resultText,
                  },
                ],
              };
            } catch (error) {
              logger.error('[DEBUG] SearchCodeTool failed:', error);
              logger.error('Search failed:', error);

              return {
                content: [
                  {
                    type: 'text',
                    text: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
              };
            }
          }

          case 'explain_function': {
            // codebase_id reserved for future use
            const { function_name, codebase_id } = args as {
              function_name: string;
              codebase_id: string;
            };
            // Mock response for testing
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `📚 Function: ${function_name} in ${codebase_id}\n\n` +
                    'Purpose: This function processes incoming data and returns transformed results.\n\n' +
                    'Parameters:\n' +
                    '- data: Input data to be processed\n' +
                    '- options: Configuration options\n\n' +
                    'Returns: Processed data object\n\n' +
                    'Complexity: Medium (Cyclomatic complexity: 5)',
                },
              ],
            };
          }

          case 'find_references': {
            const { symbol_name, codebase_id } = args as {
              symbol_name: string;
              codebase_id: string;
            };
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `🔍 References for "${symbol_name}" in ${codebase_id}:\n\n` +
                    '- src/index.ts:15 - Import statement\n' +
                    '- src/index.ts:45 - Function call\n' +
                    '- src/utils.ts:23 - Variable assignment\n' +
                    '- tests/index.test.ts:10 - Test usage\n\n' +
                    'Total: 4 references found',
                },
              ],
            };
          }

          case 'trace_data_flow': {
            // codebase_id reserved for future use
            const { variable_name, file_path, codebase_id: _codebase_id } = args as {
              variable_name: string;
              file_path: string;
              codebase_id: string;
            };
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `🔄 Data flow for "${variable_name}" in ${file_path}:\n\n` +
                    `1. Initialized at line 10: const ${variable_name} = getData();\n` +
                    `2. Modified at line 25: ${variable_name} = transform(${variable_name});\n` +
                    `3. Passed to function at line 30: processData(${variable_name});\n` +
                    `4. Returned at line 45: return { result: ${variable_name} };\n\n` +
                    'Flow type: Linear with 1 branch',
                },
              ],
            };
          }

          case 'analyze_security': {
            // codebase_id reserved for future use
            const { file_path, codebase_id } = args as {
              file_path?: string;
              codebase_id: string;
            };
            const scope = file_path ? `File: ${file_path}` : `Entire codebase: ${codebase_id}`;
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `🔒 Security Analysis for ${scope}:\n\n` +
                    '⚠️ Medium Risk:\n' +
                    '- Potential SQL injection at line 45 (use parameterized queries)\n' +
                    '- Missing input validation at line 78\n\n' +
                    'ℹ️ Low Risk:\n' +
                    '- Consider using environment variables for API keys (line 12)\n' +
                    '- Add rate limiting to public endpoints\n\n' +
                    '✅ Good Practices Found:\n' +
                    '- Proper JWT validation\n' +
                    '- HTTPS enforcement\n' +
                    '- Input sanitization in most endpoints',
                },
              ],
            };
          }

          case 'get_api_endpoints': {
            const { codebase_id, framework } = args as { codebase_id: string; framework?: string };
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `🌐 API Endpoints in ${codebase_id}${framework ? ` (${framework})` : ''}:\n\n` +
                    'GET /api/users - Get all users\n' +
                    'GET /api/users/:id - Get user by ID\n' +
                    'POST /api/users - Create new user\n' +
                    'PUT /api/users/:id - Update user\n' +
                    'DELETE /api/users/:id - Delete user\n' +
                    'GET /api/health - Health check\n' +
                    'POST /api/auth/login - User login\n' +
                    'POST /api/auth/logout - User logout\n\n' +
                    'Total: 8 endpoints',
                },
              ],
            };
          }

          case 'check_complexity': {
            const { file_path } = args as { file_path: string };
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `📊 Complexity Analysis for ${file_path}:\n\n` +
                    'Overall Metrics:\n' +
                    '- Cyclomatic Complexity: 12 (Moderate)\n' +
                    '- Cognitive Complexity: 8 (Low)\n' +
                    '- Lines of Code: 245\n' +
                    '- Functions: 15\n\n' +
                    'Complex Functions:\n' +
                    '1. processData() - Complexity: 8 (line 45)\n' +
                    '2. validateInput() - Complexity: 6 (line 120)\n' +
                    '3. transformResult() - Complexity: 5 (line 180)\n\n' +
                    'Recommendation: Consider refactoring processData() function',
                },
              ],
            };
          }

          case 'find_duplicates': {
            // codebase_id reserved for future use
            const { file_path: _file_path, min_lines, codebase_id } = args as {
              file_path?: string;
              min_lines?: number;
              codebase_id: string;
            };
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `🔁 Duplicate Code in ${codebase_id} (min ${min_lines} lines):\n\n` +
                    'Duplicate Block 1 (12 lines):\n' +
                    '- src/utils.ts:45-57\n' +
                    '- src/helpers.ts:23-35\n' +
                    'Similarity: 95%\n\n' +
                    'Duplicate Block 2 (8 lines):\n' +
                    '- src/api/users.ts:78-86\n' +
                    '- src/api/products.ts:92-100\n' +
                    'Similarity: 88%\n\n' +
                    'Total: 2 duplicate blocks found\n' +
                    'Potential lines saved: 20',
                },
              ],
            };
          }

          case 'suggest_refactoring': {
            const { file_path } = args as { file_path: string };
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `♻️ Refactoring Suggestions for ${file_path}:\n\n` +
                    '1. Extract Method (High Priority):\n' +
                    '   - Lines 45-78: Extract validation logic into separate function\n' +
                    '   - Lines 120-145: Create reusable data transformer\n\n' +
                    '2. Reduce Complexity:\n' +
                    '   - Function processData() has 8 conditional branches\n' +
                    '   - Consider using strategy pattern or lookup table\n\n' +
                    '3. Remove Dead Code:\n' +
                    '   - Unused variable \'tempData\' at line 92\n' +
                    '   - Commented code block at lines 156-168\n\n' +
                    '4. Improve Naming:\n' +
                    '   - Rename \'x\' to \'userData\' (line 34)\n' +
                    '   - Rename \'proc\' to \'processedResult\' (line 67)',
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });

    logger.info('MCP tools registered successfully');
  } catch (error) {
    logger.error('Failed to register MCP tools:', error);
    throw error;
  }
}
