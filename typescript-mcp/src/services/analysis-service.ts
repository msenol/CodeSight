import type { FunctionInfo, ComplexityMetrics, CodeExplanation } from '../types/index.js';
import { parse } from '@typescript-eslint/typescript-estree';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { glob } from 'glob';

export interface AnalysisService {
  analyzeFile(filePath: string): Promise<FileAnalysis>;
  analyzeFunction(filePath: string, functionName: string): Promise<FunctionInfo | null>;
  getFunctionComplexity(filePath: string, functionName: string): Promise<ComplexityMetrics | null>;
  explainCode(code: string, language?: string): Promise<CodeExplanation>;
  getCodeMetrics(filePath: string): Promise<CodeMetrics>;
  detectCodeSmells(filePath: string): Promise<CodeSmell[]>;
  searchEntities(codebaseId: string, options: any): Promise<any[]>;
  findCallees(functionId: string): Promise<any[]>;
  findApiEndpoints(codebaseId: string, options: any): Promise<any[]>;
  findContainingEntity(filePath: string, line: number, column: number): Promise<any>;
  findDirectReferences(entityId: string): Promise<any[]>;
  searchInComments(codebaseId: string, query: string): Promise<any[]>;
  searchInStrings(codebaseId: string, query: string): Promise<any[]>;
  findReferencesInFile(filePath: string, entityName: string): Promise<any[]>;
  searchText(codebaseId: string, query: string, options: any): Promise<any[]>;
  findDirectUsers(entityId: string): Promise<any[]>;
  findDependencies(entityId: string): Promise<any[]>;
  analyzeFunctionBehavior(entityId: string, options: any): Promise<any>;
  analyzeFunctionSignature(entityId: string): Promise<any>;
  calculateComplexityMetrics(entityId: string): Promise<any>;
  findCallers(entityId: string): Promise<any[]>;
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
      codeSmells: await this.detectCodeSmells(filePath)
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

  async getFunctionComplexity(filePath: string, functionName: string): Promise<ComplexityMetrics | null> {
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
    if (complexity.cyclomaticComplexity > 10) complexityLevel = 'high';
    else if (complexity.cyclomaticComplexity > 5) complexityLevel = 'medium';
    
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
    if (hasLoops) relatedConcepts.push('Iteration', 'Control Flow');
    if (hasConditionals) relatedConcepts.push('Conditional Logic', 'Branching');
    if (hasFunctions) relatedConcepts.push('Functions', 'Modularity');
    if (hasAsyncCode) relatedConcepts.push('Promises', 'Async/Await', 'Concurrency');
    
    return {
      summary: this.generateCodeSummary(code, language),
      purpose: this.inferCodePurpose(code),
      complexity: complexityLevel,
      suggestions,
      examples,
      relatedConcepts
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
    const maintainabilityIndex = Math.max(0, 
      171 - 5.2 * Math.log(linesOfCode) - 0.23 * complexity.cyclomaticComplexity - 16.2 * Math.log(linesOfCode)
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
      interfaceCount: structureCounts.interfaces
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
          suggestion: 'Break this line into multiple lines'
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
          suggestion: 'Address this TODO item or create a proper issue'
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
          suggestion: 'Extract this number into a named constant'
        });
      }
      
      // Deeply nested code
      const indentLevel = (line.match(/^\s*/)?.[0].length || 0) / 2;
      if (indentLevel > 4) {
        smells.push({
          type: 'deep-nesting',
          severity: 'high',
          message: 'Code is deeply nested',
          line: lineNumber,
          column: 1,
          suggestion: 'Consider extracting nested logic into separate functions'
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
          suggestion: 'Break this function into smaller, more focused functions'
        });
      }
    }
    
    return smells;
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ts': case '.tsx': return 'typescript';
      case '.js': case '.jsx': return 'javascript';
      case '.py': return 'python';
      case '.java': return 'java';
      case '.cpp': case '.cc': case '.cxx': return 'cpp';
      case '.c': return 'c';
      case '.cs': return 'csharp';
      case '.go': return 'go';
      case '.rs': return 'rust';
      case '.php': return 'php';
      case '.rb': return 'ruby';
      default: return 'unknown';
    }
  }

  private async analyzeTypeScriptFile(content: string, analysis: FileAnalysis): Promise<void> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module'
      });
      
      this.traverseASTForAnalysis(ast, analysis);
    } catch (error) {
      // Fallback to Acorn for JavaScript files
      try {
        const ast = acorn.parse(content, {
          ecmaVersion: 2022,
          sourceType: 'module',
          locations: true
        });
        
        this.traverseAcornAST(ast, analysis);
      } catch (acornError) {
        console.warn(`Failed to parse file with both TypeScript and Acorn parsers:`, error);
      }
    }
  }

  private traverseASTForAnalysis(node: any, analysis: FileAnalysis): void {
    if (!node || typeof node !== 'object') return;
    
    switch (node.type) {
      case 'FunctionDeclaration':
        if (node.id) {
          analysis.functions.push(this.createFunctionInfo(node));
        }
        break;
        
      case 'ClassDeclaration':
        if (node.id) {
          analysis.classes.push(this.createClassInfo(node));
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
      case 'ExportDefaultDeclaration':
        const exportInfo = this.createExportInfo(node);
        if (exportInfo) {
          analysis.exports.push(exportInfo);
        }
        break;
    }
    
    // Recursively traverse child nodes
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.traverseASTForAnalysis(child, analysis);
          }
        } else if (typeof node[key] === 'object') {
          this.traverseASTForAnalysis(node[key], analysis);
        }
      }
    }
  }

  private traverseAcornAST(node: any, analysis: FileAnalysis): void {
    walk.simple(node, {
      FunctionDeclaration: (funcNode: any) => {
        if (funcNode.id) {
          analysis.functions.push(this.createFunctionInfoFromAcorn(funcNode));
        }
      },
      ClassDeclaration: (classNode: any) => {
        if (classNode.id) {
          analysis.classes.push(this.createClassInfoFromAcorn(classNode));
        }
      },
      ImportDeclaration: (importNode: any) => {
        analysis.imports.push(this.createImportInfoFromAcorn(importNode));
      }
    });
  }

  private createFunctionInfo(node: any): FunctionInfo {
    const complexity = this.calculateNodeComplexity(node);
    
    return {
      name: node.id.name,
      file: '', // Will be set by caller
      line: node.loc?.start?.line || 1,
      column: (node.loc?.start?.column || 0) + 1,
      parameters: node.params.map((param: any) => this.getParameterName(param)),
      returnType: this.getReturnType(node),
      complexity
    };
  }

  private createFunctionInfoFromAcorn(node: any): FunctionInfo {
    const complexity = this.calculateNodeComplexity(node);
    
    return {
      name: node.id.name,
      file: '',
      line: node.loc?.start?.line || 1,
      column: (node.loc?.start?.column || 0) + 1,
      parameters: node.params.map((param: any) => param.name || 'unknown'),
      returnType: 'unknown',
      complexity
    };
  }

  private createClassInfo(node: any): ClassInfo {
    return {
      name: node.id.name,
      line: node.loc?.start?.line || 1,
      column: (node.loc?.start?.column || 0) + 1,
      methods: [],
      properties: [],
      extends: node.superClass?.name,
      implements: node.implements?.map((impl: any) => impl.expression?.name || impl.name)
    };
  }

  private createClassInfoFromAcorn(node: any): ClassInfo {
    return {
      name: node.id.name,
      line: node.loc?.start?.line || 1,
      column: (node.loc?.start?.column || 0) + 1,
      methods: [],
      properties: [],
      extends: node.superClass?.name
    };
  }

  private createInterfaceInfo(node: any): InterfaceInfo {
    return {
      name: node.id.name,
      line: node.loc?.start?.line || 1,
      column: (node.loc?.start?.column || 0) + 1,
      properties: [],
      methods: [],
      extends: node.extends?.map((ext: any) => ext.expression?.name || ext.name)
    };
  }

  private createImportInfo(node: any): ImportInfo {
    return {
      source: node.source.value,
      imports: node.specifiers.map((spec: any) => spec.local.name),
      isDefault: node.specifiers.some((spec: any) => spec.type === 'ImportDefaultSpecifier'),
      line: node.loc?.start?.line || 1
    };
  }

  private createImportInfoFromAcorn(node: any): ImportInfo {
    return {
      source: node.source.value,
      imports: node.specifiers.map((spec: any) => spec.local.name),
      isDefault: node.specifiers.some((spec: any) => spec.type === 'ImportDefaultSpecifier'),
      line: node.loc?.start?.line || 1
    };
  }

  private createExportInfo(node: any): ExportInfo | null {
    if (node.type === 'ExportDefaultDeclaration') {
      return {
        name: 'default',
        type: this.getExportType(node.declaration),
        isDefault: true,
        line: node.loc?.start?.line || 1
      };
    } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      return {
        name: this.getDeclarationName(node.declaration),
        type: this.getExportType(node.declaration),
        isDefault: false,
        line: node.loc?.start?.line || 1
      };
    }
    return null;
  }

  private getParameterName(param: any): string {
    if (param.type === 'Identifier') {
      return param.name;
    } else if (param.type === 'AssignmentPattern') {
      return this.getParameterName(param.left);
    } else if (param.type === 'RestElement') {
      return `...${this.getParameterName(param.argument)}`;
    }
    return 'unknown';
  }

  private getReturnType(node: any): string {
    if (node.returnType) {
      return this.getTypeAnnotation(node.returnType);
    }
    return 'unknown';
  }

  private getTypeAnnotation(typeNode: any): string {
    if (!typeNode) return 'unknown';
    
    switch (typeNode.type) {
      case 'TSStringKeyword': return 'string';
      case 'TSNumberKeyword': return 'number';
      case 'TSBooleanKeyword': return 'boolean';
      case 'TSVoidKeyword': return 'void';
      case 'TSAnyKeyword': return 'any';
      case 'TSTypeReference': return typeNode.typeName?.name || 'unknown';
      default: return 'unknown';
    }
  }

  private getExportType(declaration: any): 'function' | 'class' | 'interface' | 'variable' | 'type' {
    switch (declaration.type) {
      case 'FunctionDeclaration': return 'function';
      case 'ClassDeclaration': return 'class';
      case 'TSInterfaceDeclaration': return 'interface';
      case 'TSTypeAliasDeclaration': return 'type';
      case 'VariableDeclaration': return 'variable';
      default: return 'variable';
    }
  }

  private getDeclarationName(declaration: any): string {
    if (declaration.id) {
      return declaration.id.name;
    } else if (declaration.declarations && declaration.declarations[0]) {
      return declaration.declarations[0].id.name;
    }
    return 'unknown';
  }

  private calculateCodeComplexity(code: string): ComplexityMetrics {
    let cyclomaticComplexity = 1; // Base complexity
    let cognitiveComplexity = 0;
    
    // Count decision points for cyclomatic complexity
    const decisionPoints = [
      /\bif\b/g, /\belse\s+if\b/g, /\bwhile\b/g, /\bfor\b/g,
      /\bdo\b/g, /\bswitch\b/g, /\bcase\b/g, /\bcatch\b/g,
      /\b&&\b/g, /\b\|\|\b/g, /\?/g
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
      { pattern: /\belse\s+if\b/g, weight: 1 },
      { pattern: /\belse\b/g, weight: 1 },
      { pattern: /\bswitch\b/g, weight: 1 },
      { pattern: /\bfor\b/g, weight: 1 },
      { pattern: /\bwhile\b/g, weight: 1 },
      { pattern: /\bdo\b/g, weight: 1 },
      { pattern: /\bcatch\b/g, weight: 1 },
      { pattern: /\b&&\b/g, weight: 1 },
      { pattern: /\b\|\|\b/g, weight: 1 }
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
      maintainabilityIndex: Math.max(0, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * cyclomaticComplexity)
    };
  }

  private calculateNodeComplexity(node: any): ComplexityMetrics {
    // This would need to traverse the specific function node
    // For now, return a simplified calculation
    return {
      cyclomaticComplexity: 1,
      cognitiveComplexity: 1,
      linesOfCode: 10,
      maintainabilityIndex: 85
    };
  }

  private async findTypeScriptFunction(content: string, functionName: string, filePath: string): Promise<FunctionInfo | null> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module'
      });
      
      return this.findFunctionInAST(ast, functionName, filePath);
    } catch (error) {
      return null;
    }
  }

  private findFunctionInAST(node: any, functionName: string, filePath: string): FunctionInfo | null {
    if (!node || typeof node !== 'object') return null;
    
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === functionName) {
      const functionInfo = this.createFunctionInfo(node);
      functionInfo.file = filePath;
      return functionInfo;
    }
    
    // Recursively search child nodes
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            const result = this.findFunctionInAST(child, functionName, filePath);
            if (result) return result;
          }
        } else if (typeof node[key] === 'object') {
          const result = this.findFunctionInAST(node[key], functionName, filePath);
          if (result) return result;
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
    if (hasClasses) features.push('classes');
    if (hasFunctions) features.push('functions');
    if (hasLoops) features.push('loops');
    if (hasConditionals) features.push('conditionals');
    
    if (features.length > 0) {
      summary += ` containing ${features.join(', ')}`;
    }
    
    return summary;
  }

  private inferCodePurpose(code: string): string {
    if (/\bexport\s+(class|function|interface)\b/.test(code)) {
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
    if (/\bcomponent\b|\bjsx\b|\breturn\s*\(/i.test(code)) {
      return 'Defines UI components for rendering';
    }
    
    return 'General purpose code implementation';
  }

  private async countCodeStructures(content: string, filePath: string): Promise<{functions: number, classes: number, interfaces: number}> {
    const counts = { functions: 0, classes: 0, interfaces: 0 };
    
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module'
      });
      
      this.countStructuresInAST(ast, counts);
    } catch (error) {
      // Fallback to regex counting
      counts.functions = (content.match(/\bfunction\b/g) || []).length;
      counts.classes = (content.match(/\bclass\b/g) || []).length;
      counts.interfaces = (content.match(/\binterface\b/g) || []).length;
    }
    
    return counts;
  }

  private countStructuresInAST(node: any, counts: {functions: number, classes: number, interfaces: number}): void {
    if (!node || typeof node !== 'object') return;
    
    switch (node.type) {
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

  private analyzeFunctionLengths(content: string): Array<{name: string, startLine: number, length: number}> {
    const functions: Array<{name: string, startLine: number, length: number}> = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const functionMatch = line.match(/\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
      
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
          if (foundOpenBrace && braceCount === 0) break;
        }
        
        functions.push({
          name: functionName,
          startLine,
          length: endLine - startLine + 1
        });
      }
    }
    
    return functions;
  }

  async searchEntities(codebaseId: string, options: any): Promise<any[]> {
    const entities: any[] = [];
    const searchPattern = options.pattern || '**/*.{ts,tsx,js,jsx}';
    const entityType = options.type || 'all';
    
    try {
      const files = await glob(searchPattern, {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
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
      
      return entities.filter(entity => 
        !options.name || entity.name.toLowerCase().includes(options.name.toLowerCase())
      );
    } catch (error) {
      console.error('Failed to search entities:', error);
      return [];
    }
  }

  async findCallees(functionId: string): Promise<any[]> {
    const callees: any[] = [];
    
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
        sourceType: 'module'
      });
      
      // Find the specific function and analyze its calls
      this.traverseASTForCallees(ast, functionName, filePath, callees);
      
      return callees;
    } catch (error) {
      console.error('Failed to find callees:', error);
      return [];
    }
  }

  async findApiEndpoints(codebaseId: string, options: any): Promise<any[]> {
    const endpoints: any[] = [];
    const searchPattern = options.pattern || '**/*.{ts,tsx,js,jsx}';
    
    try {
      const files = await glob(searchPattern, {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
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
      
      return endpoints.filter(endpoint => 
        !options.method || endpoint.method === options.method.toUpperCase()
      );
    } catch (error) {
      console.error('Failed to find API endpoints:', error);
      return [];
    }
  }

  async findContainingEntity(filePath: string, line: number, column: number): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module'
      });
      
      let containingEntity: any = null;
      
      this.traverseASTForContainingEntity(ast, line, column, filePath, (entity) => {
        if (!containingEntity || 
            (entity.start_line <= line && entity.end_line >= line &&
             entity.start_line > containingEntity.start_line)) {
          containingEntity = entity;
        }
      });
      
      return containingEntity;
    } catch (error) {
      console.error('Failed to find containing entity:', error);
      return null;
    }
  }

  async findDirectReferences(entityId: string): Promise<any[]> {
    const references: any[] = [];
    
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
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
      });
      
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
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

  async searchInComments(codebaseId: string, query: string): Promise<any[]> {
    const results: any[] = [];
    
    try {
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
      });
      
      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const commentMatch = line.match(/\/\/\s*(.*)$|\/\*([\s\S]*?)\*\//g);
            
            if (commentMatch) {
              for (const comment of commentMatch) {
                if (comment.toLowerCase().includes(query.toLowerCase())) {
                  results.push({
                    file_path: filePath,
                    line_number: i + 1,
                    content: line.trim(),
                    match_type: 'comment',
                    matched_text: comment
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

  async searchInStrings(codebaseId: string, query: string): Promise<any[]> {
    const results: any[] = [];
    
    try {
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
      });
      
      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const stringMatches = line.match(/['"\`]([^'"\`]*)['"\`]/g);
            
            if (stringMatches) {
              for (const stringMatch of stringMatches) {
                const stringContent = stringMatch.slice(1, -1); // Remove quotes
                if (stringContent.toLowerCase().includes(query.toLowerCase())) {
                  results.push({
                    file_path: filePath,
                    line_number: i + 1,
                    content: line.trim(),
                    match_type: 'string',
                    matched_text: stringMatch
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

  async findReferencesInFile(filePath: string, entityName: string): Promise<any[]> {
    const references: any[] = [];
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const regex = new RegExp(`\\b${entityName}\\b`, 'g');
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
          } else if (beforeMatch.trim().endsWith('=') || beforeMatch.includes('const') || beforeMatch.includes('let') || beforeMatch.includes('var')) {
            referenceType = 'assignment';
          }
          
          references.push({
            file_path: filePath,
            line_number: i + 1,
            column_number: match.index + 1,
            context: line.trim(),
            reference_type: referenceType,
            matched_text: entityName
          });
        }
      }
      
      return references;
    } catch (error) {
      console.error('Failed to find references in file:', error);
      return [];
    }
  }

  async searchText(codebaseId: string, query: string, options: any): Promise<any[]> {
    const results: any[] = [];
    const maxResults = options.max_results || 50;
    const caseSensitive = options.case_sensitive || false;
    
    try {
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
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
                matched_text: query
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
      
      return results.sort((a, b) => b.score - a.score);
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

  async findDirectUsers(entityId: string): Promise<any[]> {
    const users: any[] = [];
    
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
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
      });
      
      for (const file of files) {
        if (file === filePath) continue; // Skip the file where entity is defined
        
        try {
          const content = await fs.readFile(file, 'utf-8');
          const references = await this.findReferencesInFile(file, entityName);
          
          if (references.length > 0) {
            users.push({
              entity_id: `${file}#user`,
              name: path.basename(file, path.extname(file)),
              file_path: file,
              usage_count: references.length,
              usage_type: 'dependency',
              references: references
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

  async findDependencies(entityId: string): Promise<any[]> {
    const dependencies: any[] = [];
    
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
        sourceType: 'module'
      });
      
      // Find imports and function calls within the entity
      this.traverseASTForDependencies(ast, entityName, filePath, dependencies);
      
      return dependencies;
    } catch (error) {
      console.error('Failed to find dependencies:', error);
      return [];
    }
  }

  async analyzeFunctionBehavior(entityId: string, options: any): Promise<any> {
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
        sourceType: 'module'
      });
      
      let behaviorAnalysis: any = {
        entity_id: entityId,
        behavior_type: 'unknown',
        side_effects: [],
        complexity_score: 0,
        patterns: [],
        async_operations: false,
        error_handling: false,
        io_operations: false
      };
      
      // Analyze function behavior
      this.traverseASTForBehaviorAnalysis(ast, functionName, behaviorAnalysis);
      
      return behaviorAnalysis;
    } catch (error) {
      console.error('Failed to analyze function behavior:', error);
      return null;
    }
  }

  async analyzeFunctionSignature(entityId: string): Promise<any> {
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
        sourceType: 'module'
      });
      
      let signature: any = null;
      
      // Find and analyze function signature
      this.traverseASTForSignatureAnalysis(ast, functionName, (sig) => {
        signature = sig;
      });
      
      return signature;
    } catch (error) {
      console.error('Failed to analyze function signature:', error);
      return null;
    }
  }

  async calculateComplexityMetrics(entityId: string): Promise<any> {
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
        maintainability_index: complexity.maintainabilityIndex
      };
    } catch (error) {
      console.error('Failed to calculate complexity metrics:', error);
      return null;
    }
  }

  async findCallers(entityId: string): Promise<any[]> {
    const callers: any[] = [];
    
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
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
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
   private async extractEntitiesFromFile(filePath: string, content: string, entityType: string): Promise<any[]> {
     const entities: any[] = [];
     
     try {
       const ast = parse(content, {
         loc: true,
         range: true,
         ecmaVersion: 2022,
         sourceType: 'module'
       });
       
       this.traverseASTForEntities(ast, filePath, entities, entityType);
       return entities;
     } catch (error) {
       // Fallback to regex-based extraction
       return this.extractEntitiesWithRegex(content, filePath, entityType);
     }
   }

   private traverseASTForEntities(node: any, filePath: string, entities: any[], entityType: string): void {
     if (!node || typeof node !== 'object') return;
     
     if ((entityType === 'all' || entityType === 'function') && 
         (node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression')) {
       if (node.id?.name) {
         entities.push({
           id: `${filePath}#${node.id.name}`,
           name: node.id.name,
           type: 'function',
           file_path: filePath,
           start_line: node.loc?.start?.line || 1,
           end_line: node.loc?.end?.line || 1
         });
       }
     }
     
     if ((entityType === 'all' || entityType === 'class') && node.type === 'ClassDeclaration') {
       if (node.id?.name) {
         entities.push({
           id: `${filePath}#${node.id.name}`,
           name: node.id.name,
           type: 'class',
           file_path: filePath,
           start_line: node.loc?.start?.line || 1,
           end_line: node.loc?.end?.line || 1
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

   private extractEntitiesWithRegex(content: string, filePath: string, entityType: string): any[] {
     const entities: any[] = [];
     const lines = content.split('\n');
     
     for (let i = 0; i < lines.length; i++) {
       const line = lines[i];
       
       if (entityType === 'all' || entityType === 'function') {
         const functionMatch = line.match(/^\s*(export\s+)?(async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
         if (functionMatch) {
           entities.push({
             id: `${filePath}#${functionMatch[3]}`,
             name: functionMatch[3],
             type: 'function',
             file_path: filePath,
             start_line: i + 1,
             end_line: i + 1
           });
         }
       }
       
       if (entityType === 'all' || entityType === 'class') {
         const classMatch = line.match(/^\s*(export\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
         if (classMatch) {
           entities.push({
             id: `${filePath}#${classMatch[2]}`,
             name: classMatch[2],
             type: 'class',
             file_path: filePath,
             start_line: i + 1,
             end_line: i + 1
           });
         }
       }
     }
     
     return entities;
   }

   private traverseASTForCallees(node: any, functionName: string, filePath: string, callees: any[]): void {
     if (!node || typeof node !== 'object') return;
     
     // Find function calls within the target function
     if (node.type === 'CallExpression' && node.callee) {
       let calleeName = '';
       
       if (node.callee.type === 'Identifier') {
         calleeName = node.callee.name;
       } else if (node.callee.type === 'MemberExpression' && node.callee.property) {
         calleeName = node.callee.property.name;
       }
       
       if (calleeName) {
         callees.push({
           id: `${filePath}#${calleeName}`,
           name: calleeName,
           file_path: filePath,
           line_number: node.loc?.start?.line || 1,
           call_type: 'direct'
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

   private async extractApiEndpointsFromFile(filePath: string, content: string): Promise<any[]> {
     const endpoints: any[] = [];
     const lines = content.split('\n');
     
     // Express.js patterns
     const expressPatterns = [
       /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
       /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g
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
             handler: 'unknown'
           });
         }
       }
     }
     
     return endpoints;
   }

   private traverseASTForContainingEntity(node: any, line: number, column: number, filePath: string, callback: (entity: any) => void): void {
     if (!node || typeof node !== 'object') return;
     
     if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && 
         node.loc && node.id?.name) {
       if (line >= node.loc.start.line && line <= node.loc.end.line) {
         callback({
           id: `${filePath}#${node.id.name}`,
           name: node.id.name,
           type: node.type === 'FunctionDeclaration' ? 'function' : 'class',
           file_path: filePath,
           start_line: node.loc.start.line,
           end_line: node.loc.end.line
         });
       }
     }
     
     // Recursively traverse
     for (const key in node) {
       if (key !== 'parent' && node[key]) {
         if (Array.isArray(node[key])) {
           for (const child of node[key]) {
             this.traverseASTForContainingEntity(child, line, column, filePath, callback);
           }
         } else if (typeof node[key] === 'object') {
           this.traverseASTForContainingEntity(node[key], line, column, filePath, callback);
         }
       }
     }
   }

   private traverseASTForDependencies(node: any, entityName: string, filePath: string, dependencies: any[]): void {
     if (!node || typeof node !== 'object') return;
     
     // Find import statements
     if (node.type === 'ImportDeclaration' && node.source?.value) {
       dependencies.push({
         id: `${filePath}#import_${node.source.value}`,
         name: node.source.value,
         type: 'import',
         file_path: filePath,
         line_number: node.loc?.start?.line || 1,
         dependency_type: node.source.value.startsWith('.') ? 'internal' : 'external'
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

   private traverseASTForBehaviorAnalysis(node: any, functionName: string, analysis: any): void {
     if (!node || typeof node !== 'object') return;
     
     // Detect async operations
     if (node.type === 'AwaitExpression' || node.type === 'YieldExpression') {
       analysis.async_operations = true;
     }
     
     // Detect error handling
     if (node.type === 'TryStatement' || node.type === 'CatchClause') {
       analysis.error_handling = true;
     }
     
     // Detect I/O operations
     if (node.type === 'CallExpression' && node.callee) {
       const callName = node.callee.name || (node.callee.property && node.callee.property.name);
       if (callName && (callName.includes('read') || callName.includes('write') || callName.includes('fetch'))) {
         analysis.io_operations = true;
         analysis.side_effects.push(callName);
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

   private traverseASTForSignatureAnalysis(node: any, functionName: string, callback: (signature: any) => void): void {
     if (!node || typeof node !== 'object') return;
     
     if ((node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression') && 
         node.id?.name === functionName) {
       const signature = {
         entity_id: `${functionName}`,
         name: functionName,
         parameters: node.params?.map((param: any) => ({
           name: param.name || 'unknown',
           type: param.typeAnnotation?.typeAnnotation?.type || 'any',
           optional: param.optional || false
         })) || [],
         return_type: node.returnType?.typeAnnotation?.type || 'unknown',
         is_async: node.async || false,
         visibility: 'public' // Default, would need more analysis for actual visibility
       };
       
       callback(signature);
     }
     
     // Recursively traverse
     for (const key in node) {
       if (key !== 'parent' && node[key]) {
         if (Array.isArray(node[key])) {
           for (const child of node[key]) {
             this.traverseASTForSignatureAnalysis(child, functionName, callback);
           }
         } else if (typeof node[key] === 'object') {
           this.traverseASTForSignatureAnalysis(node[key], functionName, callback);
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
         sourceType: 'module'
       });
       
       let functionCode: string | null = null;
       
       this.traverseASTForFunctionCode(ast, functionName, content, (code) => {
         functionCode = code;
       });
       
       return functionCode;
     } catch (error) {
       return null;
     }
   }

   private traverseASTForFunctionCode(node: any, functionName: string, content: string, callback: (code: string) => void): void {
     if (!node || typeof node !== 'object') return;
     
     if ((node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression') && 
         node.id?.name === functionName && node.range) {
       const functionCode = content.substring(node.range[0], node.range[1]);
       callback(functionCode);
     }
     
     // Recursively traverse
     for (const key in node) {
       if (key !== 'parent' && node[key]) {
         if (Array.isArray(node[key])) {
           for (const child of node[key]) {
             this.traverseASTForFunctionCode(child, functionName, content, callback);
           }
         } else if (typeof node[key] === 'object') {
           this.traverseASTForFunctionCode(node[key], functionName, content, callback);
         }
       }
     }
   }

   private async findCallsInFile(filePath: string, content: string, entityName: string): Promise<any[]> {
     const calls: any[] = [];
     const lines = content.split('\n');
     
     for (let i = 0; i < lines.length; i++) {
       const line = lines[i];
       const regex = new RegExp(`\\b${entityName}\\s*\\(`, 'g');
       let match;
       
       while ((match = regex.exec(line)) !== null) {
         calls.push({
           entity_id: `${filePath}#caller_${i}`,
           name: `caller_${i}`,
           file_path: filePath,
           line_number: i + 1,
           call_type: 'direct',
           context: line.trim()
         });
       }
     }
     
     return calls;
   }
 }