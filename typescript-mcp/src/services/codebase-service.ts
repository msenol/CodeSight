import type { CodebaseInfo, FileInfo, SearchResult } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { DatabaseSearchService } from './database-search-service.js';
import { parse } from '@typescript-eslint/typescript-estree';
import * as acorn from 'acorn';

 
 
 
 
export interface CodebaseService {
   
  addCodebase(_name: string, _path: string, _languages: string[]): Promise<string>;
   
  removeCodebase(_id: string): Promise<void>;
   
  getCodebase(_id: string): Promise<CodebaseInfo | null>;
  listCodebases(): Promise<CodebaseInfo[]>;
   
  indexCodebase(_id: string): Promise<void>;
   
  searchCode(_query: string, _codebaseId: string): Promise<SearchResult[]>;
   
  getFileInfo(_filePath: string, _codebaseId: string): Promise<FileInfo | null>;
   
  getCodeEntity(_entityId: string): Promise<unknown>;
   
  getCodeLines(_filePath: string, _startLine: number, _endLine: number): Promise<string[]>;
   
  getFiles(_codebaseId: string): Promise<string[]>;
   
  getCodeSnippet(_filePath: string, _startLine: number, _endLine: number): Promise<string>;
}

export class DefaultCodebaseService implements CodebaseService {
  private codebases = new Map<string, CodebaseInfo>();
  private searchService: DatabaseSearchService;
  private aliases: Map<string, string>;

  constructor() {
    this.searchService = new DatabaseSearchService();
    this.aliases = this.loadAliases();
  }

  private loadAliases(): Map<string, string> {
    const aliasMap = new Map<string, string>();

    // Load aliases from environment variable (JSON format)
    // Example: {"axon": "/home/msenol/Projects/Axon", "codesight": "/home/msenol/Projects/CodeSight"}
    const aliasesEnv = process.env.CODEBASE_ALIASES;
    if (aliasesEnv) {
      try {
        const parsed = JSON.parse(aliasesEnv);
        for (const [name, path] of Object.entries(parsed)) {
          aliasMap.set(name, path as string);
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    return aliasMap;
  }

  async addCodebase(name: string, path: string, languages: string[]): Promise<string> {
    // Use the provided name as the ID for consistency
    // This ensures the codebase can be found by the same ID used in indexing
    const id = name;
    const codebase: CodebaseInfo = {
      id,
      name,
      path,
      languages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fileCount: 0,
      indexedAt: new Date().toISOString(),
      status: 'indexed',
    };
    this.codebases.set(id, codebase);
    return id;
  }

  async removeCodebase(id: string): Promise<void> {
    this.codebases.delete(id);
  }

  async getCodebase(id: string): Promise<CodebaseInfo | null> {
    // Check if we have it in memory
    const memoryCodebase = this.codebases.get(id);
    if (memoryCodebase) {
      return memoryCodebase;
    }

    // Check for codebase aliases first
    const aliasPath = this.aliases.get(id);
    if (aliasPath) {
      const codebase: CodebaseInfo = {
        id,
        name: id,
        path: aliasPath,
        languages: ['typescript', 'javascript'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileCount: 0,
        indexedAt: new Date().toISOString(),
        status: 'indexed',
      };
      this.codebases.set(id, codebase);
      return codebase;
    }

    // Handle "default" codebase ID - use environment variable or current working directory
    if (id === 'default' || id === 'Default') {
      // Check for DEFAULT_CODEBASE_PATH environment variable first
      const defaultPath = process.env.DEFAULT_CODEBASE_PATH || process.cwd();
      // Using logger for debugging instead of console
      // TODO: Replace with proper logger when available
      // logger.debug('[DEBUG] Using default codebase path:', defaultPath);

      const codebase: CodebaseInfo = {
        id: 'default',
        name: process.env.DEFAULT_CODEBASE_NAME || 'Default Project',
        path: defaultPath,
        languages: ['typescript', 'javascript'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileCount: 0,
        indexedAt: new Date().toISOString(),
        status: 'indexed',
      };
      this.codebases.set('default', codebase);
      return codebase;
    }

    // For backward compatibility, accept file paths as codebase IDs
    try {
      await fs.access(id);
      // Create a temporary codebase info for the path
      const codebase: CodebaseInfo = {
        id,
        name: path.basename(id),
        path: id,
        languages: ['typescript', 'javascript'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileCount: 0,
        indexedAt: new Date().toISOString(),
        status: 'indexed',
      };
      this.codebases.set(id, codebase);
      return codebase;
    } catch {
      // Not a valid path, check memory only
      // TODO: Replace with proper logger when available
      // logger.debug('[DEBUG] Codebase not found for ID:', id);
      return null;
    }
  }

  async listCodebases(): Promise<CodebaseInfo[]> {
    return Array.from(this.codebases.values());
  }

  async indexCodebase(id: string): Promise<void> {
    const codebase = this.codebases.get(id);
    if (!codebase) {
      throw new Error(`Codebase with id ${id} not found`);
    }

    try {
      // Check if path exists
      await fs.access(codebase.path);

      // Count files in the codebase
      const files = await glob('**/*', {
        cwd: codebase.path,
        absolute: false,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**'],
      });

      // Filter only actual files (not directories)
      const actualFiles = [];
      for (const file of files) {
        const fullPath = path.join(codebase.path, file);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isFile()) {
            actualFiles.push(file);
          }
        } catch {
          // Skip files that can't be accessed
          continue;
        }
      }

      codebase.fileCount = actualFiles.length;
      codebase.indexedAt = new Date().toISOString();
      codebase.updatedAt = new Date().toISOString();
      codebase.status = 'indexed';
    } catch (error) {
      codebase.status = 'error';
      throw new Error(
        `Failed to index codebase: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async searchCode(query: string, codebaseId: string): Promise<SearchResult[]> {
    const codebase = this.codebases.get(codebaseId);
    if (!codebase) {
      throw new Error(`Codebase with id ${codebaseId} not found`);
    }

    try {
      // Check if path exists
      await fs.access(codebase.path);

      // Use SearchService for actual search
      const searchOptions = {
        codebase_id: codebase.path, // Use path as codebase_id for SearchService
        max_results: 50,
        include_tests: false,
        file_types:
          codebase.languages.length > 0 ? this.getFileExtensions(codebase.languages) : undefined,
      };

      return await this.searchService.keywordSearch(query, searchOptions);
    } catch (error) {
      throw new Error(
        `Failed to search codebase: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private getFileExtensions(languages: string[]): string[] {
    const extensionMap: Record<string, string[]> = {
      typescript: ['ts', 'tsx'],
      javascript: ['js', 'jsx'],
      python: ['py'],
      java: ['java'],
      cpp: ['cpp', 'cc', 'cxx', 'h', 'hpp'],
      c: ['c', 'h'],
      csharp: ['cs'],
      go: ['go'],
      rust: ['rs'],
      php: ['php'],
      ruby: ['rb'],
    };

    const extensions: string[] = [];
    for (const lang of languages) {
      const exts = extensionMap[lang.toLowerCase()];
      if (exts) {
        extensions.push(...exts);
      }
    }

    return extensions.length > 0 ? extensions : ['ts', 'tsx', 'js', 'jsx']; // Default to TypeScript/JavaScript
  }

  async getFileInfo(filePath: string, codebaseId: string): Promise<FileInfo | null> {
    const codebase = this.codebases.get(codebaseId);
    if (!codebase) {
      throw new Error(`Codebase with id ${codebaseId} not found`);
    }

    try {
      // Resolve absolute path
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(codebase.path, filePath);

      // Check if file exists and get stats
      const stats = await fs.stat(absolutePath);

      if (!stats.isFile()) {
        return null;
      }

      const fileName = path.basename(absolutePath);
      const language = this.detectLanguageFromExtension(path.extname(absolutePath));

      return {
        path: filePath,
        name: fileName,
        size: stats.size,
        language,
        lastModified: stats.mtime.toISOString(),
      };
    } catch {
      // File doesn't exist or can't be accessed
      return null;
    }
  }

  private detectLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
    };

    return languageMap[extension.toLowerCase()] || 'unknown';
  }

  async getCodeEntity(entityId: string): Promise<any> {
    // Parse entityId to extract file path and entity name
    // Expected format: "file_path:entity_name" or "file_path:line_number"
    const parts = entityId.split(':');
    if (parts.length < 2) {
      throw new Error(`Invalid entity ID format: ${entityId}`);
    }

    const filePath = parts[0];
    const entityIdentifier = parts[1];

    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      const extension = path.extname(filePath);

      // Parse based on file type
      if (
        extension === '.ts' ||
        extension === '.tsx' ||
        extension === '.js' ||
        extension === '.jsx'
      ) {
        return await this.parseTypeScriptEntity(content, filePath, entityIdentifier);
      } else {
        // For other file types, try to find entity by line number or simple text search
        return await this.parseGenericEntity(content, filePath, entityIdentifier);
      }
    } catch (error) {
      throw new Error(
        `Failed to get code entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async parseTypeScriptEntity(
    content: string,
    filePath: string,
    entityIdentifier: string,
  ): Promise<any> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      const entity = this.findEntityInAST(ast, entityIdentifier);
      if (entity) {
        const typedEntity = entity as {
          name: string;
          type: string;
          start_line?: number;
          end_line?: number;
          parameters?: unknown[];
          return_type?: string;
        };
        return {
          id: `${filePath}:${entityIdentifier}`,
          name: typedEntity.name,
          type: typedEntity.type,
          file_path: filePath,
          start_line: typedEntity.start_line || 0,
          end_line: typedEntity.end_line || 0,
          parameters: typedEntity.parameters || [],
          return_type: typedEntity.return_type || 'unknown',
        };
      }
    } catch (error) {
      // Fallback to Acorn for JavaScript files
      try {
        const ast = acorn.parse(content, {
          ecmaVersion: 2022,
          sourceType: 'module',
          locations: true,
        });

        const entity = this.findEntityInAcornAST(ast, entityIdentifier);
        if (entity) {
          const typedEntity = entity as {
            name: string;
            type: string;
            start_line?: number;
            end_line?: number;
          };
          return {
            id: `${filePath}:${entityIdentifier}`,
            name: typedEntity.name,
            type: typedEntity.type,
            file_path: filePath,
            start_line: typedEntity.start_line || 0,
            end_line: typedEntity.end_line || 0,
          };
        }
      } catch (acornError) {
        // If both parsers fail, fall back to generic parsing
      }
    }

    // Fallback to generic entity parsing
    return await this.parseGenericEntity(content, filePath, entityIdentifier);
  }

  private findEntityInAST(node: unknown, entityIdentifier: string): unknown | null {
    const nodeObj = node as Record<string, unknown>;
    if (!node || typeof node !== 'object') { return null; }

    // Check if this node matches our entity
    if (
      (nodeObj.type === 'FunctionDeclaration' ||
        nodeObj.type === 'ClassDeclaration' ||
        nodeObj.type === 'InterfaceDeclaration' ||
        nodeObj.type === 'TypeAliasDeclaration') &&
      nodeObj.id &&
      (nodeObj.id as Record<string, unknown>).name === entityIdentifier
    ) {
      return {
        name: (nodeObj.id as Record<string, unknown>).name,
        type: (nodeObj.type as string).replace('Declaration', '').toLowerCase(),
        start_line: ((nodeObj.loc as Record<string, unknown>).start as Record<string, unknown>)?.line || 1,
        end_line: ((nodeObj.loc as Record<string, unknown>).end as Record<string, unknown>)?.line || 1,
        parameters: this.extractParameters(node),
        return_type: this.extractReturnType(node),
      };
    }

    // Recursively search child nodes
    for (const key in nodeObj) {
      if (key !== 'parent' && nodeObj[key]) {
        if (Array.isArray(nodeObj[key])) {
          for (const child of nodeObj[key]) {
            const result = this.findEntityInAST(child, entityIdentifier);
            if (result) {return result;}
          }
        } else if (typeof nodeObj[key] === 'object') {
          const result = this.findEntityInAST(nodeObj[key], entityIdentifier);
          if (result) {return result;}
        }
      }
    }

    return null;
  }

  private findEntityInAcornAST(ast: unknown, entityIdentifier: string): unknown | null {
    let foundEntity: unknown = null;

    const visitor = {
      FunctionDeclaration: (node: unknown) => {
        const nodeObj = node as Record<string, unknown>;
        if (nodeObj.id && (nodeObj.id as Record<string, unknown>).name === entityIdentifier) {
          foundEntity = {
            name: (nodeObj.id as Record<string, unknown>).name,
            type: 'function',
            start_line: ((nodeObj.loc as Record<string, unknown>).start as Record<string, unknown>)?.line || 1,
            end_line: ((nodeObj.loc as Record<string, unknown>).end as Record<string, unknown>)?.line || 1,
          };
        }
      },
      ClassDeclaration: (node: unknown) => {
        const nodeObj = node as Record<string, unknown>;
        if (nodeObj.id && (nodeObj.id as Record<string, unknown>).name === entityIdentifier) {
          foundEntity = {
            name: (nodeObj.id as Record<string, unknown>).name,
            type: 'class',
            start_line: ((nodeObj.loc as Record<string, unknown>).start as Record<string, unknown>)?.line || 1,
            end_line: ((nodeObj.loc as Record<string, unknown>).end as Record<string, unknown>)?.line || 1,
          };
        }
      },
    };

    // Note: acorn-walk is not imported, so we'll do a simple traversal
    this.simpleASTWalk(ast, visitor);
    return foundEntity;
  }

  private simpleASTWalk(node: unknown, visitor: Record<string, unknown>): void {
    const nodeObj = node as Record<string, unknown>;
    if (!node || typeof node !== 'object') {return;}

    const nodeType = nodeObj.type as string;
    if (visitor[nodeType]) {
      (visitor[nodeType] as (n: unknown) => void)(node);
    }

    for (const key in nodeObj) {
      if (key !== 'parent' && nodeObj[key]) {
        const value = nodeObj[key];
        if (Array.isArray(value)) {
          for (const child of value) {
            this.simpleASTWalk(child, visitor);
          }
        } else if (typeof value === 'object') {
          this.simpleASTWalk(value, visitor);
        }
      }
    }
  }

  private extractParameters(node: unknown): string[] {
    if (!(node as Record<string, unknown>).params) {return [];}

    return ((node as Record<string, unknown>).params as unknown[] || []).map((param: unknown) => {
      const paramObj = param as Record<string, unknown>;
      if (paramObj.type === 'Identifier') {
        return paramObj.name as string;
      } else if (paramObj.type === 'AssignmentPattern' && (paramObj.left as Record<string, unknown>).type === 'Identifier') {
        return (paramObj.left as Record<string, unknown>).name as string;
      }
      return 'unknown';
    });
  }

  private extractReturnType(node: unknown): string {
    const nodeObj = node as Record<string, unknown>;
    if (nodeObj.returnType && (nodeObj.returnType as Record<string, unknown>).typeAnnotation) {
      // This is a simplified extraction - in a real implementation,
      // you'd want to properly parse the TypeScript type annotation
      return 'typed';
    }
    return 'unknown';
  }

  private async parseGenericEntity(
    content: string,
    filePath: string,
    entityIdentifier: string,
  ): Promise<any> {
    const lines = content.split('\n');

    // If entityIdentifier is a number, treat it as a line number
    const lineNumber = parseInt(entityIdentifier, 10);
    if (!isNaN(lineNumber) && lineNumber > 0 && lineNumber <= lines.length) {
      const line = lines[lineNumber - 1];
      return {
        id: `${filePath}:${entityIdentifier}`,
        name: `Line ${lineNumber}`,
        type: 'line',
        file_path: filePath,
        start_line: lineNumber,
        end_line: lineNumber,
        content: line.trim(),
      };
    }

    // Otherwise, search for the entity by name
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(entityIdentifier)) {
        return {
          id: `${filePath}:${entityIdentifier}`,
          name: entityIdentifier,
          type: 'text_match',
          file_path: filePath,
          start_line: i + 1,
          end_line: i + 1,
          content: line.trim(),
        };
      }
    }

    // Entity not found
    throw new Error(`Entity '${entityIdentifier}' not found in file '${filePath}'`);
  }

  async getCodeLines(filePath: string, startLine: number, endLine: number): Promise<string[]> {
    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Validate line numbers
      const start = Math.max(1, startLine) - 1; // Convert to 0-based index
      const end = Math.min(lines.length, endLine);

      if (start >= lines.length || start < 0) {
        return [];
      }

      return lines.slice(start, end);
    } catch (error) {
      throw new Error(
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getFiles(codebaseId: string): Promise<string[]> {
    const codebase = this.codebases.get(codebaseId);
    if (!codebase) {
      throw new Error(`Codebase with id ${codebaseId} not found`);
    }

    try {
      // Check if path exists
      await fs.access(codebase.path);

      // Get all files using glob
      const files = await glob('**/*', {
        cwd: codebase.path,
        absolute: false,
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/coverage/**',
          '**/.next/**',
          '**/target/**',
          '**/bin/**',
          '**/obj/**',
        ],
      });

      // Filter only actual files (not directories)
      const actualFiles = [];
      for (const file of files) {
        const fullPath = path.join(codebase.path, file);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isFile()) {
            actualFiles.push(file);
          }
        } catch {
          // Skip files that can't be accessed
          continue;
        }
      }

      return actualFiles;
    } catch (error) {
      throw new Error(
        `Failed to get files from codebase: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getCodeSnippet(filePath: string, startLine: number, endLine: number): Promise<string> {
    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Validate line numbers
      const start = Math.max(1, startLine) - 1; // Convert to 0-based index
      const end = Math.min(lines.length, endLine);

      if (start >= lines.length || start < 0) {
        return '';
      }

      return lines.slice(start, end).join('\n');
    } catch (error) {
      throw new Error(
        `Failed to read code snippet from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export const codebaseService = new DefaultCodebaseService();
export default codebaseService;
