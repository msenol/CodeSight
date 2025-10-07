 
 
 
 
 
 
import type {
  FunctionInfo,
  ComplexityMetrics,
  CodeExplanation,
  ASTNode,
  FunctionNode,
  ClassNode,
} from '../types/index.js';
import { parse } from '@typescript-eslint/typescript-estree';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { glob } from 'glob';

declare const console: {
   
  log: (..._args: unknown[]) => void;
   
  warn: (..._args: unknown[]) => void;
   
  error: (..._args: unknown[]) => void;
};

export interface AnalysisService {
   
  analyzeFile(_filePath: string): Promise<FileAnalysis>;
   
  analyzeFunction(_filePath: string, _functionName: string): Promise<FunctionInfo | null>;
   
  getFunctionComplexity(_filePath: string, _functionName: string): Promise<ComplexityMetrics | null>;
   
  explainCode(_code: string, _language?: string): Promise<CodeExplanation>;
   
  getCodeMetrics(_filePath: string): Promise<CodeMetrics>;
   
  detectCodeSmells(_filePath: string): Promise<CodeSmell[]>;
   
  searchEntities(_codebaseId: string, _options: unknown): Promise<unknown[]>;
   
  findCallees(_functionId: string): Promise<unknown[]>;
   
  findApiEndpoints(_codebaseId: string, _options: unknown): Promise<unknown[]>;
   
  findContainingEntity(_filePath: string, _line: number, _column: number): Promise<unknown>;
   
  findDirectReferences(_entityId: string): Promise<unknown[]>;
   
  searchInComments(_codebaseId: string, _query: string): Promise<unknown[]>;
   
  searchInStrings(_codebaseId: string, _query: string): Promise<unknown[]>;
   
  findReferencesInFile(_filePath: string, _entityName: string): Promise<unknown[]>;
   
  searchText(_codebaseId: string, _query: string, _options: unknown): Promise<unknown[]>;
   
  findDirectUsers(_entityId: string): Promise<unknown[]>;
   
  findDependencies(_entityId: string): Promise<unknown[]>;
   
  analyzeFunctionBehavior(_entityId: string, _options: unknown): Promise<unknown>;
   
  analyzeFunctionSignature(_entityId: string): Promise<unknown>;
   
  calculateComplexityMetrics(_entityId: string): Promise<unknown>;
   
  findCallers(_entityId: string): Promise<unknown[]>;
}

export interface FileAnalysis {
  filePath: string;
  language: string;
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  metrics: CodeMetrics;
  codeSmells: CodeSmell[];
}

export interface ClassInfo {
  name: string;
  line: number;
  column: number;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  extends?: string;
  implements?: string[];
}

export interface InterfaceInfo {
  name: string;
  line: number;
  column: number;
  properties: PropertyInfo[];
  methods: MethodSignature[];
  extends?: string[];
}

export interface PropertyInfo {
  name: string;
  type: string;
  line: number;
  column: number;
  visibility?: 'public' | 'private' | 'protected';
  isStatic?: boolean;
  isReadonly?: boolean;
}

export interface MethodSignature {
  name: string;
  parameters: string[];
  returnType: string;
  line: number;
  column: number;
}

export interface ImportInfo {
  source: string;
  imports: string[];
  isDefault: boolean;
  line: number;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'type';
  isDefault: boolean;
  line: number;
}

export interface CodeMetrics {
  linesOfCode: number;
  linesOfComments: number;
  blankLines: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  functionCount: number;
  classCount: number;
  interfaceCount: number;
}

export interface CodeSmell {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  line: number;
  column: number;
  suggestion: string;
}

export class DefaultAnalysisService implements AnalysisService {
  async analyzeFile(filePath: string): Promise<FileAnalysis> {
    const content = await fs.readFile(filePath, 'utf-8');
    const language = this.detectLanguage(filePath);

    const analysis: FileAnalysis = {
      filePath,
      language,
      functions: [],
      classes: [],
      interfaces: [],
      imports: [],
      exports: [],
      metrics: await this.getCodeMetrics(filePath),
      codeSmells: await this.detectCodeSmells(filePath),
    };

    if (language === 'typescript' || language === 'javascript') {
      await this.analyzeTypeScriptFile(content, analysis);
    }

    return analysis;
  }

  async analyzeFunction(filePath: string, functionName: string): Promise<FunctionInfo | null> {
    const content = await fs.readFile(filePath, 'utf-8');
    const language = this.detectLanguage(filePath);

    if (language === 'typescript' || language === 'javascript') {
      return await this.findTypeScriptFunction(content, functionName, filePath);
    }

    return null;
  }

  async getFunctionComplexity(
    filePath: string,
    functionName: string,
  ): Promise<ComplexityMetrics | null> {
    const functionInfo = await this.analyzeFunction(filePath, functionName);
    return functionInfo?.complexity || null;
  }

  async explainCode(code: string, language = 'typescript'): Promise<CodeExplanation> {
    const lines = code.split('\n');
    const complexity = this.calculateCodeComplexity(code);

    // Analyze code structure and patterns
    const hasLoops = /\b(for|while|do)\b/.test(code);
    const hasConditionals = /\b(if|else|switch|case)\b/.test(code);
    const hasFunctions = /\bfunction\b|=>|\bclass\b/.test(code);
    const hasAsyncCode = /\b(async|await|Promise)\b/.test(code);

    let complexityLevel: 'low' | 'medium' | 'high' = 'low';
    if (complexity.cyclomaticComplexity > 10) {complexityLevel = 'high';} else if (complexity.cyclomaticComplexity > 5) {complexityLevel = 'medium';}

    const suggestions: string[] = [];
    if (complexity.cyclomaticComplexity > 10) {
      suggestions.push('Consider breaking this code into smaller functions');
    }
    if (lines.length > 50) {
      suggestions.push('This code block is quite long, consider splitting it');
    }
    if (hasLoops && hasConditionals) {
      suggestions.push('Complex control flow detected, consider simplifying');
    }

    const examples: string[] = [];
    if (hasFunctions) {
      examples.push('Function definition or arrow function usage');
    }
    if (hasAsyncCode) {
      examples.push('Asynchronous programming patterns');
    }

    const relatedConcepts: string[] = [];
    if (hasLoops) {relatedConcepts.push('Iteration', 'Control Flow');}
    if (hasConditionals) {relatedConcepts.push('Conditional Logic', 'Branching');}
    if (hasFunctions) {relatedConcepts.push('Functions', 'Modularity');}
    if (hasAsyncCode) {relatedConcepts.push('Promises', 'Async/Await', 'Concurrency');}

    return {
      summary: this.generateCodeSummary(code, language),
      purpose: this.inferCodePurpose(code),
      complexity: complexityLevel,
      suggestions,
      examples,
      relatedConcepts,
    };
  }

  async getCodeMetrics(filePath: string): Promise<CodeMetrics> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    let linesOfCode = 0;
    let linesOfComments = 0;
    let blankLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        blankLines++;
      } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        linesOfComments++;
      } else {
        linesOfCode++;
      }
    }

    const complexity = this.calculateCodeComplexity(content);
    const structureCounts = await this.countCodeStructures(content, filePath);

    // Calculate maintainability index (simplified version)
    const maintainabilityIndex = Math.max(
      0,
      171 -
        5.2 * Math.log(linesOfCode) -
        0.23 * complexity.cyclomaticComplexity -
        16.2 * Math.log(linesOfCode),
    );

    return {
      linesOfCode,
      linesOfComments,
      blankLines,
      cyclomaticComplexity: complexity.cyclomaticComplexity,
      cognitiveComplexity: complexity.cognitiveComplexity,
      maintainabilityIndex,
      functionCount: structureCounts.functions,
      classCount: structureCounts.classes,
      interfaceCount: structureCounts.interfaces,
    };
  }

  async detectCodeSmells(filePath: string): Promise<CodeSmell[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const smells: CodeSmell[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Long line smell
      if (line.length > 120) {
        smells.push({
          type: 'long-line',
          severity: 'low',
          message: 'Line is too long (>120 characters)',
          line: lineNumber,
          column: 121,
          suggestion: 'Break this line into multiple lines',
        });
      }

      // TODO/FIXME comments
      if (/\b(TODO|FIXME|HACK)\b/i.test(line)) {
        smells.push({
          type: 'todo-comment',
          severity: 'medium',
          message: 'TODO/FIXME comment found',
          line: lineNumber,
          column: line.search(/\b(TODO|FIXME|HACK)\b/i) + 1,
          suggestion: 'Address this TODO item or create a proper issue',
        });
      }

      // Magic numbers
      const magicNumberMatch = line.match(/\b(\d{2,})\b/);
      if (magicNumberMatch && !line.includes('//') && !line.includes('const')) {
        smells.push({
          type: 'magic-number',
          severity: 'medium',
          message: 'Magic number detected',
          line: lineNumber,
          column: line.indexOf(magicNumberMatch[0]) + 1,
          suggestion: 'Extract this number into a named constant',
        });
      }

      // Deeply nested code
      const indentLevel = (line.match(/^]*/)?.[0].length || 0) / 2;
      if (indentLevel > 4) {
        smells.push({
          type: 'deep-nesting',
          severity: 'high',
          message: 'Code is deeply nested',
          line: lineNumber,
          column: 1,
          suggestion: 'Consider extracting nested logic into separate functions',
        });
      }
    }

    // Function length smell
    const functionLengths = this.analyzeFunctionLengths(content);
    for (const func of functionLengths) {
      if (func.length > 50) {
        smells.push({
          type: 'long-function',
          severity: 'high',
          message: `Function '${func.name}' is too long (${func.length} lines)`,
          line: func.startLine,
          column: 1,
          suggestion: 'Break this function into smaller, more focused functions',
        });
      }
    }

    return smells;
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.py':
        return 'python';
      case '.java':
        return 'java';
      case '.cpp':
      case '.cc':
      case '.cxx':
        return 'cpp';
      case '.c':
        return 'c';
      case '.cs':
        return 'csharp';
      case '.go':
        return 'go';
      case '.rs':
        return 'rust';
      case '.php':
        return 'php';
      case '.rb':
        return 'ruby';
      default:
        return 'unknown';
    }
  }

  private async analyzeTypeScriptFile(content: string, analysis: FileAnalysis): Promise<void> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      this.traverseASTForAnalysis(ast as any, analysis);
    } catch (error) {
      // Fallback to Acorn for JavaScript files
      try {
        const ast = acorn.parse(content, {
          ecmaVersion: 2022,
          sourceType: 'module',
          locations: true,
        });

        this.traverseAcornAST(ast, analysis);
      } catch {
        console.warn('Failed to parse file with both TypeScript and Acorn parsers:', error);
      }
    }
  }

  private traverseASTForAnalysis(node: ASTNode, analysis: FileAnalysis): void {
    if (!node || typeof node !== 'object') {return;}

    switch (node.type) {
      case 'FunctionDeclaration':
        if (node.id) {
          analysis.functions.push(this.createFunctionInfo(node as any));
        }
        break;

      case 'ClassDeclaration':
        if (node.id) {
          analysis.classes.push(this.createClassInfo(node as any));
        }
        break;

      case 'TSInterfaceDeclaration':
        if (node.id) {
          analysis.interfaces.push(this.createInterfaceInfo(node));
        }
        break;

      case 'ImportDeclaration':
        analysis.imports.push(this.createImportInfo(node));
        break;

      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration': {
        const exportInfo = this.createExportInfo(node);
        if (exportInfo) {
          analysis.exports.push(exportInfo);
        }
        break;
      }
    }

    // Recursively traverse child nodes
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.traverseASTForAnalysis(child, analysis);
          }
        } else if (typeof node[key] === 'object') {
          this.traverseASTForAnalysis(node[key] as any, analysis);
        }
      }
    }
  }

  private traverseAcornAST(node: acorn.Node, analysis: FileAnalysis): void {
    walk.simple(node, {
      FunctionDeclaration: (funcNode: acorn.FunctionDeclaration) => {
        if (funcNode.id) {
          analysis.functions.push(this.createFunctionInfoFromAcorn(funcNode));
        }
      },
      ClassDeclaration: (classNode: acorn.ClassDeclaration) => {
        if (classNode.id) {
          analysis.classes.push(this.createClassInfoFromAcorn(classNode));
        }
      },
      ImportDeclaration: (importNode: acorn.ImportDeclaration) => {
        analysis.imports.push(this.createImportInfoFromAcorn(importNode));
      },
    });
  }

  private createFunctionInfo(node: FunctionNode): FunctionInfo {
    const complexity = this.calculateNodeComplexity(node);

    return {
      name: (node.id as any).name,
      file: '', // Will be set by caller
      line: (node && typeof node === 'object' && 'loc' in node && node.loc && typeof node.loc === 'object' && 'start' in node.loc && node.loc.start && typeof node.loc.start === 'object' && 'line' in node.loc.start) ? Number(node.loc.start.line) : 1,
      column: (node.loc?.start.column || 0) + 1,
      parameters: (node.params || []).map((param: any) => this.getParameterName(param)),
      returnType: this.getReturnType(node),
      complexity,
    };
  }

  private createFunctionInfoFromAcorn(node: acorn.FunctionDeclaration): FunctionInfo {
    const complexity = this.calculateNodeComplexity(node);

    return {
      name: node.id.name,
      file: '',
      line: (node && typeof node === 'object' && 'loc' in node && node.loc && typeof node.loc === 'object' && 'start' in node.loc && node.loc.start && typeof node.loc.start === 'object' && 'line' in node.loc.start) ? Number(node.loc.start.line) : 1,
      column: (node.loc?.start.column || 0) + 1,
      parameters: node.params.map((param: acorn.Identifier) => param.name || 'unknown') || [],
      returnType: 'unknown',
      complexity,
    };
  }

  private createClassInfo(node: ClassNode): ClassInfo {
    return {
      name: (node.id as any).name,
      line: (node && typeof node === 'object' && 'loc' in node && node.loc && typeof node.loc === 'object' && 'start' in node.loc && node.loc.start && typeof node.loc.start === 'object' && 'line' in node.loc.start) ? Number(node.loc.start.line) : 1,
      column: (node.loc?.start.column || 0) + 1,
      methods: [],
      properties: [],
      extends: (node as any).superClass?.name,
      implements: (node as any).implements?.map((impl: any) => {
          if ('expression' in impl && impl.expression && typeof impl.expression === 'object' && 'name' in impl.expression) {
            return String(impl.expression.name);
          }
          if ('name' in impl && impl.name) {
            return String(impl.name);
          }
          return 'unknown';
        }),
    };
  }

  private createClassInfoFromAcorn(node: any): ClassInfo {
    return {
      name: (node.id)?.name || 'unknown',
      line: (node && typeof node === 'object' && 'loc' in node && node.loc && typeof node.loc === 'object' && 'start' in node.loc && node.loc.start && typeof node.loc.start === 'object' && 'line' in node.loc.start) ? Number(node.loc.start.line) : 1,
      column: ((node.loc)?.start?.column || 0) + 1,
      methods: [],
      properties: [],
      extends: (node).superClass?.name,
    };
  }

  private createInterfaceInfo(node: any): InterfaceInfo {
    return {
      name: (node.id)?.name || 'unknown',
      line: (node && typeof node === 'object' && 'loc' in node && node.loc && typeof node.loc === 'object' && 'start' in node.loc && node.loc.start && typeof node.loc.start === 'object' && 'line' in node.loc.start) ? Number(node.loc.start.line) : 1,
      column: ((node.loc)?.start?.column || 0) + 1,
      properties: [],
      methods: [],
      extends: (node).extends?.map((ext: any) => {
          if (ext && typeof ext === 'object') {
            if ('expression' in ext && ext.expression && typeof ext.expression === 'object' && 'name' in ext.expression) {
              return String(ext.expression.name);
            }
            if ('name' in ext && ext.name) {
              return String(ext.name);
            }
          }
          return 'unknown';
        }),
    };
  }

  private createImportInfo(node: any): ImportInfo {
    return {
      source: (node.source && typeof node.source === 'object' && 'value' in node.source) ? String(node.source.value) : 'unknown',
      imports: (node.specifiers || []).map((spec: any) => {
          if (spec && typeof spec === 'object' && 'local' in spec && spec.local && typeof spec.local === 'object' && 'name' in spec.local) {
            return String(spec.local.name);
          }
          return 'unknown';
        }),
      isDefault: node.specifiers.some((spec: unknown) => spec && typeof spec === 'object' && 'type' in spec && String(spec.type) === 'ImportDefaultSpecifier'),
      line: (node && typeof node === 'object' && 'loc' in node && node.loc && typeof node.loc === 'object' && 'start' in node.loc && node.loc.start && typeof node.loc.start === 'object' && 'line' in node.loc.start) ? Number(node.loc.start.line) : 1,
    };
  }

  private createImportInfoFromAcorn(node: any): ImportInfo {
    return {
      source: (node.source && typeof node.source === 'object' && 'value' in node.source) ? String(node.source.value) : 'unknown',
      imports: (node.specifiers || []).map((spec: any) => {
          if (spec && typeof spec === 'object' && 'local' in spec && spec.local && typeof spec.local === 'object' && 'name' in spec.local) {
            return String(spec.local.name);
          }
          return 'unknown';
        }),
      isDefault: (node.specifiers || []).some((spec: any) => spec && typeof spec === 'object' && 'type' in spec && String(spec.type) === 'ImportDefaultSpecifier'),
      line: (node && typeof node === 'object' && 'loc' in node && node.loc && typeof node.loc === 'object' && 'start' in node.loc && node.loc.start && typeof node.loc.start === 'object' && 'line' in node.loc.start) ? Number(node.loc.start.line) : 1,
    };
  }

  private createExportInfo(node: unknown): ExportInfo | null {
    if (node && typeof node === 'object' && 'type' in node && String(node.type) === 'ExportDefaultDeclaration') {
      return {
        name: 'default',
        type: this.getExportType('declaration' in node ? node.declaration : {}),
        isDefault: true,
        line: (node && typeof node === 'object' && 'loc' in node && node.loc && typeof node.loc === 'object' && 'start' in node.loc && node.loc.start && typeof node.loc.start === 'object' && 'line' in node.loc.start) ? Number(node.loc.start.line) : 1,
      };
    } else if (node && typeof node === 'object' && 'type' in node && String(node.type) === 'ExportNamedDeclaration' && 'declaration' in node && node.declaration) {
      return {
        name: this.getDeclarationName(node.declaration),
        type: this.getExportType('declaration' in node ? node.declaration : {}),
        isDefault: false,
        line: (node && typeof node === 'object' && 'loc' in node && node.loc && typeof node.loc === 'object' && 'start' in node.loc && node.loc.start && typeof node.loc.start === 'object' && 'line' in node.loc.start) ? Number(node.loc.start.line) : 1,
      };
    }
    return null;
  }

  private getParameterName(param: any): string {
    if (param && param.type === 'Identifier') {
      return param.name;
    } else if (param && param.type === 'AssignmentPattern') {
      return this.getParameterName(param.left);
    } else if (param && param.type === 'RestElement') {
      return `...${this.getParameterName(param.argument)}`;
    }
    return 'unknown';
  }

  private getReturnType(node: any): string {
    if (node?.returnType) {
      return this.getTypeAnnotation(node.returnType);
    }
    return 'unknown';
  }

  private getTypeAnnotation(typeNode: any): string {
    if (!typeNode) {return 'unknown';}

    switch (typeNode.type) {
      case 'TSStringKeyword':
        return 'string';
      case 'TSNumberKeyword':
        return 'number';
      case 'TSBooleanKeyword':
        return 'boolean';
      case 'TSVoidKeyword':
        return 'void';
      case 'TSAnyKeyword':
        return 'any';
      case 'TSTypeReference':
        return (typeNode.typeName)?.name || 'unknown';
      default:
        return 'unknown';
    }
  }

  private getExportType(
    declaration: unknown,
  ): 'function' | 'class' | 'interface' | 'variable' | 'type' {
    if (!declaration || typeof declaration !== 'object' || !('type' in declaration)) {
      return 'variable';
    }

    switch (String(declaration.type)) {
      case 'FunctionDeclaration':
        return 'function';
      case 'ClassDeclaration':
        return 'class';
      case 'TSInterfaceDeclaration':
        return 'interface';
      case 'TSTypeAliasDeclaration':
        return 'type';
      case 'VariableDeclaration':
        return 'variable';
      default:
        return 'variable';
    }
  }

  private getDeclarationName(declaration: any): string {
    if (declaration?.id) {
      return (declaration.id).name;
    } else if (declaration?.declarations?.[0]) {
      return (declaration.declarations[0].id).name;
    }
    return 'unknown';
  }

  private calculateCodeComplexity(code: string): ComplexityMetrics {
    let cyclomaticComplexity = 1; // Base complexity
    let cognitiveComplexity = 0;

    // Count decision points for cyclomatic complexity
    const decisionPoints = [
      /\bif\b/g,
      /\belse]+if\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bdo\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\b&&\b/g,
      /\b\|\|\b/g,
      /\?/g,
    ];

    for (const pattern of decisionPoints) {
      const matches = code.match(pattern);
      if (matches) {
        cyclomaticComplexity += matches.length;
      }
    }

    // Calculate cognitive complexity (simplified)
    const cognitivePatterns = [
      { pattern: /\bif\b/g, weight: 1 },
      { pattern: /\belse]+if\b/g, weight: 1 },
      { pattern: /\belse\b/g, weight: 1 },
      { pattern: /\bswitch\b/g, weight: 1 },
      { pattern: /\bfor\b/g, weight: 1 },
      { pattern: /\bwhile\b/g, weight: 1 },
      { pattern: /\bdo\b/g, weight: 1 },
      { pattern: /\bcatch\b/g, weight: 1 },
      { pattern: /\b&&\b/g, weight: 1 },
      { pattern: /\b\|\|\b/g, weight: 1 },
    ];

    for (const { pattern, weight } of cognitivePatterns) {
      const matches = code.match(pattern);
      if (matches) {
        cognitiveComplexity += matches.length * weight;
      }
    }

    const linesOfCode = code.split('\n').filter(line => line.trim().length > 0).length;

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      linesOfCode,
      maintainabilityIndex: Math.max(
        0,
        171 - 5.2 * Math.log(linesOfCode) - 0.23 * cyclomaticComplexity,
      ),
    };
  }

  private calculateNodeComplexity(_node: unknown): ComplexityMetrics {
    // This would need to traverse the specific function node
    // For now, return a simplified calculation
    return {
      cyclomaticComplexity: 1,
      cognitiveComplexity: 1,
      linesOfCode: 10,
      maintainabilityIndex: 85,
    };
  }

  private async findTypeScriptFunction(
    content: string,
    functionName: string,
    filePath: string,
  ): Promise<FunctionInfo | null> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      return this.findFunctionInAST(ast, functionName, filePath);
    } catch {
      return null;
    }
  }

  private findFunctionInAST(
    node: unknown,
    functionName: string,
    filePath: string,
  ): FunctionInfo | null {
    if (!node || typeof node !== 'object') {return null;}

    if ((node as any).type === 'FunctionDeclaration' && (node as any).id && (node as any).id.name === functionName) {
      const functionInfo = this.createFunctionInfo(node as any);
      functionInfo.file = filePath;
      return functionInfo;
    }

    // Recursively search child nodes
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            const result = this.findFunctionInAST(child, functionName, filePath);
            if (result) {return result;}
          }
        } else if (typeof node[key] === 'object') {
          const result = this.findFunctionInAST(node[key], functionName, filePath);
          if (result) {return result;}
        }
      }
    }

    return null;
  }

  private generateCodeSummary(code: string, language: string): string {
    const lines = code.split('\n').length;
    const hasClasses = /\bclass\b/.test(code);
    const hasFunctions = /\bfunction\b|=>/.test(code);
    const hasLoops = /\b(for|while|do)\b/.test(code);
    const hasConditionals = /\b(if|else|switch)\b/.test(code);

    let summary = `${language} code snippet with ${lines} lines`;

    const features = [];
    if (hasClasses) {features.push('classes');}
    if (hasFunctions) {features.push('functions');}
    if (hasLoops) {features.push('loops');}
    if (hasConditionals) {features.push('conditionals');}

    if (features.length > 0) {
      summary += ` containing ${features.join(', ')}`;
    }

    return summary;
  }

  private inferCodePurpose(code: string): string {
    if (/\bexport]+(class|function|interface)\b/.test(code)) {
      return 'Defines exportable components for use in other modules';
    }
    if (/\bimport\b/.test(code)) {
      return 'Imports and utilizes external dependencies';
    }
    if (/\btest\b|\bdescribe\b|\bit\b|\bexpect\b/.test(code)) {
      return 'Contains test cases for validating functionality';
    }
    if (/\bapi\b|\brouter\b|\bexpress\b|\bfastify\b/.test(code)) {
      return 'Implements API endpoints or web server functionality';
    }
    if (/\bcomponent\b|\bjsx\b|\breturn]*\(/i.test(code)) {
      return 'Defines UI components for rendering';
    }

    return 'General purpose code implementation';
  }

  private async countCodeStructures(
    content: string,
    _filePath: string,
  ): Promise<{ functions: number; classes: number; interfaces: number }> {
    const counts = { functions: 0, classes: 0, interfaces: 0 };

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      this.countStructuresInAST(ast, counts);
    } catch {
      // Fallback to regex counting
      counts.functions = (content.match(/\bfunction\b/g) || []).length;
      counts.classes = (content.match(/\bclass\b/g) || []).length;
      counts.interfaces = (content.match(/\binterface\b/g) || []).length;
    }

    return counts;
  }

  private countStructuresInAST(
    node: unknown,
    counts: { functions: number; classes: number; interfaces: number },
  ): void {
    if (!node || typeof node !== 'object') {return;}

    switch ((node as any).type) {
      case 'FunctionDeclaration':
        counts.functions++;
        break;
      case 'ClassDeclaration':
        counts.classes++;
        break;
      case 'TSInterfaceDeclaration':
        counts.interfaces++;
        break;
    }

    // Recursively count in child nodes
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.countStructuresInAST(child, counts);
          }
        } else if (typeof node[key] === 'object') {
          this.countStructuresInAST(node[key], counts);
        }
      }
    }
  }

  private analyzeFunctionLengths(
    content: string,
  ): Array<{ name: string; startLine: number; length: number }> {
    const functions: Array<{ name: string; startLine: number; length: number }> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const functionMatch = line.match(/\bfunction]+([a-zA-Z_$][a-zA-Z0-9_$]*)]*\(/);

      if (functionMatch) {
        const functionName = functionMatch[1];
        const startLine = i + 1;

        // Find the end of the function (simplified)
        let braceCount = 0;
        let endLine = i;
        let foundOpenBrace = false;

        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          for (const char of currentLine) {
            if (char === '{') {
              braceCount++;
              foundOpenBrace = true;
            } else if (char === '}') {
              braceCount--;
              if (foundOpenBrace && braceCount === 0) {
                endLine = j + 1;
                break;
              }
            }
          }
          if (foundOpenBrace && braceCount === 0) {break;}
        }

        functions.push({
          name: functionName,
          startLine,
          length: endLine - startLine + 1,
        });
      }
    }

    return functions;
  }

  async searchEntities(codebaseId: string, options: any): Promise<unknown[]> {
    const entities: unknown[] = [];
    const searchPattern = (options?.pattern) || '**/*.{ts,tsx,js,jsx}';
    const entityType = (options?.type) || 'all';

    try {
      const files = await glob(searchPattern, {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const fileEntities = await this.extractEntitiesFromFile(filePath, content, entityType);
          entities.push(...fileEntities);
        } catch (error) {
          console.warn(`Failed to analyze ${filePath}:`, error);
        }
      }

      return entities.filter(
        entity => !options.name || (entity as any).name?.toLowerCase().includes((options.name as string).toLowerCase()),
      );
    } catch (error) {
      console.error('Failed to search entities:', error);
      return [];
    }
  }

  async findCallees(functionId: string): Promise<unknown[]> {
    const callees: unknown[] = [];

    try {
      // Extract function info from functionId
      const [filePath, functionName] = functionId.split('#');

      if (!filePath || !functionName) {
        return [];
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      // Find the specific function and analyze its calls
      this.traverseASTForCallees(ast, functionName, filePath, callees);

      return callees;
    } catch (error) {
      console.error('Failed to find callees:', error);
      return [];
    }
  }

  async findApiEndpoints(codebaseId: string, options: any): Promise<unknown[]> {
    const endpoints: unknown[] = [];
    const searchPattern = (options?.pattern) || '**/*.{ts,tsx,js,jsx}';

    try {
      const files = await glob(searchPattern, {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const fileEndpoints = await this.extractApiEndpointsFromFile(filePath, content);
          endpoints.push(...fileEndpoints);
        } catch (error) {
          console.warn(`Failed to analyze ${filePath}:`, error);
        }
      }

      return endpoints.filter(
        endpoint => !options.method || (endpoint as any).method === (options.method as string).toUpperCase(),
      );
    } catch (error) {
      console.error('Failed to find API endpoints:', error);
      return [];
    }
  }

  async findContainingEntity(filePath: string, line: number, column: number): Promise<unknown> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      let containingEntity: unknown = null;

      this.traverseASTForContainingEntity(ast, line, column, filePath, entity => {
        if (
          !containingEntity ||
          ((entity as any).start_line <= line &&
            (entity as any).end_line >= line &&
            (entity as any).start_line > (containingEntity as any).start_line)
        ) {
          containingEntity = entity;
        }
      });

      return containingEntity;
    } catch (error) {
      console.error('Failed to find containing entity:', error);
      return null;
    }
  }

  async findDirectReferences(entityId: string): Promise<unknown[]> {
    const references: unknown[] = [];

    try {
      // Extract entity info from entityId
      const [filePath, entityName] = entityId.split('#');

      if (!filePath || !entityName) {
        return [];
      }

      // Get the directory to search in
      const baseDir = path.dirname(filePath);
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: baseDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      for (const file of files) {
        try {
          fs.readFile(file, 'utf-8'); // Context reading
          const fileReferences = await this.findReferencesInFile(file, entityName);
          references.push(...fileReferences);
        } catch (error) {
          console.warn(`Failed to analyze ${file}:`, error);
        }
      }

      return references;
    } catch (error) {
      console.error('Failed to find direct references:', error);
      return [];
    }
  }

  async searchInComments(codebaseId: string, query: string): Promise<unknown[]> {
    const results: unknown[] = [];

    try {
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const commentMatch = line.match(/[^]]*(.*)$|]\*([^]\S]*?)\*]/g);

            if (commentMatch) {
              for (const comment of commentMatch) {
                if (comment.toLowerCase().includes(query.toLowerCase())) {
                  results.push({
                    file_path: filePath,
                    line_number: i + 1,
                    content: line.trim(),
                    match_type: 'comment',
                    matched_text: comment,
                  });
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to analyze ${filePath}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to search in comments:', error);
      return [];
    }
  }

  async searchInStrings(codebaseId: string, query: string): Promise<unknown[]> {
    const results: unknown[] = [];

    try {
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const stringMatches = line.match(/['"`]([^'"`]*)['"`]/g);

            if (stringMatches) {
              for (const stringMatch of stringMatches) {
                const stringContent = stringMatch.slice(1, -1); // Remove quotes
                if (stringContent.toLowerCase().includes(query.toLowerCase())) {
                  results.push({
                    file_path: filePath,
                    line_number: i + 1,
                    content: line.trim(),
                    match_type: 'string',
                    matched_text: stringMatch,
                  });
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to analyze ${filePath}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to search in strings:', error);
      return [];
    }
  }

  async findReferencesInFile(filePath: string, entityName: string): Promise<unknown[]> {
    const references: unknown[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const regex = new RegExp(`]b${entityName}]b`, 'g');
        let match;

        while ((match = regex.exec(line)) !== null) {
          // Determine reference type based on context
          let referenceType = 'usage';
          const beforeMatch = line.substring(0, match.index);
          const afterMatch = line.substring(match.index + entityName.length);

          if (afterMatch.trim().startsWith('(')) {
            referenceType = 'call';
          } else if (beforeMatch.trim().endsWith('import') || beforeMatch.includes('from')) {
            referenceType = 'import';
          } else if (
            beforeMatch.trim().endsWith('=') ||
            beforeMatch.includes('const') ||
            beforeMatch.includes('let') ||
            beforeMatch.includes('var')
          ) {
            referenceType = 'assignment';
          }

          references.push({
            file_path: filePath,
            line_number: i + 1,
            column_number: match.index + 1,
            context: line.trim(),
            reference_type: referenceType,
            matched_text: entityName,
          });
        }
      }

      return references;
    } catch (error) {
      console.error('Failed to find references in file:', error);
      return [];
    }
  }

  async searchText(codebaseId: string, query: string, options: any): Promise<unknown[]> {
    const results: unknown[] = [];
    const maxResults = (options?.max_results) || 50;
    const caseSensitive = (options?.case_sensitive) || false;

    try {
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const searchLine = caseSensitive ? line : line.toLowerCase();
            const searchQuery = caseSensitive ? query : query.toLowerCase();

            if (searchLine.includes(searchQuery)) {
              const index = searchLine.indexOf(searchQuery);
              results.push({
                file_path: filePath,
                line_number: i + 1,
                column_number: index + 1,
                content: line.trim(),
                score: this.calculateTextMatchScore(line, query),
                matched_text: query,
              });

              if (results.length >= maxResults) {
                return results;
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to analyze ${filePath}:`, error);
        }
      }

      return results.sort((a, b) => ((b as any).score || 0) - ((a as any).score || 0));
    } catch (error) {
      console.error('Failed to search text:', error);
      return [];
    }
  }

  private calculateTextMatchScore(line: string, query: string): number {
    const lineLength = line.length;
    const queryLength = query.length;

    // Higher score for exact matches
    if (line.includes(query)) {
      const ratio = queryLength / lineLength;
      return Math.min(1.0, ratio * 2); // Cap at 1.0
    }

    return 0;
  }

  async findDirectUsers(entityId: string): Promise<unknown[]> {
    const users: unknown[] = [];

    try {
      // Extract entity info from entityId
      const [filePath, entityName] = entityId.split('#');

      if (!filePath || !entityName) {
        return [];
      }

      // Get the directory to search in
      const baseDir = path.dirname(filePath);
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: baseDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      for (const file of files) {
        if (file === filePath) {continue;} // Skip the file where entity is defined

        try {
          fs.readFile(file, 'utf-8'); // Context reading
          const references = await this.findReferencesInFile(file, entityName);

          if (references.length > 0) {
            users.push({
              entity_id: `${file}#user`,
              name: path.basename(file, path.extname(file)),
              file_path: file,
              usage_count: references.length,
              usage_type: 'dependency',
              references,
            });
          }
        } catch (error) {
          console.warn(`Failed to analyze ${file}:`, error);
        }
      }

      return users;
    } catch (error) {
      console.error('Failed to find direct users:', error);
      return [];
    }
  }

  async findDependencies(entityId: string): Promise<unknown[]> {
    const dependencies: unknown[] = [];

    try {
      // Extract entity info from entityId
      const [filePath, entityName] = entityId.split('#');

      if (!filePath || !entityName) {
        return [];
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      // Find imports and function calls within the entity
      this.traverseASTForDependencies(ast, entityName, filePath, dependencies);

      return dependencies;
    } catch (error) {
      console.error('Failed to find dependencies:', error);
      return [];
    }
  }

  async analyzeFunctionBehavior(entityId: string, _options: unknown): Promise<unknown> {
    try {
      // Extract entity info from entityId
      const [filePath, functionName] = entityId.split('#');

      if (!filePath || !functionName) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      const behaviorAnalysis: unknown = {
        entity_id: entityId,
        behavior_type: 'unknown',
        side_effects: [],
        complexity_score: 0,
        patterns: [],
        async_operations: false,
        error_handling: false,
        io_operations: false,
      };

      // Analyze function behavior
      this.traverseASTForBehaviorAnalysis(ast, functionName, behaviorAnalysis);

      return behaviorAnalysis;
    } catch (error) {
      console.error('Failed to analyze function behavior:', error);
      return null;
    }
  }

  async analyzeFunctionSignature(entityId: string): Promise<unknown> {
    try {
      // Extract entity info from entityId
      const [filePath, functionName] = entityId.split('#');

      if (!filePath || !functionName) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      let signature: unknown = null;

      // Find and analyze function signature
      this.traverseASTForSignatureAnalysis(ast, functionName, sig => {
        signature = sig;
      });

      return signature;
    } catch (error) {
      console.error('Failed to analyze function signature:', error);
      return null;
    }
  }

  async calculateComplexityMetrics(entityId: string): Promise<unknown> {
    try {
      // Extract entity info from entityId
      const [filePath, functionName] = entityId.split('#');

      if (!filePath || !functionName) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const functionCode = await this.extractFunctionCode(content, functionName);

      if (!functionCode) {
        return null;
      }

      const complexity = this.calculateCodeComplexity(functionCode);

      return {
        entity_id: entityId,
        cyclomatic_complexity: complexity.cyclomaticComplexity,
        cognitive_complexity: complexity.cognitiveComplexity,
        lines_of_code: complexity.linesOfCode,
        maintainability_index: complexity.maintainabilityIndex,
      };
    } catch (error) {
      console.error('Failed to calculate complexity metrics:', error);
      return null;
    }
  }

  async findCallers(entityId: string): Promise<unknown[]> {
    const callers: unknown[] = [];

    try {
      // Extract entity info from entityId
      const [filePath, entityName] = entityId.split('#');

      if (!filePath || !entityName) {
        return [];
      }

      // Get the directory to search in
      const baseDir = path.dirname(filePath);
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: baseDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const fileCalls = await this.findCallsInFile(file, content, entityName);
          callers.push(...fileCalls);
        } catch (error) {
          console.warn(`Failed to analyze ${file}:`, error);
        }
      }

      return callers;
    } catch (error) {
      console.error('Failed to find callers:', error);
      return [];
    }
  }

  // Helper methods for proper implementation
  private async extractEntitiesFromFile(
    filePath: string,
    content: string,
    entityType: string,
  ): Promise<unknown[]> {
    const entities: unknown[] = [];

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      this.traverseASTForEntities(ast, filePath, entities, entityType);
      return entities;
    } catch {
      // Fallback to regex-based extraction
      return this.extractEntitiesWithRegex(content, filePath, entityType);
    }
  }

  private traverseASTForEntities(
    node: unknown,
    filePath: string,
    entities: unknown[],
    entityType: string,
  ): void {
    if (!node || typeof node !== 'object') {return;}

    if (
      (entityType === 'all' || entityType === 'function') &&
      ((node as any).type === 'FunctionDeclaration' || (node as any).type === 'ArrowFunctionExpression')
    ) {
      if ((node as any).id?.name) {
        entities.push({
          id: `${filePath}#${(node as any).id.name}`,
          name: (node as any).id.name,
          type: 'function',
          file_path: filePath,
          start_line: (node && typeof node === 'object' && 'loc' in node && node.loc && typeof node.loc === 'object' && 'start' in node.loc && node.loc.start && typeof node.loc.start === 'object' && 'line' in node.loc.start) ? Number(node.loc.start.line) : 1,
          end_line: ((node as any).loc)?.end?.line || 1,
        });
      }
    }

    if ((entityType === 'all' || entityType === 'class') && (node as any).type === 'ClassDeclaration') {
      if ((node as any).id?.name) {
        entities.push({
          id: `${filePath}#${(node as any).id.name}`,
          name: (node as any).id.name,
          type: 'class',
          file_path: filePath,
          start_line: (node && typeof node === 'object' && 'loc' in node && node.loc && typeof node.loc === 'object' && 'start' in node.loc && node.loc.start && typeof node.loc.start === 'object' && 'line' in node.loc.start) ? Number(node.loc.start.line) : 1,
          end_line: ((node as any).loc)?.end?.line || 1,
        });
      }
    }

    // Recursively traverse
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.traverseASTForEntities(child, filePath, entities, entityType);
          }
        } else if (typeof node[key] === 'object') {
          this.traverseASTForEntities(node[key], filePath, entities, entityType);
        }
      }
    }
  }

  private extractEntitiesWithRegex(content: string, filePath: string, entityType: string): unknown[] {
    const entities: unknown[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (entityType === 'all' || entityType === 'function') {
        const functionMatch = line.match(
          /^]*(export]+)?(async]+)?function]+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
        );
        if (functionMatch) {
          entities.push({
            id: `${filePath}#${functionMatch[3]}`,
            name: functionMatch[3],
            type: 'function',
            file_path: filePath,
            start_line: i + 1,
            end_line: i + 1,
          });
        }
      }

      if (entityType === 'all' || entityType === 'class') {
        const classMatch = line.match(/^]*(export]+)?class]+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (classMatch) {
          entities.push({
            id: `${filePath}#${classMatch[2]}`,
            name: classMatch[2],
            type: 'class',
            file_path: filePath,
            start_line: i + 1,
            end_line: i + 1,
          });
        }
      }
    }

    return entities;
  }

  private traverseASTForCallees(
    node: unknown,
    functionName: string,
    filePath: string,
    callees: unknown[],
  ): void {
    if (!node || typeof node !== 'object') {return;}

    // Find function calls within the target function
    if ((node as any).type === 'CallExpression' && (node as any).callee) {
      let calleeName = '';

      if ((node as any).callee.type === 'Identifier') {
        calleeName = ((node as any).callee).name;
      } else if ((node as any).callee.type === 'MemberExpression' && (node as any).callee.property) {
        calleeName = ((node as any).callee.property).name;
      }

      if (calleeName) {
        callees.push({
          id: `${filePath}#${calleeName}`,
          name: calleeName,
          file_path: filePath,
          line_number: ((node as any).loc)?.start?.line || 1,
          call_type: 'direct',
        });
      }
    }

    // Recursively traverse
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.traverseASTForCallees(child, functionName, filePath, callees);
          }
        } else if (typeof node[key] === 'object') {
          this.traverseASTForCallees(node[key], functionName, filePath, callees);
        }
      }
    }
  }

  private async extractApiEndpointsFromFile(filePath: string, content: string): Promise<unknown[]> {
    const endpoints: unknown[] = [];
    const lines = content.split('\n');

    // Express.js patterns
    const expressPatterns = [
      /app\.(get|post|put|delete|patch)]*\(]*['"`]([^'"`]+)['"`]/g,
      /router\.(get|post|put|delete|patch)]*\(]*['"`]([^'"`]+)['"`]/g,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of expressPatterns) {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          endpoints.push({
            id: `${filePath}#${match[1]}_${match[2]}_${i}`,
            method: match[1].toUpperCase(),
            path: match[2],
            file_path: filePath,
            line_number: i + 1,
            handler: 'unknown',
          });
        }
      }
    }

    return endpoints;
  }

  private traverseASTForContainingEntity(
    _node: unknown,
    _line: number,
    _column: number,
    _filePath: string,
    _callback: (_entity: unknown) => void,
  ): void {
    if (!_node || typeof _node !== 'object') {return;}

    if (
      (( _node as any).type === 'FunctionDeclaration' || ( _node as any).type === 'ClassDeclaration') &&
      ( _node as any).loc &&
      ( _node as any).id?.name
    ) {
      if (_line >= (( _node as any).loc).start.line && _line <= (( _node as any).loc).end.line) {
        _callback({
          id: `${_filePath}#${( _node as any).id.name}`,
          name: ( _node as any).id.name,
          type: ( _node as any).type === 'FunctionDeclaration' ? 'function' : 'class',
          file_path: _filePath,
          start_line: (( _node as any).loc).start.line,
          end_line: (( _node as any).loc).end.line,
        });
      }
    }

    // Recursively traverse
    for (const key in _node) {
      if (key !== 'parent' && _node[key]) {
        if (Array.isArray(_node[key])) {
          for (const child of _node[key]) {
            this.traverseASTForContainingEntity(child, _line, _column, _filePath, _callback);
          }
        } else if (typeof _node[key] === 'object') {
          this.traverseASTForContainingEntity(_node[key], _line, _column, _filePath, _callback);
        }
      }
    }
  }

  private traverseASTForDependencies(
    node: unknown,
    entityName: string,
    filePath: string,
    dependencies: unknown[],
  ): void {
    if (!node || typeof node !== 'object') {return;}

    // Find import statements
    if ((node as any).type === 'ImportDeclaration' && (node as any).source?.value) {
      dependencies.push({
        id: `${filePath}#import_${(node as any).source.value}`,
        name: (node as any).source.value,
        type: 'import',
        file_path: filePath,
        line_number: ((node as any).loc)?.start?.line || 1,
        dependency_type: (node as any).source.value.startsWith('.') ? 'internal' : 'external',
      });
    }

    // Recursively traverse
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.traverseASTForDependencies(child, entityName, filePath, dependencies);
          }
        } else if (typeof node[key] === 'object') {
          this.traverseASTForDependencies(node[key], entityName, filePath, dependencies);
        }
      }
    }
  }

  private traverseASTForBehaviorAnalysis(node: unknown, functionName: string, analysis: unknown): void {
    if (!node || typeof node !== 'object') {return;}

    // Detect async operations
    if ((node as any).type === 'AwaitExpression' || (node as any).type === 'YieldExpression') {
      (analysis as any).async_operations = true;
    }

    // Detect error handling
    if ((node as any).type === 'TryStatement' || (node as any).type === 'CatchClause') {
      (analysis as any).error_handling = true;
    }

    // Detect I/O operations
    if ((node as any).type === 'CallExpression' && (node as any).callee) {
      const callName = ((node as any).callee).name || ((node as any).callee.property?.name);
      if (
        callName &&
        (callName.includes('read') || callName.includes('write') || callName.includes('fetch'))
      ) {
        (analysis as any).io_operations = true;
        ((analysis as any).side_effects || []).push(callName);
      }
    }

    // Recursively traverse
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.traverseASTForBehaviorAnalysis(child, functionName, analysis);
          }
        } else if (typeof node[key] === 'object') {
          this.traverseASTForBehaviorAnalysis(node[key], functionName, analysis);
        }
      }
    }
  }

  private traverseASTForSignatureAnalysis(
    _node: unknown,
    _functionName: string,
    _callback: (_signature: unknown) => void,
  ): void {
    if (!_node || typeof _node !== 'object') {return;}

    if (
      ((_node as any).type === 'FunctionDeclaration' || (_node as any).type === 'ArrowFunctionExpression') &&
      (_node as any).id?.name === _functionName
    ) {
      const signature = {
        entity_id: `${_functionName}`,
        name: _functionName,
        parameters:
          (_node as any).params?.map((param: any) => {
            if (param && typeof param === 'object') {
              return {
                name: ('name' in param) ? String(param.name) : 'unknown',
                type: ('typeAnnotation' in param && param.typeAnnotation && typeof param.typeAnnotation === 'object' && 'typeAnnotation' in param.typeAnnotation && param.typeAnnotation.typeAnnotation && typeof param.typeAnnotation.typeAnnotation === 'object' && 'type' in param.typeAnnotation.typeAnnotation) ? String(param.typeAnnotation.typeAnnotation.type) : 'unknown',
                optional: ('optional' in param) ? Boolean(param.optional) : false,
              };
            }
            return {
              name: 'unknown',
              type: 'unknown',
              optional: false,
            };
          }) || [],
        return_type: ((_node as any).returnType)?.typeAnnotation?.type || 'unknown',
        is_async: (_node as any).async || false,
        visibility: 'public', // Default, would need more analysis for actual visibility
      };

      _callback(signature);
    }

    // Recursively traverse
    for (const key in _node) {
      if (key !== 'parent' && _node[key]) {
        if (Array.isArray(_node[key])) {
          for (const child of _node[key]) {
            this.traverseASTForSignatureAnalysis(child, _functionName, _callback);
          }
        } else if (typeof _node[key] === 'object') {
          this.traverseASTForSignatureAnalysis(_node[key], _functionName, _callback);
        }
      }
    }
  }

  private async extractFunctionCode(content: string, functionName: string): Promise<string | null> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      let functionCode: string | null = null;

      this.traverseASTForFunctionCode(ast, functionName, content, code => {
        functionCode = code;
      });

      return functionCode;
    } catch {
      return null;
    }
  }

  private traverseASTForFunctionCode(
    _node: unknown,
    _functionName: string,
    _content: string,
    _callback: (_code: string) => void,
  ): void {
    if (!_node || typeof _node !== 'object') {return;}

    if (
      ((_node as any).type === 'FunctionDeclaration' || (_node as any).type === 'ArrowFunctionExpression') &&
      (_node as any).id?.name === _functionName &&
      (_node as any).range
    ) {
      const functionCode = _content.substring((_node as any).range[0], (_node as any).range[1]);
      _callback(functionCode);
    }

    // Recursively traverse
    for (const key in _node) {
      if (key !== 'parent' && _node[key]) {
        if (Array.isArray(_node[key])) {
          for (const child of _node[key]) {
            this.traverseASTForFunctionCode(child, _functionName, _content, _callback);
          }
        } else if (typeof _node[key] === 'object') {
          this.traverseASTForFunctionCode(_node[key], _functionName, _content, _callback);
        }
      }
    }
  }

  private async findCallsInFile(
    filePath: string,
    content: string,
    entityName: string,
  ): Promise<unknown[]> {
    const calls: unknown[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const regex = new RegExp(`]b${entityName}]s*](`, 'g');

      while (regex.exec(line) !== null) {
        calls.push({
          entity_id: `${filePath}#caller_${i}`,
          name: `caller_${i}`,
          file_path: filePath,
          line_number: i + 1,
          call_type: 'direct',
          context: line.trim(),
        });
      }
    }

    return calls;
  }
}
