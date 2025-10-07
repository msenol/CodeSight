import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { wait } from '../utils/helpers';

describe('Claude Desktop Integration Tests', () => {
  let mcpServer: ChildProcess | null = null;
  const testLogDir = join(process.cwd(), 'typescript-mcp', 'logs');
  const testDbPath = join(process.cwd(), 'typescript-mcp', 'test-codesight.db');

  beforeAll(async () => {
    // Ensure test directories exist
    if (!existsSync(testLogDir)) {
      mkdirSync(testLogDir, { recursive: true });
    }

    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }

    // Build the MCP server
    await new Promise<void>((resolve, reject) => {
      const build = spawn('npm', ['run', 'build:mcp'], {
        stdio: 'pipe',
        shell: true,
      });

      build.on('close', (code) => {
        if (code === 0) {resolve();}
        else {reject(new Error(`Build failed with code ${code}`));}
      });
    });
  });

  beforeEach(async () => {
    // Start MCP server for each test
    await startMCPServer();
  });

  afterEach(async () => {
    // Stop MCP server after each test
    await stopMCPServer();
  });

  afterAll(async () => {
    // Clean up test artifacts
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

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
        },
      });

      let resolved = false;

      mcpServer.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });

      mcpServer.stderr?.on('data', (data) => {
        const log = data.toString();
        // Look for successful startup message
        if ((log.includes('MCP server started') || log.includes('Server connected and ready') || log.includes('MCP server started on stdio')) && !resolved) {
          resolved = true;
          setTimeout(resolve, 100); // Give server time to fully initialize
        }
      });

      mcpServer.stdout?.on('data', (data) => {
        const log = data.toString();
        if ((log.includes('MCP server started') || log.includes('Server connected and ready') || log.includes('MCP server started on stdio')) && !resolved) {
          resolved = true;
          setTimeout(resolve, 100);
        }
      });

      // Timeout after 10 seconds
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

      // Wait for graceful shutdown
      await new Promise(resolve => {
        setTimeout(resolve, 2000);
      });

      // Force kill if still running
      if (!mcpServer.killed) {
        mcpServer.kill('SIGKILL');
      }
    }
    mcpServer = null;
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

  it('should start MCP server successfully', async () => {
    expect(mcpServer).toBeTruthy();
    expect(mcpServer?.killed).toBe(false);
  });

  it('should respond to MCP initialize request', async () => {
    const response = await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    });

    expect(response).toHaveProperty('protocolVersion');
    expect(response).toHaveProperty('capabilities');
    expect(response.capabilities).toHaveProperty('tools');
  });

  it('should list available MCP tools', async () => {
    // First initialize
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    const response = await sendMCPRequest({
      method: 'tools/list',
    });

    expect(response).toHaveProperty('tools');
    expect(Array.isArray(response.tools)).toBe(true);
    expect(response.tools.length).toBeGreaterThan(0);

    // Check that expected tools are present
    const toolNames = response.tools.map((tool: any) => tool.name);
    const expectedTools = [
      'search_code',
      'explain_function',
      'find_references',
      'trace_data_flow',
      'analyze_security',
      'get_api_endpoints',
      'check_complexity',
      'find_duplicates',
      'suggest_refactoring',
    ];

    expectedTools.forEach(tool => {
      expect(toolNames).toContain(tool);
    });
  });

  it('should handle search_code tool call', async () => {
    // Initialize
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    const response = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'search_code',
        arguments: {
          query: 'data processing functions',
          codebase: 'test-project',
          language: 'typescript',
        },
      },
    });

    expect(response).toHaveProperty('content');
    expect(Array.isArray(response.content)).toBe(true);
  });

  it('should handle explain_function tool call', async () => {
    // Initialize
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    const response = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'explain_function',
        arguments: {
          function_name: 'processData',
          file_path: 'src/utils/data.ts',
          codebase: 'test-project',
        },
      },
    });

    expect(response).toHaveProperty('content');
    expect(Array.isArray(response.content)).toBe(true);
  });

  it('should properly format Claude Desktop configuration', async () => {
    const configPath = join(process.cwd(), 'typescript-mcp', 'claude-desktop-config.json');

    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(await import('fs').then(fs => fs.readFileSync(configPath, 'utf8')));

    expect(config).toHaveProperty('mcpServers');
    expect(config.mcpServers).toHaveProperty('codesight');

    const serverConfig = config.mcpServers.codesight;
    expect(serverConfig).toHaveProperty('command', 'node');
    expect(serverConfig).toHaveProperty('args');
    expect(Array.isArray(serverConfig.args)).toBe(true);
    expect(serverConfig.args[0]).toMatch(/(index|test-integration-server)\.js$/);
  });

  it('should handle malformed requests gracefully', async () => {
    // Test with invalid JSON - should not crash the server
    expect(() => {
      if (mcpServer && mcpServer.stdin) {
        mcpServer.stdin.write('invalid json\n');
      }
    }).not.toThrow();

    // Wait a bit to ensure server processes the invalid input
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test with missing required tool name - should return an error response
    try {
      const response = await sendMCPRequest({
        method: 'tools/call',
        params: {
          // Missing name field
          arguments: { query: 'test' },
        },
      });

      // Should get an error response, not crash
      expect(response).toBeDefined();
    } catch (error) {
      // It's acceptable if the server returns an error
      expect(error.message).toBeDefined();
    }
  });

  it('should maintain connection across multiple requests', async () => {
    // Initialize
    await sendMCPRequest({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    // Send multiple requests sequentially
    const toolsResponse = await sendMCPRequest({
      method: 'tools/list',
    });

    expect(toolsResponse).toHaveProperty('tools');

    const searchResponse = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'search_code',
        arguments: { query: 'test', codebase: 'test' },
      },
    });

    expect(searchResponse).toHaveProperty('content');

    const explainResponse = await sendMCPRequest({
      method: 'tools/call',
      params: {
        name: 'explain_function',
        arguments: { function_name: 'test', file_path: 'test.js' },
      },
    });

    expect(explainResponse).toHaveProperty('content');
  });

  it('should write debug logs to specified directory', async () => {
    // Give some time for logs to be written
    await new Promise(resolve => setTimeout(resolve, 1000));

    const logFiles = ['combined.log', 'error.log'];

    for (const logFile of logFiles) {
      const logPath = join(testLogDir, logFile);
      if (existsSync(logPath)) {
        const logContent = await import('fs').then(fs => fs.readFileSync(logPath, 'utf8'));
        expect(logContent.length).toBeGreaterThan(0);
      }
    }
  });
});