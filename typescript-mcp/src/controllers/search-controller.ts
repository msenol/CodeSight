import type { Request, Response } from 'express';
import { SearchCodeTool } from '../tools/search-code.js';
import { FindReferencesTool } from '../tools/find-references.js';
import { TraceDataFlowTool } from '../tools/trace-data-flow.js';
import { z } from 'zod';

const SearchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  codebase_id: z.string().uuid('Invalid codebase ID'),
  context_lines: z.number().min(0).max(20).optional(),
  max_results: z.number().min(1).max(100).optional(),
  include_tests: z.boolean().optional(),
  file_types: z.array(z.string()).optional(),
  exclude_patterns: z.array(z.string()).optional()
});

const FindReferencesRequestSchema = z.object({
  entity_id: z.string().uuid('Invalid entity ID'),
  include_tests: z.boolean().optional(),
  include_indirect: z.boolean().optional(),
  include_comments: z.boolean().optional(),
  include_strings: z.boolean().optional(),
  max_results: z.number().min(1).max(200).optional(),
  file_types: z.array(z.string()).optional(),
  exclude_patterns: z.array(z.string()).optional(),
  context_lines: z.number().min(0).max(10).optional()
});

const TraceDataFlowRequestSchema = z.object({
  start_point: z.string().min(1, 'Start point is required'),
  end_point: z.string().optional(),
  codebase_id: z.string().uuid('Invalid codebase ID'),
  max_depth: z.number().min(1).max(20).optional(),
  include_external: z.boolean().optional(),
  trace_direction: z.enum(['forward', 'backward', 'both']).optional(),
  include_data_transformations: z.boolean().optional(),
  include_side_effects: z.boolean().optional()
});

export class SearchController {
  constructor(
    private searchCodeTool: SearchCodeTool,
    private findReferencesTool: FindReferencesTool,
    private traceDataFlowTool: TraceDataFlowTool
  ) {}

  /**
   * Search for code patterns, functions, or text in the codebase
   * POST /api/search/code
   */
  async searchCode(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = SearchRequestSchema.parse(req.body);
      
      const result = await this.searchCodeTool.call(validatedData);
      
      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Code search failed');
    }
  }

  /**
   * Find all references to a specific code entity
   * POST /api/search/references
   */
  async findReferences(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = FindReferencesRequestSchema.parse(req.body);
      
      const result = await this.findReferencesTool.call(validatedData);
      
      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Reference search failed');
    }
  }

  /**
   * Trace data flow between code entities
   * POST /api/search/trace-flow
   */
  async traceDataFlow(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = TraceDataFlowRequestSchema.parse(req.body);
      
      const result = await this.traceDataFlowTool.call(validatedData);
      
      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Data flow tracing failed');
    }
  }

  /**
   * Advanced search with multiple criteria
   * POST /api/search/advanced
   */
  async advancedSearch(req: Request, res: Response): Promise<void> {
    try {
      const {
        queries,
        codebase_id,
        search_types = ['code', 'references'],
        combine_results = true,
        max_results_per_type = 50
      } = req.body;

      if (!Array.isArray(queries) || queries.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Queries array is required and must not be empty'
        });
        return;
      }

      if (!codebase_id || typeof codebase_id !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Valid codebase_id is required'
        });
        return;
      }

      const results: any = {
        codebase_id,
        total_queries: queries.length,
        search_types,
        results: []
      };

      for (const query of queries) {
        const queryResults: any = {
          query: query.text || query,
          results: {}
        };

        if (search_types.includes('code')) {
          try {
            const codeResult = await this.searchCodeTool.call({
              query: query.text || query,
              codebase_id,
              max_results: max_results_per_type,
              ...query.options
            });
            queryResults.results.code = codeResult;
          } catch (error) {
            queryResults.results.code = { error: error instanceof Error ? error.message : 'Unknown error' };
          }
        }

        if (search_types.includes('references') && query.entity_id) {
          try {
            const referencesResult = await this.findReferencesTool.call({
              entity_id: query.entity_id,
              max_results: max_results_per_type,
              ...query.options
            });
            queryResults.results.references = referencesResult;
          } catch (error) {
            queryResults.results.references = { error: error instanceof Error ? error.message : 'Unknown error' };
          }
        }

        results.results.push(queryResults);
      }

      if (combine_results) {
        results.combined = this.combineSearchResults(results.results);
      }

      res.status(200).json({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Advanced search failed');
    }
  }

  /**
   * Search suggestions based on partial input
   * GET /api/search/suggestions
   */
  async getSearchSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const { 
        partial_query, 
        codebase_id, 
        suggestion_types = ['functions', 'classes', 'variables'],
        max_suggestions = 10 
      } = req.query;

      if (!partial_query || typeof partial_query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'partial_query parameter is required'
        });
        return;
      }

      if (!codebase_id || typeof codebase_id !== 'string') {
        res.status(400).json({
          success: false,
          error: 'codebase_id parameter is required'
        });
        return;
      }

      // Generate search suggestions based on partial input
      const suggestions = await this.generateSearchSuggestions(
        partial_query,
        codebase_id,
        Array.isArray(suggestion_types) ? suggestion_types as string[] : [suggestion_types as string],
        parseInt(max_suggestions as string) || 10
      );

      res.status(200).json({
        success: true,
        data: {
          partial_query,
          suggestions,
          total_suggestions: suggestions.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Search suggestions failed');
    }
  }

  /**
   * Get search history and analytics
   * GET /api/search/history
   */
  async getSearchHistory(req: Request, res: Response): Promise<void> {
    try {
      const { 
        codebase_id, 
        limit = 50, 
        include_analytics = false 
      } = req.query;

      if (!codebase_id || typeof codebase_id !== 'string') {
        res.status(400).json({
          success: false,
          error: 'codebase_id parameter is required'
        });
        return;
      }

      // This would typically fetch from a database
      const history = await this.getSearchHistoryData(
        codebase_id,
        parseInt(limit as string) || 50,
        include_analytics === 'true'
      );

      res.status(200).json({
        success: true,
        data: history,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Search history retrieval failed');
    }
  }

  private combineSearchResults(results: any[]): any {
    const combined = {
      total_matches: 0,
      unique_files: new Set<string>(),
      match_types: new Set<string>(),
      top_matches: [] as any[]
    };

    for (const result of results) {
      if (result.results.code?.matches) {
        combined.total_matches += result.results.code.matches.length;
        result.results.code.matches.forEach((match: any) => {
          combined.unique_files.add(match.file_path);
          combined.match_types.add(match.match_type);
          combined.top_matches.push({
            ...match,
            query: result.query
          });
        });
      }

      if (result.results.references?.references) {
        combined.total_matches += result.results.references.references.length;
        result.results.references.references.forEach((ref: any) => {
          combined.unique_files.add(ref.file_path);
          combined.match_types.add('reference');
        });
      }
    }

    // Sort top matches by relevance and limit
    combined.top_matches = combined.top_matches
      .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
      .slice(0, 20);

    return {
      total_matches: combined.total_matches,
      unique_files: Array.from(combined.unique_files),
      match_types: Array.from(combined.match_types),
      top_matches: combined.top_matches
    };
  }

  private async generateSearchSuggestions(
    partialQuery: string,
    codebaseId: string,
    suggestionTypes: string[],
    maxSuggestions: number
  ): Promise<any[]> {
    // This would typically use a search index or database
    // For now, return mock suggestions
    const suggestions = [];
    
    if (suggestionTypes.includes('functions')) {
      suggestions.push(
        { type: 'function', name: `${partialQuery}Handler`, description: 'Event handler function' },
        { type: 'function', name: `get${partialQuery}`, description: 'Getter function' },
        { type: 'function', name: `set${partialQuery}`, description: 'Setter function' }
      );
    }
    
    if (suggestionTypes.includes('classes')) {
      suggestions.push(
        { type: 'class', name: `${partialQuery}Service`, description: 'Service class' },
        { type: 'class', name: `${partialQuery}Controller`, description: 'Controller class' }
      );
    }
    
    if (suggestionTypes.includes('variables')) {
      suggestions.push(
        { type: 'variable', name: `${partialQuery}Config`, description: 'Configuration variable' },
        { type: 'variable', name: `${partialQuery}Data`, description: 'Data variable' }
      );
    }

    return suggestions.slice(0, maxSuggestions);
  }

  private async getSearchHistoryData(
    codebaseId: string,
    limit: number,
    includeAnalytics: boolean
  ): Promise<any> {
    // This would typically fetch from a database
    // For now, return mock data
    const history = {
      codebase_id: codebaseId,
      recent_searches: [
        {
          query: 'authentication',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          results_count: 15,
          search_type: 'code'
        },
        {
          query: 'user validation',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          results_count: 8,
          search_type: 'code'
        }
      ].slice(0, limit)
    };

    if (includeAnalytics) {
      (history as any).analytics = {
        total_searches: 156,
        most_searched_terms: ['authentication', 'validation', 'user', 'api'],
        average_results_per_search: 12.3,
        search_success_rate: 0.87
      };
    }

    return history;
  }

  private handleError(error: unknown, res: Response, defaultMessage: string): void {
    console.error('SearchController Error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        })),
        timestamp: new Date().toISOString()
      });
      return;
    }

    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    const message = error instanceof Error ? error.message : defaultMessage;

    res.status(statusCode).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
}

export default SearchController;