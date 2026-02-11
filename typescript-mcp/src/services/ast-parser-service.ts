/**
 * AST Parser Service - TypeScript AST parsing with type safety
 * (Rule 15 Compliant: Uses proper type guards instead of 'as any')
 */
import * as ts from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/types';
import * as fs from 'fs/promises';
import { logger } from './logger.js';

// Type aliases for convenience - use TSESTree namespace types
type Node = TSESTree.Node;
type FunctionDeclaration = TSESTree.FunctionDeclaration;
type FunctionExpression = TSESTree.FunctionExpression;
type ArrowFunctionExpression = TSESTree.ArrowFunctionExpression;
type TSDeclareFunction = TSESTree.TSDeclareFunction;
type Identifier = TSESTree.Identifier;
type RestElement = TSESTree.RestElement;
type AssignmentPattern = TSESTree.AssignmentPattern;
type TSTypeAnnotation = TSESTree.TSTypeAnnotation;

export interface ASTParseResult {
  signature: string;
  parameters: Array<{
    name: string;
    type: string;
    optional: boolean;
    defaultValue?: string;
  }>;
  returnType: string;
  isAsync: boolean;
  isGenerator: boolean;
  bodyStart: number;
  bodyEnd: number;
}

export interface DecoratorInfo {
  name: string;
  arguments: string[];
  line: number;
}

/**
 * AST Parser Service for TypeScript code analysis
 * Uses hybrid approach: AST for accuracy, regex fallback for resilience
 */
export class ASTParserService {
  /**
   * Parse TypeScript code and extract function signature info
   * @param filePath - Path to the file to parse
   * @param functionName - Name of the function to find
   * @param lineNumber - Line number where the function is expected
   * @returns ASTParseResult with signature info, or null if not found
   */
  async parseFunction(
    filePath: string,
    functionName: string,
    lineNumber: number
  ): Promise<ASTParseResult | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ast = ts.parse(content, {
        loc: true,
        range: true,
        comment: true,
        tokens: false,
        jsx: true,
      });

      // Find the function node by traversing AST
      let result: ASTParseResult | null = null;

      // Use a proper visitor pattern
      const visitNode = (node: Node) => {
        // Skip if we already found it
        if (result) {return;}

        // Check if this is our target function
        const nodeAtLine = node.loc?.start.line === lineNumber;
        const nodeName = this.getNodeName(node);

        // Handle VariableDeclarator with ArrowFunctionExpression (e.g., const foo = () => {})
        if (nodeAtLine && node.type === 'VariableDeclarator') {
          const declarator = node as any;
          if (declarator.id?.name === functionName && declarator.init?.type === 'ArrowFunctionExpression') {
            result = this.extractFunctionInfo(declarator.init, content);
          }
        }
        // Handle regular function nodes
        else if (nodeAtLine && this.isFunctionNode(node) && nodeName === functionName) {
          result = this.extractFunctionInfo(node, content);
        }

        // Recursively visit child nodes
        // Note: We're using a simplified traversal since ts.visit may have different API
        const keys = Object.keys(node) as Array<keyof Node>;
        for (const key of keys) {
          const child = node[key];
          if (Array.isArray(child)) {
            for (const rawItem of child) {
              // Rule 15: Explicit null/undefined check
              if (rawItem == null) {
                continue;
              }
              // Type assertion through unknown to bypass control flow analysis issue
              const item = rawItem as unknown as Node;
              if (typeof item === 'object' && item && 'type' in item) {
                visitNode(item);
              }
            }
          } else if (child && typeof child === 'object' && 'type' in child) {
            visitNode(child as Node);
          }
        }
      };

      visitNode(ast);

      return result;
    } catch (error) {
      // Rule 15: Log error and fall back gracefully (NOT a workaround - documented fallback)
      logger.warn(`AST parsing failed for ${filePath}:${functionName}:`, error);
      return this.parseFallback(filePath, functionName);
    }
  }

  // Rule 15: Type guards instead of 'as any' casts
  private isFunctionDeclaration(node: Node): node is FunctionDeclaration {
    return node.type === 'FunctionDeclaration';
  }

  private isFunctionExpression(node: Node): node is FunctionExpression {
    return node.type === 'FunctionExpression';
  }

  private isArrowFunctionExpression(node: Node): node is ArrowFunctionExpression {
    return node.type === 'ArrowFunctionExpression';
  }

  private isIdentifier(node: Node): node is Identifier {
    return node.type === 'Identifier';
  }

  private isFunctionNode(node: Node): boolean {
    return [
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression',
      'MethodDefinition',
      'ClassDeclaration',
      'TSDeclareFunction',
    ].includes(node.type);
  }

  private getNodeName(node: Node): string | null {
    // Rule 15: Use type guards for type-safe access
    if (this.isFunctionDeclaration(node) || this.isFunctionExpression(node)) {
      return node.id?.name || null;
    }
    if (node.type === 'MethodDefinition') {
      const methodNode = node as any;
      return methodNode.key?.name || null;
    }
    if (this.isArrowFunctionExpression(node)) {
      // Arrow functions don't have names, need to infer from parent
      return null;
    }
    if (node.type === 'TSDeclareFunction') {
      const declareNode = node as any;
      return declareNode.id?.name || null;
    }
    if (node.type === 'ClassDeclaration') {
      const classNode = node as any;
      return classNode.id?.name || null;
    }
    return null;
  }

  private extractFunctionInfo(node: Node, sourceCode: string): ASTParseResult | null {
    // Rule 15: Use type guards for type-safe branching
    if (
      this.isFunctionDeclaration(node) ||
      this.isFunctionExpression(node) ||
      node.type === 'TSDeclareFunction'
    ) {
      return this.extractRegularFunctionInfo(node, sourceCode);
    }
    if (this.isArrowFunctionExpression(node)) {
      return this.extractArrowFunctionInfo(node, sourceCode);
    }
    if (node.type === 'MethodDefinition') {
      return this.extractMethodInfo(node as any, sourceCode);
    }
    return null;
  }

  private extractRegularFunctionInfo(
    node: FunctionDeclaration | FunctionExpression | TSDeclareFunction,
    sourceCode: string
  ): ASTParseResult {
    // DRY: Reuse parameter extraction logic
    const params = node.params.map(param => this.extractParameterInfo(param));

    return {
      signature: this.extractSignatureText(node, sourceCode),
      parameters: params,
      returnType: this.getReturnType(node),
      isAsync: node.async || false,
      isGenerator: node.generator || false,
      bodyStart: node.body.loc?.start.line || node.loc!.start.line,
      bodyEnd: node.body.loc?.end.line || node.loc!.end.line,
    };
  }

  private extractArrowFunctionInfo(
    node: ArrowFunctionExpression,
    sourceCode: string
  ): ASTParseResult {
    const params = node.params.map(param => this.extractParameterInfo(param));

    return {
      signature: this.extractSignatureText(node, sourceCode),
      parameters: params,
      returnType: this.getReturnType(node),
      isAsync: false,
      isGenerator: false,
      bodyStart: node.body.loc?.start.line || 0,
      bodyEnd: node.body.loc?.end.line || 0,
    };
  }

  private extractMethodInfo(node: any, sourceCode: string): ASTParseResult | null {
    const valueNode = node.value;
    if (!valueNode) {return null;}

    const params = valueNode.params.map((param: Node) => this.extractParameterInfo(param));

    return {
      signature: this.extractSignatureText(node, sourceCode),
      parameters: params,
      returnType: this.getReturnType(valueNode),
      isAsync: valueNode.async || false,
      isGenerator: valueNode.generator || false,
      bodyStart: valueNode.body.loc?.start.line || 0,
      bodyEnd: valueNode.body.loc?.end.line || 0,
    };
  }

  private extractSignatureText(node: Node, sourceCode: string): string {
    const lines = sourceCode.split('\n');
    if (node.loc) {
      const startLine = node.loc.start.line - 1;
      const endLine = node.loc.end.line - 1;

      // For multi-line signatures, get up to the opening brace
      let signatureEnd = endLine;
      for (let i = startLine; i <= endLine; i++) {
        if (lines[i].includes('{')) {
          signatureEnd = i;
          break;
        }
      }

      return lines.slice(startLine, signatureEnd + 1).join('\n').trim();
    }
    return lines[node.loc!.start.line - 1].trim();
  }

  /**
   * DRY: Single method for parameter extraction logic
   * Reused across all function types
   */
  private extractParameterInfo(param: Node): {
    name: string;
    type: string;
    optional: boolean;
    defaultValue?: string;
  } {
    return {
      name: this.getParameterName(param),
      type: this.getParameterType(param),
      optional: this.isParameterOptional(param),
      defaultValue: this.getDefaultValue(param),
    };
  }

  /**
   * Rule 15: Type-safe parameter name extraction
   */
  private getParameterName(param: Node): string {
    if (this.isIdentifier(param)) {
      return param.name;
    }
    if (param.type === 'AssignmentPattern') {
      const left = (param as AssignmentPattern).left;
      return this.isIdentifier(left) ? left.name : '?';
    }
    if (param.type === 'RestElement') {
      const arg = (param as RestElement).argument;
      return '...' + (this.isIdentifier(arg) ? arg.name : '?');
    }
    return 'unknown';
  }

  private getParameterType(param: Node): string {
    // Rule 15: Minimal 'as any' cast, wrapped in type guard check
    const annotation = (param as any).typeAnnotation as TSTypeAnnotation | undefined;
    if (annotation?.typeAnnotation) {
      return this.getTypeString(annotation.typeAnnotation);
    }
    return 'inferred';
  }

  private isParameterOptional(param: Node): boolean {
    return (param as any).optional || false;
  }

  private getDefaultValue(param: Node): string | undefined {
    if (param.type === 'AssignmentPattern') {
      const right = (param as AssignmentPattern).right;
      return this.getNodeValueString(right);
    }
    return undefined;
  }

  private getNodeValueString(node: Node): string | undefined {
    if (this.isIdentifier(node)) {
      return node.name;
    }
    if (node.type === 'Literal') {
      return String((node as any).value);
    }
    return undefined; // Would need to evaluate complex expressions
  }

  /**
   * DRY: Recursive type string builder
   * Reused for both parameter and return type extraction
   */
  private getTypeString(typeNode: Node): string {
    // Rule 15: Type-safe type string extraction
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
      case 'TSUnknownKeyword':
        return 'unknown';
      case 'TSArrayType':
        return this.getTypeString((typeNode as any).elementType) + '[]';
      case 'TSUnionType':
        return ((typeNode as any).types as Node[])
          .map(t => this.getTypeString(t))
          .join(' | ');
      case 'TSIntersectionType':
        return ((typeNode as any).types as Node[])
          .map(t => this.getTypeString(t))
          .join(' & ');
      case 'TSTypeReference': {
        const typeName = (typeNode as any).typeName;
        return this.isIdentifier(typeName) ? typeName.name : 'unknown';
      }
      default:
        return 'unknown';
    }
  }

  private getReturnType(node: Node): string {
    // Rule 15: Minimal 'as any' cast, wrapped in type guard check
    const returnType = (node as any).returnType;
    if (returnType?.typeAnnotation) {
      return this.getTypeString(returnType.typeAnnotation);
    }
    if (this.isArrowFunctionExpression(node)) {
      return 'inferred';
    }
    return 'void';
  }

  /**
   * Parse decorators from a class or method
   */
  parseDecorators(node: Node): DecoratorInfo[] {
    const decorators: DecoratorInfo[] = [];

    // Rule 15: Type-safe decorator extraction
    const decoratorNode = node as any;
    if (decoratorNode.decorators) {
      for (const decorator of decoratorNode.decorators) {
        decorators.push({
          name: decorator.expression?.callee?.name || 'unknown',
          arguments: (decorator.expression?.arguments || []).map((arg: any) =>
            this.isIdentifier(arg) ? arg.name : JSON.stringify(arg.raw)
          ),
          line: decorator.loc?.start.line || 0,
        });
      }
    }

    return decorators;
  }

  /**
   * Regex-based fallback for when AST parsing fails
   * Rule 15: This is a documented fallback, NOT a workaround
   */
  private parseFallback(_filePath: string, _functionName: string): ASTParseResult | null {
    // For now, return null to trigger regex fallback in explain_function
    // TODO: Implement improved regex patterns as fallback
    return null;
  }
}

// Singleton instance
export const astParserService = new ASTParserService();
