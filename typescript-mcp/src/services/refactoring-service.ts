import type { RefactoringSuggestion, RefactoringOptions, CodeSmell } from '../types/index.js';
import { parse } from '@typescript-eslint/typescript-estree';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { distance } from 'fast-levenshtein';

export interface RefactoringService {
  analyzeFile(filePath: string): Promise<RefactoringSuggestion[]>;
  suggestExtractMethod(filePath: string, startLine: number, endLine: number): Promise<RefactoringSuggestion[]>;
  suggestExtractVariable(filePath: string, line: number, expression: string): Promise<RefactoringSuggestion[]>;
  suggestRenameSymbol(filePath: string, symbolName: string, newName: string): Promise<RefactoringSuggestion[]>;
  detectCodeSmells(filePath: string): Promise<RefactoringSuggestion[]>;
  suggestDesignPatterns(filePath: string): Promise<RefactoringSuggestion[]>;
  optimizeImports(filePath: string): Promise<RefactoringSuggestion[]>;
  analyzeMetrics(entity: any): Promise<any>;
}

export interface RefactoringPattern {
  name: string;
  description: string;
  detector: (code: string, ast?: any) => RefactoringMatch[];
  confidence: number;
}

export interface RefactoringMatch {
  line: number;
  column: number;
  length: number;
  originalCode: string;
  suggestedCode: string;
  reason: string;
}

export interface CodeSmellPattern {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  detector: (code: string, ast?: any) => CodeSmellMatch[];
}

export interface CodeSmellMatch {
  line: number;
  column: number;
  code: string;
  issue: string;
  suggestion: string;
}

export class DefaultRefactoringService implements RefactoringService {
  
  async suggestRefactorings(codebaseId: string, options?: RefactoringOptions): Promise<RefactoringSuggestion[]> {
    const suggestions: RefactoringSuggestion[] = [];
    
    try {
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
      });
      
      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const fileSuggestions = await this.analyzeFileForRefactoring(filePath, content, options);
          suggestions.push(...fileSuggestions);
        } catch (error) {
          console.warn(`Failed to analyze ${filePath}:`, error);
        }
      }
      
      // Sort by priority and confidence
      return this.sortSuggestionsByPriority(suggestions);
    } catch (error) {
      console.error('Failed to suggest refactorings:', error);
      return [];
    }
  }

  async analyzeCodeSmells(codebaseId: string): Promise<CodeSmell[]> {
    const codeSmells: CodeSmell[] = [];
    
    try {
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
      });
      
      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const fileSmells = await this.detectCodeSmells(filePath);
          // Convert RefactoringSuggestion to CodeSmell format
          const convertedSmells = fileSmells.map(smell => ({
            type: smell.type,
            severity: smell.priority as 'low' | 'medium' | 'high',
            file: smell.file,
            line: smell.line,
            description: smell.description,
            suggestion: smell.impact,
            metrics: { confidence: smell.confidence }
          }));
          codeSmells.push(...convertedSmells);
        } catch (error) {
          console.warn(`Failed to analyze code smells in ${filePath}:`, error);
        }
      }
      
      // Sort by severity
      return this.sortSmellsBySeverity(codeSmells);
    } catch (error) {
      console.error('Failed to analyze code smells:', error);
      return [];
    }
  }
  private refactoringPatterns: RefactoringPattern[] = [
    {
      name: 'Extract Method',
      description: 'Long methods should be broken into smaller methods',
      confidence: 0.8,
      detector: this.detectLongMethods.bind(this)
    },
    {
      name: 'Extract Variable',
      description: 'Complex expressions should be extracted into variables',
      confidence: 0.7,
      detector: this.detectComplexExpressions.bind(this)
    },
    {
      name: 'Inline Variable',
      description: 'Unnecessary variables should be inlined',
      confidence: 0.6,
      detector: this.detectUnnecessaryVariables.bind(this)
    },
    {
      name: 'Replace Magic Numbers',
      description: 'Magic numbers should be replaced with named constants',
      confidence: 0.9,
      detector: this.detectMagicNumbers.bind(this)
    },
    {
      name: 'Simplify Conditionals',
      description: 'Complex conditional expressions can be simplified',
      confidence: 0.7,
      detector: this.detectComplexConditionals.bind(this)
    }
  ];

  private codeSmellPatterns: CodeSmellPattern[] = [
    {
      name: 'Long Parameter List',
      description: 'Functions with too many parameters',
      severity: 'medium',
      detector: this.detectLongParameterLists.bind(this)
    },
    {
      name: 'Duplicate Code',
      description: 'Similar code blocks that could be extracted',
      severity: 'high',
      detector: this.detectDuplicateCode.bind(this)
    },
    {
      name: 'Dead Code',
      description: 'Unused variables and functions',
      severity: 'low',
      detector: this.detectDeadCode.bind(this)
    },
    {
      name: 'God Class',
      description: 'Classes with too many responsibilities',
      severity: 'high',
      detector: this.detectGodClasses.bind(this)
    },
    {
      name: 'Feature Envy',
      description: 'Methods that use more features of another class',
      severity: 'medium',
      detector: this.detectFeatureEnvy.bind(this)
    }
  ];

  async analyzeFile(filePath: string): Promise<RefactoringSuggestion[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const suggestions: RefactoringSuggestion[] = [];
    
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module'
      });
      
      // Apply all refactoring patterns
      for (const pattern of this.refactoringPatterns) {
        const matches = pattern.detector(content, ast);
        for (const match of matches) {
          suggestions.push({
            id: this.generateId(),
            type: pattern.name.toLowerCase().replace(/\s+/g, '_'),
            priority: 'medium',
            file: filePath,
            line: match.line,
            description: `${pattern.description}: ${match.reason}`,
            before: match.originalCode,
            after: match.suggestedCode,
            impact: 'Improves code maintainability',
            confidence: pattern.confidence
          });
        }
      }
      
      // Detect code smells
      const codeSmells = await this.detectCodeSmells(filePath);
      suggestions.push(...codeSmells);
      
    } catch (error) {
      console.warn(`Failed to parse ${filePath}:`, error);
      // Fallback to text-based analysis
      const textBasedSuggestions = await this.analyzeWithTextPatterns(content, filePath);
      suggestions.push(...textBasedSuggestions);
    }
    
    return suggestions;
  }

  async suggestExtractMethod(filePath: string, startLine: number, endLine: number): Promise<RefactoringSuggestion[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const selectedCode = lines.slice(startLine - 1, endLine).join('\n');
    
    // Analyze the selected code block
    const variables = this.extractVariables(selectedCode);
    const parameters = variables.filter(v => this.isUsedBeforeDefinition(v, selectedCode));
    const returnValues = variables.filter(v => this.isUsedAfterBlock(v, content, endLine));
    
    const methodName = this.suggestMethodName(selectedCode);
    const parameterList = parameters.join(', ');
    const returnType = returnValues.length > 1 ? `{${returnValues.join(', ')}}` : returnValues[0] || 'void';
    
    const extractedMethod = `
  private ${methodName}(${parameterList}): ${returnType} {
${selectedCode.split('\n').map(line => '    ' + line).join('\n')}
${returnValues.length > 0 ? `    return ${returnValues.length > 1 ? `{${returnValues.join(', ')}}` : returnValues[0]};` : ''}
  }`;
    
    const methodCall = returnValues.length > 0 
      ? `const ${returnValues.length > 1 ? `{${returnValues.join(', ')}}` : returnValues[0]} = this.${methodName}(${parameters.join(', ')});`
      : `this.${methodName}(${parameters.join(', ')});`;
    
    return [{
      id: this.generateId(),
      type: 'extract_method',
      priority: 'medium',
      file: filePath,
      line: startLine,
      description: `Extract ${endLine - startLine + 1} lines into a separate method`,
      before: selectedCode,
      after: methodCall + extractedMethod,
      impact: 'Improves code organization',
      confidence: 0.8
    }];
  }

  async suggestExtractVariable(filePath: string, line: number, expression: string): Promise<RefactoringSuggestion[]> {
    const variableName = this.suggestVariableName(expression);
    const extractedVariable = `const ${variableName} = ${expression};`;
    
    return [{
      id: this.generateId(),
      type: 'extract_variable',
      priority: 'low',
      file: filePath,
      line: line,
      description: `Extract complex expression into variable '${variableName}'`,
      before: expression,
      after: extractedVariable + `\n    ${variableName}`,
      impact: 'Improves code readability',
      confidence: 0.7
    }];
  }

  async suggestRenameSymbol(filePath: string, symbolName: string, newName: string): Promise<RefactoringSuggestion[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const occurrences = this.findSymbolOccurrences(content, symbolName);
    
    const suggestions: RefactoringSuggestion[] = [];
    
    for (const occurrence of occurrences) {
      suggestions.push({
        id: this.generateId(),
        type: 'rename_symbol',
        priority: 'medium',
        file: filePath,
        line: occurrence.line,
        description: `Rename '${symbolName}' to '${newName}'`,
        before: symbolName,
        after: newName,
        impact: 'Improves code clarity',
        confidence: 0.9
      });
    }
    
    return suggestions;
  }

  async detectCodeSmells(filePath: string): Promise<RefactoringSuggestion[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const suggestions: RefactoringSuggestion[] = [];
    
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module'
      });
      
      for (const pattern of this.codeSmellPatterns) {
        const matches = pattern.detector(content, ast);
        for (const match of matches) {
          suggestions.push({
            id: this.generateId(),
            type: pattern.name.toLowerCase().replace(/\s+/g, '_'),
            priority: pattern.severity === 'high' ? 'high' : pattern.severity === 'medium' ? 'medium' : 'low',
            file: filePath,
            line: match.line,
            description: `${pattern.description}: ${match.issue}`,
            before: match.code,
            after: match.suggestion,
            impact: 'Reduces code smells',
            confidence: pattern.severity === 'high' ? 0.9 : pattern.severity === 'medium' ? 0.7 : 0.5
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to detect code smells in ${filePath}:`, error);
    }
    
    return suggestions;
  }

  async suggestDesignPatterns(filePath: string): Promise<RefactoringSuggestion[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const suggestions: RefactoringSuggestion[] = [];
    
    // Detect opportunities for common design patterns
    
    // Strategy Pattern
    if (this.detectStrategyPatternOpportunity(content)) {
      suggestions.push({
        id: this.generateId(),
        type: 'strategy_pattern',
        priority: 'medium',
        file: filePath,
        line: 1,
        description: 'Consider implementing Strategy pattern for conditional logic',
        before: 'Multiple if-else or switch statements',
        after: 'Strategy interface with concrete implementations',
        impact: 'Improves code flexibility',
        confidence: 0.6
      });
    }
    
    // Factory Pattern
    if (this.detectFactoryPatternOpportunity(content)) {
      suggestions.push({
        id: this.generateId(),
        type: 'factory_pattern',
        priority: 'medium',
        file: filePath,
        line: 1,
        description: 'Consider implementing Factory pattern for object creation',
        before: 'Direct object instantiation with complex logic',
        after: 'Factory method or class for object creation',
        impact: 'Improves code maintainability',
        confidence: 0.6
      });
    }
    
    // Observer Pattern
    if (this.detectObserverPatternOpportunity(content)) {
      suggestions.push({
        id: this.generateId(),
        type: 'observer_pattern',
        priority: 'medium',
        file: filePath,
        line: 1,
        description: 'Consider implementing Observer pattern for event handling',
        before: 'Direct method calls for notifications',
        after: 'Observer interface with subject-observer relationship',
        impact: 'Improves code flexibility and maintainability',
        confidence: 0.6
      });
    }
    
    return suggestions;
  }

  async optimizeImports(filePath: string): Promise<RefactoringSuggestion[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const suggestions: RefactoringSuggestion[] = [];
    
    const lines = content.split('\n');
    const imports: string[] = [];
    const usedImports = new Set<string>();
    
    // Collect all imports
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('import ')) {
        imports.push(line);
        
        // Extract imported names
        const importMatch = line.match(/import\s+(?:{([^}]+)}|([^\s]+))\s+from/);
        if (importMatch) {
          const namedImports = importMatch[1];
          const defaultImport = importMatch[2];
          
          if (namedImports) {
            namedImports.split(',').forEach(name => {
              const trimmed = name.trim();
              if (content.includes(trimmed)) {
                usedImports.add(trimmed);
              }
            });
          }
          
          if (defaultImport && content.includes(defaultImport)) {
            usedImports.add(defaultImport);
          }
        }
      }
    }
    
    // Detect unused imports
    for (let i = 0; i < imports.length; i++) {
      const importLine = imports[i];
      const importMatch = importLine.match(/import\s+(?:{([^}]+)}|([^\s]+))\s+from/);
      
      if (importMatch) {
        const namedImports = importMatch[1];
        const defaultImport = importMatch[2];
        
        let hasUnusedImports = false;
        
        if (namedImports) {
          const names = namedImports.split(',').map(n => n.trim());
          const unusedNames = names.filter(name => !usedImports.has(name));
          
          if (unusedNames.length > 0) {
            hasUnusedImports = true;
            const usedNames = names.filter(name => usedImports.has(name));
            const optimizedImport = usedNames.length > 0 
              ? importLine.replace(`{${namedImports}}`, `{${usedNames.join(', ')}}`)
              : '';
            
            suggestions.push({
              id: this.generateId(),
              type: 'optimize_imports',
              priority: 'low',
              file: filePath,
              line: i + 1,
              description: `Remove unused imports: ${unusedNames.join(', ')}`,
              before: importLine,
              after: optimizedImport,
              impact: 'Reduces unused code',
              confidence: 0.9
            });
          }
        }
        
        if (defaultImport && !usedImports.has(defaultImport)) {
          suggestions.push({
            id: this.generateId(),
            type: 'optimize_imports',
            priority: 'low',
            file: filePath,
            line: i + 1,
            description: `Remove unused import: ${defaultImport}`,
            before: importLine,
            after: '',
            impact: 'Reduces unused code',
            confidence: 0.9
          });
        }
      }
    }
    
    return suggestions;
  }

  // Pattern detection methods
  private detectLongMethods(code: string, ast?: any): RefactoringMatch[] {
    const matches: RefactoringMatch[] = [];
    const lines = code.split('\n');
    
    if (ast) {
      this.traverseAST(ast, (node: any) => {
        if (node.type === 'FunctionDeclaration' || node.type === 'MethodDefinition') {
          const startLine = node.loc?.start?.line || 1;
          const endLine = node.loc?.end?.line || startLine;
          const methodLength = endLine - startLine;
          
          if (methodLength > 20) {
            const functionName = node.id?.name || node.key?.name || 'anonymous';
            matches.push({
              line: startLine,
              column: node.loc?.start?.column || 0,
              length: methodLength,
              originalCode: lines.slice(startLine - 1, endLine).join('\n'),
              suggestedCode: `// Consider breaking ${functionName} into smaller methods`,
              reason: `Method is ${methodLength} lines long (recommended: < 20 lines)`
            });
          }
        }
      });
    }
    
    return matches;
  }

  private detectComplexExpressions(code: string, ast?: any): RefactoringMatch[] {
    const matches: RefactoringMatch[] = [];
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect complex expressions (simplified heuristic)
      const complexityIndicators = [
        /\([^)]*\([^)]*\)/g, // Nested parentheses
        /\?[^:]*:[^;]*/g,    // Ternary operators
        /&&.*\|\|/g,         // Mixed logical operators
        /\.[^.]*\.[^.]*\./g  // Chained method calls
      ];
      
      for (const pattern of complexityIndicators) {
        const match = line.match(pattern);
        if (match) {
          const variableName = this.suggestVariableName(match[0]);
          matches.push({
            line: i + 1,
            column: line.indexOf(match[0]),
            length: match[0].length,
            originalCode: match[0],
            suggestedCode: `const ${variableName} = ${match[0]};\n    ${variableName}`,
            reason: 'Complex expression should be extracted for readability'
          });
        }
      }
    }
    
    return matches;
  }

  private detectUnnecessaryVariables(code: string, ast?: any): RefactoringMatch[] {
    const matches: RefactoringMatch[] = [];
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect variables that are used only once immediately after declaration
      const varMatch = line.match(/^\s*(const|let|var)\s+(\w+)\s*=\s*(.+);?$/);
      if (varMatch && i + 1 < lines.length) {
        const varName = varMatch[2];
        const nextLine = lines[i + 1];
        
        if (nextLine.includes(varName) && !this.isUsedElsewhere(varName, lines, i + 2)) {
          matches.push({
            line: i + 1,
            column: 0,
            length: line.length,
            originalCode: line + '\n' + nextLine,
            suggestedCode: nextLine.replace(varName, varMatch[3]),
            reason: `Variable '${varName}' is used only once and can be inlined`
          });
        }
      }
    }
    
    return matches;
  }

  private detectMagicNumbers(code: string, ast?: any): RefactoringMatch[] {
    const matches: RefactoringMatch[] = [];
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find magic numbers (numbers > 1 that aren't in comments or strings)
      const magicNumberPattern = /\b(\d{2,})\b/g;
      let match;
      
      while ((match = magicNumberPattern.exec(line)) !== null) {
        const number = match[1];
        
        // Skip if it's in a comment or string
        if (this.isInCommentOrString(line, match.index)) continue;
        
        // Skip common non-magic numbers
        if (['100', '200', '404', '500'].includes(number)) continue;
        
        const constantName = this.suggestConstantName(number, line);
        matches.push({
          line: i + 1,
          column: match.index,
          length: number.length,
          originalCode: number,
          suggestedCode: `const ${constantName} = ${number};\n    // Use ${constantName} instead of ${number}`,
          reason: `Magic number ${number} should be replaced with a named constant`
        });
      }
    }
    
    return matches;
  }

  private detectComplexConditionals(code: string, ast?: any): RefactoringMatch[] {
    const matches: RefactoringMatch[] = [];
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect complex if conditions
      const complexConditionPattern = /if\s*\(([^)]*(?:\|\||&&)[^)]*)\)/;
      const match = line.match(complexConditionPattern);
      
      if (match) {
        const condition = match[1];
        const operators = (condition.match(/\|\||&&/g) || []).length;
        
        if (operators >= 2) {
          const methodName = this.suggestPredicateMethodName(condition);
          matches.push({
            line: i + 1,
            column: line.indexOf(condition),
            length: condition.length,
            originalCode: `if (${condition})`,
            suggestedCode: `private ${methodName}(): boolean {\n    return ${condition};\n  }\n\n  // Use: if (this.${methodName}())`,
            reason: 'Complex conditional should be extracted into a predicate method'
          });
        }
      }
    }
    
    return matches;
  }

  // Code smell detection methods
  private detectLongParameterLists(code: string, ast?: any): CodeSmellMatch[] {
    const matches: CodeSmellMatch[] = [];
    
    if (ast) {
      this.traverseAST(ast, (node: any) => {
        if ((node.type === 'FunctionDeclaration' || node.type === 'MethodDefinition') && node.params) {
          if (node.params.length > 5) {
            const functionName = node.id?.name || node.key?.name || 'anonymous';
            matches.push({
              line: node.loc?.start?.line || 1,
              column: node.loc?.start?.column || 0,
              code: `${functionName}(${node.params.length} parameters)`,
              issue: `Function has ${node.params.length} parameters (recommended: ≤ 5)`,
              suggestion: 'Consider using parameter objects or breaking the function into smaller functions'
            });
          }
        }
      });
    }
    
    return matches;
  }

  private detectDuplicateCode(code: string, ast?: any): CodeSmellMatch[] {
    const matches: CodeSmellMatch[] = [];
    const lines = code.split('\n');
    
    // Simple duplicate detection using line similarity
    for (let i = 0; i < lines.length - 3; i++) {
      const block1 = lines.slice(i, i + 3).join('\n');
      
      for (let j = i + 3; j < lines.length - 2; j++) {
        const block2 = lines.slice(j, j + 3).join('\n');
        
        const similarity = 1 - (distance(block1, block2) / Math.max(block1.length, block2.length));
        
        if (similarity > 0.8) {
          matches.push({
            line: i + 1,
            column: 0,
            code: block1,
            issue: `Similar code block found at line ${j + 1}`,
            suggestion: 'Extract common code into a shared function'
          });
        }
      }
    }
    
    return matches;
  }

  private detectDeadCode(code: string, ast?: any): CodeSmellMatch[] {
    const matches: CodeSmellMatch[] = [];
    
    // Simple dead code detection (unused variables)
    const lines = code.split('\n');
    const declaredVariables = new Set<string>();
    const usedVariables = new Set<string>();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find variable declarations
      const varDeclaration = line.match(/^\s*(const|let|var)\s+(\w+)/);
      if (varDeclaration) {
        declaredVariables.add(varDeclaration[2]);
      }
      
      // Find variable usage
      for (const variable of declaredVariables) {
        if (line.includes(variable) && !line.match(new RegExp(`^\\s*(const|let|var)\\s+${variable}`))) {
          usedVariables.add(variable);
        }
      }
    }
    
    // Report unused variables
    for (const variable of declaredVariables) {
      if (!usedVariables.has(variable)) {
        const declarationLine = this.findVariableDeclarationLine(lines, variable);
        if (declarationLine > 0) {
          matches.push({
            line: declarationLine,
            column: 0,
            code: lines[declarationLine - 1],
            issue: `Variable '${variable}' is declared but never used`,
            suggestion: `Remove unused variable '${variable}'`
          });
        }
      }
    }
    
    return matches;
  }

  private detectGodClasses(code: string, ast?: any): CodeSmellMatch[] {
    const matches: CodeSmellMatch[] = [];
    
    if (ast) {
      this.traverseAST(ast, (node: any) => {
        if (node.type === 'ClassDeclaration' && node.body) {
          const methods = node.body.body.filter((member: any) => 
            member.type === 'MethodDefinition'
          );
          
          if (methods.length > 15) {
            const className = node.id?.name || 'anonymous';
            matches.push({
              line: node.loc?.start?.line || 1,
              column: node.loc?.start?.column || 0,
              code: `class ${className}`,
              issue: `Class has ${methods.length} methods (recommended: ≤ 15)`,
              suggestion: 'Consider splitting this class into smaller, more focused classes'
            });
          }
        }
      });
    }
    
    return matches;
  }

  private detectFeatureEnvy(code: string, ast?: any): CodeSmellMatch[] {
    const matches: CodeSmellMatch[] = [];
    
    // This is a simplified detection - in practice, this would require
    // more sophisticated analysis of method calls and dependencies
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for methods that make many calls to another object
      const externalCalls = line.match(/\w+\./g);
      if (externalCalls && externalCalls.length > 3) {
        matches.push({
          line: i + 1,
          column: 0,
          code: line.trim(),
          issue: 'Method makes many calls to external objects',
          suggestion: 'Consider moving this functionality to the class being heavily used'
        });
      }
    }
    
    return matches;
  }

  // Helper methods
  private traverseAST(node: any, callback: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;
    
    callback(node);
    
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.traverseAST(child, callback);
          }
        } else if (typeof node[key] === 'object') {
          this.traverseAST(node[key], callback);
        }
      }
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private extractVariables(code: string): string[] {
    const variables: string[] = [];
    const varPattern = /\b(const|let|var)\s+(\w+)/g;
    let match;
    
    while ((match = varPattern.exec(code)) !== null) {
      variables.push(match[2]);
    }
    
    return variables;
  }

  private isUsedBeforeDefinition(variable: string, code: string): boolean {
    const lines = code.split('\n');
    let definitionLine = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`${variable} =`) || lines[i].includes(`${variable}:`)) {
        definitionLine = i;
        break;
      }
    }
    
    if (definitionLine === -1) return true; // Assume it's a parameter
    
    for (let i = 0; i < definitionLine; i++) {
      if (lines[i].includes(variable)) {
        return true;
      }
    }
    
    return false;
  }

  private isUsedAfterBlock(variable: string, fullCode: string, endLine: number): boolean {
    const lines = fullCode.split('\n');
    
    for (let i = endLine; i < lines.length; i++) {
      if (lines[i].includes(variable)) {
        return true;
      }
    }
    
    return false;
  }

  private suggestMethodName(code: string): string {
    // Simple heuristic to suggest method names based on code content
    if (code.includes('validate')) return 'validateData';
    if (code.includes('calculate')) return 'calculateResult';
    if (code.includes('process')) return 'processData';
    if (code.includes('format')) return 'formatOutput';
    if (code.includes('parse')) return 'parseInput';
    
    return 'extractedMethod';
  }

  private suggestVariableName(expression: string): string {
    // Simple heuristic to suggest variable names
    if (expression.includes('length')) return 'length';
    if (expression.includes('count')) return 'count';
    if (expression.includes('index')) return 'index';
    if (expression.includes('result')) return 'result';
    if (expression.includes('value')) return 'value';
    
    return 'extractedValue';
  }

  private suggestConstantName(number: string, context: string): string {
    if (context.includes('timeout')) return `TIMEOUT_${number}_MS`;
    if (context.includes('limit')) return `LIMIT_${number}`;
    if (context.includes('max')) return `MAX_${number}`;
    if (context.includes('min')) return `MIN_${number}`;
    
    return `CONSTANT_${number}`;
  }

  private suggestPredicateMethodName(condition: string): string {
    if (condition.includes('null')) return 'isValid';
    if (condition.includes('empty')) return 'isEmpty';
    if (condition.includes('length')) return 'hasValidLength';
    if (condition.includes('type')) return 'isCorrectType';
    
    return 'checkCondition';
  }

  private findSymbolOccurrences(code: string, symbol: string): Array<{line: number, column: number}> {
    const occurrences: Array<{line: number, column: number}> = [];
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let index = 0;
      
      while ((index = line.indexOf(symbol, index)) !== -1) {
        // Check if it's a whole word
        const before = index > 0 ? line[index - 1] : ' ';
        const after = index + symbol.length < line.length ? line[index + symbol.length] : ' ';
        
        if (!/\w/.test(before) && !/\w/.test(after)) {
          occurrences.push({ line: i + 1, column: index + 1 });
        }
        
        index += symbol.length;
      }
    }
    
    return occurrences;
  }

  private isInCommentOrString(line: string, position: number): boolean {
    const beforePosition = line.substring(0, position);
    
    // Check for line comments
    if (beforePosition.includes('//')) return true;
    
    // Check for strings (simplified)
    const singleQuotes = (beforePosition.match(/'/g) || []).length;
    const doubleQuotes = (beforePosition.match(/"/g) || []).length;
    const backticks = (beforePosition.match(/`/g) || []).length;
    
    return (singleQuotes % 2 === 1) || (doubleQuotes % 2 === 1) || (backticks % 2 === 1);
  }

  private isUsedElsewhere(variable: string, lines: string[], startIndex: number): boolean {
    for (let i = startIndex; i < lines.length; i++) {
      if (lines[i].includes(variable)) {
        return true;
      }
    }
    return false;
  }

  private findVariableDeclarationLine(lines: string[], variable: string): number {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(new RegExp(`^\\s*(const|let|var)\\s+${variable}\\b`))) {
        return i + 1;
      }
    }
    return 0;
  }

  private detectStrategyPatternOpportunity(code: string): boolean {
    // Look for multiple if-else or switch statements that could benefit from Strategy pattern
    const switchCount = (code.match(/switch\s*\(/g) || []).length;
    const ifElseCount = (code.match(/if\s*\([^)]*\)\s*{[^}]*}\s*else/g) || []).length;
    
    return switchCount > 2 || ifElseCount > 3;
  }

  private detectFactoryPatternOpportunity(code: string): boolean {
    // Look for multiple 'new' statements with conditional logic
    const newStatements = (code.match(/new\s+\w+\s*\(/g) || []).length;
    const conditionals = (code.match(/if\s*\(/g) || []).length;
    
    return newStatements > 3 && conditionals > 2;
  }

  private detectObserverPatternOpportunity(code: string): boolean {
    // Look for event-like method calls or callback patterns
    const eventPatterns = [
      /\w+\.on\(/g,
      /\w+\.addEventListener\(/g,
      /\w+\.subscribe\(/g,
      /\w+\.notify\(/g
    ];
    
    let eventCount = 0;
    for (const pattern of eventPatterns) {
      eventCount += (code.match(pattern) || []).length;
    }
    
    return eventCount > 2;
  }

  private async analyzeWithTextPatterns(content: string, filePath: string): Promise<RefactoringSuggestion[]> {
    const suggestions: RefactoringSuggestion[] = [];
    const lines = content.split('\n');
    
    // Basic text-based analysis when AST parsing fails
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect long lines
      if (line.length > 120) {
        suggestions.push({
          id: this.generateId(),
          type: 'long_line',
          priority: 'low',
          file: filePath,
          line: i + 1,
          description: 'Line is too long and should be broken up',
          before: line,
          after: '// Break this line into multiple lines',
          impact: 'Improves code readability',
          confidence: 0.7
        });
      }
      
      // Detect TODO comments
      if (/\b(TODO|FIXME|HACK)\b/i.test(line)) {
        suggestions.push({
          id: this.generateId(),
          type: 'todo_comment',
          priority: 'low',
          file: filePath,
          line: i + 1,
          description: 'TODO comment should be addressed',
          before: line.trim(),
          after: '// Create proper issue or implement the TODO',
          impact: 'Improves code quality',
          confidence: 0.6
        });
      }
    }
    
    return suggestions;
  }

  async analyzeMetrics(entity: any): Promise<any> {
    // Mock implementation for now
    return {
      complexity: 5,
      maintainability: 80,
      testability: 70,
      reusability: 60
    };
  }

  private async analyzeFileForRefactoring(filePath: string, content: string, options?: RefactoringOptions): Promise<RefactoringSuggestion[]> {
    const suggestions: RefactoringSuggestion[] = [];
    const relativePath = path.relative(process.cwd(), filePath);
    
    try {
      // Parse AST
      const ast = acorn.parse(content, {
        ecmaVersion: 2020,
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true
      });
      
      // Analyze for various refactoring opportunities
      this.detectLargeClasses(ast, content, suggestions, relativePath);
      this.detectComplexConditions(ast, content, suggestions, relativePath);
      
    } catch (error) {
      // Fallback to regex-based analysis
      this.analyzeWithRegex(content, suggestions, relativePath);
    }
    
    return suggestions;
  }





  private detectLargeClasses(ast: any, content: string, suggestions: RefactoringSuggestion[], filePath: string): void {
    this.traverseAST(ast, (node: any) => {
      if (node.type === 'ClassDeclaration') {
        const className = node.id?.name || 'anonymous';
        const methods = this.countClassMethods(node);
        const startLine = node.loc?.start?.line || 1;
        const endLine = node.loc?.end?.line || startLine;
        const lineCount = endLine - startLine + 1;
        
        if (methods > 20 || lineCount > 500) {
          suggestions.push({
            id: `large_class_${suggestions.length}`,
            type: 'extract_class',
            priority: 'high',
            file: filePath,
            line: startLine,
            description: `Class '${className}' is too large (${methods} methods, ${lineCount} lines)`,
            before: this.extractCodeSnippet(content, startLine, Math.min(startLine + 10, endLine)),
            after: `// Split into multiple classes\nclass ${className}Part1 { }\nclass ${className}Part2 { }`,
            impact: 'Improves class cohesion and reduces complexity',
            confidence: 0.75
          });
        }
      }
    });
  }

  private detectComplexConditions(ast: any, content: string, suggestions: RefactoringSuggestion[], filePath: string): void {
    this.traverseAST(ast, (node: any) => {
      if (node.type === 'IfStatement' || node.type === 'ConditionalExpression') {
        const complexity = this.calculateConditionComplexity(node);
        const startLine = node.loc?.start?.line || 1;
        
        if (complexity > 5) {
          suggestions.push({
            id: `complex_condition_${suggestions.length}`,
            type: 'simplify_condition',
            priority: 'medium',
            file: filePath,
            line: startLine,
            description: `Complex condition detected (complexity: ${complexity})`,
            before: this.extractCodeSnippet(content, startLine, startLine + 2),
            after: '// Extract to descriptive method\nif (isValidCondition()) { }',
            impact: 'Improves code readability and understanding',
            confidence: 0.7
          });
        }
      }
    });
  }

  private analyzeWithRegex(content: string, suggestions: RefactoringSuggestion[], filePath: string): void {
    const lines = content.split('\n');
    
    // Detect long functions with regex
    const functionPattern = /function\s+(\w+)|const\s+(\w+)\s*=\s*\(/g;
    let match;
    
    while ((match = functionPattern.exec(content)) !== null) {
      const functionName = match[1] || match[2];
      const startLine = content.substring(0, match.index).split('\n').length;
      const functionEnd = this.findFunctionEnd(content, match.index);
      const functionLines = content.substring(match.index, functionEnd).split('\n').length;
      
      if (functionLines > 50) {
        suggestions.push({
          id: `long_function_${suggestions.length}`,
          type: 'extract_method',
          priority: 'medium',
          file: filePath,
          line: startLine,
          description: `Function '${functionName}' is too long (${functionLines} lines)`,
          before: lines.slice(startLine - 1, startLine + 4).join('\n'),
          after: `// Refactored ${functionName}\nfunction ${functionName}() {\n  // Implementation\n}`,
          impact: 'Improves readability and maintainability',
          confidence: 0.6
        });
      }
    }
  }



  private detectLongMethodSmells(ast: any, content: string, smells: CodeSmell[], filePath: string): void {
    this.traverseAST(ast, (node: any) => {
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
        const startLine = node.loc?.start?.line || 1;
        const endLine = node.loc?.end?.line || startLine;
        const lineCount = endLine - startLine + 1;
        
        if (lineCount > 30) {
          const functionName = node.id?.name || 'anonymous';
          
          smells.push({
            type: 'long_method',
            severity: lineCount > 100 ? 'high' : 'medium',
            file: filePath,
            line: startLine,
            description: `Method '${functionName}' is too long (${lineCount} lines)`,
            suggestion: 'Break down into smaller methods',
            metrics: {
              lines: lineCount,
              complexity: this.estimateComplexity(node)
            }
          });
        }
      }
    });
  }

  private detectLargeClassSmells(ast: any, content: string, smells: CodeSmell[], filePath: string): void {
    this.traverseAST(ast, (node: any) => {
      if (node.type === 'ClassDeclaration') {
        const className = node.id?.name || 'anonymous';
        const methods = this.countClassMethods(node);
        const startLine = node.loc?.start?.line || 1;
        
        if (methods > 15) {
          smells.push({
            type: 'large_class',
            severity: methods > 25 ? 'high' : 'medium',
            file: filePath,
            line: startLine,
            description: `Class '${className}' has too many methods (${methods})`,
            suggestion: 'Consider splitting into multiple classes',
            metrics: {
              methods: methods,
              responsibilities: Math.ceil(methods / 5)
            }
          });
        }
      }
    });
  }

  private detectDeepNestingSmells(ast: any, content: string, smells: CodeSmell[], filePath: string): void {
    this.traverseAST(ast, (node: any) => {
      const depth = this.calculateNestingDepth(node);
      if (depth > 4) {
        const startLine = node.loc?.start?.line || 1;
        
        smells.push({
          type: 'deep_nesting',
          severity: depth > 6 ? 'high' : 'medium',
          file: filePath,
          line: startLine,
          description: `Deep nesting detected (depth: ${depth})`,
          suggestion: 'Extract nested logic into separate methods',
          metrics: {
            depth: depth,
            complexity: depth * 2
          }
        });
      }
    });
  }

  private detectMagicNumberSmells(content: string, smells: CodeSmell[], filePath: string): void {
    const magicNumberPattern = /\b(?<!\.)\d{2,}(?!\.\d)\b/g;
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const matches = line.match(magicNumberPattern);
      if (matches && matches.length > 0) {
        matches.forEach(match => {
          if (!this.isAcceptableNumber(match)) {
            smells.push({
              type: 'magic_number',
              severity: 'low',
              file: filePath,
              line: index + 1,
              description: `Magic number '${match}' found`,
              suggestion: 'Replace with named constant',
              metrics: {
                value: parseInt(match),
                occurrences: 1
              }
            });
          }
        });
      }
    });
  }

  private detectSmellsWithRegex(content: string, smells: CodeSmell[], filePath: string): void {
    const lines = content.split('\n');
    
    // Detect long lines
    lines.forEach((line, index) => {
      if (line.length > 120) {
        smells.push({
          type: 'long_line',
          severity: 'low',
          file: filePath,
          line: index + 1,
          description: `Line is too long (${line.length} characters)`,
          suggestion: 'Break line into multiple lines',
          metrics: {
            length: line.length,
            recommended: 120
          }
        });
      }
    });
  }

  // Helper methods
  private countClassMethods(classNode: any): number {
    let count = 0;
    if (classNode.body && classNode.body.body) {
      classNode.body.body.forEach((member: any) => {
        if (member.type === 'MethodDefinition') {
          count++;
        }
      });
    }
    return count;
  }

  private calculateConditionComplexity(node: any): number {
    let complexity = 1;
    
    const countOperators = (n: any): void => {
      if (!n) return;
      
      if (n.type === 'LogicalExpression' && (n.operator === '&&' || n.operator === '||')) {
        complexity++;
        countOperators(n.left);
        countOperators(n.right);
      } else if (n.type === 'BinaryExpression') {
        complexity++;
      }
    };
    
    countOperators(node.test || node);
    return complexity;
  }

  private calculateNestingDepth(node: any): number {
    let maxDepth = 0;
    
    const traverse = (n: any, depth: number): void => {
      if (!n || typeof n !== 'object') return;
      
      if (n.type === 'IfStatement' || n.type === 'ForStatement' || n.type === 'WhileStatement' || n.type === 'BlockStatement') {
        maxDepth = Math.max(maxDepth, depth);
        depth++;
      }
      
      for (const key in n) {
        if (key !== 'parent') {
          const child = n[key];
          if (Array.isArray(child)) {
            child.forEach(item => traverse(item, depth));
          } else if (child && typeof child === 'object') {
            traverse(child, depth);
          }
        }
      }
    };
    
    traverse(node, 1);
    return maxDepth;
  }

  private estimateComplexity(node: any): number {
    let complexity = 1;
    
    this.traverseAST(node, (n: any) => {
      if (n.type === 'IfStatement' || n.type === 'ForStatement' || n.type === 'WhileStatement' || n.type === 'SwitchCase') {
        complexity++;
      }
    });
    
    return complexity;
  }

  private extractCodeSnippet(content: string, startLine: number, endLine: number): string {
    const lines = content.split('\n');
    return lines.slice(startLine - 1, endLine).join('\n');
  }

  private findFunctionEnd(content: string, startIndex: number): number {
    let braceCount = 0;
    let inFunction = false;
    
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      
      if (char === '{') {
        braceCount++;
        inFunction = true;
      } else if (char === '}') {
        braceCount--;
        if (inFunction && braceCount === 0) {
          return i + 1;
        }
      }
    }
    
    return content.length;
  }

  private findDuplicateBlocks(lines: string[]): Array<{ startLine: number; lines: string[] }> {
    const blocks: Array<{ startLine: number; lines: string[] }> = [];
    const minBlockSize = 5;
    
    for (let i = 0; i < lines.length - minBlockSize; i++) {
      for (let j = i + minBlockSize; j < lines.length - minBlockSize; j++) {
        let matchLength = 0;
        
        while (i + matchLength < lines.length &&
               j + matchLength < lines.length &&
               lines[i + matchLength].trim() === lines[j + matchLength].trim() &&
               lines[i + matchLength].trim().length > 0) {
          matchLength++;
        }
        
        if (matchLength >= minBlockSize) {
          blocks.push({
            startLine: i + 1,
            lines: lines.slice(i, i + matchLength)
          });
          i += matchLength - 1;
          break;
        }
      }
    }
    
    return blocks;
  }

  private isAcceptableNumber(numStr: string): boolean {
    const num = parseInt(numStr);
    // Common acceptable numbers
    return num === 0 || num === 1 || num === 2 || num === 10 || num === 100 || num === 1000;
  }

  private sortSuggestionsByPriority(suggestions: RefactoringSuggestion[]): RefactoringSuggestion[] {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return suggestions.sort((a, b) => {
      const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (weightDiff !== 0) return weightDiff;
      return b.confidence - a.confidence;
    });
  }

  private sortSmellsBySeverity(smells: CodeSmell[]): CodeSmell[] {
    const severityWeight = { high: 3, medium: 2, low: 1 };
    return smells.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);
  }
}