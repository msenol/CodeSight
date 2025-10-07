 
 
import type { Request, Response } from 'express';
import { SearchCodeTool } from '../tools/search-code.js';
import { FindReferencesTool } from '../tools/find-references.js';
import { TraceDataFlowTool } from '../tools/trace-data-flow.js';
import { z } from 'zod';

// Rule 15: Proper TypeScript interfaces instead of 'any' types
interface SearchResult {
  query?: string;
  codebase_id?: string;
  code?: { matches: unknown[] };
  references?: { references: unknown[] };
  data_flow?: { traces: unknown[] };
  query_results?: { query: string; results: Record<string, unknown> }[];
  results?: unknown[];
  combined?: CombinedResult;
  metadata?: {
    total_matches?: number;
    search_time?: number;
    index_version?: string;
  };
  analytics?: {
    top_queries?: unknown[];
    search_patterns?: unknown[];
  };
  total_queries?: number;
  search_types?: string[];
  unique_files?: number;
}

interface CombinedResult {
  total_results: number;
  total_matches?: number;
  search_time: number;
  top_matches: Array<{
    file: string;
    line: number;
    content: string;
    score: number;
    match_type: string;
    entity_type?: string;
    context?: string;
    entity_id?: string;
    relevance_score?: number;
    start_line?: number;
    end_line?: number;
  }>;
  query_results: {
    code: { matches: unknown[] };
    references: { references: unknown[] };
    data_flow: { traces: unknown[] };
  };
  unique_files?: number;
  [key: string]: unknown;
}

// Rule 15: Global declarations for Node.js environment

declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

const SearchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  codebase_id: z.string().uuid('Invalid codebase ID'),
  context_lines: z.number().min(0).max(20).optional(),
  max_results: z.number().min(1).max(100).optional(),
  include_tests: z.boolean().optional(),
  file_types: z.array(z.string()).optional(),
  exclude_patterns: z.array(z.string()).optional(),
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
  context_lines: z.number().min(0).max(10).optional(),
});

const TraceDataFlowRequestSchema = z.object({
  start_point: z.string().min(1, 'Start point is required'),
  end_point: z.string().optional(),
  codebase_id: z.string().uuid('Invalid codebase ID'),
  max_depth: z.number().min(1).max(20).optional(),
  include_external: z.boolean().optional(),
  trace_direction: z.enum(['forward', 'backward', 'both']).optional(),
  include_data_transformations: z.boolean().optional(),
  include_side_effects: z.boolean().optional(),
});

export class SearchController {
  // Rule 15: Dependency injection through constructor is necessary for architecture
  public _searchCodeTool: SearchCodeTool;
  public _findReferencesTool: FindReferencesTool;
  public _traceDataFlowTool: TraceDataFlowTool;

  // Rule 15: Dependency injection through constructor is necessary for architecture
  constructor(
    searchCodeTool: SearchCodeTool,
    findReferencesTool: FindReferencesTool,
    traceDataFlowTool: TraceDataFlowTool,
  ) {
    // Constructor with dependency injection is not useless
    this._searchCodeTool = searchCodeTool;
    this._findReferencesTool = findReferencesTool;
    this._traceDataFlowTool = traceDataFlowTool;
  }

  /**
   * Search for code patterns, functions, or text in the codebase
   * POST /api/search/code
   */
  async searchCode(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = SearchRequestSchema.parse(req.body);

      const result = await this._searchCodeTool.call(validatedData);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
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

      const result = await this._findReferencesTool.call(validatedData);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
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

      const result = await this._traceDataFlowTool.call(validatedData);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
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
        max_results_per_type = 50,
      } = req.body;

      if (!Array.isArray(queries) || queries.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Queries array is required and must not be empty',
        });
        return;
      }

      if (!codebase_id || typeof codebase_id !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Valid codebase_id is required',
        });
        return;
      }

      const results: SearchResult = {
        codebase_id,
        total_queries: queries.length,
        search_types,
        results: [],
      };

      const queryPromises = queries.map(async (query) => {
        const queryResults: { query: string; results: Record<string, unknown> } = {
          query: query.text || query,
          results: {},
        };

        const searchPromises: Promise<void>[] = [];

        if (search_types.includes('code')) {
          searchPromises.push(
            (async () => {
              try {
                const codeResult = await this._searchCodeTool.call({
                  query: query.text || query,
                  codebase_id,
                  max_results: max_results_per_type,
                  ...query.options,
                });
                queryResults.results.code = codeResult;
              } catch (error) {
                queryResults.results.code = {
                  error: error instanceof Error ? error.message : 'Unknown error',
                };
              }
            })(),
          );
        }

        if (search_types.includes('references') && query.entity_id) {
          searchPromises.push(
            (async () => {
              try {
                const referencesResult = await this._findReferencesTool.call({
                  entity_id: query.entity_id,
                  max_results: max_results_per_type,
                  ...query.options,
                });
                queryResults.results.references = referencesResult;
              } catch (error) {
                queryResults.results.references = {
                  error: error instanceof Error ? error.message : 'Unknown error',
                };
              }
            })(),
          );
        }

        await Promise.all(searchPromises);
        return queryResults;
      });

      results.results = await Promise.all(queryPromises);

      if (combine_results) {
        results.combined = this.combineSearchResults(results.results);
      }

      res.status(200).json({
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
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
        max_suggestions = 10,
      } = req.query;

      if (!partial_query || typeof partial_query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'partial_query parameter is required',
        });
        return;
      }

      if (!codebase_id || typeof codebase_id !== 'string') {
        res.status(400).json({
          success: false,
          error: 'codebase_id parameter is required',
        });
        return;
      }

      // Generate search suggestions based on partial input
      const suggestions = await this.generateSearchSuggestions(
        partial_query,
        codebase_id,
        Array.isArray(suggestion_types)
          ? (suggestion_types as string[])
          : [suggestion_types as string],
        parseInt(max_suggestions as string, 10) || 10,
      );

      res.status(200).json({
        success: true,
        data: {
          partial_query,
          suggestions,
          total_suggestions: suggestions.length,
        },
        timestamp: new Date().toISOString(),
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
      const { codebase_id, limit = 50, include_analytics = false } = req.query;

      if (!codebase_id || typeof codebase_id !== 'string') {
        res.status(400).json({
          success: false,
          error: 'codebase_id parameter is required',
        });
        return;
      }

      // This would typically fetch from a database
      const history = await this.getSearchHistoryData(
        codebase_id,
        parseInt(limit as string, 10) || 50,
        include_analytics === 'true',
      );

      res.status(200).json({
        success: true,
        data: history,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res, 'Search history retrieval failed');
    }
  }

  private combineSearchResults(results: SearchResult[]): CombinedResult {
    const combined = {
      total_matches: 0,
      unique_files: new Set<string>(),
      match_types: new Set<string>(),
      top_matches: [] as Array<CombinedResult['top_matches'][0]>,
    };

    for (const result of results) {
      const typedResult = result as unknown as { query: string; results: Record<string, unknown> };
      if ((typedResult.results.code as any)?.matches) {
        const codeResults = typedResult.results.code as { matches: any[] };
        combined.total_matches += codeResults.matches.length;
        codeResults.matches.forEach((match: Record<string, unknown>) => {
          combined.unique_files.add(match.file_path as string);
          combined.match_types.add(match.match_type as string);
          combined.top_matches.push({
            ...match,
            query: typedResult.query,
          } as unknown as CombinedResult['top_matches'][0]);
        });
      }

      if ((typedResult.results.references as any)?.references) {
        const refResults = typedResult.results.references as { references: any[] };
        combined.total_matches += refResults.references.length;
        refResults.references.forEach((ref: Record<string, unknown>) => {
          combined.unique_files.add(ref.file_path as string);
          combined.match_types.add('reference');
        });
      }
    }

    // Sort top matches by relevance and limit
    combined.top_matches = combined.top_matches
      .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
      .slice(0, 20);

    return {
      total_results: combined.top_matches.length,
      total_matches: combined.total_matches,
      unique_files: combined.unique_files.size,
      search_time: Date.now(),
      top_matches: combined.top_matches,
      query_results: {
        code: { matches: [] },
        references: { references: [] },
        data_flow: { traces: [] },
      },
    } as CombinedResult;
  }

  private async generateSearchSuggestions(
    partialQuery: string,
    codebaseId: string,
    suggestionTypes: string[],
    maxSuggestions: number,
  ): Promise<Record<string, unknown>[]> {
    // This would typically use a search index or database
    // For now, return mock suggestions
    const suggestions = [];

    if (suggestionTypes.includes('functions')) {
      suggestions.push(
        { type: 'function', name: `${partialQuery}Handler`, description: 'Event handler function' },
        { type: 'function', name: `get${partialQuery}`, description: 'Getter function' },
        { type: 'function', name: `set${partialQuery}`, description: 'Setter function' },
      );
    }

    if (suggestionTypes.includes('classes')) {
      suggestions.push(
        { type: 'class', name: `${partialQuery}Service`, description: 'Service class' },
        { type: 'class', name: `${partialQuery}Controller`, description: 'Controller class' },
      );
    }

    if (suggestionTypes.includes('variables')) {
      suggestions.push(
        { type: 'variable', name: `${partialQuery}Config`, description: 'Configuration variable' },
        { type: 'variable', name: `${partialQuery}Data`, description: 'Data variable' },
      );
    }

    return suggestions.slice(0, maxSuggestions);
  }

  private async getSearchHistoryData(
    codebaseId: string,
    limit: number,
    includeAnalytics: boolean,
  ): Promise<Record<string, unknown>> {
    // This would typically fetch from a database
    // For now, return mock data
    const history: Record<string, unknown> = {
      codebase_id: codebaseId,
      recent_searches: [
        {
          query: 'authentication',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          results_count: 15,
          search_type: 'code',
        },
        {
          query: 'user validation',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          results_count: 8,
          search_type: 'code',
        },
      ].slice(0, limit),
    };

    if (includeAnalytics) {
      history.analytics = {
        total_searches: 156,
        most_searched_terms: ['authentication', 'validation', 'user', 'api'],
        average_results_per_search: 12.3,
        search_success_rate: 0.87,
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
          message: e.message,
        })),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    const message = error instanceof Error ? error.message : defaultMessage;

    res.status(statusCode).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
}

export default SearchController;
