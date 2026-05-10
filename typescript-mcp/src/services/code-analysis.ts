/**
 * Code Analysis Service - Phase 4.1
 * Provides comprehensive code analysis capabilities
 * Uses real file reading and complexity calculation
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { complexityService } from './complexity-service.js';
import { getIndexingService } from './indexing-service.js';
import { logger } from './logger.js';

export interface CodeAnalysisResult {
  complexity?: {
    overall_score: number;
    functions: Array<{
      name: string;
      cyclomatic_complexity: number;
      line_number: number;
      lines_of_code: number;
      test_coverage?: number;
      has_documentation: boolean;
      is_public?: boolean;
    }>;
  };

  classes?: Array<{
    name: string;
    lines_of_code: number;
    method_count: number;
    dependency_count: number;
    line_number: number;
    file_path: string;
  }>;

  testing?: {
    coverage_percentage: number;
    test_count: number;
  };

  duplicates?: Array<{
    description: string;
    duplicate_lines: number;
    similarity: number;
    locations: Array<{
      file: string;
      line: number;
    }>;
  }>;

  variables?: {
    poorly_named: Array<{
      name: string;
      line_number: number;
      original_code: string;
      suggested_code: string;
    }>;
  };

  code_smells?: Array<{
    name: string;
    description: string;
    location: {
      file: string;
      line: number;
    };
  }>;

  nesting?: Array<{
    depth: number;
    line: number;
  }>;

  imports?: Array<{
    module: string;
  }>;

  functions?: Array<{
    name: string;
    line_number: number;
    has_documentation: boolean;
    is_public: boolean;
  }>;
}

/**
 * Code Analysis Service
 * Provides real static code analysis using file reading + complexity calculation
 */
export class CodeAnalysisService {
  async analyzeSnippet(snippet: string, _codebaseId: string): Promise<CodeAnalysisResult> {
    const lines = snippet.split('\n');
    const functions = this.extractFunctionData(snippet, lines);
    const smells = this.detectCodeSmells(snippet, lines, '<snippet>');

    const overallScore = this.calculateOverallScore(functions);

    return {
      complexity: {
        overall_score: overallScore,
        functions,
      },
      code_smells: smells,
      nesting: this.detectNesting(snippet, lines),
      imports: this.extractImports(snippet, lines),
      functions: functions.map(f => ({
        name: f.name,
        line_number: f.line_number,
        has_documentation: f.has_documentation,
        is_public: f.is_public,
      })),
    };
  }

  async analyzeFile(filePath: string, codebaseId: string): Promise<CodeAnalysisResult> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const ext = path.extname(filePath);
      const language = this.detectLanguage(ext);

      // Get functions from DB entities if available
      let functions = this.extractFunctionData(content, lines);

      // Try to get more accurate data from DB
      try {
        const db = getIndexingService().db;
        const entities = db
          .prepare(
            `SELECT name, start_line, end_line, entity_type, content
             FROM code_entities
             WHERE LOWER(codebase_id) = LOWER(?)
               AND file_path = ?
               AND entity_type IN ('function', 'method')
             ORDER BY start_line`,
          )
          .all(codebaseId, filePath) as Array<{
          name: string;
          start_line: number;
          end_line: number;
          entity_type: string;
          content: string;
        }>;

        if (entities.length > 0) {
          functions = entities.map(entity => {
            const entityLines = entity.end_line - entity.start_line + 1;
            const code = entity.content || lines.slice(entity.start_line - 1, entity.end_line).join('\n');
            return {
              name: entity.name,
              cyclomatic_complexity: this.estimateCyclomaticComplexity(code),
              line_number: entity.start_line,
              lines_of_code: entityLines,
              has_documentation: this.hasDocumentation(lines, entity.start_line),
              is_public: this.isPublic(code),
            };
          });
        }
      } catch {
        // DB not available, use extracted functions
      }

      const smells = this.detectCodeSmells(content, lines, filePath);
      const overallScore = this.calculateOverallScore(functions);

      return {
        complexity: {
          overall_score: overallScore,
          functions,
        },
        code_smells: smells,
        nesting: this.detectNesting(content, lines),
        imports: this.extractImports(content, lines),
        functions: functions.map(f => ({
          name: f.name,
          line_number: f.line_number,
          has_documentation: f.has_documentation,
          is_public: f.is_public,
        })),
      };
    } catch (error) {
      logger.error('Code analysis failed:', error);
      return {
        complexity: {
          overall_score: 0,
          functions: [],
        },
      };
    }
  }

  async analyzeCodebase(codebaseId: string): Promise<CodeAnalysisResult> {
    try {
      const db = getIndexingService().db;
      const entities = db
        .prepare(
          `SELECT name, start_line, end_line, entity_type, file_path, content
           FROM code_entities
           WHERE LOWER(codebase_id) = LOWER(?)
             AND entity_type IN ('function', 'method')
           ORDER BY (end_line - start_line) DESC
           LIMIT 500`,
        )
        .all(codebaseId) as Array<{
        name: string;
        start_line: number;
        end_line: number;
        entity_type: string;
        file_path: string;
        content: string;
      }>;

      const functions = entities.map(entity => {
        const code = entity.content || '';
        return {
          name: entity.name,
          cyclomatic_complexity: this.estimateCyclomaticComplexity(code),
          line_number: entity.start_line,
          lines_of_code: entity.end_line - entity.start_line + 1,
          has_documentation: false,
          is_public: this.isPublic(code),
        };
      });

      const overallScore = this.calculateOverallScore(functions);

      return {
        complexity: {
          overall_score: overallScore,
          functions,
        },
      };
    } catch {
      return {
        complexity: {
          overall_score: 0,
          functions: [],
        },
      };
    }
  }

  /**
   * Extract function data from source code text
   */
  private extractFunctionData(
    code: string,
    lines: string[],
  ): Array<{
    name: string;
    cyclomatic_complexity: number;
    line_number: number;
    lines_of_code: number;
    has_documentation: boolean;
    is_public: boolean;
  }> {
    const functions: Array<{
      name: string;
      cyclomatic_complexity: number;
      line_number: number;
      lines_of_code: number;
      has_documentation: boolean;
      is_public: boolean;
    }> = [];

    // Match function declarations
    const functionRegex =
      /(?:export\s+)?(?:async\s+)?(?:function|const|let|var)\s+(\w+)\s*(?:=\s*(?:async\s+)?)?(?:\(|<)/g;
    let match;

    while ((match = functionRegex.exec(code)) !== null) {
      const name = match[1];
      const lineNum = code.substring(0, match.index).split('\n').length;
      const funcBody = this.extractFunctionBody(code, match.index);
      const loc = funcBody.split('\n').length;

      functions.push({
        name,
        cyclomatic_complexity: this.estimateCyclomaticComplexity(funcBody),
        line_number: lineNum,
        lines_of_code: loc,
        has_documentation: this.hasDocumentation(lines, lineNum),
        is_public: this.isPublic(funcBody),
      });
    }

    // Match class methods
    const methodRegex = /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/g;
    const classMatch = /class\s+\w+/;
    if (classMatch.test(code)) {
      while ((match = methodRegex.exec(code)) !== null) {
        const name = match[1];
        // Skip keywords and already-found functions
        if (
          ['if', 'for', 'while', 'switch', 'catch', 'constructor', 'new', 'return'].includes(name)
        ) {
          continue;
        }
        if (functions.some(f => f.name === name)) {
          continue;
        }

        const lineNum = code.substring(0, match.index).split('\n').length;
        const funcBody = this.extractFunctionBody(code, match.index);

        functions.push({
          name,
          cyclomatic_complexity: this.estimateCyclomaticComplexity(funcBody),
          line_number: lineNum,
          lines_of_code: funcBody.split('\n').length,
          has_documentation: this.hasDocumentation(lines, lineNum),
          is_public: !match[0].startsWith('private'),
        });
      }
    }

    return functions;
  }

  /**
   * Extract function body from code starting at position
   */
  private extractFunctionBody(code: string, startPos: number): string {
    let braceCount = 0;
    let started = false;
    let endPos = startPos;

    for (let i = startPos; i < code.length; i++) {
      if (code[i] === '{') {
        braceCount++;
        started = true;
      } else if (code[i] === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          endPos = i + 1;
          break;
        }
      }
    }

    if (!started) {
      // Arrow function or one-liner — return the line
      const lineEnd = code.indexOf('\n', startPos);
      return code.substring(startPos, lineEnd > 0 ? lineEnd : code.length);
    }

    return code.substring(startPos, endPos);
  }

  /**
   * Estimate cyclomatic complexity from code
   */
  private estimateCyclomaticComplexity(code: string): number {
    let complexity = 1; // Base

    // Decision points
    const patterns = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\?/g, // nullish coalescing
      /\?.*:/g, // ternary
      /&&/g, // logical AND
      /\|\|/g, // logical OR
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Detect code smells
   */
  private detectCodeSmells(
    code: string,
    lines: string[],
    filePath: string,
  ): Array<{ name: string; description: string; location: { file: string; line: number } }> {
    const smells: Array<{
      name: string;
      description: string;
      location: { file: string; line: number };
    }> = [];

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // eval() usage
      if (/\beval\s*\(/.test(trimmed)) {
        smells.push({
          name: 'eval-usage',
          description: 'Use of eval() is a security risk and performance concern',
          location: { file: filePath, line: lineNum },
        });
      }

      // any type
      if (/: any\b/.test(trimmed) || /as any\b/.test(trimmed)) {
        smells.push({
          name: 'any-type',
          description: 'Usage of `any` type defeats TypeScript type safety',
          location: { file: filePath, line: lineNum },
        });
      }

      // == instead of ===
      if (/[^!=]==[^=]/.test(trimmed) && !/===/.test(trimmed)) {
        smells.push({
          name: 'loose-equality',
          description: 'Use === instead of == for strict equality',
          location: { file: filePath, line: lineNum },
        });
      }

      // var usage
      if (/\bvar\b/.test(trimmed)) {
        smells.push({
          name: 'var-usage',
          description: 'Use const/let instead of var',
          location: { file: filePath, line: lineNum },
        });
      }

      // console.log in production code
      if (/\bconsole\.log\b/.test(trimmed) && !filePath.includes('.test.')) {
        smells.push({
          name: 'console-log',
          description: 'console.log should be replaced with proper logger',
          location: { file: filePath, line: lineNum },
        });
      }

      // Hardcoded credentials
      if (
        /password\s*=\s*['"]/.test(trimmed) ||
        /api_key\s*=\s*['"]/.test(trimmed) ||
        /secret\s*=\s*['"]/.test(trimmed)
      ) {
        smells.push({
          name: 'hardcoded-credentials',
          description: 'Potential hardcoded credentials detected',
          location: { file: filePath, line: lineNum },
        });
      }

      // TODO/FIXME/HACK
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(trimmed)) {
        smells.push({
          name: 'technical-debt-marker',
          description: `Found ${trimmed.match(/(TODO|FIXME|HACK|XXX)/)?.[1]} comment`,
          location: { file: filePath, line: lineNum },
        });
      }
    });

    // Long function detection (>50 lines)
    const funcRegex =
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\(/g;
    let match;
    while ((match = funcRegex.exec(code)) !== null) {
      const name = match[1] || match[2];
      const startLine = code.substring(0, match.index).split('\n').length;
      const body = this.extractFunctionBody(code, match.index);
      const bodyLines = body.split('\n').length;

      if (bodyLines > 50) {
        smells.push({
          name: 'long-function',
          description: `Function ${name} is ${bodyLines} lines (max recommended: 50)`,
          location: { file: filePath, line: startLine },
        });
      }
    }

    return smells;
  }

  /**
   * Detect nesting depth
   */
  private detectNesting(
    code: string,
    _lines: string[],
  ): Array<{ depth: number; line: number }> {
    const nesting: Array<{ depth: number; line: number }> = [];
    let depth = 0;

    code.split('\n').forEach((line, idx) => {
      for (const ch of line) {
        if (ch === '{') {depth++;}
        if (ch === '}') {depth--;}
      }
      if (depth > 3) {
        nesting.push({ depth, line: idx + 1 });
      }
    });

    return nesting;
  }

  /**
   * Extract imports
   */
  private extractImports(
    code: string,
    _lines: string[],
  ): Array<{ module: string }> {
    const imports: Array<{ module: string }> = [];
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      imports.push({ module: match[1] });
    }
    return imports;
  }

  private hasDocumentation(lines: string[], lineNum: number): boolean {
    if (lineNum < 2) {return false;}
    const prevLine = lines[lineNum - 2]?.trim() || '';
    return prevLine.startsWith('*') || prevLine.startsWith('/**') || prevLine.startsWith('///');
  }

  private isPublic(code: string): boolean {
    return code.includes('export ') || !code.includes('private ');
  }

  private calculateOverallScore(
    functions: Array<{ cyclomatic_complexity: number }>,
  ): number {
    if (functions.length === 0) {return 50;}
    const avgComplexity =
      functions.reduce((sum, f) => sum + f.cyclomatic_complexity, 0) / functions.length;
    // Score: 100 (best) → 0 (worst). CC=1 → 100, CC=20 → 0
    return Math.max(0, Math.round(100 - (avgComplexity - 1) * 5));
  }

  private detectLanguage(ext: string): string {
    const map: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.rs': 'rust',
      '.go': 'go',
      '.java': 'java',
    };
    return map[ext] || 'typescript';
  }
}
