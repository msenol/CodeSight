import { readFile } from 'fs/promises';
import { glob } from 'glob';
import path from 'path';
import type { APIEndpoint } from '../types/index.js';
import { codebaseService } from './codebase-service.js';

export interface ApiDiscoveryService {
  discoverEndpoints(_projectPath: string): Promise<APIEndpoint[]>;
  analyzeFile(_filePath: string): Promise<APIEndpoint[]>;
  findRestEndpoints(_filePath: string): Promise<APIEndpoint[]>;
  findGraphQLEndpoints(_filePath: string): Promise<APIEndpoint[]>;
  findWebSocketEndpoints(_filePath: string): Promise<APIEndpoint[]>;
  generateApiDocumentation(_endpoints: APIEndpoint[]): Promise<string>;
  validateEndpoints(_endpoints: APIEndpoint[]): Promise<ValidationResult[]>;
  findApiEndpoints(_codebaseId: string): Promise<APIEndpoint[]>;
  detectFrameworks(_codebaseId: string): Promise<string[]>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DetailedValidationResult {
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
  extractor: (_match: RegExpMatchArray, _code: string, _line: number) => Partial<APIEndpoint>;
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
  private endpointPatterns: EndpointPattern[] = [];

  async discoverEndpoints(projectPath: string): Promise<APIEndpoint[]> {
    const files = await glob('**/*.{ts,tsx,js,jsx}', {
      cwd: projectPath,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    });

    const allEndpoints: APIEndpoint[] = [];
    for (const file of files) {
      const endpoints = await this.analyzeFile(file);
      allEndpoints.push(...endpoints);
    }
    return this.deduplicateEndpoints(allEndpoints);
  }

  async analyzeFile(filePath: string): Promise<APIEndpoint[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const endpoints: APIEndpoint[] = [];

      // Express patterns: app.get('/path', ...), router.post('/path', ...)
      const expressPattern = /(?:app|router|express)\.(get|post|put|delete|patch|all|use)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
      let match: RegExpExecArray | null;
      while ((match = expressPattern.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        endpoints.push(this.createEndpoint(match, filePath, line, 'express'));
      }

      // Fastify patterns: fastify.get('/path', ...), server.post('/path', ...)
      const fastifyPattern = /(?:fastify|server|instance)\.(get|post|put|delete|patch|all|route)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
      while ((match = fastifyPattern.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        endpoints.push(this.createEndpoint(match, filePath, line, 'fastify'));
      }

      // NestJS method decorators: @Get(), @Post(), @Put(), etc.
      const nestMethodPattern = /@(Get|Post|Put|Delete|Patch|All|Options|Head)\s*(?:\(\s*['"`]([^'"`]+)['"`]\s*\))?/gi;
      // Find controller prefix if any
      const controllerMatch = /@Controller\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/i.exec(content);
      const prefix = controllerMatch ? controllerMatch[1].replace(/\/$/, '') : '';

      while ((match = nestMethodPattern.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        const method = match[1].toUpperCase();
        const routePath = match[2] || '';
        const fullPath = prefix + (routePath.startsWith('/') ? routePath : '/' + routePath);
        endpoints.push({
          id: `${method}:${fullPath}`,
          method,
          path: fullPath || '/',
          file: path.basename(filePath),
          line,
          handler: '',
          parameters: [],
          responses: [],
          authentication_required: content.toLowerCase().includes('auth') || content.toLowerCase().includes('guard'),
          handler_function: '',
          file_path: filePath,
          line_number: line,
          tags: ['nestjs'],
        });
      }

      // Next.js App Router: route.ts / page.tsx implicit endpoints
      const normalizedPath = filePath.replace(/\\/g, '/');
      if (normalizedPath.includes('/api/') || normalizedPath.includes('\\api\\')) {
        const nextPath = this.extractNextJsPath(normalizedPath);
        if (nextPath) {
          // Check for exported HTTP methods
          const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
          for (const method of methods) {
            if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`, 'i').test(content) ||
                new RegExp(`export\\s+\\{[^}]*\\b${method}\\b[^}]*\\}`, 'i').test(content)) {
              endpoints.push({
                id: `${method}:${nextPath}`,
                method,
                path: nextPath,
                file: path.basename(filePath),
                line: 1,
                handler: '',
                parameters: [],
                responses: [],
                authentication_required: false,
                handler_function: '',
                file_path: filePath,
                line_number: 1,
                tags: ['nextjs'],
              });
            }
          }
          // If no explicit method exports, assume GET for page.tsx
          if (endpoints.length === 0 && filePath.endsWith('page.tsx')) {
            endpoints.push({
              id: `GET:${nextPath}`,
              method: 'GET',
              path: nextPath,
              file: path.basename(filePath),
              line: 1,
              handler: '',
              parameters: [],
              responses: [],
              authentication_required: false,
              handler_function: '',
              file_path: filePath,
              line_number: 1,
              tags: ['nextjs'],
            });
          }
        }
      }

      return this.deduplicateEndpoints(endpoints);
    } catch {
      return [];
    }
  }

  async findRestEndpoints(filePath: string): Promise<APIEndpoint[]> {
    const endpoints = await this.analyzeFile(filePath);
    return endpoints.filter(e =>
      ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(e.method.toUpperCase())
    );
  }

  async findGraphQLEndpoints(filePath: string): Promise<APIEndpoint[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const endpoints: APIEndpoint[] = [];

      // GraphQL schema or resolver files
      if (filePath.endsWith('.graphql') || filePath.endsWith('.gql') ||
          content.includes('type Query') || content.includes('type Mutation') ||
          content.includes('GraphQLObjectType') || content.includes('@Resolver')) {
        const hasQuery = content.includes('type Query') || content.includes('Query:');
        const hasMutation = content.includes('type Mutation') || content.includes('Mutation:');
        const hasSubscription = content.includes('type Subscription') || content.includes('Subscription:');

        if (hasQuery) {
          endpoints.push({
            id: `GRAPHQL:/graphql`,
            method: 'GRAPHQL',
            path: '/graphql',
            file: path.basename(filePath),
            line: 1,
            handler: 'Query resolver',
            parameters: [],
            responses: [],
            authentication_required: false,
            handler_function: '',
            file_path: filePath,
            line_number: 1,
            tags: ['graphql'],
          });
        }
      }
      return endpoints;
    } catch {
      return [];
    }
  }

  async findWebSocketEndpoints(filePath: string): Promise<APIEndpoint[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const endpoints: APIEndpoint[] = [];

      const wsPattern = /(?:ws|socket|io)\.(on|emit|handleUpgrade)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
      let match: RegExpExecArray | null;
      while ((match = wsPattern.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        endpoints.push({
          id: `WS:${match[2]}`,
          method: 'WEBSOCKET',
          path: match[2],
          file: path.basename(filePath),
          line,
          handler: '',
          parameters: [],
          responses: [],
          authentication_required: false,
          handler_function: '',
          file_path: filePath,
          line_number: line,
          tags: ['websocket'],
        });
      }
      return endpoints;
    } catch {
      return [];
    }
  }

  async generateApiDocumentation(endpoints: APIEndpoint[]): Promise<string> {
    if (endpoints.length === 0) {
      return '# API Documentation\n\nNo API endpoints found.\n';
    }

    const byTag = new Map<string, APIEndpoint[]>();
    for (const ep of endpoints) {
      const tag = ep.tags?.[0] || 'general';
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(ep);
    }

    let doc = '# API Documentation\n\n';
    doc += `Total endpoints: ${endpoints.length}\n\n`;

    for (const [tag, eps] of byTag) {
      doc += `## ${tag.toUpperCase()}\n\n`;
      for (const ep of eps) {
        doc += `### ${ep.method} ${ep.path}\n`;
        doc += `- File: \`${ep.file_path}:${ep.line_number}\`\n`;
        if (ep.description) doc += `- Description: ${ep.description}\n`;
        if (ep.authentication_required) doc += `- Authentication: Required\n`;
        doc += '\n';
      }
    }
    return doc;
  }

  async validateEndpoints(endpoints: APIEndpoint[]): Promise<ValidationResult[]> {
    return endpoints.map(endpoint => {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!endpoint.path || endpoint.path === '/') {
        warnings.push('Endpoint path is root or empty');
      }
      if (!this.isValidHttpMethod(endpoint.method) && endpoint.method !== 'GRAPHQL' && endpoint.method !== 'WEBSOCKET') {
        errors.push(`Invalid HTTP method: ${endpoint.method}`);
      }
      if (!endpoint.handler_function && !endpoint.handler) {
        warnings.push('No handler function identified');
      }

      return { isValid: errors.length === 0, errors, warnings };
    });
  }

  async findApiEndpoints(codebaseId: string): Promise<APIEndpoint[]> {
    const codebase = await codebaseService.getCodebase(codebaseId);
    if (!codebase) return [];
    return this.discoverEndpoints(codebase.path);
  }

  async detectFrameworks(codebaseId: string): Promise<string[]> {
    const codebase = await codebaseService.getCodebase(codebaseId);
    if (!codebase) return [];

    const frameworks = new Set<string>();
    const files = await glob('**/{package.json,*.config.*}', {
      cwd: codebase.path,
      absolute: true,
      ignore: ['**/node_modules/**'],
    });

    for (const file of files) {
      try {
        if (file.endsWith('package.json')) {
          const content = await readFile(file, 'utf-8');
          const pkg = JSON.parse(content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          if (deps.express) frameworks.add('express');
          if (deps['@nestjs/core']) frameworks.add('nestjs');
          if (deps.fastify || deps['@fastify']) frameworks.add('fastify');
          if (deps.next) frameworks.add('nextjs');
          if (deps['@apollo/server'] || deps.graphql) frameworks.add('graphql');
          if (deps['socket.io'] || deps.ws) frameworks.add('websocket');
          if (deps.hapi || deps['@hapi/hapi']) frameworks.add('hapi');
          if (deps.koa) frameworks.add('koa');
        }
      } catch {
        // ignore
      }
    }

    return Array.from(frameworks);
  }

  // Helper methods
  private createEndpoint(
    match: RegExpExecArray,
    filePath: string,
    line: number,
    framework: string,
  ): APIEndpoint {
    const method = match[1].toUpperCase() === 'ALL' ? 'GET' : match[1].toUpperCase();
    const routePath = match[2];
    return {
      id: `${method}:${routePath}`,
      method,
      path: routePath,
      file: path.basename(filePath),
      line,
      handler: '',
      parameters: this.extractParameters(routePath),
      responses: [],
      authentication_required: false,
      handler_function: '',
      file_path: filePath,
      line_number: line,
      tags: [framework],
    };
  }

  private extractParameters(routePath: string): string[] {
    const params: string[] = [];
    const paramPattern = /:(\w+)|\[(\w+)\]|\[\.{3}(\w+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = paramPattern.exec(routePath)) !== null) {
      params.push(m[1] || m[2] || m[3] || 'param');
    }
    return params;
  }

  private extractNextJsPath(filePath: string): string | null {
    const normalized = filePath.replace(/\\/g, '/');
    const apiIdx = normalized.indexOf('/api/');
    if (apiIdx === -1) return null;

    let routePath = normalized.slice(apiIdx + 4); // starts with /api/...
    // Remove route.ts or page.tsx
    routePath = routePath.replace(/\/route\.ts$/, '');
    routePath = routePath.replace(/\/page\.tsx$/, '');
    routePath = routePath.replace(/\/page\.ts$/, '');
    routePath = routePath.replace(/\/page\.jsx$/, '');
    routePath = routePath.replace(/\/page\.js$/, '');
    // Convert [id] to :id
    routePath = routePath.replace(/\[(?:\.{3})?(\w+)\]/g, ':$1');
    return routePath || '/';
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private isInGraphQLContext(content: string, index: number): boolean {
    const beforeMatch = content.substring(0, index);
    const afterMatch = content.substring(index);

    const graphqlKeywords = [
      'resolver',
      'schema',
      'Query',
      'Mutation',
      'Subscription',
      'type',
      'input',
    ];
    const hasGraphQLBefore = graphqlKeywords.some(keyword =>
      beforeMatch.toLowerCase().includes(keyword.toLowerCase()),
    );

    const functionPattern = /\w+\s*:\s*\(.*\)\s*=>|function\s+\w+\s*\(/;
    const nearbyFunction =
      beforeMatch.slice(-100).search(functionPattern) >= 0 ||
      afterMatch.slice(0, 100).search(functionPattern) >= 0;

    return hasGraphQLBefore || nearbyFunction;
  }

  private deduplicateEndpoints(endpoints: APIEndpoint[]): APIEndpoint[] {
    const seen = new Set<string>();
    const unique: APIEndpoint[] = [];

    for (const endpoint of endpoints) {
      const key = `${endpoint.method}:${endpoint.path}:${endpoint.file_path}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(endpoint);
      }
    }

    return unique;
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

    if (method === 'GET' && path.includes('/create')) {
      return false;
    }
    if (method === 'POST' && !path.endsWith('s') && !path.includes('/')) {
      return false;
    }
    if (method === 'PUT' && !path.includes('/')) {
      return false;
    }
    if (method === 'DELETE' && path.endsWith('s') && !path.includes('/')) {
      return false;
    }

    return true;
  }
}

// Export a default instance for use in tools
export const apiDiscoveryService = new DefaultApiDiscoveryService();
export default apiDiscoveryService;
