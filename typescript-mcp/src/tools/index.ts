/**
 * MCP Tools registration - Phase 4.1: Advanced AI Features
 */
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../services/logger.js';
import { IndexingService, getIndexingService } from '../services/indexing-service.js';
import { SearchCodeTool } from './search-code.js';
import { ExplainFunctionTool } from './explain-function.js';
import { AICodeReviewTool } from './ai-code-review.js';
import { IntelligentRefactoringTool } from './intelligent-refactoring.js';
import { BugPredictionTool } from './bug-prediction.js';
import { ContextAwareCodegenTool } from './context-aware-codegen.js';
import { TechnicalDebtAnalysisTool } from './technical-debt-analysis.js';
import { AnalyzeCodebaseComplexityTool } from './analyze-codebase-complexity.js';
import { AnalyzeSecurityTool } from './analyze-security.js';
import { apiDiscoveryService } from '../services/api-discovery-service.js';
import { complexityService } from '../services/complexity-service.js';
import { FindDuplicatesTool } from './find-duplicates.js';
import { TraceDataFlowTool } from './trace-data-flow.js';

/**
 * Get or create codebase ID from current context
 */
function getCodebaseId(providedId?: string): string {
  if (providedId) {
    return providedId;
  }
  return path.basename(process.cwd());
}

/**
 * Get default codebase - the most recently indexed one
 */
function getDefaultCodebase(): string | undefined {
  try {
    const db = getIndexingService().db;
    const row = db.prepare('SELECT id FROM codebases ORDER BY indexed_at DESC LIMIT 1').get() as { id: string } | undefined;
    return row?.id;
  } catch {
    return undefined;
  }
}

/**
 * Ensure codebase is indexed, auto-index if needed
 */
/**
 * Register all MCP tools with the server
 */
export async function registerMCPTools(server: Server): Promise<void> {
  try {
    // Set consistent DATABASE_PATH for all services
    // This ensures indexing and search use the same database file
    if (!process.env.DATABASE_PATH) {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      process.env.DATABASE_PATH = path.join(__dirname, '..', '..', 'code-intelligence.db');
      logger.info(`DATABASE_PATH set to: ${process.env.DATABASE_PATH}`);
    }

    // Configure OpenRouter AI provider (key must be set via environment variable)
    process.env.PREFERRED_AI_PROVIDER = 'openrouter';

    // Initialize Phase 4.1 AI-powered services
    const searchCodeTool = new SearchCodeTool();
    const aiCodeReviewTool = new AICodeReviewTool();
    const intelligentRefactoringTool = new IntelligentRefactoringTool();
    const bugPredictionTool = new BugPredictionTool();
    const contextAwareCodegenTool = new ContextAwareCodegenTool();
    const technicalDebtTool = new TechnicalDebtAnalysisTool();
    const analyzeSecurityTool = new AnalyzeSecurityTool();

    logger.debug('[DEBUG] Services initialized for MCP tools');
    // Register list_tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_code',
            description:
              'Search for code patterns in the codebase using natural language. Auto-indexes if codebase not indexed.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Natural language search query',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier (optional, defaults to current directory name)',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'explain_function',
            description: 'Explain what a function does. Auto-indexes if codebase not indexed.',
            inputSchema: {
              type: 'object',
              properties: {
                function_name: {
                  type: 'string',
                  description: 'Name of the function to explain',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier (optional, defaults to current directory name)',
                },
              },
              required: ['function_name'],
            },
          },
          {
            name: 'find_references',
            description:
              'Find all references to a symbol in the codebase. Auto-indexes if codebase not indexed.',
            inputSchema: {
              type: 'object',
              properties: {
                symbol_name: {
                  type: 'string',
                  description: 'Name of the symbol to find references for',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier (optional, defaults to current directory name)',
                },
              },
              required: ['symbol_name'],
            },
          },
          {
            name: 'trace_data_flow',
            description:
              'Trace data flow through the codebase. Auto-indexes if codebase not indexed.',
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
                  description: 'Codebase identifier (optional, defaults to current directory name)',
                },
              },
              required: ['variable_name', 'file_path'],
            },
          },
          {
            name: 'analyze_security',
            description:
              'Analyze code for potential security vulnerabilities. Auto-indexes if codebase not indexed.',
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
                  description: 'Codebase identifier (optional, defaults to current directory name)',
                },
              },
              required: [],
            },
          },
          {
            name: 'get_api_endpoints',
            description:
              'List all API endpoints in the codebase. Auto-indexes if codebase not indexed.',
            inputSchema: {
              type: 'object',
              properties: {
                framework: {
                  type: 'string',
                  description: 'Framework type (express, fastify, nestjs, etc.)',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier (optional, defaults to current directory name)',
                },
              },
              required: [],
            },
          },
          {
            name: 'check_complexity',
            description: 'Analyze code complexity metrics. Auto-indexes if codebase not indexed.',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'File path to analyze',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier (optional, defaults to current directory name)',
                },
              },
              required: [],
            },
          },
          {
            name: 'find_duplicates',
            description:
              'Find duplicate code patterns in the codebase. Auto-indexes if codebase not indexed.',
            inputSchema: {
              type: 'object',
              properties: {
                min_lines: {
                  type: 'number',
                  description: 'Minimum number of lines for duplicate detection (default: 5)',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier (optional, defaults to current directory name)',
                },
              },
              required: [],
            },
          },
          {
            name: 'suggest_refactoring',
            description:
              'Suggest refactoring opportunities for code. Auto-indexes if codebase not indexed.',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'File path to analyze for refactoring',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier (optional, defaults to current directory name)',
                },
              },
              required: [],
            },
          },
          // Phase 4.1 AI-Powered Tools (these analyze provided code snippets, no auto-indexing needed)
          {
            name: 'ai_code_review',
            description:
              'AI-powered comprehensive code review with intelligent suggestions and analysis',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description:
                    'File path to review (optional, analyzes code snippet if not provided)',
                },
                code_snippet: {
                  type: 'string',
                  description: 'Code snippet to review (optional, uses file_path if not provided)',
                },
                review_type: {
                  type: 'string',
                  enum: ['basic', 'comprehensive', 'security-focused', 'performance-focused'],
                  description: 'Type of code review to perform',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier (optional)',
                },
                context: {
                  type: 'object',
                  properties: {
                    pr_description: { type: 'string' },
                    changed_files: { type: 'array', items: { type: 'string' } },
                    target_branch: { type: 'string' },
                  },
                  description: 'Additional context for the review',
                },
              },
              required: ['codebase_id', 'review_type'],
            },
          },
          {
            name: 'intelligent_refactoring',
            description:
              'AI-powered intelligent refactoring recommendations with code transformation suggestions',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description:
                    'File path to refactor (optional, uses code_snippet if not provided)',
                },
                code_snippet: {
                  type: 'string',
                  description:
                    'Code snippet to refactor (optional, uses file_path if not provided)',
                },
                refactoring_type: {
                  type: 'string',
                  enum: [
                    'extract-method',
                    'rename-variable',
                    'reduce-complexity',
                    'optimize-performance',
                    'improve-readability',
                    'apply-pattern',
                  ],
                  description: 'Type of refactoring to focus on',
                },
                target_scope: {
                  type: 'string',
                  enum: ['function', 'class', 'module', 'entire-file'],
                  description: 'Scope of refactoring analysis',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
                preferences: {
                  type: 'object',
                  properties: {
                    preserve_behavior: { type: 'boolean' },
                    backward_compatible: { type: 'boolean' },
                    test_driven: { type: 'boolean' },
                  },
                  description: 'Refactoring preferences and constraints',
                },
              },
              required: ['codebase_id', 'refactoring_type'],
            },
          },
          {
            name: 'bug_prediction',
            description: 'AI-powered bug prediction and proactive risk assessment',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'File path to analyze (optional, uses code_snippet if not provided)',
                },
                code_snippet: {
                  type: 'string',
                  description: 'Code snippet to analyze (optional, uses file_path if not provided)',
                },
                prediction_type: {
                  type: 'string',
                  enum: ['proactive', 'reactive', 'pattern-based', 'ml-enhanced'],
                  description: 'Type of bug prediction analysis',
                },
                scope: {
                  type: 'string',
                  enum: ['function', 'class', 'module', 'system'],
                  description: 'Scope of bug prediction analysis',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
                historical_data: {
                  type: 'object',
                  description: 'Historical bug and testing data for better predictions',
                },
              },
              required: ['codebase_id', 'prediction_type', 'scope'],
            },
          },
          {
            name: 'context_aware_code_generation',
            description: 'AI-powered context-aware code generation with project understanding',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Natural language description of code to generate',
                },
                context: {
                  type: 'object',
                  properties: {
                    file_path: { type: 'string' },
                    surrounding_code: { type: 'string' },
                    project_structure: { type: 'string' },
                    existing_patterns: { type: 'array', items: { type: 'string' } },
                    dependencies: { type: 'array', items: { type: 'string' } },
                    coding_standards: {
                      type: 'object',
                      properties: {
                        language: { type: 'string' },
                        style_guide: { type: 'string' },
                        naming_conventions: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                  description: 'Project and code context for generation',
                },
                generation_type: {
                  type: 'string',
                  enum: ['function', 'class', 'module', 'test', 'documentation', 'configuration'],
                  description: 'Type of code to generate',
                },
                constraints: {
                  type: 'object',
                  properties: {
                    max_lines: { type: 'number' },
                    complexity_limit: { type: 'number' },
                    test_required: { type: 'boolean' },
                    documentation_required: { type: 'boolean' },
                    performance_optimized: { type: 'boolean' },
                  },
                  description: 'Generation constraints and requirements',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
              },
              required: ['codebase_id', 'prompt', 'generation_type'],
            },
          },
          {
            name: 'technical_debt_analysis',
            description:
              'Comprehensive technical debt assessment with business impact analysis and prioritization',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description:
                    'File path to analyze (optional, analyzes entire codebase if not provided)',
                },
                scope: {
                  type: 'string',
                  enum: ['function', 'class', 'module', 'system'],
                  description: 'Scope of technical debt analysis',
                },
                analysis_depth: {
                  type: 'string',
                  enum: ['basic', 'comprehensive', 'deep'],
                  description: 'Depth of technical debt analysis',
                },
                include_recommendations: {
                  type: 'boolean',
                  description: 'Include actionable recommendations and remediation plans',
                },
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier',
                },
                historical_data: {
                  type: 'object',
                  description: 'Historical data for trend analysis and prediction',
                },
              },
              required: ['codebase_id', 'scope', 'analysis_depth'],
            },
          },
          {
            name: 'analyze_codebase_complexity',
            description:
              'Analyze all functions/methods in a codebase and return the most complex ones sorted by cyclomatic complexity. Use this to find refactoring candidates, detect high-risk areas, and measure code quality.',
            inputSchema: {
              type: 'object',
              properties: {
                codebase_id: {
                  type: 'string',
                  description: 'Codebase identifier to analyze',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (1-100, default: 10)',
                },
                min_cyclomatic: {
                  type: 'number',
                  description: 'Minimum cyclomatic complexity threshold (default: 10)',
                },
                min_lines: {
                  type: 'number',
                  description: 'Minimum raw line count to consider (default: 30)',
                },
                entity_type: {
                  type: 'string',
                  enum: ['function', 'method', 'all'],
                  description: 'Type of entities to analyze (default: all)',
                },
                exclude_patterns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Path patterns to exclude (default: build artifacts)',
                },
              },
              required: ['codebase_id'],
            },
          },
          {
            name: 'index_codebase',
            description:
              'Index a codebase for code intelligence. Parse all TypeScript/JavaScript files and store code entities in the database for search and analysis.',
            inputSchema: {
              type: 'object',
              properties: {
                codebase_path: {
                  type: 'string',
                  description:
                    'Absolute path to the codebase to index. Defaults to current working directory.',
                },
                codebase_id: {
                  type: 'string',
                  description:
                    'Optional codebase identifier. If not provided, defaults to the directory name.',
                },
              },
              required: [],
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

            try {
              // Resolve codebase ID: explicit > most recent indexed
              let codebaseId = getCodebaseId((args as { codebase_id?: string }).codebase_id);
              
              // If not explicitly provided, use most recently indexed codebase
              if (!(args as { codebase_id?: string }).codebase_id) {
                const defaultCb = getDefaultCodebase();
                if (defaultCb) {
                  codebaseId = defaultCb;
                }
              }
              
              logger.info(`Searching in codebase: ${codebaseId}`);

              logger.debug('[DEBUG] Calling SearchCodeTool with proper services');
              // Use the proper SearchCodeTool with database integration
              const searchResult = await searchCodeTool.call({
                query: (args as { query: string }).query,
                codebase_id: codebaseId,
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
                        `No results found for "${(args as { query: string }).query}" in ${codebaseId}.\n\n` +
                        '💡 The codebase was auto-indexed. Try a different search query.',
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
            const tool = new ExplainFunctionTool();
            try {
              let codebaseId = (args as { codebase_id?: string }).codebase_id;
              if (!codebaseId) {
                codebaseId = getDefaultCodebase() || getCodebaseId();
              }

              const result = await tool.call({
                ...args,
                codebase_id: codebaseId,
              });
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Function explanation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
              };
            }
          }

          case 'find_references': {
            const { symbol_name } = args as { symbol_name: string; codebase_id?: string };
            let codebaseId = (args as { codebase_id?: string }).codebase_id;
            if (!codebaseId) {
              codebaseId = getDefaultCodebase() || getCodebaseId();
            }
            try {
              const refs = await searchCodeTool.findReferences(symbol_name, codebaseId);
              if (refs.length === 0) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `ℹ️ No references found for "${symbol_name}" in '${codebaseId}'.`,
                    },
                  ],
                };
              }
              let text = `🔍 References for "${symbol_name}" in ${codebaseId}:\n\n`;
              for (const ref of refs.slice(0, 50)) {
                const type = ref.reference_type === 'definition' ? '📍 Def' : '👉 Use';
                text += `${type} — ${ref.file_path}:${ref.line} (${ref.entity_type})\n`;
              }
              if (refs.length > 50) {
                text += `\n... and ${refs.length - 50} more references`;
              }
              text += `\nTotal: ${refs.length} references found`;
              return { content: [{ type: 'text', text }] };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `❌ find_references failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
                isError: true,
              };
            }
          }

          case 'trace_data_flow': {
            const { variable_name, file_path, codebase_id } = args as {
              variable_name: string;
              file_path: string;
              codebase_id: string;
            };
            try {
              const traceDataFlowTool = new TraceDataFlowTool();
              const result = await traceDataFlowTool.call({
                start_point: variable_name,
                end_point: file_path || 'output',
                codebase_id: getDefaultCodebase() || getCodebaseId(codebase_id),
                max_depth: 5,
              });
              let text = `🔄 Data flow for "${variable_name}":\n\n`;
              text += `Direction: ${result.trace_direction}\n`;
              text += `Total steps: ${result.total_steps}\n`;
              text += `Nodes: ${result.nodes.length}\n`;
              text += `Edges: ${result.edges.length}\n`;
              text += `Paths: ${result.paths.length}\n\n`;
              if (result.paths.length > 0) {
                text += 'Paths found:\n';
                for (const p of result.paths.slice(0, 5)) {
                  text += `- ${p.description}\n`;
                }
              }
              if (result.security_checkpoints.length > 0) {
                text += `\nSecurity checkpoints: ${result.security_checkpoints.length}\n`;
              }
              return { content: [{ type: 'text', text }] };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `❌ trace_data_flow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
                isError: true,
              };
            }
          }

          case 'analyze_security': {
            try {
              const result = await analyzeSecurityTool.call(args);
              const vulnText = result.vulnerabilities.length
                ? result.vulnerabilities
                    .map(
                      v =>
                        `[${v.severity.toUpperCase()}] ${v.type}: ${v.title}\n` +
                        `  File: ${v.file_path}:${v.line_number}\n` +
                        `  ${v.description}\n` +
                        `  Recommendation: ${v.recommendation}\n`,
                    )
                    .join('\n')
                : 'No vulnerabilities found.';

              const text =
                `🔒 Security Analysis for ${result.codebase_id}:\n\n` +
                `Score: ${result.security_score}/100\n` +
                `Total: ${result.total_vulnerabilities} vulnerabilities\n` +
                `Critical: ${result.summary.critical} | High: ${result.summary.high} | Medium: ${result.summary.medium} | Low: ${result.summary.low}\n\n` +
                `${vulnText}\n\n` +
                'Recommendations:\n' +
                result.recommendations.map(r => `- ${r}`).join('\n');

              return { content: [{ type: 'text', text }] };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Security analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
              };
            }
          }

          case 'get_api_endpoints': {
            const { framework } = args as { codebase_id?: string; framework?: string };
            let codebaseId = (args as { codebase_id?: string }).codebase_id;
            if (!codebaseId) {
              codebaseId = getDefaultCodebase() || getCodebaseId();
            }
            const endpoints = await apiDiscoveryService.findApiEndpoints(codebaseId);
            const filtered = framework
              ? endpoints.filter(e => e.tags?.includes(framework.toLowerCase()))
              : endpoints;
            if (filtered.length === 0) {
              const detected = await apiDiscoveryService.detectFrameworks(codebaseId);
              return {
                content: [
                  {
                    type: 'text',
                    text: `ℹ️ No API endpoints found in '${codebaseId}'.\nDetected frameworks: ${detected.length > 0 ? detected.join(', ') : 'none'}`,
                  },
                ],
              };
            }
            let text = `🌐 API Endpoints in ${codebaseId}${framework ? ` (${framework})` : ''}:\n\n`;
            for (const ep of filtered) {
              text += `${ep.method} ${ep.path} — ${ep.file_path}:${ep.line_number}\n`;
            }
            text += `\nTotal: ${filtered.length} endpoints`;
            return { content: [{ type: 'text', text }] };
          }

          case 'check_complexity': {
            const { file_path } = args as { file_path: string };
            try {
              const report = await complexityService.calculateFileComplexity(file_path);
              let text = `📊 Complexity Analysis for ${file_path}:\n\n`;
              text += 'Overall Metrics:\n';
              text += `- Cyclomatic Complexity: ${(report as any).cyclomaticComplexity ?? 'N/A'}\n`;
              text += `- Cognitive Complexity: ${(report as any).cognitiveComplexity ?? 'N/A'}\n`;
              text += `- Lines of Code: ${(report as any).linesOfCode ?? 'N/A'}\n`;
              text += `- Maintainability Index: ${(report as any).maintainabilityIndex ?? 'N/A'}\n\n`;
              if ((report as any).functions?.length) {
                text += `Functions (${(report as any).functions.length}):\n`;
                for (const fn of (report as any).functions.slice(0, 10)) {
                  text += `- ${fn.name} (line ${fn.line}): complexity ${fn.complexity?.cyclomaticComplexity ?? '?'} (${fn.riskLevel})\n`;
                }
              }
              return { content: [{ type: 'text', text }] };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `❌ Complexity analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
                isError: true,
              };
            }
          }

          case 'find_duplicates': {
            const findDuplicatesTool = new FindDuplicatesTool();
            try {
              let codebaseId = (args as { codebase_id?: string }).codebase_id;
              if (!codebaseId) {
                codebaseId = getDefaultCodebase() || getCodebaseId();
              }
              const result = await findDuplicatesTool.call({ ...args, codebase_id: codebaseId });
              let text = `🔁 Duplicate Code in ${result.codebase_id}:\n\n`;
              text += `Files analyzed: ${result.summary.total_files_analyzed}\n`;
              text += `Files with duplicates: ${result.summary.files_with_duplicates}\n`;
              text += `Duplication percentage: ${result.summary.duplication_percentage}%\n`;
              text += `Potential code reduction: ${result.summary.potential_code_reduction} lines\n\n`;
              if (result.duplicate_groups.length > 0) {
                text += `Duplicate Groups (${result.duplicate_groups.length}):\n`;
                for (const group of result.duplicate_groups.slice(0, 10)) {
                  text += `\n[${group.detection_type}] Similarity: ${Math.round(group.similarity_score * 100)}%\n`;
                  for (const inst of group.instances) {
                    text += `  - ${inst.file_path}:${inst.start_line}-${inst.end_line}\n`;
                  }
                  if (group.refactoring_suggestion) {
                    text += `  💡 ${group.refactoring_suggestion}\n`;
                  }
                }
              }
              if (result.recommendations.length > 0) {
                text += '\nRecommendations:\n';
                for (const rec of result.recommendations) {
                  text += `- ${rec}\n`;
                }
              }
              return { content: [{ type: 'text', text }] };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `❌ find_duplicates failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
                isError: true,
              };
            }
          }

          case 'suggest_refactoring': {
            const { file_path } = args as { file_path: string };
            try {
              const report = await complexityService.calculateFileComplexity(file_path);
              const functions = (report as any).functions || [];
              let text = `♻️ Refactoring Suggestions for ${file_path}:\n\n`;
              text += 'Overall Metrics:\n';
              text += `- Cyclomatic Complexity: ${(report as any).cyclomaticComplexity ?? 'N/A'}\n`;
              text += `- Lines of Code: ${(report as any).linesOfCode ?? 'N/A'}\n`;
              text += `- Maintainability Index: ${Math.round((report as any).maintainabilityIndex ?? 0)}\n\n`;
              const highComplexity = functions.filter(
                (f: any) => f.complexity?.cyclomaticComplexity > 10,
              );
              const fileCC = (report as any).cyclomaticComplexity ?? 0;
              const fileMI = Math.round((report as any).maintainabilityIndex ?? 100);
              const fileLOC = (report as any).linesOfCode ?? 0;

              // File-level checks
              if (fileCC > 50 || fileMI < 20) {
                text += `🔴 File-level complexity is CRITICAL (CC=${fileCC}, MI=${fileMI}, LOC=${fileLOC}):
`;
                text += '  💡 This file needs major refactoring — split into multiple modules\n';
                text += '  💡 Extract related logic into separate services/utilities\n';
                if (fileLOC > 500) {
                  text += `  💡 ${fileLOC} lines is too large — target < 300 lines per file\n`;
                }
                text += '\n';
              } else if (fileCC > 20 || fileMI < 40) {
                text += `🟡 File-level complexity is HIGH (CC=${fileCC}, MI=${fileMI}):\n`;
                text += '  💡 Consider splitting complex logic into separate functions\n\n';
              }

              if (highComplexity.length > 0) {
                text += `🔴 High Complexity Functions (${highComplexity.length}):\n`;
                for (const fn of highComplexity.slice(0, 5)) {
                  text += `  - ${fn.name} (line ${fn.line}): complexity ${fn.complexity?.cyclomaticComplexity} (${fn.riskLevel})\n`;
                  text += '    💡 Consider breaking into smaller functions\n';
                }
              }
              const longFunctions = functions.filter((f: any) => f.complexity?.linesOfCode > 50);
              if (longFunctions.length > 0) {
                text += `\n📏 Long Functions (${longFunctions.length}):\n`;
                for (const fn of longFunctions.slice(0, 5)) {
                  text += `  - ${fn.name} (line ${fn.line}): ${fn.complexity?.linesOfCode} lines\n`;
                  text += '    💡 Consider extracting helper methods\n';
                }
              }
              if (highComplexity.length === 0 && longFunctions.length === 0 && fileCC <= 20 && fileMI >= 40) {
                text += '✅ Code looks clean! No major refactoring suggestions.\n';
              }
              return { content: [{ type: 'text', text }] };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `❌ suggest_refactoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
                isError: true,
              };
            }
          }

          // Phase 4.1 AI-Powered Tools
          case 'ai_code_review': {
            const { file_path, code_snippet, review_type, codebase_id, context } = args as {
              file_path?: string;
              code_snippet?: string;
              review_type: string;
              codebase_id: string;
              context?: any;
            };

            try {
              const reviewResult = await aiCodeReviewTool.call({
                file_path,
                code_snippet,
                review_type: review_type as any,
                codebase_id,
                context,
              });

              const resultText =
                `🤖 AI Code Review (${review_type})\n\n` +
                `Overall Score: ${reviewResult.overall_score}/100\n\n` +
                '📊 Metrics:\n' +
                `- Complexity Score: ${reviewResult.metrics.complexity_score}\n` +
                `- Maintainability Index: ${reviewResult.metrics.maintainability_index}\n` +
                `- Security Score: ${reviewResult.metrics.security_score}\n\n` +
                `🔍 Issues Found: ${reviewResult.issues.length}\n\n` +
                reviewResult.issues
                  .slice(0, 10)
                  .map(
                    (issue, index) =>
                      `${index + 1}. ${issue.severity.toUpperCase()}: ${issue.title}\n` +
                      `   ${issue.description}\n` +
                      `   Category: ${issue.category} | Confidence: ${issue.confidence}%\n` +
                      `   Suggestion: ${issue.suggestion}\n`,
                  )
                  .join('\n') +
                (reviewResult.issues.length > 10
                  ? `\n... and ${reviewResult.issues.length - 10} more issues\n`
                  : '') +
                '\n💡 Key Recommendations:\n' +
                reviewResult.recommendations
                  .slice(0, 3)
                  .map(
                    (rec, index) =>
                      `${index + 1}. ${rec.action} (${rec.priority})\n   Rationale: ${rec.rationale}\n`,
                  )
                  .join('');

              return {
                content: [{ type: 'text', text: resultText }],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `AI Code Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
              };
            }
          }

          case 'intelligent_refactoring': {
            const {
              file_path,
              code_snippet,
              refactoring_type,
              target_scope,
              codebase_id,
              preferences,
            } = args as {
              file_path?: string;
              code_snippet?: string;
              refactoring_type: string;
              target_scope?: string;
              codebase_id: string;
              preferences?: any;
            };

            try {
              const refactoringResult = await intelligentRefactoringTool.call({
                file_path,
                code_snippet,
                refactoring_type: refactoring_type as any,
                target_scope: target_scope as any,
                codebase_id,
                preferences,
              });

              const resultText =
                '♻️ Intelligent Refactoring Analysis\n\n' +
                'Overall Assessment:\n' +
                `- Refactoring Potential: ${refactoringResult.overall_assessment.refactoring_potential}%\n` +
                `- Code Quality Score: ${refactoringResult.overall_assessment.code_quality_score}/100\n` +
                `- Maintainability Improvement: +${refactoringResult.overall_assessment.maintainability_improvement}\n` +
                `- Effort Required: ${refactoringResult.overall_assessment.effort_required}%\n\n` +
                `📋 Found ${refactoringResult.suggestions.length} Refactoring Opportunities:\n\n` +
                refactoringResult.suggestions
                  .slice(0, 5)
                  .map(
                    (suggestion, index) =>
                      `${index + 1}. ${suggestion.title}\n` +
                      `   Category: ${suggestion.category} | Impact: ${suggestion.impact}\n` +
                      `   Effort: ${suggestion.effort} | Confidence: ${suggestion.confidence}%\n` +
                      `   Benefits: ${suggestion.benefits.slice(0, 2).join(', ')}\n\n` +
                      `   Original Code:\n${suggestion.original_code.substring(0, 200)}${suggestion.original_code.length > 200 ? '...' : ''}\n\n` +
                      `   Suggested Code:\n${suggestion.refactored_code.substring(0, 200)}${suggestion.refactored_code.length > 200 ? '...' : ''}\n`,
                  )
                  .join('');

              return {
                content: [{ type: 'text', text: resultText }],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Intelligent Refactoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
              };
            }
          }

          case 'bug_prediction': {
            const {
              file_path,
              code_snippet,
              prediction_type,
              scope,
              codebase_id,
              historical_data,
            } = args as {
              file_path?: string;
              code_snippet?: string;
              prediction_type: string;
              scope: string;
              codebase_id: string;
              historical_data?: any;
            };

            try {
              const predictionResult = await bugPredictionTool.call({
                file_path,
                code_snippet,
                prediction_type: prediction_type as any,
                scope: scope as any,
                codebase_id,
                historical_data,
              });

              const resultText =
                `🔮 Bug Prediction Analysis (${prediction_type})\n\n` +
                `Risk Assessment: ${predictionResult.overall_risk_assessment.risk_category.toUpperCase()}\n` +
                `Bug Risk Score: ${predictionResult.overall_risk_assessment.bug_risk_score}/100\n` +
                `Predicted Bugs: ${predictionResult.overall_risk_assessment.predicted_bugs}\n\n` +
                `🚨 Identified Risks: ${predictionResult.identified_risks.length}\n\n` +
                predictionResult.identified_risks
                  .slice(0, 5)
                  .map(
                    (risk, index) =>
                      `${index + 1}. ${risk.title}\n` +
                      `   Category: ${risk.category} | Severity: ${risk.severity}\n` +
                      `   Likelihood: ${risk.likelihood}% | Impact: ${risk.impact}\n` +
                      `   Location: ${risk.location.file_path}:${risk.location.line_start}\n` +
                      `   Description: ${risk.description}\n` +
                      `   Mitigation: ${risk.mitigation_strategies.slice(0, 2).join(', ')}\n`,
                  )
                  .join('') +
                `\n🎯 Hotspots: ${predictionResult.hotspots.length}\n` +
                predictionResult.hotspots
                  .map(
                    (hotspot, index) =>
                      `${index + 1}. ${hotspot.location} (Risk: ${hotspot.risk_concentration})\n` +
                      `   Issues: ${hotspot.bug_types.join(', ')}\n`,
                  )
                  .join('\n');

              return {
                content: [{ type: 'text', text: resultText }],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Bug Prediction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
              };
            }
          }

          case 'context_aware_code_generation': {
            const { prompt, context, generation_type, constraints, codebase_id } = args as {
              prompt: string;
              context?: any;
              generation_type: string;
              constraints?: any;
              codebase_id: string;
            };

            try {
              const generationResult = await contextAwareCodegenTool.call({
                prompt,
                context: context || {},
                generation_type: generation_type as any,
                constraints,
                codebase_id,
              });

              const resultText =
                '⚡ Context-Aware Code Generation\n\n' +
                `Generated: ${generationResult.code_metadata.type} (${generationResult.code_metadata.estimated_lines} lines)\n` +
                `Language: ${generationResult.code_metadata.language}\n` +
                `Confidence Score: ${generationResult.confidence_score}/100\n\n` +
                `📝 Generated Code:\n\`\`\`\n${generationResult.generated_code}\`\`\`\n\n` +
                `✅ Validation: ${generationResult.validation_results.syntax_valid ? 'PASSED' : 'FAILED'}\n` +
                `Issues: ${generationResult.validation_results.potential_issues.length}\n\n` +
                '📊 Context Compliance:\n' +
                `- Style Compliance: ${generationResult.context_analysis.style_compliance}%\n` +
                `- Naming Convention: ${generationResult.context_analysis.naming_convention_compliance}%\n` +
                `- Architectural Alignment: ${generationResult.context_analysis.architectural_alignment}%\n\n` +
                '💡 Suggestions:\n' +
                generationResult.suggestions.optimization_opportunities
                  .slice(0, 3)
                  .map(s => `- ${s}`)
                  .join('\n');

              return {
                content: [{ type: 'text', text: resultText }],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Context-Aware Code Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
              };
            }
          }

          case 'technical_debt_analysis': {
            const {
              file_path,
              scope,
              analysis_depth,
              include_recommendations,
              codebase_id,
              historical_data,
            } = args as {
              file_path?: string;
              scope: string;
              analysis_depth: string;
              include_recommendations: boolean;
              codebase_id: string;
              historical_data?: any;
            };

            try {
              const debtResult = await technicalDebtTool.call({
                file_path,
                scope: scope as any,
                analysis_depth: analysis_depth as any,
                include_recommendations,
                codebase_id,
                historical_data,
              });

              const resultText =
                `📊 Technical Debt Analysis (${analysis_depth})\n\n` +
                `Overall Assessment: ${debtResult.overall_assessment.debt_category.toUpperCase()}\n` +
                `Debt Score: ${debtResult.overall_assessment.total_debt_score}/100\n` +
                `Interest Rate: ${debtResult.overall_assessment.interest_rate}%\n` +
                `Principal: ${debtResult.overall_assessment.principal}\n` +
                `Estimated Interest: ${debtResult.overall_assessment.estimated_interest}\n\n` +
                '💰 Financial Impact:\n' +
                `- Current Cost/Month: $${debtResult.financial_impact.current_cost_per_month}\n` +
                `- 6-Month Projection: $${debtResult.financial_impact.projected_cost_6_months}\n` +
                `- 12-Month Projection: $${debtResult.financial_impact.projected_cost_12_months}\n` +
                `- ROI Potential: ${debtResult.financial_impact.roi_potential}%\n\n` +
                `🚨 Debt Hotspots: ${debtResult.hotspots.length}\n\n` +
                debtResult.hotspots
                  .slice(0, 3)
                  .map(
                    (hotspot, index) =>
                      `${index + 1}. ${hotspot.location}\n` +
                      `   Concentration: ${hotspot.debt_concentration}\n` +
                      `   Issues: ${hotspot.primary_issues.join(', ')}\n` +
                      `   Actions: ${hotspot.recommended_actions.slice(0, 2).join(', ')}\n`,
                  )
                  .join('') +
                `\n🎯 Quick Wins: ${debtResult.priority_matrix.quick_wins.length}\n` +
                debtResult.priority_matrix.quick_wins
                  .slice(0, 3)
                  .map(
                    (item, index) =>
                      `${index + 1}. ${item.title} (Impact: ${item.impact_score}, Effort: ${item.effort_score})\n`,
                  )
                  .join('');

              return {
                content: [{ type: 'text', text: resultText }],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Technical Debt Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
              };
            }
          }

          case 'analyze_codebase_complexity': {
            const { codebase_id, limit, min_cyclomatic, min_lines, entity_type, exclude_patterns } =
              args as {
                codebase_id: string;
                limit?: number;
                min_cyclomatic?: number;
                min_lines?: number;
                entity_type?: 'function' | 'method' | 'all';
                exclude_patterns?: string[];
              };

            try {
              const tool = new AnalyzeCodebaseComplexityTool();
              const result = await tool.call({
                codebase_id,
                limit: limit ?? 10,
                min_cyclomatic: min_cyclomatic ?? 10,
                min_lines: min_lines ?? 30,
                entity_type: entity_type ?? 'all',
                exclude_patterns: exclude_patterns ?? [
                  'node_modules',
                  'dist',
                  'build',
                  '.next',
                  'storybook-static',
                  'coverage',
                  'out',
                  'min.js',
                  'bundle.js',
                ],
              });

              const resultText =
                `📊 Codebase Complexity Analysis for "${result.codebase_id}"\n\n` +
                `Total entities scanned: ${result.total_entities_scanned}\n` +
                `Entities meeting threshold: ${result.total_analyzed}\n\n` +
                `=== TOP ${result.results.length} MOST COMPLEX FUNCTIONS/METHODS ===\n\n` +
                result.results
                  .map(
                    r =>
                      `${r.rank}. ${r.name} (${r.entity_type})\n` +
                      `   File: ${r.file_path}:${r.start_line}-${r.end_line}\n` +
                      `   Raw Lines: ${r.raw_lines} | LOC: ${r.lines_of_code}\n` +
                      `   Cyclomatic: ${r.cyclomatic_complexity} | Cognitive: ${r.cognitive_complexity} | MI: ${r.maintainability_index}\n` +
                      `   Preview: ${r.preview.substring(0, 120)}...\n`,
                  )
                  .join('\n');

              return {
                content: [{ type: 'text', text: resultText }],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Complexity analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
              };
            }
          }

          case 'index_codebase': {
            const codebasePath =
              (args as { codebase_path?: string }).codebase_path || process.cwd();
            const codebaseId =
              (args as { codebase_id?: string }).codebase_id || path.basename(codebasePath);

            logger.info(`Indexing codebase: ${codebasePath} as ${codebaseId}`);

            try {
              // Use shared singleton — same DB connection as all other tools
              const indexingService = getIndexingService();

              // Index the codebase with progress (clears existing entries automatically)
              const entityCount = await indexingService.indexCodebaseWithProgress(
                codebasePath,
                undefined,
                codebaseId,
              );

              const resultText =
                '✅ Codebase indexed successfully!\n\n' +
                `📁 Codebase: ${codebaseId}\n` +
                `📍 Path: ${codebasePath}\n` +
                `🔍 Entities indexed: ${entityCount}\n\n` +
                '💡 You can now use all code intelligence tools like search_code, explain_function, etc.';

              return {
                content: [{ type: 'text', text: resultText }],
              };
            } catch (error) {
              logger.error('Indexing error:', error);
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to index codebase: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
              };
            }
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
