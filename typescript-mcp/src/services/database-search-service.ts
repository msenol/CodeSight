import type { SearchResult } from '../types/index.js';
import Database from 'better-sqlite3';
import * as fs from 'fs/promises';
import * as path from 'path';

/* eslint-disable @typescript-eslint/no-unused-vars */
 
 
 
 
// Rule 15: Global declarations for Node.js environment
declare const process: {
  env: Record<string, string | undefined>;
  cwd: () => string;
};
declare const console: Console;

export interface SearchOptions {
  codebase_id: string;
  max_results?: number;
  include_tests?: boolean;
  file_types?: string[];
  exclude_patterns?: string[];
}

export interface SearchService {
  keywordSearch(_query: string, _options: SearchOptions): Promise<SearchResult[]>;
  semanticSearch(_query: string, _options: SearchOptions): Promise<SearchResult[]>;
  structuredSearch(_query: string, _options: SearchOptions): Promise<SearchResult[]>;
   
  regexSearch(_pattern: string, _options: SearchOptions): Promise<SearchResult[]>;
   
  fuzzySearch(_query: string, _options: SearchOptions): Promise<SearchResult[]>;
  getCodeSnippet(filePath: string, line: number, contextLines: number): Promise<string>;
  getContextLines(filePath: string, line: number, contextLines: number): Promise<string[]>;
}

export class DatabaseSearchService implements SearchService {
  private db: Database.Database;
  private databasePath: string;

  constructor(dbPath?: string) {
    this.databasePath =
      dbPath || process.env.DATABASE_PATH || path.join(process.cwd(), 'code-intelligence.db');

    console.log('[DEBUG] DatabaseSearchService using path:', this.databasePath);
    this.db = new Database(this.databasePath);

    // Test database connection
    try {
      const test = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").get();

      console.log('[DEBUG] Database tables found:', test);
    } catch (error) {

      console.error('[DEBUG] Database connection error:', error);
    }
  }

  async keywordSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const maxResults = options.max_results || 10;
    const searchQuery = query.toLowerCase();


    console.log(
      `[DEBUG] keywordSearch called with query: "${searchQuery}", codebase_id: "${options.codebase_id}"`,
    );

    // First check if table exists and has data
    try {
      const count = this.db.prepare('SELECT COUNT(*) as count FROM code_entities').get() as {
        count: number;
      };

      console.log(`[DEBUG] Database has ${count.count} entities`);
    } catch (error) {

      console.error('[DEBUG] Error checking entity count:', error);
    }

    // Search in database
    const stmt = this.db.prepare(`
      SELECT id, name, file_path, entity_type, start_line, end_line, content
      FROM code_entities
      WHERE (LOWER(name) LIKE ? OR LOWER(content) LIKE ?)
      ORDER BY
        CASE
          WHEN LOWER(name) = ? THEN 1
          WHEN LOWER(name) LIKE ? THEN 2
          WHEN LOWER(content) LIKE ? THEN 3
          ELSE 4
        END,
        name
      LIMIT ?
    `);

    const likeQuery = `%${searchQuery}%`;
    const exactMatch = searchQuery;
    const startsWithQuery = `${searchQuery}%`;
    const containsQuery = `%${searchQuery}%`;

    const rows = stmt.all(
      likeQuery,
      likeQuery,
      exactMatch,
      startsWithQuery,
      containsQuery,
      maxResults,
    );


    console.log(`[DEBUG] Found ${rows.length} raw results for query "${searchQuery}"`);

    const results = rows.map(row => ({
      file: (row as any).file_path,
      line: (row as any).start_line || 1,
      column: 1,
      content: (row as any).content || '',
      score: this.calculateRelevanceScore((row as any).name, (row as any).content, searchQuery),
    }));

    console.log(`[DEBUG] Returning ${results.length} formatted results`);

    return results;
  }

  async semanticSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // For now, fall back to keyword search
    return this.keywordSearch(query, options);
  }

  async structuredSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // For now, fall back to keyword search
    return this.keywordSearch(query, options);
  }

  async regexSearch(pattern: string, options: SearchOptions): Promise<SearchResult[]> {
    const maxResults = options.max_results || 10;

    try {
      const regex = new RegExp(pattern, 'i');
      const stmt = this.db.prepare(`
        SELECT id, name, file_path, entity_type, start_line, end_line, content
        FROM code_entities
        WHERE name REGEXP ? OR content REGEXP ?
        ORDER BY name
        LIMIT ?
      `);

      const rows = stmt.all(pattern, pattern, maxResults) as any[];

      return rows.map(row => ({
        file: row.file_path,
        line: row.start_line || 1,
        column: 1,
        content: row.content || '',
        score: 0.8, // Default score for regex matches
      }));
    } catch (error) {

      console.error('Invalid regex pattern:', error);
      return [];
    }
  }

  async fuzzySearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const maxResults = options.max_results || 10;
    const searchQuery = query.toLowerCase();

    // Get all entities and filter by fuzzy match
    const stmt = this.db.prepare(`
      SELECT id, name, file_path, entity_type, start_line, end_line, content
      FROM code_entities
      ORDER BY name
      LIMIT 100
    `);

    const rows = stmt.all() as any[];
    const results: SearchResult[] = [];

    for (const row of rows) {
      const nameDistance = this.levenshteinDistance(row.name.toLowerCase(), searchQuery);
      const contentDistance = row.content
        ? this.levenshteinDistance(row.content.toLowerCase(), searchQuery)
        : 100;

      const minDistance = Math.min(nameDistance, contentDistance);
      if (minDistance <= query.length * 0.4) {
        // Allow 40% character difference
        results.push({
          file: row.file_path,
          line: row.start_line || 1,
          column: 1,
          content: row.content || '',
          score: Math.max(0, 1 - minDistance / Math.max(query.length, row.name.length)),
        });
      }
    }

    // Sort by relevance score and limit results
    return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
  }

  async getCodeSnippet(filePath: string, line: number, contextLines: number): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const start = Math.max(0, line - contextLines - 1);
      const end = Math.min(lines.length, line + contextLines);

      return lines.slice(start, end).join('\n');
    } catch (error) {

      console.error(`Error reading file ${filePath}:`, error);
      return '';
    }
  }

  async getContextLines(filePath: string, line: number, contextLines: number): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const start = Math.max(0, line - contextLines - 1);
      const end = Math.min(lines.length, line + contextLines);

      return lines.slice(start, end);
    } catch (error) {

      console.error(`Error reading file ${filePath}:`, error);
      return [];
    }
  }

  private calculateRelevanceScore(name: string, content: string | null, query: string): number {
    const lowerName = name.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact name match gets highest score
    if (lowerName === lowerQuery) {
      return 1.0;
    }

    // Name starts with query gets high score
    if (lowerName.startsWith(lowerQuery)) {
      return 0.9;
    }

    // Name contains query gets medium score
    if (lowerName.includes(lowerQuery)) {
      return 0.8;
    }

    // Content contains query gets lower score
    if (content && content.toLowerCase().includes(lowerQuery)) {
      return 0.6;
    }

    return 0.3;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp',
      cc: 'cpp',
      cxx: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      dart: 'dart',
      ex: 'elixir',
    };

    return languageMap[ext || ''] || 'unknown';
  }
}
