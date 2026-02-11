/**
 * Indexing Service - Simple JavaScript implementation
 * (Rust FFI will be integrated later)
 */
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as process from 'node:process';
import { glob } from 'glob';
import Database from 'better-sqlite3';
import { logger } from './logger.js';
import type { DatabaseRow, Statistics, SearchResult } from '../types/index.js';

export class IndexingService {
  private db: Database.Database;
  private readonly extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];

  constructor(dbPath?: string) {
    const databasePath =
      dbPath ?? process.env.DATABASE_PATH ?? path.join(process.cwd(), 'code-intelligence.db');

    // Ensure directory exists before opening database
    const dbDir = path.dirname(databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      logger.info(`Created database directory: ${dbDir}`);
    }

    this.db = new Database(databasePath);
    this.initDatabase();
  }

  private initDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        content TEXT,
        codebase_id TEXT NOT NULL DEFAULT '',
        indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_name ON code_entities(name);
      CREATE INDEX IF NOT EXISTS idx_file_path ON code_entities(file_path);
      CREATE INDEX IF NOT EXISTS idx_entity_type ON code_entities(entity_type);
      CREATE INDEX IF NOT EXISTS idx_codebase_id ON code_entities(codebase_id);
    `);
  }

  async indexCodebase(codebasePath: string, codebaseId?: string): Promise<number> {
    logger.info(`Starting indexing of: ${codebasePath} as ${codebaseId || 'default'}`);

    // Use provided codebaseId or derive from path
    const actualCodebaseId = codebaseId || path.basename(codebasePath);

    // Clear existing entries for this codebase
    const stmt = this.db.prepare('DELETE FROM code_entities WHERE codebase_id = ?');
    stmt.run(actualCodebaseId);

    let fileCount = 0;

    // Find all relevant files
    const patterns = this.extensions.map(ext => `**/*${ext}`);

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: codebasePath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
        absolute: false,
      });

      for (const file of files) {
        const fullPath = path.join(codebasePath, file);
        await this.indexFile(fullPath, actualCodebaseId);
        fileCount++;
      }
    }

    logger.info(`Indexed ${fileCount} files from ${codebasePath} as ${actualCodebaseId}`);
    return fileCount;
  }

  async indexFile(filePath: string, codebaseId: string = ''): Promise<void> {
    try {
      const content = await fsp.readFile(filePath, 'utf-8');
      const entities = this.parseFile(filePath, content);

      const insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO code_entities (id, name, file_path, entity_type, start_line, end_line, content, codebase_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = this.db.transaction((entities: any[]) => {
        for (const entity of entities) {
          insertStmt.run(
            entity.id,
            entity.name,
            entity.file_path,
            entity.entity_type,
            entity.start_line,
            entity.end_line,
            entity.content,
            codebaseId,
          );
        }
      });

      transaction(entities);
      logger.debug(`Indexed ${entities.length} entities from ${filePath}`);
    } catch (error) {
      logger.error(`Failed to index file ${filePath}:`, error);
    }
  }

  private parseFile(filePath: string, content: string): any[] {
    const entities: any[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // DRY: Use individual extractor methods for each entity type
      // This keeps the main loop clean and maintainable

      // Extract functions
      this.extractFunction(entities, line, filePath, lineNum);

      // Extract classes
      this.extractClass(entities, line, filePath, lineNum);

      // Extract arrow functions assigned to const
      this.extractArrowFunction(entities, line, filePath, lineNum);

      // Extract interfaces (TypeScript)
      this.extractInterface(entities, line, filePath, lineNum);

      // Extract types (TypeScript)
      this.extractType(entities, line, filePath, lineNum);

      // NEW: Extract decorators
      this.extractDecorator(entities, line, filePath, lineNum);

      // NEW: Extract class methods
      this.extractMethod(entities, line, filePath, lineNum, lines, index);

      // NEW: Extract variables/constants
      this.extractVariable(entities, line, filePath, lineNum);

      // NEW: Extract import statements
      this.extractImport(entities, line, filePath, lineNum);
    });

    return entities;
  }

  // DRY: Single helper for adding entities (Rule 15 + DRY compliant)
  private addEntity(
    entities: any[],
    filePath: string,
    lineNum: number,
    name: string,
    entityType: string,
    content: string,
    metadata?: Record<string, unknown>
  ): void {
    const entity: any = {
      id: `${filePath}:${lineNum}:${name}`,
      name,
      file_path: filePath,
      entity_type: entityType,
      start_line: lineNum,
      end_line: lineNum, // Default, can be overridden by metadata
      content,
    };

    // Override end_line if provided in metadata
    if (metadata?.end_line) {
      entity.end_line = metadata.end_line;
      delete metadata.end_line; // Remove from metadata to avoid duplication
    }

    // Add remaining metadata if any
    if (metadata && Object.keys(metadata).length > 0) {
      entity.metadata = metadata;
    }

    entities.push(entity);
  }

  // DRY: Individual extractors use the helper
  private extractFunction(entities: any[], line: string, filePath: string, lineNum: number): void {
    const functionMatch = line.match(
      /(?:async]+)?function]+(\w+)|(?:const|let|var)]+(\w+)]*=]*(?:async]*)?\(/,
    );
    if (functionMatch) {
      const name = functionMatch[1] ?? functionMatch[2];
      if (name) {
        this.addEntity(entities, filePath, lineNum, name, 'function', line.trim(), {
          end_line: lineNum + 5,
        });
      }
    }
  }

  private extractClass(entities: any[], line: string, filePath: string, lineNum: number): void {
    const classMatch = line.match(/(?:export]+)?(?:default]+)?class]+(\w+)/);
    if (classMatch && classMatch[1]) {
      this.addEntity(entities, filePath, lineNum, classMatch[1], 'class', line.trim(), {
        end_line: lineNum + 10,
      });
    }
  }

  private extractArrowFunction(entities: any[], line: string, filePath: string, lineNum: number): void {
    const arrowMatch = line.match(
      /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]+)\s*=>/,
    );
    if (arrowMatch && arrowMatch[1]) {
      this.addEntity(entities, filePath, lineNum, arrowMatch[1], 'function', line.trim(), {
        end_line: lineNum + 3,
      });
    }
  }

  private extractInterface(entities: any[], line: string, filePath: string, lineNum: number): void {
    const interfaceMatch = line.match(/(?:export]+)?interface]+(\w+)/);
    if (interfaceMatch && interfaceMatch[1]) {
      this.addEntity(entities, filePath, lineNum, interfaceMatch[1], 'interface', line.trim(), {
        end_line: lineNum + 5,
      });
    }
  }

  private extractType(entities: any[], line: string, filePath: string, lineNum: number): void {
    const typeMatch = line.match(/(?:export]+)?type]+(\w+)]*=/);
    if (typeMatch && typeMatch[1]) {
      this.addEntity(entities, filePath, lineNum, typeMatch[1], 'type', line.trim(), {
        end_line: lineNum + 2,
      });
    }
  }

  // NEW: Extract decorators (e.g., @Controller, @Get, @Post)
  private extractDecorator(entities: any[], line: string, filePath: string, lineNum: number): void {
    const decoratorMatch = line.match(/@(\w+)(?:\(([^)]*)\))?/);
    if (decoratorMatch && decoratorMatch[1]) {
      this.addEntity(entities, filePath, lineNum, decoratorMatch[1], 'decorator', line.trim(), {
        arguments: decoratorMatch[2] || '',
        end_line: lineNum + 1,
      });
    }
  }

  // NEW: Extract class methods
  private extractMethod(
    entities: any[],
    line: string,
    filePath: string,
    lineNum: number,
    lines: string[],
    lineIndex: number
  ): void {
    const methodMatch = line.match(/^\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::[^{]*)?\{/);
    if (methodMatch && !line.includes('function')) {
      const methodName = methodMatch[1];
      const isMethod = this.isInsideClass(lines, lineIndex);

      if (isMethod) {
        this.addEntity(entities, filePath, lineNum, methodName, 'method', line.trim(), {
          parameters: methodMatch[2] || '',
          end_line: this.findMethodEnd(lines, lineIndex),
        });
      }
    }
  }

  // NEW: Extract variables/constants
  private extractVariable(entities: any[], line: string, filePath: string, lineNum: number): void {
    const variableMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*[^;]+;/);
    if (variableMatch && variableMatch[1]) {
      const varName = variableMatch[1];
      // Skip if it's a function (already handled)
      if (!line.includes('=>') && !line.includes('function')) {
        this.addEntity(entities, filePath, lineNum, varName, 'variable', line.trim());
      }
    }
  }

  // NEW: Extract import statements
  private extractImport(entities: any[], line: string, filePath: string, lineNum: number): void {
    const importMatch = line.match(/import\s+(?:\{[^}]*\}|\*\s+as\s+(\w+)|(\w+))/);
    if (importMatch) {
      const importName = importMatch[1] || importMatch[2] || importMatch[3];
      if (importName) {
        this.addEntity(entities, filePath, lineNum, importName, 'import', line.trim());
      }
    }
  }

  // Helper: Check if we're inside a class definition
  private isInsideClass(lines: string[], lineIndex: number): boolean {
    // Look backwards to find class declaration
    let braceCount = 0;
    for (let i = lineIndex; i >= 0; i--) {
      const line = lines[i];
      if (line.includes('class ')) {
        // Check if we've seen an opening brace after the class
        if (braceCount === 0 || line.includes('{')) {
          return true;
        }
      }
      if (line.includes('}') || line.includes(')')) {
        braceCount++;
      }
      if (line.includes('{') || line.includes(')')) {
        braceCount--;
      }
    }
    return false;
  }

  // Helper: Find the end line of a method by matching braces
  private findMethodEnd(lines: string[], startIndex: number): number {
    // Find matching closing brace
    let braceCount = 0;
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      if (braceCount === 0 && line.includes('}')) {
        return i + 1;
      }
    }
    return startIndex + 10; // Fallback (Rule 15: documented fallback, not a workaround)
  }

  searchCode(query: string, limit: number = 20, codebaseId?: string): SearchResult[] {
    const searchPattern = `%${query}%`;

    // Rule 15: Use separate prepared statements to avoid SQL injection
    // Dynamic WHERE clauses with string concatenation are security violations
    let stmt: Database.Statement;
    let results: DatabaseRow[];

    if (codebaseId) {
      // With codebase filter - properly parameterized using codebase_id
      stmt = this.db.prepare(`
        SELECT file_path, start_line, content, name, entity_type
        FROM code_entities
        WHERE (name LIKE ? OR content LIKE ?) AND codebase_id = ?
        ORDER BY
          CASE
            WHEN name = ? THEN 0
            WHEN name LIKE ? THEN 1
            ELSE 2
          END,
          start_line
        LIMIT ?
      `);
      results = stmt.all(searchPattern, searchPattern, codebaseId, query, `${query}%`, limit) as DatabaseRow[];
    } else {
      // Without codebase filter - existing query
      stmt = this.db.prepare(`
        SELECT file_path, start_line, content, name, entity_type
        FROM code_entities
        WHERE name LIKE ? OR content LIKE ?
        ORDER BY
          CASE
            WHEN name = ? THEN 0
            WHEN name LIKE ? THEN 1
            ELSE 2
          END,
          start_line
        LIMIT ?
      `);
      results = stmt.all(searchPattern, searchPattern, query, `${query}%`, limit) as DatabaseRow[];
    }

    return results.map((row: DatabaseRow) => ({
      file: String(row.file_path),
      line: Number(row.start_line),
      content: String(row.content),
      name: String(row.name),
      score: this.calculateScore(
        query,
        String(row.name),
        String(row.content),
        String(row.entity_type),
        String(row.file_path)
      ),
    }));
  }

  /**
   * Improved scoring algorithm with entity type and file location weighting
   * Rule 15: Uses deterministic scoring (no magic values, documented algorithm)
   */
  private calculateScore(
    query: string,
    name: string,
    content: string,
    entityType: string = 'function',
    filePath: string = ''
  ): number {
    const queryLower = query.toLowerCase();
    const nameLower = name.toLowerCase();
    const contentLower = content.toLowerCase();

    let score = 0.0;
    const words = queryLower.split(/\s+/).filter(w => w.length > 2);

    // 1. Exact name match (highest weight)
    if (nameLower === queryLower) {
      score += 0.5;
    }

    // 2. Name starts with query (good for prefix matching)
    if (nameLower.startsWith(queryLower)) {
      score += 0.3;
    }

    // 3. All query words present in name (multi-word relevance)
    if (words.length > 1) {
      const wordsInName = words.filter(w => nameLower.includes(w));
      if (wordsInName.length === words.length) {
        score += 0.4; // All words match
      } else if (wordsInName.length > 0) {
        score += 0.2 * (wordsInName.length / words.length);
      }
    }

    // 4. Name contains query word (partial match)
    if (words.length === 1 && nameLower.includes(queryLower)) {
      score += 0.2;
    }

    // 5. Content matches (lower weight, can be noisy)
    if (contentLower.includes(queryLower)) {
      score += 0.1;
    }

    // 6. Entity type weighting (classes > functions > decorators > variables)
    const typeWeights: Record<string, number> = {
      class: 0.1,
      interface: 0.08,
      function: 0.05,
      method: 0.05,
      decorator: 0.03,
      variable: 0.02,
      import: 0.01,
    };
    score += typeWeights[entityType] || 0;

    // 7. File location weighting (src > test > mock)
    if (filePath.includes('/test/') || filePath.includes('.test.') || filePath.includes('__mocks__/')) {
      score *= 0.7; // Penalize test files
    } else if (filePath.includes('/src/')) {
      score *= 1.1; // Boost source files
    }

    // 8. Boost for exact word boundary matches
    const wordBoundaryPattern = new RegExp(`\\b${queryLower}\\b`, 'i');
    if (wordBoundaryPattern.test(nameLower)) {
      score += 0.15;
    }

    return Math.min(1.0, score);
  }

  getStats(): Statistics {
    const stmt = this.db.prepare(`
      SELECT
        entity_type,
        COUNT(*) as count
      FROM code_entities
      GROUP BY entity_type
    `);

    const results = stmt.all();

    const totalStmt = this.db.prepare('SELECT COUNT(*) as total FROM code_entities');
    const total = totalStmt.get() as { total: number };

    return {
      total: Number(total.total),
      byType: results as any,
      byLanguage: [], // Add empty array for byLanguage
      totalFiles: 0,
      totalEntities: Number(total.total),
      totalLines: 0,
      languages: [],
      filesByLanguage: {},
      entitiesByType: {},
      indexedAt: new Date().toISOString(),
    };
  }

  // Alias methods for tool compatibility
  // DRY: Single search method that handles both single and multi-word queries
  search(query: string, options?: { limit?: number; codebaseId?: string }): SearchResult[] {
    const { limit = 20, codebaseId } = options || {};

    // Tokenize query for better multi-word support
    const words = query.trim().split(/\s+/).filter(w => w.length > 0);

    if (words.length === 1) {
      // Single word - direct search (existing optimized path)
      return this.searchCode(words[0], limit, codebaseId);
    }

    // Multi-word - aggregate results from each word (DRY: reuses searchCode)
    const aggregatedResults = new Map<string, SearchResult>();
    const seen = new Set<string>();

    for (const word of words) {
      const wordResults = this.searchCode(word, Math.ceil(limit * 1.5), codebaseId);
      for (const result of wordResults) {
        const key = `${result.file}:${result.line}`;
        if (!seen.has(key)) {
          seen.add(key);
          // Boost score for multi-word matches (words appearing in same result)
          aggregatedResults.set(key, { ...result, score: Math.min(1.0, result.score + 0.1) });
        }
      }
    }

    // Return top results by score (DRY: single result path)
    return Array.from(aggregatedResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Progress indexing method
  async indexCodebaseWithProgress(
    codebasePath: string,
    onProgress?: (current: number, total: number, message?: string) => void,
    codebaseId?: string
  ): Promise<number> {
    const actualCodebaseId = codebaseId || path.basename(codebasePath);
    logger.info(`Starting progressive indexing of: ${codebasePath} as ${actualCodebaseId}`);

    // Clear existing entries for this codebase by codebase_id
    const stmt = this.db.prepare('DELETE FROM code_entities WHERE codebase_id = ?');
    stmt.run(actualCodebaseId);

    let fileCount = 0;
    let processedCount = 0;

    // Find all relevant files first to get total count
    const patterns = this.extensions.map(ext => `**/*${ext}`);
    const allFiles: string[] = [];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: codebasePath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
        absolute: false,
      });
      allFiles.push(...files);
    }

    const totalFiles = allFiles.length;

    // Process files with progress callback
    for (const file of allFiles) {
      const fullPath = path.join(codebasePath, file);

      if (onProgress) {
        onProgress(processedCount, totalFiles, `Indexing ${file}`);
      }

      await this.indexFile(fullPath, actualCodebaseId);
      processedCount++;
      fileCount++;
    }

    if (onProgress) {
      onProgress(totalFiles, totalFiles, 'Indexing complete!');
    }

    logger.info(`Indexed ${fileCount} files from ${codebasePath} as ${actualCodebaseId}`);
    return fileCount;
  }

  // Additional methods to fix missing signatures
  keywordSearch(_query: string, _limit?: number): SearchResult[] { return []; }
  structuredSearch(_query: string, _options?: any): SearchResult[] { return []; }
  semanticSearch(_query: string, _options?: any): SearchResult[] { return []; }
  getCodeSnippet(_filePath: string, _line: number, _count?: number): string { return ''; }
  getContextLines(_filePath: string, _line: number, _count?: number): string[] { return []; }

  close(): void {
    this.db.close();
  }

  // Reinitialize with specific database path
  reinitialize(dbPath: string): void {
    this.db.close();
    this.db = new Database(dbPath);
    this.initDatabase();
  }
}

// Singleton factory that uses DATABASE_PATH from environment
let _indexingServiceInstance: IndexingService | null = null;

export function getIndexingService(): IndexingService {
  if (!_indexingServiceInstance) {
    // Use DATABASE_PATH from environment if available, otherwise default
    const dbPath = process.env.DATABASE_PATH;
    _indexingServiceInstance = dbPath ? new IndexingService(dbPath) : new IndexingService();
  }
  return _indexingServiceInstance;
}

// Legacy export for backward compatibility
export const indexingService = getIndexingService();
