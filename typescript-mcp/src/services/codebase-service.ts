import type { CodebaseInfo, FileInfo, SearchResult } from '../types/index.js';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { DefaultSearchService } from './search-service.js';
import { parse } from '@typescript-eslint/typescript-estree';
import * as acorn from 'acorn';

export interface CodebaseService {
  addCodebase(name: string, path: string, languages: string[]): Promise<string>;
  removeCodebase(id: string): Promise<void>;
  getCodebase(id: string): Promise<CodebaseInfo | null>;
  listCodebases(): Promise<CodebaseInfo[]>;
  indexCodebase(id: string): Promise<void>;
  searchCode(query: string, codebaseId: string): Promise<SearchResult[]>;
  getFileInfo(filePath: string, codebaseId: string): Promise<FileInfo | null>;
  getCodeEntity(entityId: string): Promise<any>;
  getCodeLines(filePath: string, startLine: number, endLine: number): Promise<string[]>;
  getFiles(codebaseId: string): Promise<string[]>;
  getCodeSnippet(filePath: string, startLine: number, endLine: number): Promise<string>;
}

export class DefaultCodebaseService implements CodebaseService {
  private codebases = new Map<string, CodebaseInfo>();
  private searchService: DefaultSearchService;

  constructor() {
    this.searchService = new DefaultSearchService();
  }

  async addCodebase(name: string, path: string, languages: string[]): Promise<string> {
    const id = `codebase_${Date.now()}`;
    const codebase: CodebaseInfo = {
      id,
      name,
      path,
      languages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fileCount: 0,
      indexedAt: null,
      status: 'active'
    };
    this.codebases.set(id, codebase);
    return id;
  }

  async removeCodebase(id: string): Promise<void> {
    this.codebases.delete(id);
  }

  async getCodebase(id: string): Promise<CodebaseInfo | null> {
    return this.codebases.get(id) || null;
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
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/coverage/**'
        ]
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
        } catch (error) {
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
      throw new Error(`Failed to index codebase: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        file_types: codebase.languages.length > 0 ? this.getFileExtensions(codebase.languages) : undefined
      };
      
      return await this.searchService.keywordSearch(query, searchOptions);
    } catch (error) {
      throw new Error(`Failed to search codebase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getFileExtensions(languages: string[]): string[] {
    const extensionMap: Record<string, string[]> = {
      'typescript': ['ts', 'tsx'],
      'javascript': ['js', 'jsx'],
      'python': ['py'],
      'java': ['java'],
      'cpp': ['cpp', 'cc', 'cxx', 'h', 'hpp'],
      'c': ['c', 'h'],
      'csharp': ['cs'],
      'go': ['go'],
      'rust': ['rs'],
      'php': ['php'],
      'ruby': ['rb']
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
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(codebase.path, filePath);
      
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
        lastModified: stats.mtime.toISOString()
      };
    } catch (error) {
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
      '.sass': 'sass'
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
      if (extension === '.ts' || extension === '.tsx' || extension === '.js' || extension === '.jsx') {
        return await this.parseTypeScriptEntity(content, filePath, entityIdentifier);
      } else {
        // For other file types, try to find entity by line number or simple text search
        return await this.parseGenericEntity(content, filePath, entityIdentifier);
      }
    } catch (error) {
      throw new Error(`Failed to get code entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async parseTypeScriptEntity(content: string, filePath: string, entityIdentifier: string): Promise<any> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module'
      });
      
      const entity = this.findEntityInAST(ast, entityIdentifier);
      if (entity) {
        return {
          id: `${filePath}:${entityIdentifier}`,
          name: entity.name,
          type: entity.type,
          file_path: filePath,
          start_line: entity.start_line,
          end_line: entity.end_line,
          parameters: entity.parameters || [],
          return_type: entity.return_type || 'unknown'
        };
      }
    } catch (error) {
      // Fallback to Acorn for JavaScript files
      try {
        const ast = acorn.parse(content, {
          ecmaVersion: 2022,
          sourceType: 'module',
          locations: true
        });
        
        const entity = this.findEntityInAcornAST(ast, entityIdentifier);
        if (entity) {
          return {
            id: `${filePath}:${entityIdentifier}`,
            name: entity.name,
            type: entity.type,
            file_path: filePath,
            start_line: entity.start_line,
            end_line: entity.end_line
          };
        }
      } catch (acornError) {
        // If both parsers fail, fall back to generic parsing
      }
    }
    
    // Fallback to generic entity parsing
    return await this.parseGenericEntity(content, filePath, entityIdentifier);
  }
  
  private findEntityInAST(node: any, entityIdentifier: string): any | null {
    if (!node || typeof node !== 'object') return null;
    
    // Check if this node matches our entity
    if ((node.type === 'FunctionDeclaration' || 
         node.type === 'ClassDeclaration' || 
         node.type === 'InterfaceDeclaration' ||
         node.type === 'TypeAliasDeclaration') && 
        node.id && node.id.name === entityIdentifier) {
      
      return {
        name: node.id.name,
        type: node.type.replace('Declaration', '').toLowerCase(),
        start_line: node.loc?.start?.line || 1,
        end_line: node.loc?.end?.line || 1,
        parameters: this.extractParameters(node),
        return_type: this.extractReturnType(node)
      };
    }
    
    // Recursively search child nodes
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            const result = this.findEntityInAST(child, entityIdentifier);
            if (result) return result;
          }
        } else if (typeof node[key] === 'object') {
          const result = this.findEntityInAST(node[key], entityIdentifier);
          if (result) return result;
        }
      }
    }
    
    return null;
  }
  
  private findEntityInAcornAST(ast: any, entityIdentifier: string): any | null {
    let foundEntity: any = null;
    
    const visitor = {
      FunctionDeclaration: (node: any) => {
        if (node.id && node.id.name === entityIdentifier) {
          foundEntity = {
            name: node.id.name,
            type: 'function',
            start_line: node.loc.start.line,
            end_line: node.loc.end.line
          };
        }
      },
      ClassDeclaration: (node: any) => {
        if (node.id && node.id.name === entityIdentifier) {
          foundEntity = {
            name: node.id.name,
            type: 'class',
            start_line: node.loc.start.line,
            end_line: node.loc.end.line
          };
        }
      }
    };
    
    // Note: acorn-walk is not imported, so we'll do a simple traversal
    this.simpleASTWalk(ast, visitor);
    return foundEntity;
  }
  
  private simpleASTWalk(node: any, visitor: any): void {
    if (!node || typeof node !== 'object') return;
    
    if (visitor[node.type]) {
      visitor[node.type](node);
    }
    
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.simpleASTWalk(child, visitor);
          }
        } else if (typeof node[key] === 'object') {
          this.simpleASTWalk(node[key], visitor);
        }
      }
    }
  }
  
  private extractParameters(node: any): string[] {
    if (!node.params) return [];
    
    return node.params.map((param: any) => {
      if (param.type === 'Identifier') {
        return param.name;
      } else if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
        return param.left.name;
      }
      return 'unknown';
    });
  }
  
  private extractReturnType(node: any): string {
    if (node.returnType && node.returnType.typeAnnotation) {
      // This is a simplified extraction - in a real implementation,
      // you'd want to properly parse the TypeScript type annotation
      return 'typed';
    }
    return 'unknown';
  }
  
  private async parseGenericEntity(content: string, filePath: string, entityIdentifier: string): Promise<any> {
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
        content: line.trim()
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
          content: line.trim()
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
      throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          '**/obj/**'
        ]
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
        } catch (error) {
          // Skip files that can't be accessed
          continue;
        }
      }
      
      return actualFiles;
    } catch (error) {
      throw new Error(`Failed to get files from codebase: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error(`Failed to read code snippet from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const codebaseService = new DefaultCodebaseService();
export default codebaseService;