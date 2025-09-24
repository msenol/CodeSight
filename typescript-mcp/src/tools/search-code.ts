import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SearchService } from '../services/search-service.js';
import type { CodebaseService } from '../services/codebase-service.js';
import { z } from 'zod';

// Input validation schema
const SearchCodeInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  codebase_id: z.string().uuid('Invalid codebase ID'),
  context_lines: z.number().int().min(0).max(10).default(3),
  max_results: z.number().int().min(1).max(100).default(10),
  include_tests: z.boolean().default(true),
  file_types: z.array(z.string()).optional(),
  exclude_patterns: z.array(z.string()).optional()
});

type SearchCodeInput = z.infer<typeof SearchCodeInputSchema>;

interface SearchResult {
  entity_id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  code_snippet: string;
  relevance_score: number;
  entity_type: string;
  context: string[];
  language: string;
  qualified_name: string;
}

interface SearchCodeResult {
  results: SearchResult[];
  query_intent: string;
  execution_time_ms: number;
  total_matches: number;
  search_strategy: string;
}

/**
 * Search code using natural language queries
 * Supports semantic search, keyword matching, and AST-based queries
 */
export class SearchCodeTool {
  name = 'search_code';
  description = 'Search code using natural language queries with semantic understanding';
  
  inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query to search for code'
      },
      codebase_id: {
        type: 'string',
        description: 'UUID of the codebase to search in'
      },
      context_lines: {
        type: 'number',
        description: 'Number of context lines to include around matches',
        default: 3
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 10
      },
      include_tests: {
        type: 'boolean',
        description: 'Whether to include test files in search',
        default: true
      },
      file_types: {
        type: 'array',
        items: { type: 'string' },
        description: 'File extensions to filter by (e.g., [".ts", ".js"])'
      },
      exclude_patterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Patterns to exclude from search'
      }
    },
    required: ['query', 'codebase_id']
  };

  constructor(
    private searchService: SearchService,
    private codebaseService: CodebaseService
  ) {}

  async call(args: unknown): Promise<SearchCodeResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const input = SearchCodeInputSchema.parse(args);
      
      // Verify codebase exists and is indexed
      const codebase = await this.codebaseService.getCodebase(input.codebase_id);
      if (!codebase) {
        throw new Error(`Codebase with ID ${input.codebase_id} not found`);
      }
      
      if (codebase.status !== 'indexed') {
        throw new Error(`Codebase ${codebase.name} is not indexed. Current status: ${codebase.status}`);
      }

      // Detect query intent
      const queryIntent = this.detectQueryIntent(input.query);
      
      // Perform search based on intent and query complexity
      const searchResults = await this.performSearch(input, queryIntent);
      
      // Format results with context
      const formattedResults = await this.formatResults(searchResults, input);
      
      const executionTime = Date.now() - startTime;
      
      return {
        results: formattedResults,
        query_intent: queryIntent,
        execution_time_ms: executionTime,
        total_matches: searchResults.length,
        search_strategy: this.getSearchStrategy(input.query, queryIntent)
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect the intent of the natural language query
   */
  private detectQueryIntent(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Authentication/Security patterns
    if (lowerQuery.includes('auth') || lowerQuery.includes('login') || 
        lowerQuery.includes('password') || lowerQuery.includes('security')) {
      return 'find_authentication';
    }
    
    // API/Endpoint patterns
    if (lowerQuery.includes('api') || lowerQuery.includes('endpoint') || 
        lowerQuery.includes('route') || lowerQuery.includes('controller')) {
      return 'find_api';
    }
    
    // Database patterns
    if (lowerQuery.includes('database') || lowerQuery.includes('query') || 
        lowerQuery.includes('sql') || lowerQuery.includes('model')) {
      return 'find_database';
    }
    
    // Function/Method patterns
    if (lowerQuery.includes('function') || lowerQuery.includes('method') || 
        lowerQuery.includes('implement') || lowerQuery.includes('define')) {
      return 'find_function';
    }
    
    // Class/Type patterns
    if (lowerQuery.includes('class') || lowerQuery.includes('type') || 
        lowerQuery.includes('interface') || lowerQuery.includes('struct')) {
      return 'find_type';
    }
    
    // Error/Exception patterns
    if (lowerQuery.includes('error') || lowerQuery.includes('exception') || 
        lowerQuery.includes('throw') || lowerQuery.includes('catch')) {
      return 'find_error_handling';
    }
    
    // Configuration patterns
    if (lowerQuery.includes('config') || lowerQuery.includes('setting') || 
        lowerQuery.includes('environment') || lowerQuery.includes('env')) {
      return 'find_configuration';
    }
    
    // Default to general search
    return 'general_search';
  }

  /**
   * Perform the actual search using appropriate strategy
   */
  private async performSearch(input: SearchCodeInput, intent: string): Promise<any[]> {
    const searchOptions = {
      codebase_id: input.codebase_id,
      max_results: input.max_results,
      include_tests: input.include_tests,
      file_types: input.file_types,
      exclude_patterns: input.exclude_patterns
    };

    // Use different search strategies based on query complexity and intent
    if (this.isSimpleKeywordQuery(input.query)) {
      // Fast keyword search for simple queries
      return await this.searchService.keywordSearch(input.query, searchOptions);
    } else if (this.isStructuredQuery(input.query)) {
      // AST-based search for structured queries
      return await this.searchService.structuredSearch(input.query, searchOptions);
    } else {
      // Semantic search for complex natural language queries
      return await this.searchService.semanticSearch(input.query, searchOptions);
    }
  }

  /**
   * Check if query is a simple keyword search
   */
  private isSimpleKeywordQuery(query: string): boolean {
    // Simple heuristics: short queries, no complex grammar
    return query.length < 20 && 
           !query.includes(' and ') && 
           !query.includes(' or ') && 
           !query.includes(' where ') &&
           !/\b(implement|define|create|handle|process)\b/i.test(query);
  }

  /**
   * Check if query has structured patterns
   */
  private isStructuredQuery(query: string): boolean {
    // Look for code-like patterns
    return /\b(function|class|method|interface|type)\s+\w+/i.test(query) ||
           /\w+\s*\(/i.test(query) || // function calls
           /\w+\s*\{/i.test(query);   // object/class definitions
  }

  /**
   * Format search results with context
   */
  private async formatResults(results: any[], input: SearchCodeInput): Promise<SearchResult[]> {
    const formatted: SearchResult[] = [];
    
    for (const result of results) {
      try {
        // Get code snippet with context
        const snippet = await this.searchService.getCodeSnippet(
          result.file_path,
          result.start_line,
          input.context_lines
        );
        
        // Get surrounding context lines
        const context = await this.searchService.getContextLines(
          result.file_path,
          result.start_line,
          input.context_lines
        );
        
        formatted.push({
          entity_id: result.entity_id || result.id,
          file_path: result.file_path,
          start_line: result.start_line,
          end_line: result.end_line,
          code_snippet: snippet,
          relevance_score: result.relevance_score || result.score || 1.0,
          entity_type: result.entity_type || 'unknown',
          context: context,
          language: result.language || this.detectLanguage(result.file_path),
          qualified_name: result.qualified_name || result.name || ''
        });
      } catch (error) {
        // Skip results that can't be formatted
        console.warn(`Failed to format search result: ${error}`);
      }
    }
    
    // Sort by relevance score
    return formatted.sort((a, b) => b.relevance_score - a.relevance_score);
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'dart': 'dart',
      'ex': 'elixir'
    };
    
    return languageMap[ext || ''] || 'unknown';
  }

  /**
   * Get description of search strategy used
   */
  private getSearchStrategy(query: string, intent: string): string {
    if (this.isSimpleKeywordQuery(query)) {
      return 'keyword_search';
    } else if (this.isStructuredQuery(query)) {
      return 'ast_search';
    } else {
      return 'semantic_search';
    }
  }
}

export default SearchCodeTool;