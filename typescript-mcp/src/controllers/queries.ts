import { FastifyRequest, FastifyReply } from 'fastify';
import { DatabaseSearchService } from '../services/database-search-service';
import { Logger } from '../services/logger';

const logger = new Logger('QueriesController');

export interface QueryRequest {
  query: string;
  query_type?: 'natural_language' | 'structured' | 'regex';
  intent?: 'find_function' | 'explain_code' | 'trace_flow' | 'find_usage' | 'security_audit' | 'find_api' | 'check_complexity';
  codebase_id?: string;
  limit?: number;
  offset?: number;
  file_types?: string[];
  filters?: {
    entity_types?: string[];
    languages?: string[];
    date_range?: {
      start?: string;
      end?: string;
    };
  };
}

export interface QueryResponse {
  success: boolean;
  results?: Array<{
    id: string;
    name: string;
    type: string;
    file_path: string;
    line_number: number;
    content?: string;
    score: number;
    match_type: 'exact' | 'fuzzy' | 'semantic';
    context?: string[];
  }>;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
  };
  query_intent?: string;
  execution_time_ms: number;
  metadata?: {
    results_count: number;
    search_time_ms: number;
    files_searched: number;
    codebase_name?: string;
  };
  error?: string;
}

export class QueriesController {
  constructor(private searchService: DatabaseSearchService) {}

  async searchQuery(request: FastifyRequest<{ Body: QueryRequest }>, reply: FastifyReply) {
    const startTime = Date.now();

    try {
      const { query, query_type = 'natural_language', limit = 10, offset = 0, codebase_id, filters } = request.body;

      if (!query || query.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Query cannot be empty'
        } as QueryResponse);
      }

      logger.info('Processing search query', { query, query_type, limit, offset, codebase_id });

      // Perform search using the existing search service
      const searchResults = await this.searchService.search({
        query,
        limit,
        offset,
        codebaseId: codebase_id,
        filters: {
          fileTypes: filters?.file_types,
          entityTypes: filters?.entity_types,
          languages: filters?.languages
        }
      });

      const executionTime = Date.now() - startTime;

      // Map search results to the expected format
      const results = searchResults.results.map(result => ({
        id: result.id,
        name: result.name,
        type: result.type,
        file_path: result.file_path,
        line_number: result.line_number,
        content: result.content,
        score: result.score,
        match_type: result.match_type as 'exact' | 'fuzzy' | 'semantic',
        context: result.context
      }));

      const response: QueryResponse = {
        success: true,
        results,
        pagination: {
          limit,
          offset,
          total: searchResults.total || results.length,
          has_more: searchResults.has_more || false
        },
        query_intent: searchResults.intent || 'general_search',
        execution_time_ms: executionTime,
        metadata: {
          results_count: results.length,
          search_time_ms: executionTime,
          files_searched: searchResults.files_searched || 0,
          codebase_name: searchResults.codebase_name
        }
      };

      logger.info('Search query completed', {
        resultsCount: results.length,
        executionTime,
        query
      });

      return reply.send(response);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Search query failed', { error: error.message, query, executionTime });

      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        execution_time_ms: executionTime
      } as QueryResponse);
    }
  }

  async getQueryHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      // This would be implemented if we had query history storage
      // For now, return a placeholder response
      const response = {
        success: true,
        queries: [],
        pagination: {
          limit: 20,
          offset: 0,
          total: 0,
          has_more: false
        },
        metadata: {
          results_count: 0,
          search_time_ms: 0,
          files_searched: 0
        }
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get query history', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve query history'
      });
    }
  }

  async getSuggestedQueries(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { codebase_id } = request.query as { codebase_id?: string };

      // Generate suggested queries based on codebase analysis
      const suggestions = [
        'authentication functions',
        'database connection setup',
        'API endpoint definitions',
        'error handling patterns',
        'configuration management',
        'logging implementation',
        'test coverage',
        'security measures',
        'performance optimization',
        'code structure analysis'
      ];

      const response = {
        success: true,
        suggestions,
        metadata: {
          codebase_id,
          suggestions_count: suggestions.length
        }
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get suggested queries', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve suggested queries'
      });
    }
  }

  async validateQuery(request: FastifyRequest<{ Body: { query: string } }>, reply: FastifyReply) {
    try {
      const { query } = request.body;

      if (!query || query.trim().length === 0) {
        return reply.send({
          valid: false,
          error: 'Query cannot be empty'
        });
      }

      if (query.length > 1000) {
        return reply.send({
          valid: false,
          error: 'Query too long (maximum 1000 characters)'
        });
      }

      // Basic validation for potentially malicious content
      const dangerousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /data:text\/html/gi
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(query)) {
          return reply.send({
            valid: false,
            error: 'Query contains potentially dangerous content'
          });
        }
      }

      return reply.send({
        valid: true,
        metadata: {
          query_length: query.length,
          word_count: query.split(/\s+/).length
        }
      });
    } catch (error) {
      logger.error('Query validation failed', { error: error.message });
      return reply.status(500).send({
        valid: false,
        error: 'Validation failed'
      });
    }
  }
}

// Factory function for dependency injection
export function createQueriesController(searchService: DatabaseSearchService): QueriesController {
  return new QueriesController(searchService);
}