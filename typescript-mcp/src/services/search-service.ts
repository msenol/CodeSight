/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable no-undef */
/* eslint-disable no-useless-escape */
import type { SearchResult } from '../types/index.js';
import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import { distance } from 'fast-levenshtein';
import * as natural from 'natural';
import { parse } from '@typescript-eslint/typescript-estree';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export interface SearchOptions {
  codebase_id: string;
  max_results?: number;
  include_tests?: boolean;
  file_types?: string[];
  exclude_patterns?: string[];
}

export interface SearchService {
  keywordSearch(_query: string, _options: SearchOptions): Promise<SearchResult[]>;
  semanticSearch(query: string, options: SearchOptions): Promise<SearchResult[]>;
  structuredSearch(query: string, options: SearchOptions): Promise<SearchResult[]>;
  regexSearch(pattern: string, options: SearchOptions): Promise<SearchResult[]>;
  fuzzySearch(query: string, options: SearchOptions): Promise<SearchResult[]>;
  getCodeSnippet(filePath: string, line: number, contextLines: number): Promise<string>;
  getContextLines(filePath: string, line: number, contextLines: number): Promise<string[]>;
}

export class DefaultSearchService implements SearchService {
  private codebaseCache = new Map<string, string[]>();
  private stemmer = natural.PorterStemmer;
  private tokenizer = new natural.WordTokenizer();

  async keywordSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const files = await this.getCodebaseFiles(options.codebase_id, options);
    const results: SearchResult[] = [];
    const keywords = this.tokenizer.tokenize(query.toLowerCase()) || [];

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lowerLine = line.toLowerCase();

          let score = 0;
          let matchCount = 0;

          for (const keyword of keywords) {
            if (lowerLine.includes(keyword)) {
              matchCount++;
              // Boost score for exact matches
              if (lowerLine.includes(query.toLowerCase())) {
                score += 10;
              } else {
                score += 5;
              }
            }
          }

          if (matchCount > 0) {
            results.push({
              file: filePath,
              line: i + 1,
              column: line.indexOf(keywords[0]) + 1,
              content: line.trim(),
              score: score * (matchCount / keywords.length),
            });
          }
        }
      } catch (error) {
        console.warn(`Error reading file ${filePath}:`, error);
      }
    }

    return this.sortAndLimitResults(results, options.max_results || 10);
  }

  async semanticSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // Implement semantic search using TF-IDF and cosine similarity
    const files = await this.getCodebaseFiles(options.codebase_id, options);
    const results: SearchResult[] = [];
    const queryTerms = this.stemmer.tokenizeAndStem(query.toLowerCase());

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineTerms = this.stemmer.tokenizeAndStem(line.toLowerCase());

          // Calculate semantic similarity using Jaccard similarity
          const intersection = queryTerms.filter(term => lineTerms.includes(term));
          const union = [...new Set([...queryTerms, ...lineTerms])];
          const similarity = intersection.length / union.length;

          if (similarity > 0.1) {
            // Threshold for relevance
            results.push({
              file: filePath,
              line: i + 1,
              column: 1,
              content: line.trim(),
              score: similarity * 100,
            });
          }
        }
      } catch (error) {
        console.warn(`Error reading file ${filePath}:`, error);
      }
    }

    return this.sortAndLimitResults(results, options.max_results || 10);
  }

  async structuredSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // Search for code structures like functions, classes, interfaces
    const files = await this.getCodebaseFiles(options.codebase_id, options);
    const results: SearchResult[] = [];

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const ext = path.extname(filePath);

        if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
          await this.searchTypeScriptStructures(filePath, content, query, results);
        } else {
          // Fallback to regex-based structure search
          await this.searchGenericStructures(filePath, content, query, results);
        }
      } catch (error) {
        console.warn(`Error parsing file ${filePath}:`, error);
      }
    }

    return this.sortAndLimitResults(results, options.max_results || 10);
  }

  async regexSearch(pattern: string, options: SearchOptions): Promise<SearchResult[]> {
    const files = await this.getCodebaseFiles(options.codebase_id, options);
    const results: SearchResult[] = [];

    try {
      const regex = new RegExp(pattern, 'gi');

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const matches = line.matchAll(regex);

            for (const match of matches) {
              results.push({
                file: filePath,
                line: i + 1,
                column: (match.index || 0) + 1,
                content: line.trim(),
                score: 100, // Exact regex match gets high score
              });
            }
          }
        } catch (error) {
          console.warn(`Error reading file ${filePath}:`, error);
        }
      }
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${pattern}`);
    }

    return this.sortAndLimitResults(results, options.max_results || 10);
  }

  async fuzzySearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const files = await this.getCodebaseFiles(options.codebase_id, options);
    const results: SearchResult[] = [];
    const maxDistance = Math.floor(query.length * 0.3); // Allow 30% character differences

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const words = line.split(/]+/);

          for (let j = 0; j < words.length; j++) {
            const word = words[j];
            const dist = distance(query.toLowerCase(), word.toLowerCase());

            if (dist <= maxDistance) {
              const similarity = 1 - dist / Math.max(query.length, word.length);
              results.push({
                file: filePath,
                line: i + 1,
                column: line.indexOf(word) + 1,
                content: line.trim(),
                score: similarity * 100,
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Error reading file ${filePath}:`, error);
      }
    }

    return this.sortAndLimitResults(results, options.max_results || 10);
  }

  private async getCodebaseFiles(codebaseId: string, options: SearchOptions): Promise<string[]> {
    const cacheKey = `${codebaseId}-${JSON.stringify(options)}`;

    if (this.codebaseCache.has(cacheKey)) {
      return this.codebaseCache.get(cacheKey)!;
    }

    // For now, assume codebaseId is the directory path
    // In a real implementation, you'd look up the path from a database
    const basePath = codebaseId;

    let patterns = ['**/*'];
    if (options.file_types && options.file_types.length > 0) {
      patterns = options.file_types.map(ext => `**/*.${ext}`);
    }

    const allFiles: string[] = [];
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: basePath,
        absolute: true,
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          ...(options.exclude_patterns || []),
        ],
      });
      allFiles.push(...files);
    }

    // Filter out test files if requested
    const filteredFiles =
      options.include_tests === false ? allFiles.filter(file => !this.isTestFile(file)) : allFiles;

    this.codebaseCache.set(cacheKey, filteredFiles);
    return filteredFiles;
  }

  private isTestFile(filePath: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    return (
      fileName.includes('.test.') ||
      fileName.includes('.spec.') ||
      fileName.includes('test') ||
      fileName.includes('spec') ||
      filePath.includes('/test/') ||
      filePath.includes('/tests/') ||
      filePath.includes(']test]') ||
      filePath.includes(']tests]')
    );
  }

  private async searchTypeScriptStructures(
    filePath: string,
    content: string,
    query: string,
    results: SearchResult[],
  ): Promise<void> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      // Search for functions, classes, interfaces, etc.
      this.traverseAST(ast, query, filePath, results);
    } catch (error) {
      // Fallback to Acorn for JavaScript files
      try {
        const ast = acorn.parse(content, {
          ecmaVersion: 2022,
          sourceType: 'module',
          locations: true,
        });

        walk.simple(ast, {
          FunctionDeclaration: (node: any) => {
            if (node.id?.name.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                file: filePath,
                line: node.loc.start.line,
                column: node.loc.start.column + 1,
                content: `function ${node.id.name}`,
                score: 90,
              });
            }
          },
          ClassDeclaration: (node: any) => {
            if (node.id?.name.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                file: filePath,
                line: node.loc.start.line,
                column: node.loc.start.column + 1,
                content: `class ${node.id.name}`,
                score: 95,
              });
            }
          },
        });
      } catch (acornError) {
        console.warn(`Failed to parse ${filePath} with both TypeScript and Acorn parsers`);
      }
    }
  }

  private traverseAST(node: any, query: string, filePath: string, results: SearchResult[]): void {
    if (!node || typeof node !== 'object') {return;}

    // Check for named declarations
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'ClassDeclaration' ||
      node.type === 'InterfaceDeclaration' ||
      node.type === 'TypeAliasDeclaration'
    ) {
      if (node.id?.name?.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          file: filePath,
          line: node.loc?.start?.line || 1,
          column: (node.loc?.start?.column || 0) + 1,
          content: `${node.type.replace('Declaration', '').toLowerCase()} ${node.id.name}`,
          score: 95,
        });
      }
    }

    // Recursively traverse child nodes
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.traverseAST(child, query, filePath, results);
          }
        } else if (typeof node[key] === 'object') {
          this.traverseAST(node[key], query, filePath, results);
        }
      }
    }
  }

  private async searchGenericStructures(
    filePath: string,
    content: string,
    query: string,
    results: SearchResult[],
  ): Promise<void> {
    const lines = content.split('\n');
    const structurePatterns = [
      /^]*(function|class|interface|type|const|let|var)]+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
      /^]*(export]+)?(function|class|interface|type|const|let|var)]+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
      /^]*(public|private|protected)?]*(static)?]*(async)?]*([a-zA-Z_$][a-zA-Z0-9_$]*)]*\(/,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of structurePatterns) {
        const match = line.match(pattern);
        if (match) {
          const name = match[match.length - 1]; // Get the last captured group (name)
          if (name && name.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              file: filePath,
              line: i + 1,
              column: line.indexOf(name) + 1,
              content: line.trim(),
              score: 85,
            });
          }
        }
      }
    }
  }

  private sortAndLimitResults(results: SearchResult[], maxResults: number): SearchResult[] {
    return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
  }

  async getCodeSnippet(filePath: string, line: number, contextLines: number): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const startLine = Math.max(0, line - contextLines - 1);
      const endLine = Math.min(lines.length, line + contextLines);

      return lines.slice(startLine, endLine).join('\n');
    } catch (error) {
      return `// Error reading file: ${filePath}`;
    }
  }

  async getContextLines(filePath: string, line: number, contextLines: number): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const startLine = Math.max(0, line - contextLines - 1);
      const endLine = Math.min(lines.length, line + contextLines);

      return lines.slice(startLine, endLine);
    } catch (error) {
      return [`// Error reading file: ${filePath}`];
    }
  }
}
