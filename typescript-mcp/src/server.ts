 
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
import { AICodeReviewTool } from './tools/ai-code-review.js';
import { IntelligentRefactoringTool } from './tools/intelligent-refactoring.js';
import { BugPredictionTool } from './tools/bug-prediction.js';
import { ContextAwareCodegenTool } from './tools/context-aware-codegen.js';
import { TechnicalDebtAnalysisTool } from './tools/technical-debt-analysis.js';
import { logger } from './services/logger.js';

export async function createFastifyServer() {
  const fastify = Fastify({
    logger: false, // Use our custom logger
  });

  // Initialize AI tools for REST API access
  const aiCodeReviewTool = new AICodeReviewTool();
  const intelligentRefactoringTool = new IntelligentRefactoringTool();
  const bugPredictionTool = new BugPredictionTool();
  const contextAwareCodegenTool = new ContextAwareCodegenTool();
  const technicalDebtTool = new TechnicalDebtAnalysisTool();

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

  // MCP tool call endpoint for HTTP access
  fastify.post('/mcp/call', async (request, reply) => {
    const body = request.body as { tool: string; arguments: any };

    try {
      const { tool, arguments: args } = body;

      if (!tool) {
        return reply.code(400).send({
          error: 'Tool name is required',
          code: 'MISSING_TOOL_NAME'
        });
      }

      // Validate args
      if (!args || typeof args !== 'object') {
        return reply.code(400).send({
          error: 'Tool arguments must be an object',
          code: 'INVALID_ARGUMENTS'
        });
      }

      // Validate required fields for specific tools
      if (tool === 'technical_debt_analysis' && !args.codebase_id) {
        return reply.code(400).send({
          error: 'codebase_id is required for technical_debt_analysis',
          code: 'MISSING_REQUIRED_FIELD'
        });
      }

      // Handle different tools
      let result: any;

      switch (tool) {
        case 'ai_code_review': {
          result = await aiCodeReviewTool.call({
            file_path: args.file_path,
            code_snippet: args.code_snippet,
            review_type: args.review_type || 'basic',
            codebase_id: args.codebase_id || 'test',
            context: args.context
          });
          break;
        }

        case 'bug_prediction': {
          result = await bugPredictionTool.call({
            file_path: args.file_path,
            code_snippet: args.code_snippet || args.code, // Accept both parameter names
            prediction_type: args.prediction_type || 'pattern-based',
            scope: args.scope || 'module',
            analysis_depth: args.analysis_depth,
            codebase_id: args.codebase_id || 'test',
            historical_data: args.historical_data
          });
          break;
        }

        case 'context_aware_code_generation': {
          result = await contextAwareCodegenTool.call({
            prompt: args.prompt,
            requirement: args.requirement, // Accept both parameter names
            context: {
              file_path: args.context?.file_path,
              surrounding_code: args.context?.surrounding_code,
              project_structure: args.context?.project_structure,
              existing_patterns: args.context?.existing_patterns,
              dependencies: args.context?.dependencies,
              coding_standards: args.context?.coding_standards
            },
            generation_type: args.generation_type || 'function',
            constraints: args.constraints,
            codebase_id: args.codebase_id || 'test'
          });
          break;
        }

        case 'intelligent_refactoring': {
          result = await intelligentRefactoringTool.call({
            file_path: args.file_path,
            code_snippet: args.code_snippet || args.code,
            refactoring_type: args.refactoring_type || 'improve-readability',
            target_scope: args.target_scope,
            codebase_id: args.codebase_id || 'test',
            preferences: args.preferences
          });
          break;
        }

        case 'technical_debt_analysis': {
          result = await technicalDebtTool.call({
            file_path: args.file_path,
            scope: args.scope || 'module',
            analysis_depth: args.analysis_depth || 'basic',
            include_recommendations: args.include_recommendations !== false,
            codebase_id: args.codebase_id || 'test',
            historical_data: args.historical_data
          });
          break;
        }

        default:
          return reply.code(404).send({
            error: `Unknown tool: ${tool}`,
            code: 'UNKNOWN_TOOL'
          });
      }

      return reply.code(200).send(result);

    } catch (error) {
      logger.error('MCP tool call failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Determine appropriate status code and error type based on error message
      let statusCode = 500;
      let errorType = 'INTERNAL_ERROR';

      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        statusCode = 408;
        errorType = 'TIMEOUT';
      } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist') || errorMessage.includes('File not found')) {
        statusCode = 404;
        errorType = 'NOT_FOUND';
      } else if (errorMessage.includes('empty') || errorMessage.includes('required') || errorMessage.includes('must be provided') || errorMessage.includes('invalid') || errorMessage.includes('syntax')) {
        statusCode = 400;
        errorType = 'INVALID_REQUEST';
      } else if (errorMessage.includes('too large') || errorMessage.includes('exceeds')) {
        statusCode = 413;
        errorType = 'PAYLOAD_TOO_LARGE';
      } else if (errorMessage.includes('forEach') || errorMessage.includes('is not a function')) {
        statusCode = 400;
        errorType = 'INVALID_REQUEST';
      }

      return reply.code(statusCode).send({
        error: errorMessage,
        code: errorType,
        tool: body.tool
      });
    }
  });

  return fastify;
}
