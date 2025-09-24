import type { ComplexityMetrics, FunctionInfo } from '../types/index.js';
import { parse } from '@typescript-eslint/typescript-estree';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export interface ComplexityService {
  calculateFileComplexity(filePath: string): Promise<ComplexityMetrics>;
  calculateFunctionComplexity(filePath: string, functionName: string): Promise<ComplexityMetrics | null>;
  calculateCodeComplexity(code: string, language?: string): Promise<ComplexityMetrics>;
  getComplexityReport(filePath: string): Promise<ComplexityReport>;
  analyzeCyclomaticComplexity(code: string): Promise<number>;
  analyzeCognitiveComplexity(code: string): Promise<number>;
  calculateMaintainabilityIndex(metrics: ComplexityMetrics): number;
  calculateComplexity(codeSnippet: string, language: string): Promise<ComplexityMetrics>;
  analyzeFunction(functionCode: string, language: string): Promise<any>;
  calculateMetrics(entity: any, metricTypes: string[]): Promise<any>;
}

export interface ComplexityReport {
  filePath: string;
  overallComplexity: ComplexityMetrics;
  functions: FunctionComplexityInfo[];
  classes: ClassComplexityInfo[];
  recommendations: ComplexityRecommendation[];
}

export interface FunctionComplexityInfo {
  name: string;
  line: number;
  complexity: ComplexityMetrics;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ClassComplexityInfo {
  name: string;
  line: number;
  methodCount: number;
  averageMethodComplexity: number;
  totalComplexity: ComplexityMetrics;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ComplexityRecommendation {
  type: 'function' | 'class' | 'file';
  target: string;
  issue: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
}

export class DefaultComplexityService implements ComplexityService {
  async calculateFileComplexity(filePath: string): Promise<ComplexityMetrics> {
    const content = await fs.readFile(filePath, 'utf-8');
    return await this.calculateCodeComplexity(content, this.getLanguageFromPath(filePath));
  }

  async calculateFunctionComplexity(filePath: string, functionName: string): Promise<ComplexityMetrics | null> {
    const content = await fs.readFile(filePath, 'utf-8');
    const language = this.getLanguageFromPath(filePath);
    
    if (language === 'typescript' || language === 'javascript') {
      return await this.findAndAnalyzeFunctionComplexity(content, functionName);
    }
    
    return null;
  }

  async calculateCodeComplexity(code: string, language = 'typescript'): Promise<ComplexityMetrics> {
    const cyclomaticComplexity = await this.analyzeCyclomaticComplexity(code);
    const cognitiveComplexity = await this.analyzeCognitiveComplexity(code);
    const linesOfCode = this.countLinesOfCode(code);
    
    const metrics: ComplexityMetrics = {
      cyclomaticComplexity,
      cognitiveComplexity,
      linesOfCode,
      maintainabilityIndex: 0 // Will be calculated below
    };
    
    metrics.maintainabilityIndex = this.calculateMaintainabilityIndex(metrics);
    
    return metrics;
  }

  async getComplexityReport(filePath: string): Promise<ComplexityReport> {
    const content = await fs.readFile(filePath, 'utf-8');
    const language = this.getLanguageFromPath(filePath);
    
    const overallComplexity = await this.calculateCodeComplexity(content, language);
    const functions = await this.analyzeFunctionComplexities(content, filePath);
    const classes = await this.analyzeClassComplexities(content, filePath);
    const recommendations = this.generateRecommendations(overallComplexity, functions, classes, filePath);
    
    return {
      filePath,
      overallComplexity,
      functions,
      classes,
      recommendations
    };
  }

  async analyzeCyclomaticComplexity(code: string): Promise<number> {
    let complexity = 1; // Base complexity
    
    // Decision points that increase cyclomatic complexity
    const decisionPatterns = [
      // Conditional statements
      { pattern: /\bif\s*\(/g, weight: 1 },
      { pattern: /\belse\s+if\s*\(/g, weight: 1 },
      { pattern: /\bswitch\s*\(/g, weight: 1 },
      { pattern: /\bcase\s+/g, weight: 1 },
      
      // Loops
      { pattern: /\bfor\s*\(/g, weight: 1 },
      { pattern: /\bwhile\s*\(/g, weight: 1 },
      { pattern: /\bdo\s*\{/g, weight: 1 },
      { pattern: /\bfor\s+\w+\s+in\s+/g, weight: 1 },
      { pattern: /\bfor\s+\w+\s+of\s+/g, weight: 1 },
      
      // Exception handling
      { pattern: /\bcatch\s*\(/g, weight: 1 },
      { pattern: /\bfinally\s*\{/g, weight: 1 },
      
      // Logical operators (each && or || adds complexity)
      { pattern: /&&/g, weight: 1 },
      { pattern: /\|\|/g, weight: 1 },
      
      // Ternary operators
      { pattern: /\?[^?]*:/g, weight: 1 },
      
      // Null coalescing and optional chaining with conditions
      { pattern: /\?\?/g, weight: 1 }
    ];
    
    for (const { pattern, weight } of decisionPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length * weight;
      }
    }
    
    return complexity;
  }

  async analyzeCognitiveComplexity(code: string): Promise<number> {
    let complexity = 0;
    const lines = code.split('\n');
    let nestingLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Track nesting level
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      // Cognitive complexity patterns with nesting multipliers
      const cognitivePatterns = [
        // Conditional statements (base + nesting)
        { pattern: /\bif\s*\(/, baseWeight: 1, nestingMultiplier: true },
        { pattern: /\belse\s+if\s*\(/, baseWeight: 1, nestingMultiplier: true },
        { pattern: /\belse\s*\{/, baseWeight: 1, nestingMultiplier: true },
        { pattern: /\bswitch\s*\(/, baseWeight: 1, nestingMultiplier: true },
        { pattern: /\bcase\s+/, baseWeight: 1, nestingMultiplier: true },
        
        // Loops (base + nesting)
        { pattern: /\bfor\s*\(/, baseWeight: 1, nestingMultiplier: true },
        { pattern: /\bwhile\s*\(/, baseWeight: 1, nestingMultiplier: true },
        { pattern: /\bdo\s*\{/, baseWeight: 1, nestingMultiplier: true },
        { pattern: /\bfor\s+\w+\s+(in|of)\s+/, baseWeight: 1, nestingMultiplier: true },
        
        // Exception handling
        { pattern: /\bcatch\s*\(/, baseWeight: 1, nestingMultiplier: true },
        
        // Logical operators (no nesting multiplier)
        { pattern: /&&/, baseWeight: 1, nestingMultiplier: false },
        { pattern: /\|\|/, baseWeight: 1, nestingMultiplier: false },
        
        // Ternary operators
        { pattern: /\?[^?]*:/, baseWeight: 1, nestingMultiplier: true },
        
        // Recursion (function calls to self)
        { pattern: /\breturn\s+\w+\s*\(/, baseWeight: 1, nestingMultiplier: false },
        
        // Break/continue in loops
        { pattern: /\bbreak\s*;/, baseWeight: 1, nestingMultiplier: false },
        { pattern: /\bcontinue\s*;/, baseWeight: 1, nestingMultiplier: false }
      ];
      
      for (const { pattern, baseWeight, nestingMultiplier } of cognitivePatterns) {
        if (pattern.test(line)) {
          const weight = nestingMultiplier ? baseWeight + nestingLevel : baseWeight;
          complexity += weight;
        }
      }
      
      // Update nesting level after processing the line
      nestingLevel += openBraces - closeBraces;
      nestingLevel = Math.max(0, nestingLevel); // Prevent negative nesting
    }
    
    return complexity;
  }

  calculateMaintainabilityIndex(metrics: ComplexityMetrics): number {
    // Microsoft's Maintainability Index formula (simplified)
    // MI = 171 - 5.2 * ln(Halstead Volume) - 0.23 * (Cyclomatic Complexity) - 16.2 * ln(Lines of Code)
    // Simplified version without Halstead metrics:
    
    const { cyclomaticComplexity, linesOfCode } = metrics;
    
    if (linesOfCode === 0) return 100;
    
    // Simplified formula focusing on complexity and LOC
    const baseIndex = 171;
    const complexityPenalty = 0.23 * cyclomaticComplexity;
    const locPenalty = 16.2 * Math.log(linesOfCode);
    const halsteadPenalty = 5.2 * Math.log(linesOfCode * 2); // Approximation
    
    const maintainabilityIndex = baseIndex - halsteadPenalty - complexityPenalty - locPenalty;
    
    // Normalize to 0-100 scale
    return Math.max(0, Math.min(100, maintainabilityIndex));
  }

  async calculateComplexity(codeSnippet: string, language: string): Promise<ComplexityMetrics> {
    return await this.calculateCodeComplexity(codeSnippet, language);
  }

  async analyzeFunction(functionCode: string, language: string): Promise<any> {
    const complexity = await this.calculateCodeComplexity(functionCode, language);
    
    return {
      name: this.extractFunctionName(functionCode),
      complexity: complexity.cyclomaticComplexity,
      cognitiveComplexity: complexity.cognitiveComplexity,
      linesOfCode: complexity.linesOfCode,
      parameters: this.countParameters(functionCode),
      returnPaths: this.countReturnPaths(functionCode),
      nestedDepth: this.calculateNestingDepth(functionCode),
      suggestions: this.generateFunctionSuggestions(complexity)
    };
  }

  async calculateMetrics(entity: any, metricTypes: string[]): Promise<any> {
    const metrics: any = {};
    
    try {
      // Extract code from entity
      let code = '';
      if (typeof entity === 'string') {
        code = entity;
      } else if (entity.code) {
        code = entity.code;
      } else if (entity.content) {
        code = entity.content;
      } else if (entity.filePath) {
        code = await fs.readFile(entity.filePath, 'utf-8');
      } else {
        throw new Error('Unable to extract code from entity');
      }
      
      // Calculate requested metrics
      if (metricTypes.includes('cyclomatic') || metricTypes.includes('all')) {
        metrics.cyclomatic_complexity = await this.analyzeCyclomaticComplexity(code);
      }
      
      if (metricTypes.includes('cognitive') || metricTypes.includes('all')) {
        metrics.cognitive_complexity = await this.analyzeCognitiveComplexity(code);
      }
      
      if (metricTypes.includes('maintainability') || metricTypes.includes('all')) {
        const complexityMetrics = await this.calculateCodeComplexity(code);
        metrics.maintainability_index = complexityMetrics.maintainabilityIndex;
      }
      
      if (metricTypes.includes('halstead') || metricTypes.includes('all')) {
        metrics.halstead_metrics = this.calculateHalsteadMetrics(code);
      }
      
      if (metricTypes.includes('lines') || metricTypes.includes('all')) {
        metrics.lines_of_code = this.countLinesOfCode(code);
      }
      
      return metrics;
    } catch (error) {
      console.error('Failed to calculate metrics:', error);
      return {
        cyclomatic_complexity: 0,
        cognitive_complexity: 0,
        maintainability_index: 0,
        lines_of_code: 0,
        halstead_metrics: {
          volume: 0,
          difficulty: 0,
          effort: 0
        }
      };
    }
  }

  private getLanguageFromPath(filePath: string): string {
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
      default: return 'unknown';
    }
  }

  private countLinesOfCode(code: string): number {
    return code.split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && 
               !trimmed.startsWith('//') && 
               !trimmed.startsWith('/*') && 
               !trimmed.startsWith('*') &&
               trimmed !== '}';
      })
      .length;
  }

  private async findAndAnalyzeFunctionComplexity(content: string, functionName: string): Promise<ComplexityMetrics | null> {
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module'
      });
      
      const functionNode = this.findFunctionInAST(ast, functionName);
      if (functionNode) {
        const functionCode = this.extractFunctionCode(content, functionNode);
        return await this.calculateCodeComplexity(functionCode);
      }
    } catch (error) {
      // Fallback to Acorn
      try {
        const ast = acorn.parse(content, {
          ecmaVersion: 2022,
          sourceType: 'module',
          locations: true
        });
        
        const functionNode = this.findFunctionInAcornAST(ast, functionName);
        if (functionNode) {
          const functionCode = this.extractFunctionCodeFromAcorn(content, functionNode);
          return await this.calculateCodeComplexity(functionCode);
        }
      } catch (acornError) {
        console.warn('Failed to parse with both TypeScript and Acorn parsers');
      }
    }
    
    return null;
  }

  private findFunctionInAST(node: any, functionName: string): any {
    if (!node || typeof node !== 'object') return null;
    
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name === functionName) {
      return node;
    }
    
    // Search in child nodes
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            const result = this.findFunctionInAST(child, functionName);
            if (result) return result;
          }
        } else if (typeof node[key] === 'object') {
          const result = this.findFunctionInAST(node[key], functionName);
          if (result) return result;
        }
      }
    }
    
    return null;
  }

  private findFunctionInAcornAST(ast: any, functionName: string): any {
    let foundFunction: any = null;
    
    walk.simple(ast, {
      FunctionDeclaration: (node: any) => {
        if (node.id && node.id.name === functionName) {
          foundFunction = node;
        }
      }
    });
    
    return foundFunction;
  }

  private extractFunctionCode(content: string, functionNode: any): string {
    if (functionNode.range) {
      return content.substring(functionNode.range[0], functionNode.range[1]);
    }
    
    // Fallback: extract by line numbers
    const lines = content.split('\n');
    const startLine = (functionNode.loc?.start?.line || 1) - 1;
    const endLine = (functionNode.loc?.end?.line || lines.length) - 1;
    
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  private extractFunctionCodeFromAcorn(content: string, functionNode: any): string {
    const lines = content.split('\n');
    const startLine = (functionNode.loc?.start?.line || 1) - 1;
    const endLine = (functionNode.loc?.end?.line || lines.length) - 1;
    
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  private async analyzeFunctionComplexities(content: string, filePath: string): Promise<FunctionComplexityInfo[]> {
    const functions: FunctionComplexityInfo[] = [];
    
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module'
      });
      
      await this.collectFunctionComplexities(ast, content, functions);
    } catch (error) {
      // Fallback to Acorn
      try {
        const ast = acorn.parse(content, {
          ecmaVersion: 2022,
          sourceType: 'module',
          locations: true
        });
        
        await this.collectFunctionComplexitiesFromAcorn(ast, content, functions);
      } catch (acornError) {
        console.warn('Failed to analyze function complexities');
      }
    }
    
    return functions;
  }

  private async collectFunctionComplexities(node: any, content: string, functions: FunctionComplexityInfo[]): Promise<void> {
    if (!node || typeof node !== 'object') return;
    
    if (node.type === 'FunctionDeclaration' && node.id) {
      const functionCode = this.extractFunctionCode(content, node);
      const complexity = await this.calculateCodeComplexity(functionCode);
      
      functions.push({
        name: node.id.name,
        line: node.loc?.start?.line || 1,
        complexity,
        riskLevel: this.calculateRiskLevel(complexity)
      });
    }
    
    // Recursively process child nodes
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            await this.collectFunctionComplexities(child, content, functions);
          }
        } else if (typeof node[key] === 'object') {
          await this.collectFunctionComplexities(node[key], content, functions);
        }
      }
    }
  }

  private async collectFunctionComplexitiesFromAcorn(ast: any, content: string, functions: FunctionComplexityInfo[]): Promise<void> {
    walk.simple(ast, {
      FunctionDeclaration: async (node: any) => {
        if (node.id) {
          const functionCode = this.extractFunctionCodeFromAcorn(content, node);
          const complexity = await this.calculateCodeComplexity(functionCode);
          
          functions.push({
            name: node.id.name,
            line: node.loc?.start?.line || 1,
            complexity,
            riskLevel: this.calculateRiskLevel(complexity)
          });
        }
      }
    });
  }

  private async analyzeClassComplexities(content: string, filePath: string): Promise<ClassComplexityInfo[]> {
    const classes: ClassComplexityInfo[] = [];
    
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module'
      });
      
      await this.collectClassComplexities(ast, content, classes);
    } catch (error) {
      // Fallback to Acorn
      try {
        const ast = acorn.parse(content, {
          ecmaVersion: 2022,
          sourceType: 'module',
          locations: true
        });
        
        await this.collectClassComplexitiesFromAcorn(ast, content, classes);
      } catch (acornError) {
        console.warn('Failed to analyze class complexities');
      }
    }
    
    return classes;
  }

  private async collectClassComplexities(node: any, content: string, classes: ClassComplexityInfo[]): Promise<void> {
    if (!node || typeof node !== 'object') return;
    
    if (node.type === 'ClassDeclaration' && node.id) {
      const methods = this.extractClassMethods(node);
      let totalComplexity = 0;
      let methodCount = 0;
      
      for (const method of methods) {
        const methodCode = this.extractFunctionCode(content, method);
        const complexity = await this.calculateCodeComplexity(methodCode);
        totalComplexity += complexity.cyclomaticComplexity;
        methodCount++;
      }
      
      const averageMethodComplexity = methodCount > 0 ? totalComplexity / methodCount : 0;
      const classComplexity: ComplexityMetrics = {
        cyclomaticComplexity: totalComplexity,
        cognitiveComplexity: totalComplexity, // Simplified
        linesOfCode: this.extractClassCode(content, node).split('\n').length,
        maintainabilityIndex: 0
      };
      
      classComplexity.maintainabilityIndex = this.calculateMaintainabilityIndex(classComplexity);
      
      classes.push({
        name: node.id.name,
        line: node.loc?.start?.line || 1,
        methodCount,
        averageMethodComplexity,
        totalComplexity: classComplexity,
        riskLevel: this.calculateRiskLevel(classComplexity)
      });
    }
    
    // Recursively process child nodes
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            await this.collectClassComplexities(child, content, classes);
          }
        } else if (typeof node[key] === 'object') {
          await this.collectClassComplexities(node[key], content, classes);
        }
      }
    }
  }

  private async collectClassComplexitiesFromAcorn(ast: any, content: string, classes: ClassComplexityInfo[]): Promise<void> {
    walk.simple(ast, {
      ClassDeclaration: async (node: any) => {
        if (node.id) {
          // Simplified class analysis for Acorn
          const classCode = this.extractClassCodeFromAcorn(content, node);
          const complexity = await this.calculateCodeComplexity(classCode);
          
          classes.push({
            name: node.id.name,
            line: node.loc?.start?.line || 1,
            methodCount: 1, // Simplified
            averageMethodComplexity: complexity.cyclomaticComplexity,
            totalComplexity: complexity,
            riskLevel: this.calculateRiskLevel(complexity)
          });
        }
      }
    });
  }

  private extractClassMethods(classNode: any): any[] {
    const methods: any[] = [];
    
    if (classNode.body && classNode.body.body) {
      for (const member of classNode.body.body) {
        if (member.type === 'MethodDefinition' || member.type === 'FunctionExpression') {
          methods.push(member);
        }
      }
    }
    
    return methods;
  }

  private extractClassCode(content: string, classNode: any): string {
    if (classNode.range) {
      return content.substring(classNode.range[0], classNode.range[1]);
    }
    
    const lines = content.split('\n');
    const startLine = (classNode.loc?.start?.line || 1) - 1;
    const endLine = (classNode.loc?.end?.line || lines.length) - 1;
    
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  private extractClassCodeFromAcorn(content: string, classNode: any): string {
    const lines = content.split('\n');
    const startLine = (classNode.loc?.start?.line || 1) - 1;
    const endLine = (classNode.loc?.end?.line || lines.length) - 1;
    
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  private calculateRiskLevel(complexity: ComplexityMetrics): 'low' | 'medium' | 'high' | 'critical' {
    const { cyclomaticComplexity, maintainabilityIndex } = complexity;
    
    if (cyclomaticComplexity > 20 || maintainabilityIndex < 20) {
      return 'critical';
    } else if (cyclomaticComplexity > 10 || maintainabilityIndex < 40) {
      return 'high';
    } else if (cyclomaticComplexity > 5 || maintainabilityIndex < 60) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private generateRecommendations(
    overallComplexity: ComplexityMetrics,
    functions: FunctionComplexityInfo[],
    classes: ClassComplexityInfo[],
    filePath: string
  ): ComplexityRecommendation[] {
    const recommendations: ComplexityRecommendation[] = [];
    
    // File-level recommendations
    if (overallComplexity.cyclomaticComplexity > 50) {
      recommendations.push({
        type: 'file',
        target: path.basename(filePath),
        issue: 'File has very high overall complexity',
        suggestion: 'Consider splitting this file into smaller, more focused modules',
        priority: 'high'
      });
    }
    
    if (overallComplexity.maintainabilityIndex < 30) {
      recommendations.push({
        type: 'file',
        target: path.basename(filePath),
        issue: 'File has low maintainability index',
        suggestion: 'Refactor to reduce complexity and improve code organization',
        priority: 'high'
      });
    }
    
    // Function-level recommendations
    for (const func of functions) {
      if (func.riskLevel === 'critical' || func.riskLevel === 'high') {
        recommendations.push({
          type: 'function',
          target: func.name,
          issue: `Function has ${func.riskLevel} complexity (CC: ${func.complexity.cyclomaticComplexity})`,
          suggestion: 'Break this function into smaller, single-purpose functions',
          priority: func.riskLevel === 'critical' ? 'high' : 'medium'
        });
      }
    }
    
    // Class-level recommendations
    for (const cls of classes) {
      if (cls.methodCount > 20) {
        recommendations.push({
          type: 'class',
          target: cls.name,
          issue: `Class has too many methods (${cls.methodCount})`,
          suggestion: 'Consider splitting this class using composition or inheritance',
          priority: 'medium'
        });
      }
      
      if (cls.averageMethodComplexity > 10) {
        recommendations.push({
          type: 'class',
          target: cls.name,
          issue: `Class methods have high average complexity (${cls.averageMethodComplexity.toFixed(1)})`,
          suggestion: 'Simplify method implementations and extract helper functions',
          priority: 'medium'
        });
      }
    }
    
    return recommendations;
  }

  private calculateHalsteadMetrics(code: string): any {
    // Simple Halstead metrics calculation
    const operators = code.match(/[+\-*/=<>!&|^%~?:;,(){}\[\]]/g) || [];
    const operands = code.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];
    
    const uniqueOperators = new Set(operators).size;
    const uniqueOperands = new Set(operands).size;
    const totalOperators = operators.length;
    const totalOperands = operands.length;
    
    const vocabulary = uniqueOperators + uniqueOperands;
    const length = totalOperators + totalOperands;
    const volume = length * Math.log2(vocabulary || 1);
    const difficulty = (uniqueOperators / 2) * (totalOperands / (uniqueOperands || 1));
    const effort = difficulty * volume;
    
    return {
      volume: Math.round(volume),
      difficulty: Math.round(difficulty * 10) / 10,
      effort: Math.round(effort)
    };
  }

  private extractFunctionName(code: string): string {
    const functionMatch = code.match(/function\s+(\w+)|const\s+(\w+)\s*=|class\s+(\w+)/);
    return functionMatch ? (functionMatch[1] || functionMatch[2] || functionMatch[3]) : 'anonymous';
  }

  private countParameters(code: string): number {
    const paramMatch = code.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1].trim()) return 0;
    
    return paramMatch[1].split(',').filter(p => p.trim().length > 0).length;
  }

  private countReturnPaths(code: string): number {
    const returns = code.match(/\breturn\b/g);
    return returns ? returns.length : 1; // At least one implicit return
  }

  private calculateNestingDepth(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (const char of code) {
      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}') {
        currentDepth--;
      }
    }
    
    return maxDepth;
  }

  private generateFunctionSuggestions(complexity: ComplexityMetrics): string[] {
    const suggestions: string[] = [];
    
    if (complexity.cyclomaticComplexity > 10) {
      suggestions.push('Consider breaking down this function');
    }
    
    if (complexity.linesOfCode > 50) {
      suggestions.push('Function is too long, consider splitting it');
    }
    
    if (complexity.maintainabilityIndex < 50) {
      suggestions.push('Low maintainability - refactor recommended');
    }
    
    return suggestions;
  }
}