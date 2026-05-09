#!/usr/bin/env node

/**
 * MCP Integration Test for Rust FFI
 *
 * Spawns the MCP server (dist/index.js) and exercises all 16 tools
 * via the Model Context Protocol (stdio transport).
 */

const { spawn } = require('child_process');
const path = require('path');

const SERVER_PATH = path.join(__dirname, '..', 'dist', 'index.js');

function send(proc, msg) {
  const line = JSON.stringify(msg);
  proc.stdin.write(line + '\n');
}

function sendInit(proc) {
  send(proc, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'rust-ffi-test', version: '1.0' },
    },
  });
  send(proc, { jsonrpc: '2.0', method: 'notifications/initialized' });
}

function callTool(proc, id, name, args) {
  send(proc, {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: args },
  });
}

async function runTest() {
  console.log('🚀 Starting MCP server for Rust FFI integration test...\n');

  const proc = spawn('node', [SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: path.join(__dirname, '..'),
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.includes('WARN') || line.includes('ERROR')) {
        console.log('   [SERVER]', line);
      }
    }
  });

  const responses = [];
  let buffer = '';

  proc.stdout.on('data', (data) => {
    buffer += data.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        responses.push(msg);
      } catch {
        // ignore non-JSON lines
      }
    }
  });

  // Wait for server to start
  await new Promise((r) => setTimeout(r, 800));

  sendInit(proc);
  await new Promise((r) => setTimeout(r, 300));

  const tests = [
    {
      id: 10,
      name: 'search_code',
      args: { query: 'search', codebase_id: 'typescript-mcp/src/tools' },
      check: (res) => res?.content?.length > 0,
    },
    {
      id: 20,
      name: 'index_codebase',
      args: { path: 'typescript-mcp/src/tools', force_reindex: false },
      check: (res) => res?.content?.[0]?.text?.toLowerCase().includes('indexed'),
    },
    {
      id: 30,
      name: 'explain_function',
      args: { function_name: 'searchCode', file_path: 'src/tools/search-code.ts' },
      check: (res) => res?.content?.length > 0,
    },
    {
      id: 40,
      name: 'check_complexity',
      args: { file_path: 'src/tools/search-code.ts' },
      check: (res) => res?.content?.length > 0,
    },
    {
      id: 50,
      name: 'find_duplicates',
      args: { codebase_id: 'typescript-mcp/src/tools', min_lines: 5 },
      check: (res) => Array.isArray(res?.content),
    },
    {
      id: 60,
      name: 'analyze_security',
      args: { codebase_id: 'typescript-mcp/src/tools' },
      check: (res) => res?.content?.length > 0,
    },
    {
      id: 70,
      name: 'ai_code_review',
      args: { file_path: 'src/tools/search-code.ts' },
      check: (res) => res?.content?.length > 0,
    },
    {
      id: 80,
      name: 'get_api_endpoints',
      args: { codebase_id: 'typescript-mcp/src' },
      check: (res) => Array.isArray(res?.content),
    },
    {
      id: 90,
      name: 'trace_data_flow',
      args: { symbol_name: 'searchCode', codebase_id: 'typescript-mcp/src/tools' },
      check: (res) => res?.content?.length > 0,
    },
    {
      id: 100,
      name: 'context_aware_code_generation',
      args: { prompt: 'Create a simple greet function', language: 'typescript' },
      check: (res) => res?.content?.length > 0,
    },
  ];

  for (const t of tests) {
    callTool(proc, t.id, t.name, t.args);
    // AI tools need more time on free-tier OpenRouter
    const delay = t.name.startsWith('ai_') ? 20000 : 1500;
    await new Promise((r) => setTimeout(r, delay));
  }

  // Give extra time for slow LLM responses
  await new Promise((r) => setTimeout(r, 10000));

  proc.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));

  console.log('\n📊 Test Results\n' + '='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const res = responses.find((r) => r.id === t.id);
    const ok = res && t.check(res.result);
    const status = ok ? '✅ PASS' : '❌ FAIL';
    if (ok) passed++; else failed++;

    const text = res?.result?.content?.[0]?.text ?? '(no text)';
    const preview = text.length > 80 ? text.slice(0, 80) + '…' : text;

    console.log(`${status}  ${t.name.padEnd(22)} ${preview}`);
    if (!ok && res?.error) {
      console.log(`         Error: ${JSON.stringify(res.error).slice(0, 120)}`);
    }
  }

  console.log('='.repeat(60));
  console.log(`\nTotal: ${tests.length} | Passed: ${passed} | Failed: ${failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
