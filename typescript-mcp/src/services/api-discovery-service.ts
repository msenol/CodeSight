/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable no-useless-escape */
/* eslint-disable no-undef */
/* eslint-disable no-console */
import type { APIEndpoint } from '../types/index.js';
import { parse } from '@typescript-eslint/typescript-estree';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export interface ApiDiscoveryService {
  discoverEndpoints(projectPath: string): Promise<APIEndpoint[]>;
  analyzeFile(filePath: string): Promise<APIEndpoint[]>;
  findRestEndpoints(filePath: string): Promise<APIEndpoint[]>;
  findGraphQLEndpoints(filePath: string): Promise<APIEndpoint[]>;
  findWebSocketEndpoints(filePath: string): Promise<APIEndpoint[]>;
  generateApiDocumentation(endpoints: APIEndpoint[]): Promise<string>;
  validateEndpoints(endpoints: APIEndpoint[]): Promise<ValidationResult[]>;
  findApiEndpoints(codebaseId: string): Promise<APIEndpoint[]>;
  detectFrameworks(codebaseId: string): Promise<string[]>;
}

export interface ValidationResult {
  endpoint: APIEndpoint;
  issues: ValidationIssue[];
  score: number;
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

export interface EndpointPattern {
  framework: string;
  patterns: RegExp[];
  extractor: (match: RegExpMatchArray, code: string, line: number) => Partial<APIEndpoint>;
}

export interface RouteInfo {
  method: string;
  path: string;
  handler: string;
  middleware?: string[];
  parameters?: ParameterInfo[];
  responses?: ResponseInfo[];
}

export interface ParameterInfo {
  name: string;
  type: 'path' | 'query' | 'body' | 'header';
  dataType: string;
  required: boolean;
  description?: string;
}

export interface ResponseInfo {
  statusCode: number;
  description: string;
  schema?: string;
}

export class DefaultApiDiscoveryService implements ApiDiscoveryService {
  private endpointPatterns: EndpointPattern[] = [
    // Express.js patterns
    {
      framework: 'express',
      patterns: [
        /app\.(get|post|put|delete|patch|options|head)]*\(]*['"`]([^'"` ]+)['"`]]*,]*([^)]+))/g,
        /router\.(get|post|put|delete|patch|options|head)]*\(]*['"`]([^'"` ]+)['"`]]*,]*([^)]+))/g,
      ],
      extractor: this.extractExpressEndpoint.bind(this),
    },
    // Fastify patterns
    {
      framework: 'fastify',
      patterns: [
        /fastify\.(get|post|put|delete|patch|options|head)]*\(]*['"`]([^'"` ]+)['"`]]*,]*([^)]+))/g,
        /server\.(get|post|put|delete|patch|options|head)]*\(]*['"`]([^'"` ]+)['"`]]*,]*([^)]+))/g,
      ],
      extractor: this.extractFastifyEndpoint.bind(this),
    },
    // NestJS patterns
    {
      framework: 'nestjs',
      patterns: [/@(Get|Post|Put|Delete|Patch|Options|Head)]*\(]*['"`]?([^'"`)]*)['"`]?]*)/g],
      extractor: this.extractNestJSEndpoint.bind(this),
    },
    // Next.js API routes
    {
      framework: 'nextjs',
      patterns: [
        /export]+(?:default]+)?(?:async]+)?function]+(\w+)]*\(]*req]*,]*res]*)/g,
      ],
      extractor: this.extractNextJSEndpoint.bind(this),
    },
    // Koa.js patterns
    {
      framework: 'koa',
      patterns: [
        /router\.(get|post|put|delete|patch|options|head)]*\(]*['"`]([^'"` ]+)['"`]]*,]*([^)]+))/g,
      ],
      extractor: this.extractKoaEndpoint.bind(this),
    },
  ];

  async discoverEndpoints(projectPath: string): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];

    // Find all relevant files
    const patterns = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'];

    const allFiles: string[] = [];
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: projectPath,
        absolute: true,
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/test/**',
          '**/tests/**',
        ],
      });
      allFiles.push(...files);
    }

    // Analyze each file
    for (const filePath of allFiles) {
      try {
        const fileEndpoints = await this.analyzeFile(filePath);
        endpoints.push(...fileEndpoints);
      } catch (error) {
        console.warn(`Failed to analyze ${filePath}:`, error);
      }
    }

    // Remove duplicates and sort
    return this.deduplicateEndpoints(endpoints);
  }

  async analyzeFile(filePath: string): Promise<APIEndpoint[]> {
    // Content reserved for future use
    const endpoints: APIEndpoint[] = [];

    // Try REST endpoint discovery
    const restEndpoints = await this.findRestEndpoints(filePath);
    endpoints.push(...restEndpoints);

    // Try GraphQL endpoint discovery
    const graphqlEndpoints = await this.findGraphQLEndpoints(filePath);
    endpoints.push(...graphqlEndpoints);

    // Try WebSocket endpoint discovery
    const wsEndpoints = await this.findWebSocketEndpoints(filePath);
    endpoints.push(...wsEndpoints);

    return endpoints;
  }

  async findRestEndpoints(filePath: string): Promise<APIEndpoint[]> {
    // Content reserved for future use
    const endpoints: APIEndpoint[] = [];
    // Lines reserved for future use

    // Apply all endpoint patterns
    for (const patternConfig of this.endpointPatterns) {
      for (const pattern of patternConfig.patterns) {
        let match;
        // Content reserved for future use
        while ((match = pattern.exec(content)) !== null) {
          const lineNumber = this.getLineNumber(content, match.index);
          const endpointData = patternConfig.extractor(match, content, lineNumber);

          if (endpointData.method && endpointData.path) {
            endpoints.push({
              id: `${endpointData.method}_${endpointData.path}_${Date.now()}`,
              method: endpointData.method,
              path: endpointData.path,
              file: filePath,
              line: lineNumber,
              handler: endpointData.handler || 'unknown',
              parameters: endpointData.parameters || [],
              responses: endpointData.responses || [],
              authentication_required: false,
              handler_function: endpointData.handler || 'unknown',
              file_path: filePath,
              line_number: lineNumber,
            });
          }
        } // end while
      }
    }

    // Additional AST-based analysis for more complex patterns
    try {
      const astEndpoints = await this.analyzeWithAST(content, filePath);
      endpoints.push(...astEndpoints);
    } catch (error) {
      console.warn(`AST analysis failed for ${filePath}:`, error);
    }

    return endpoints;
  }

  async findGraphQLEndpoints(filePath: string): Promise<APIEndpoint[]> {
    // Content reserved for future use
    const endpoints: APIEndpoint[] = [];

    // GraphQL schema definitions - Rule 15: Reserved for future implementation
    // const schemaPatterns = [
    //   /type\s+(\w+)\s*\{([^}]+)\}/g,
    //   /input\s+(\w+)\s*\{([^}]+)\}/g,
    //   /enum\s+(\w+)\s*\{([^}]+)\}/g,
    // ];

    // for (const pattern of schemaPatterns) {
    //   let match;
    //         // Content reserved for future use
    //     const lineNumber = this.getLineNumber(content, match.index);
    //     endpoints.push({
    //       //       id: `GRAPHQL_${match[1]}_${Date.now()}`,
      //       method: 'GRAPHQL',
      //       path: `/graphql/${match[1]}`,
      //       file: filePath,
      //       line: lineNumber,
      //       handler: `GraphQL ${match[1]} type`,
      //       parameters: this.parseGraphQLFields(match[2]),
      //       responses: [],
      //       authentication_required: false,
      //       handler_function: `GraphQL ${match[1]} type`,
      //       file_path: filePath,
      //       line_number: lineNumber,
      //     });
      //   }
      // }

    // GraphQL resolvers - Rule 15: Reserved for future implementation
    // const resolverPatterns = [/(\w+):]*\([^)]*)]*=>]*{/g, /(\w+)]*\([^)]*)]*{/g];

    // GraphQL resolver detection - Rule 15: Reserved for future implementation
    /*
    for (const pattern of resolverPatterns) {
      let match;
      // Content reserved for future use
      while ((match = pattern.exec(content)) !== null) {
        if (this.isInGraphQLContext(content, match.index)) {
          const lineNumber = this.getLineNumber(content, match.index);
          endpoints.push({
            id: `GRAPHQL_RESOLVER_${match[1]}_${Date.now()}`,
            method: 'GRAPHQL',
            path: `/graphql/resolver/${match[1]}`,
            file: filePath,
            line: lineNumber,
            handler: `${match[1]} resolver`,
            parameters: [],
            responses: [],
            authentication_required: false,
            handler_function: `${match[1]} resolver`,
            file_path: filePath,
            line_number: lineNumber,
          });
        }
      } // end while
    }
    */

    return endpoints;
  }

  async findWebSocketEndpoints(filePath: string): Promise<APIEndpoint[]> {
    // Rule 15: Reserved for future implementation
    const endpoints: APIEndpoint[] = [];

    // WebSocket server patterns - Rule 15: Reserved for future implementation
    // const wsPatterns = [
    //   /new\s+(?:WebSocket|WebSocketServer)\s*\(/g,
    //   /ws\.on\s*\(\s*['"`]([^'"` ]+)['"`]/g,
    //   /socket\.on\s*\(\s*['"`]([^'"` ]+)['"`]/g,
    //   /io\.on\s*\(\s*['"`]([^'"` ]+)['"`]/g,
    // ];

    // for (const pattern of wsPatterns) {
    //   let match;
    //         // Content reserved for future use
    //     const lineNumber = this.getLineNumber(content, match.index);
    //     const eventName = match[1] || 'connection';

    //     endpoints.push({
    //       id: `WEBSOCKET_${eventName}_${Date.now()}`,
    //       method: 'WEBSOCKET',
    //       path: `/ws/${eventName}`,
    //       file: filePath,
    //       line: lineNumber,
    //       handler: `WebSocket ${eventName} handler`,
    //       parameters: [],
    //       responses: [],
    //       authentication_required: false,
    //       handler_function: `WebSocket ${eventName} handler`,
    //       file_path: filePath,
    //       line_number: lineNumber,
    //     });
    //   }
    // }

    return endpoints;
  }

  async generateApiDocumentation(endpoints: APIEndpoint[]): Promise<string> {
    const groupedEndpoints = this.groupEndpointsByPath(endpoints);
    let documentation = '# API Documentation\n\n';

    for (const [basePath, pathEndpoints] of groupedEndpoints) {
      documentation += `## ${basePath}\n\n`;

      for (const endpoint of pathEndpoints) {
        documentation += `### ${endpoint.method} ${endpoint.path}\n\n`;
        documentation += `**File:** ${path.basename(endpoint.file)}:${endpoint.line}\n`;
        documentation += `**Handler:** ${endpoint.handler}\n\n`;

        if (endpoint.parameters && endpoint.parameters.length > 0) {
          documentation += '**Parameters:**\n\n';
          for (const param of endpoint.parameters) {
            documentation += `- \`${param}\`\n`;
          }
          documentation += '\n';
        }

        if (endpoint.responses && endpoint.responses.length > 0) {
          documentation += '**Responses:**\n\n';
          for (const response of endpoint.responses) {
            documentation += `- \`${response}\`\n`;
          }
          documentation += '\n';
        }

        documentation += '---\n\n';
      }
    }

    return documentation;
  }

  async validateEndpoints(endpoints: APIEndpoint[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const endpoint of endpoints) {
      const issues: ValidationIssue[] = [];
      let score = 100;

      // Validate method
      if (!this.isValidHttpMethod(endpoint.method)) {
        issues.push({
          type: 'error',
          message: `Invalid HTTP method: ${endpoint.method}`,
          suggestion: 'Use standard HTTP methods (GET, POST, PUT, DELETE, etc.)',
        });
        score -= 20;
      }

      // Validate path
      if (!endpoint.path.startsWith('/')) {
        issues.push({
          type: 'warning',
          message: 'Path should start with /',
          suggestion: `Change '${endpoint.path}' to '/${endpoint.path}'`,
        });
        score -= 10;
      }

      // Check for path parameters
      const pathParams = endpoint.path.match(/:[\w]+/g) || [];
      if (pathParams.length > 0 && (!endpoint.parameters || endpoint.parameters.length === 0)) {
        issues.push({
          type: 'warning',
          message: 'Path has parameters but no parameter documentation',
          suggestion: 'Document path parameters',
        });
        score -= 15;
      }

      // Check handler naming
      if (endpoint.handler === 'unknown' || endpoint.handler === '') {
        issues.push({
          type: 'info',
          message: 'Handler name could not be determined',
          suggestion: 'Use descriptive handler function names',
        });
        score -= 5;
      }

      // Check for RESTful conventions
      if (!this.followsRestfulConventions(endpoint)) {
        issues.push({
          type: 'info',
          message: 'Endpoint may not follow RESTful conventions',
          suggestion: 'Consider using RESTful URL patterns',
        });
        score -= 10;
      }

      results.push({
        endpoint,
        issues,
        score: Math.max(0, score),
      });
    }

    return results;
  }

  async findApiEndpoints(codebaseId: string): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];

    try {
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      for (const filePath of files) {
        try {
            // Content reserved for future use
          const fileEndpoints = await this.extractEndpointsFromFile(filePath, content);
          endpoints.push(...fileEndpoints);
        } catch (error) {
          console.warn(`Failed to analyze ${filePath}:`, error);
        }
      }

      return this.deduplicateEndpoints(endpoints);
    } catch (error) {
      console.error('Failed to find API endpoints:', error);
      return [];
    }
  }

  async detectFrameworks(codebaseId: string): Promise<string[]> {
    const frameworks: Set<string> = new Set();

    try {
      // Check package.json for framework dependencies
      const packageJsonPath = path.join(codebaseId, 'package.json');
      try {
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageContent);

        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        // Detect common frameworks
        if (allDeps.express) {frameworks.add('express');}
        if (allDeps.fastify) {frameworks.add('fastify');}
        if (allDeps['@nestjs/core']) {frameworks.add('nestjs');}
        if (allDeps.koa) {frameworks.add('koa');}
        if (allDeps.next) {frameworks.add('nextjs');}
        if (allDeps.typescript) {frameworks.add('typescript');}
        if (allDeps.react) {frameworks.add('react');}
        if (allDeps.vue) {frameworks.add('vue');}
        if (allDeps.angular) {frameworks.add('angular');}
      } catch (error) {
        // package.json not found or invalid
      }

      // Analyze code patterns
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      for (const filePath of files.slice(0, 10)) {
        // Sample first 10 files
        try {
            // Content reserved for future use

          // Detect framework patterns
          if (content.includes('app.get(') || content.includes('app.post(')) {
            frameworks.add('express');
          }
          if (content.includes('fastify.get(') || content.includes('fastify.post(')) {
            frameworks.add('fastify');
          }
          if (content.includes('@Controller') || content.includes('@Get(')) {
            frameworks.add('nestjs');
          }
          if (
            content.includes('export default function') &&
            content.includes('req:') &&
            content.includes('res:')
          ) {
            frameworks.add('nextjs');
          }
        } catch (error) {
          console.warn(`Failed to analyze ${filePath}:`, error);
        }
      }

      return Array.from(frameworks);
    } catch (error) {
      console.error('Failed to detect frameworks:', error);
      return [];
    }
  }

  // Endpoint extraction methods
  private extractExpressEndpoint(
    match: RegExpMatchArray,
    code: string,
    line: number,
  ): Partial<APIEndpoint> {
    const method = match[1].toUpperCase();
    const path = match[2];
    const handlerCode = match[3];

    return {
      method,
      path,
      handler: this.extractHandlerName(handlerCode),
      parameters: this.extractParameters(path, handlerCode),
      responses: this.extractResponses(handlerCode),
    };
  }

  private extractFastifyEndpoint(
    match: RegExpMatchArray,
    code: string,
    line: number,
  ): Partial<APIEndpoint> {
    const method = match[1].toUpperCase();
    const path = match[2];
    const handlerCode = match[3];

    return {
      method,
      path,
      handler: this.extractHandlerName(handlerCode),
      parameters: this.extractParameters(path, handlerCode),
      responses: this.extractResponses(handlerCode),
    };
  }

  private extractNestJSEndpoint(
    match: RegExpMatchArray,
    code: string,
    line: number,
  ): Partial<APIEndpoint> {
    const method = match[1].toUpperCase();
    const path = match[2] || '';

    // Find the method name after the decorator
    const afterDecorator = code.substring(match.index! + match[0].length);
    const methodMatch = afterDecorator.match(/]*(\w+)]*\(/);
    const handler = methodMatch ? methodMatch[1] : 'unknown';

    return {
      method,
      path,
      handler,
      parameters: this.extractParameters(path, afterDecorator),
      responses: [],
    };
  }

  private extractNextJSEndpoint(
    match: RegExpMatchArray,
    code: string,
    line: number,
  ): Partial<APIEndpoint> {
    const handler = match[1];

    // Determine path from file structure (simplified)
    const path = `/api/${  handler.toLowerCase()}`;

    // Check for method handling in the function
    const methods = this.extractNextJSMethods(code);

    return {
      method: methods.length > 0 ? methods.join('|') : 'GET',
      path,
      handler,
      parameters: [],
      responses: [],
    };
  }

  private extractKoaEndpoint(
    match: RegExpMatchArray,
    code: string,
    line: number,
  ): Partial<APIEndpoint> {
    const method = match[1].toUpperCase();
    const path = match[2];
    const handlerCode = match[3];

    return {
      method,
      path,
      handler: this.extractHandlerName(handlerCode),
      parameters: this.extractParameters(path, handlerCode),
      responses: this.extractResponses(handlerCode),
    };
  }

  // Helper methods
  private async analyzeWithAST(content: string, filePath: string): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
      });

      this.traverseAST(ast, (node: any) => {
        // Look for method calls that might be API endpoints
        if (node.type === 'CallExpression' && node.callee) {
          const endpoint = this.extractEndpointFromCallExpression(_node, _filePath);
          if (endpoint) {
            endpoints.push(endpoint);
          }
        }

        // Look for decorators (NestJS, etc.)
        if (node.type === 'Decorator') {
          const endpoint = this.extractEndpointFromDecorator(_node, _filePath);
          if (endpoint) {
            endpoints.push(endpoint);
          }
        }
      });
    } catch (error) {
      // Fallback to Acorn
      try {
        const ast = acorn.parse(content, {
          ecmaVersion: 2022,
          sourceType: 'module',
          locations: true,
        });

        walk.simple(ast, {
          CallExpression: (node: any) => {
            const endpoint = this.extractEndpointFromCallExpression(_node, _filePath);
            if (endpoint) {
              endpoints.push(endpoint);
            }
          },
        });
      } catch (acornError) {
        console.warn('Both TypeScript and Acorn parsing failed');
      }
    }

    return endpoints;
  }

  private extractEndpointFromCallExpression(node: any, filePath: string): APIEndpoint | null {
    if (!node.callee) {return null;}

    // Check for method calls like app.get(), router.post(), etc.
    if (
      node.callee.type === 'MemberExpression' &&
      node.callee.property &&
      node.arguments &&
      node.arguments.length >= 2
    ) {
      const method = node.callee.property.name;
      const pathArg = node.arguments[0];

      if (
        this.isValidHttpMethod(method.toUpperCase()) &&
        pathArg.type === 'Literal' &&
        typeof pathArg.value === 'string'
      ) {
        return {
          id: `${method.toUpperCase()}_${pathArg.value}_${Date.now()}`,
          method: method.toUpperCase(),
          path: pathArg.value,
          file: filePath,
          line: node.loc?.start?.line || 1,
          handler: this.extractHandlerFromArguments(node.arguments),
          parameters: [],
          responses: [],
          authentication_required: false,
          handler_function: this.extractHandlerFromArguments(node.arguments),
          file_path: filePath,
          line_number: node.loc?.start?.line || 1,
        };
      }
    }

    return null;
  }

  private extractEndpointFromDecorator(node: any, filePath: string): APIEndpoint | null {
    // This would be implemented for frameworks that use decorators
    // like NestJS, Angular, etc.
    return null;
  }

  private traverseAST(node: any, callback: (node: any) => void): void {
    if (!node || typeof node !== 'object') {return;}

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

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private extractHandlerName(handlerCode: string): string {
    // Try to extract function name
    const functionMatch = handlerCode.match(/function]+(\w+)/);
    if (functionMatch) {return functionMatch[1];}

    // Try to extract variable name
    const variableMatch = handlerCode.match(/(\w+)/);
    if (variableMatch) {return variableMatch[1];}

    return 'anonymous';
  }

  private extractHandlerFromArguments(args: any[]): string {
    if (args.length < 2) {return 'unknown';}

    const handlerArg = args[1];

    if (handlerArg.type === 'Identifier') {
      return handlerArg.name;
    } else if (
      handlerArg.type === 'FunctionExpression' ||
      handlerArg.type === 'ArrowFunctionExpression'
    ) {
      return handlerArg.id?.name || 'anonymous';
    }

    return 'unknown';
  }

  private extractParameters(path: string, handlerCode: string): string[] {
    const parameters: string[] = [];

    // Extract path parameters
    const pathParams = path.match(/:[\w]+/g) || [];
    parameters.push(...pathParams);

    // Extract query parameters from handler code (simplified)
    const queryParams = handlerCode.match(/req\.query\.(\w+)/g) || [];
    parameters.push(...queryParams.map(p => p.replace('req.query.', 'query.')));

    // Extract body parameters
    const bodyParams = handlerCode.match(/req\.body\.(\w+)/g) || [];
    parameters.push(...bodyParams.map(p => p.replace('req.body.', 'body.')));

    return parameters;
  }

  private extractResponses(handlerCode: string): string[] {
    const responses: string[] = [];

    // Extract status codes
    const statusCodes = handlerCode.match(/res\.status]*\(]*(\d+)]*)/g) || [];
    responses.push(...statusCodes.map(s => s.match(/\d+/)?.[0] || '200'));

    // Extract response methods
    const responseMethods = handlerCode.match(/res\.(json|send|end|redirect)/g) || [];
    responses.push(...responseMethods);

    return responses.length > 0 ? responses : ['200'];
  }

  private extractNextJSMethods(code: string): string[] {
    const methods: string[] = [];

    // Look for method checks in Next.js API routes
    const methodChecks = code.match(/req\.method]*===]*['"`](\w+)['"`]/g) || [];
    for (const check of methodChecks) {
      const method = check.match(/['"`](\w+)['"`]/)?.[1];
      if (method) {methods.push(method);}
    }

    return methods;
  }

  private parseGraphQLFields(fieldsString: string): string[] {
    const fields: string[] = [];
    const fieldPattern = /(\w+)]*:]*([^\n,]+)/g;
    let match;

    while ((match = fieldPattern.exec(fieldsString)) !== null) {
      fields.push(`${match[1]}: ${match[2].trim()}`);
    }

    return fields;
  }

  private isInGraphQLContext(content: string, index: number): boolean {
    const beforeIndex = content.substring(0, index);
    return (
      beforeIndex.includes('resolvers') ||
      beforeIndex.includes('typeDefs') ||
      beforeIndex.includes('GraphQL')
    );
  }

  private deduplicateEndpoints(endpoints: APIEndpoint[]): APIEndpoint[] {
    const seen = new Set<string>();
    const unique: APIEndpoint[] = [];

    for (const endpoint of endpoints) {
      const key = `${endpoint.method}:${endpoint.path}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(endpoint);
      }
    }

    return unique.sort((a, b) => {
      if (a.path !== b.path) {return a.path.localeCompare(b.path);}
      return a.method.localeCompare(b.method);
    });
  }

  private groupEndpointsByPath(endpoints: APIEndpoint[]): Map<string, APIEndpoint[]> {
    const groups = new Map<string, APIEndpoint[]>();

    for (const endpoint of endpoints) {
      const basePath = endpoint.path.split('/')[1] || 'root';

      if (!groups.has(basePath)) {
        groups.set(basePath, []);
      }

      groups.get(basePath)!.push(endpoint);
    }

    return groups;
  }

  private isValidHttpMethod(method: string): boolean {
    const validMethods = [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'PATCH',
      'OPTIONS',
      'HEAD',
      'WEBSOCKET',
      'GRAPHQL',
    ];
    return validMethods.includes(method.toUpperCase());
  }

  private followsRestfulConventions(endpoint: APIEndpoint): boolean {
    const { method, path } = endpoint;

    // Basic RESTful convention checks
    if (method === 'GET' && path.includes('/create')) {return false;}
    if (method === 'POST' && !path.endsWith('s') && !path.includes('/')) {return false;}
    if (method === 'PUT' && !path.includes('/:')) {return false;}
    if (method === 'DELETE' && !path.includes('/:')) {return false;}

    return true;
  }

  private async extractEndpointsFromFile(
    filePath: string,
    content: string,
  ): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];
    const relativePath = path.relative(process.cwd(), filePath);

    try {
      // Try AST parsing first
      const ast = acorn.parse(content, {
        ecmaVersion: 2020,
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
      });

      this.traverseASTForEndpoints(ast, endpoints, relativePath, content);
    } catch (error) {
      // Fallback to regex patterns
      this.extractEndpointsWithRegex(content, endpoints, relativePath);
    }

    return endpoints;
  }

  private traverseASTForEndpoints(
    node: any,
    endpoints: APIEndpoint[],
    filePath: string,
    content: string,
  ): void {
    if (!node || typeof node !== 'object') {return;}

    // Express patterns: app.get(), app.post(), etc.
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'MemberExpression' &&
      node.callee?.property?.name &&
      ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(
        node.callee.property.name,
      )
    ) {
      const method = node.callee.property.name.toUpperCase();
      const pathArg = node.arguments?.[0];

      if (pathArg?.type === 'Literal' && typeof pathArg.value === 'string') {
        const endpoint: APIEndpoint = {
          id: `${filePath}_${endpoints.length}`,
          method,
          path: pathArg.value,
          file: filePath,
          line: node.loc?.start?.line || 1,
          handler: 'unknown',
          parameters: [],
          responses: ['200'],
          authentication_required: false,
          handler_function: 'unknown',
          file_path: filePath,
          line_number: node.loc?.start?.line || 1,
        };

        endpoints.push(endpoint);
      }
    }

    // NestJS patterns: @Get(), @Post(), etc.
    if (
      node.type === 'Decorator' &&
      node.expression?.type === 'CallExpression' &&
      node.expression?.callee?.name &&
      ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Head', 'Options'].includes(
        node.expression.callee.name,
      )
    ) {
      const method = node.expression.callee.name.toUpperCase();
      const pathArg = node.expression.arguments?.[0];
      const path = pathArg?.type === 'Literal' ? pathArg.value : '/';

      const endpoint: APIEndpoint = {
        id: `${filePath}_${endpoints.length}`,
        method,
        path: String(path),
        file: filePath,
        line: node.loc?.start?.line || 1,
        handler: 'unknown',
        parameters: [],
        responses: ['200'],
        authentication_required: false,
        handler_function: 'unknown',
        file_path: filePath,
        line_number: node.loc?.start?.line || 1,
      };

      endpoints.push(endpoint);
    }

    // Traverse child nodes
    for (const key in node) {
      if (key !== 'parent') {
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(item => this.traverseASTForEndpoints(item, endpoints, filePath, content));
        } else if (child && typeof child === 'object') {
          this.traverseASTForEndpoints(child, endpoints, filePath, content);
        }
      }
    }
  }

  private extractEndpointsWithRegex(
    content: string,
    endpoints: APIEndpoint[],
    filePath: string,
  ): void {
  // Lines reserved for future use

    // Express patterns
    const expressPattern =
      /\b(app|router)\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

    // NestJS patterns
    const nestjsPattern =
      /@(Get|Post|Put|Delete|Patch|Head|Options)\s*\(\s*['"\`]?([^'"\`)]*)['"\`]?/gi;

    let match;

    // Find Express endpoints
    while ((match = expressPattern.exec(content)) !== null) {
      const method = match[2].toUpperCase();
      const path = match[3];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      const endpoint: APIEndpoint = {
        id: `${filePath}_${endpoints.length}`,
        method: method as any,
        path,
        file: filePath,
        line: lineNumber,
        handler: 'unknown',
        parameters: [],
        responses: ['200'],
        authentication_required: false,
        handler_function: 'unknown',
        file_path: filePath,
        line_number: lineNumber,
      };

      endpoints.push(endpoint);
    }

    // Find NestJS endpoints
    while ((match = nestjsPattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2] || '/';
      const lineNumber = content.substring(0, match.index).split('\n').length;

      const endpoint: APIEndpoint = {
        id: `${filePath}_${endpoints.length}`,
        method: method as any,
        path,
        file: filePath,
        line: lineNumber,
        handler: 'unknown',
        parameters: [],
        responses: ['200'],
        authentication_required: false,
        handler_function: 'unknown',
        file_path: filePath,
        line_number: lineNumber,
      };

      endpoints.push(endpoint);
    }
  }
}
