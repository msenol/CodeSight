/**
 * Indexing Service - Simple JavaScript implementation
 * (Rust FFI will be integrated later)
 */
import * as fs from 'fs/promises';
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
        indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_name ON code_entities(name);
      CREATE INDEX IF NOT EXISTS idx_file_path ON code_entities(file_path);
      CREATE INDEX IF NOT EXISTS idx_entity_type ON code_entities(entity_type);
    `);
  }

  async indexCodebase(codebasePath: string): Promise<number> {
    logger.info(`Starting indexing of: ${codebasePath}`);

    // Clear existing entries for this codebase
    const stmt = this.db.prepare('DELETE FROM code_entities WHERE file_path LIKE ?');
    stmt.run(`${codebasePath}%`);

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
        await this.indexFile(fullPath);
        fileCount++;
      }
    }

    logger.info(`Indexed ${fileCount} files from ${codebasePath}`);
    return fileCount;
  }

  async indexFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const entities = this.parseFile(filePath, content);

      const insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO code_entities (id, name, file_path, entity_type, start_line, end_line, content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
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

      // Extract functions
      const functionMatch = line.match(
        /(?:async]+)?function]+(\w+)|(?:const|let|var)]+(\w+)]*=]*(?:async]*)?\(/,
      );
      if (functionMatch) {
        const name = functionMatch[1] ?? functionMatch[2];
        if (name) {
          entities.push({
            id: `${filePath}:${lineNum}:${name}`,
            name,
            file_path: filePath,
            entity_type: 'function',
            start_line: lineNum,
            end_line: lineNum + 5, // Approximate
            content: line.trim(),
          });
        }
      }

      // Extract classes
      const classMatch = line.match(/(?:export]+)?(?:default]+)?class]+(\w+)/);
      if (classMatch && classMatch[1]) {
        entities.push({
          id: `${filePath}:${lineNum}:${classMatch[1]}`,
          name: classMatch[1],
          file_path: filePath,
          entity_type: 'class',
          start_line: lineNum,
          end_line: lineNum + 10, // Approximate
          content: line.trim(),
        });
      }

      // Extract arrow functions assigned to const
      const arrowMatch = line.match(
        /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]+)\s*=>/,
      );
      if (arrowMatch && arrowMatch[1]) {
        entities.push({
          id: `${filePath}:${lineNum}:${arrowMatch[1]}`,
          name: arrowMatch[1],
          file_path: filePath,
          entity_type: 'function',
          start_line: lineNum,
          end_line: lineNum + 3, // Approximate
          content: line.trim(),
        });
      }

      // Extract interfaces (TypeScript)
      const interfaceMatch = line.match(/(?:export]+)?interface]+(\w+)/);
      if (interfaceMatch && interfaceMatch[1]) {
        entities.push({
          id: `${filePath}:${lineNum}:${interfaceMatch[1]}`,
          name: interfaceMatch[1],
          file_path: filePath,
          entity_type: 'interface',
          start_line: lineNum,
          end_line: lineNum + 5, // Approximate
          content: line.trim(),
        });
      }

      // Extract types (TypeScript)
      const typeMatch = line.match(/(?:export]+)?type]+(\w+)]*=/);
      if (typeMatch && typeMatch[1]) {
        entities.push({
          id: `${filePath}:${lineNum}:${typeMatch[1]}`,
          name: typeMatch[1],
          file_path: filePath,
          entity_type: 'type',
          start_line: lineNum,
          end_line: lineNum + 2, // Approximate
          content: line.trim(),
        });
      }
    });

    return entities;
  }

  searchCode(query: string, limit: number = 20): SearchResult[] {
    const searchPattern = `%${query}%`;

    const stmt = this.db.prepare(`
      SELECT file_path, start_line, content, name
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

    const results = stmt.all(searchPattern, searchPattern, query, `${query}%`, limit);

    return results.map((row: DatabaseRow) => ({
      file: String(row.file_path),
      line: Number(row.start_line),
      content: String(row.content),
      name: String(row.name),
      score: this.calculateScore(query, String(row.name), String(row.content)),
    }));
  }

  private calculateScore(query: string, name: string, content: string): number {
    const queryLower = query.toLowerCase();
    const nameLower = name.toLowerCase();
    const contentLower = content.toLowerCase();

    // Exact name match
    if (nameLower === queryLower) {return 1.0;}

    // Name starts with query
    if (nameLower.startsWith(queryLower)) {return 0.9;}

    // Name contains query
    if (nameLower.includes(queryLower)) {return 0.8;}

    // Content contains query
    if (contentLower.includes(queryLower)) {return 0.6;}

    return 0.3;
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
  search(query: string, options?: { limit?: number }): SearchResult[] {
    return this.searchCode(query, options?.limit || 20);
  }

  // Progress indexing method
  async indexCodebaseWithProgress(
    codebasePath: string,
    onProgress?: (current: number, total: number, message?: string) => void
  ): Promise<number> {
    logger.info(`Starting progressive indexing of: ${codebasePath}`);

    // Clear existing entries for this codebase
    const stmt = this.db.prepare('DELETE FROM code_entities WHERE file_path LIKE ?');
    stmt.run(`${codebasePath}%`);

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

      await this.indexFile(fullPath);
      processedCount++;
      fileCount++;
    }

    if (onProgress) {
      onProgress(totalFiles, totalFiles, 'Indexing complete!');
    }

    logger.info(`Indexed ${fileCount} files from ${codebasePath}`);
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
}

export const indexingService = new IndexingService();
