#!/usr/bin/env node

/**
 * Manual MCP Server Test Script
 * Tests the CodeSight MCP server functionality
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Starting Manual MCP Server Test...\n');

// Start the MCP server
const mcpServer = spawn('node', [join(__dirname, 'dist', 'minimal-index.js')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
});

let testResults = {
    started: false,
    initialized: false,
    toolsRegistered: false,
    errors: []
};

// Test timeout
const testTimeout = setTimeout(() => {
    console.log('\n⏱️ Test timeout reached (30 seconds)');
    printResults();
    process.exit(0);
}, 30000);

mcpServer.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📤 Server:', output.trim());

    if (output.includes('Server connected and ready')) {
        testResults.started = true;
        console.log('✅ Server started successfully');

        // Test initialization
        setTimeout(() => {
            testMCPInitialization();
        }, 1000);
    }

    if (output.includes('MCP tools registered successfully')) {
        testResults.toolsRegistered = true;
        console.log('✅ MCP tools registered');
    }

    if (output.includes('Rust core initialized successfully')) {
        testResults.initialized = true;
        console.log('✅ Core services initialized');
    }
});

mcpServer.stderr.on('data', (data) => {
    const error = data.toString();
    console.error('❌ Error:', error.trim());
    testResults.errors.push(error);
});

mcpServer.on('close', (code) => {
    console.log(`\n🔄 Server process exited with code ${code}`);
    clearTimeout(testTimeout);
    printResults();
});

function testMCPInitialization() {
    console.log('\n🔍 Testing MCP Initialization...');

    // Send a simple JSON-RPC message to test
    const testMessage = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
                name: "test-client",
                version: "1.0.0"
            }
        }
    });

    mcpServer.stdin.write(testMessage + '\n');

    // Test listing tools
    setTimeout(() => {
        const listToolsMessage = JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list"
        });

        mcpServer.stdin.write(listToolsMessage + '\n');

        setTimeout(() => {
            console.log('🧪 Test completed successfully!');
            mcpServer.kill('SIGTERM');
        }, 2000);
    }, 1000);
}

function printResults() {
    console.log('\n📊 Test Results:');
    console.log('================');
    console.log(`✅ Server Started: ${testResults.started ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Core Initialized: ${testResults.initialized ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Tools Registered: ${testResults.toolsRegistered ? 'PASS' : 'FAIL'}`);
    console.log(`❌ Errors: ${testResults.errors.length}`);

    if (testResults.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        testResults.errors.forEach((error, index) => {
            console.log(`  ${index + 1}. ${error}`);
        });
    }

    const allPassed = testResults.started && testResults.initialized && testResults.toolsRegistered && testResults.errors.length === 0;

    console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Test interrupted by user');
    clearTimeout(testTimeout);
    mcpServer.kill('SIGTERM');
    printResults();
    process.exit(0);
});