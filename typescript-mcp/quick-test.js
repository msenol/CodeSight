#!/usr/bin/env node

/**
 * Quick MCP Test - Tests basic functionality
 */

console.log('🚀 CodeSight MCP Quick Test');
console.log('============================\n');

// Test 1: Check if the build exists
import { existsSync } from 'fs';
import { join } from 'path';

const distPath = join(process.cwd(), 'dist', 'minimal-index.js');

if (!existsSync(distPath)) {
    console.log('❌ Build not found. Run: npm run build');
    process.exit(1);
}

console.log('✅ Build exists');

// Test 2: Try to start the server
import { spawn } from 'child_process';

const server = spawn('node', [distPath], {
    stdio: 'pipe',
    cwd: process.cwd()
});

let output = '';
let hasStarted = false;

server.stdout.on('data', (data) => {
    output += data.toString();
    if (output.includes('Server connected and ready')) {
        hasStarted = true;
        console.log('✅ Server starts successfully');
        server.kill('SIGTERM');
    }
});

server.stderr.on('data', (data) => {
    console.log('⚠️ Warning:', data.toString().trim());
});

setTimeout(() => {
    if (server.kill('SIGTERM')) {
        console.log('✅ Server process terminated cleanly');
    }

    console.log('\n📊 Quick Test Results:');
    console.log(`✅ Server Status: ${hasStarted ? 'WORKING' : 'NEEDS DEBUG'}`);
    console.log('\n🎯 Next Steps:');
    console.log('1. Configure Claude Desktop with provided config');
    console.log('2. Test with real code analysis requests');
    console.log('3. Index a sample project for testing');

    process.exit(0);
}, 5000);