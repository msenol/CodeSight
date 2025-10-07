import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';

describe('VS Code Integration Tests', () => {
  let mcpServer: ChildProcess | null = null;
  let vscodeProcess: ChildProcess | null = null;
  const testWorkspaceDir = join(process.cwd(), 'tests', 'workspace');
  const testLogDir = join(process.cwd(), 'typescript-mcp', 'logs');
  const testDbPath = join(process.cwd(), 'typescript-mcp', 'vscode-test.db');

  beforeAll(async () => {
    // Create test workspace
    if (!existsSync(testWorkspaceDir)) {
      mkdirSync(testWorkspaceDir, { recursive: true });
    }

    // Create test files in workspace
    createTestFiles();

    // Ensure log directory exists
    if (!existsSync(testLogDir)) {
      mkdirSync(testLogDir, { recursive: true });
    }

    // Clean up test database
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  beforeEach(async () => {
    await startMCPServer();
  });

  afterEach(async () => {
    await stopMCPServer();
    await stopVSCode();
  });

  afterAll(async () => {
    // Clean up test artifacts
    if (existsSync(testWorkspaceDir)) {
      rmSync(testWorkspaceDir, { recursive: true });
    }
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  function createTestFiles(): void {
    // Create test TypeScript files
    const testFiles = [
      {
        path: join(testWorkspaceDir, 'src', 'utils.ts'),
        content: `
export function processData(data: any[]): any[] {
  return data.filter(item => item !== null).map(item => ({
    ...item,
    processed: true,
    timestamp: new Date().toISOString()
  }));
}

export function validateInput(input: string): boolean {
  return typeof input === 'string' && input.length > 0;
}

export class DataProcessor {
  private config: Record<string, any>;

  constructor(config: Record<string, any>) {
    this.config = config;
  }

  process(items: any[]): any[] {
    return processData(items).map(item => ({
      ...item,
      config: this.config
    }));
  }
}
        `,
      },
      {
        path: join(testWorkspaceDir, 'src', 'api.ts'),
        content: `
import { validateInput } from './utils';

export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

export async function fetchUserData(userId: string): Promise<ApiResponse<any>> {
  if (!validateInput(userId)) {
    throw new Error('Invalid user ID');
  }

  // Mock API call
  return {
    data: { id: userId, name: 'Test User' },
    status: 200,
    message: 'Success'
  };
}

export function handleApiError(error: Error): ApiResponse<null> {
  return {
    data: null,
    status: 500,
    message: error.message
  };
}
        `,
      },
      {
        path: join(testWorkspaceDir, 'package.json'),
        content: `
{
  "name": "vscode-test-project",
  "version": "1.0.0",
  "dependencies": {
    "typescript": "^5.0.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest"
  }
}
        `,
      },
      {
        path: join(testWorkspaceDir, 'tsconfig.json'),
        content: `
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
        `,
      },
    ];

    testFiles.forEach(file => {
      const dir = file.path.substring(0, file.path.lastIndexOf('\\'));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(file.path, file.content.trim());
    });
  }

  async function startMCPServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const serverPath = join(process.cwd(), 'typescript-mcp', 'test-integration-server.js');

      if (!existsSync(serverPath)) {
        reject(new Error(`MCP server not built at ${serverPath}`));
        return;
      }

      mcpServer = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          LOG_LEVEL: 'debug',
          LOG_DIR: testLogDir,
          DATABASE_PATH: testDbPath,
          NODE_ENV: 'test',
          WORKSPACE_ROOT: testWorkspaceDir,
        },
      });

      let resolved = false;

      mcpServer.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });

      const checkStartup = (data: Buffer) => {
        const log = data.toString();
        if ((log.includes('MCP server started') || log.includes('Server connected and ready') || log.includes('MCP server started on stdio')) && !resolved) {
          resolved = true;
          mcpServer?.stdout?.off('data', checkStartup);
          mcpServer?.stderr?.off('data', checkStartup);
          setTimeout(resolve, 100);
        }
      };

      mcpServer.stdout?.on('data', checkStartup);
      mcpServer.stderr?.on('data', checkStartup);

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('MCP server startup timeout'));
        }
      }, 10000);
    });
  }

  async function stopMCPServer(): Promise<void> {
    if (mcpServer && !mcpServer.killed) {
      mcpServer.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (!mcpServer.killed) {
        mcpServer.kill('SIGKILL');
      }
    }
    mcpServer = null;
  }

  async function stopVSCode(): Promise<void> {
    if (vscodeProcess && !vscodeProcess.killed) {
      vscodeProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!vscodeProcess.killed) {
        vscodeProcess.kill('SIGKILL');
      }
    }
    vscodeProcess = null;
  }

  function sendMCPRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!mcpServer || !mcpServer.stdin) {
        reject(new Error('MCP server not available'));
        return;
      }

      const requestId = Math.random().toString(36).substr(2, 9);
      const message = {
        jsonrpc: '2.0',
        id: requestId,
        ...request,
      };

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('MCP request timeout'));
        }
      }, 5000);

      const handleResponse = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === requestId && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            mcpServer?.stdout?.off('data', handleResponse);
            if (response.error) {
              reject(new Error(`MCP Error: ${response.error.message}`));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // Invalid JSON, ignore
        }
      };

      mcpServer.stdout?.on('data', handleResponse);
      mcpServer.stdin.write(JSON.stringify(message) + '\n');
    });
  }

  it('should detect VS Code workspace structure', async () => {
    // Initialize
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'vscode-test-client', version: '1.0.0' },
      },
    });

    // Check if server can access workspace files
    const searchResponse = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'search_code',
        arguments: {
          query: 'processData function',
          codebase: testWorkspaceDir,
          language: 'typescript',
        },
      },
    });

    expect(searchResponse).toHaveProperty('content');
    expect(Array.isArray(searchResponse.content)).toBe(true);
  });

  it('should analyze TypeScript files in VS Code workspace', async () => {
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'vscode-test-client', version: '1.0.0' },
      },
    });

    // Test function explanation
    const explainResponse = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'explain_function',
        arguments: {
          function_name: 'processData',
          file_path: join(testWorkspaceDir, 'src', 'utils.ts'),
          codebase: testWorkspaceDir,
        },
      },
    });

    expect(explainResponse).toHaveProperty('content');
    expect(Array.isArray(explainResponse.content)).toBe(true);
  });

  it('should find references across VS Code workspace', async () => {
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'vscode-test-client', version: '1.0.0' },
      },
    });

    // Test reference finding
    const referencesResponse = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'find_references',
        arguments: {
          symbol: 'validateInput',
          file_path: join(testWorkspaceDir, 'src', 'utils.ts'),
          codebase: testWorkspaceDir,
        },
      },
    });

    expect(referencesResponse).toHaveProperty('content');
    expect(Array.isArray(referencesResponse.content)).toBe(true);
  });

  it('should detect API endpoints in VS Code workspace', async () => {
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'vscode-test-client', version: '1.0.0' },
      },
    });

    const apiResponse = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'get_api_endpoints',
        arguments: {
          codebase: testWorkspaceDir,
          language: 'typescript',
        },
      },
    });

    expect(apiResponse).toHaveProperty('content');
    expect(Array.isArray(apiResponse.content)).toBe(true);
  });

  it('should analyze code complexity for VS Code files', async () => {
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'vscode-test-client', version: '1.0.0' },
      },
    });

    const complexityResponse = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'check_complexity',
        arguments: {
          file_path: join(testWorkspaceDir, 'src', 'utils.ts'),
          codebase: testWorkspaceDir,
        },
      },
    });

    expect(complexityResponse).toHaveProperty('content');
    expect(Array.isArray(complexityResponse.content)).toBe(true);
  });

  it('should trace data flow in VS Code workspace', async () => {
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'vscode-test-client', version: '1.0.0' },
      },
    });

    const dataFlowResponse = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'trace_data_flow',
        arguments: {
          variable: 'data',
          function_name: 'processData',
          file_path: join(testWorkspaceDir, 'src', 'utils.ts'),
          codebase: testWorkspaceDir,
        },
      },
    });

    expect(dataFlowResponse).toHaveProperty('content');
    expect(Array.isArray(dataFlowResponse.content)).toBe(true);
  });

  it('should find duplicate code in VS Code workspace', async () => {
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'vscode-test-client', version: '1.0.0' },
      },
    });

    const duplicatesResponse = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'find_duplicates',
        arguments: {
          codebase: testWorkspaceDir,
          min_lines: 3,
        },
      },
    });

    expect(duplicatesResponse).toHaveProperty('content');
    expect(Array.isArray(duplicatesResponse.content)).toBe(true);
  });

  it('should suggest refactoring for VS Code workspace', async () => {
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'vscode-test-client', version: '1.0.0' },
      },
    });

    const refactorResponse = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'suggest_refactoring',
        arguments: {
          file_path: join(testWorkspaceDir, 'src', 'utils.ts'),
          codebase: testWorkspaceDir,
        },
      },
    });

    expect(refactorResponse).toHaveProperty('content');
    expect(Array.isArray(refactorResponse.content)).toBe(true);
  });

  it('should perform security analysis on VS Code workspace', async () => {
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'vscode-test-client', version: '1.0.0' },
      },
    });

    const securityResponse = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'analyze_security',
        arguments: {
          codebase: testWorkspaceDir,
          severity: 'medium',
        },
      },
    });

    expect(securityResponse).toHaveProperty('content');
    expect(Array.isArray(securityResponse.content)).toBe(true);
  });

  it('should handle workspace file changes', async () => {
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'vscode-test-client', version: '1.0.0' },
      },
    });

    // Add a new file to workspace
    const newFilePath = join(testWorkspaceDir, 'src', 'new-file.ts');
    writeFileSync(newFilePath, `
export function newFunction(x: number): number {
  return x * 2;
}
    `);

    // Search for the new function
    const searchResponse = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'search_code',
        arguments: {
          query: 'newFunction',
          codebase: testWorkspaceDir,
          language: 'typescript',
        },
      },
    });

    expect(searchResponse).toHaveProperty('content');
    expect(Array.isArray(searchResponse.content)).toBe(true);
  });

  it('should work with VS Code extension configuration', async () => {
    // Simulate VS Code extension configuration
    const vscodeConfig = {
      'codesight.enableIntegration': true,
      'codesight.autoIndex': true,
      'codesight.excludePatterns': ['node_modules/**', 'dist/**'],
      'codesight.maxResults': 100,
    };

    // Test with VS Code-like configuration
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: {
          name: 'vscode',
          version: '1.85.0',
          metadata: vscodeConfig,
        },
      },
    });

    const toolsResponse = await sendMCPRequest({
      method: 'tools/list',
    });

    expect(toolsResponse).toHaveProperty('tools');
    expect(Array.isArray(toolsResponse.tools)).toBe(true);
    expect(toolsResponse.tools.length).toBeGreaterThan(0);
  });
});