import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // globals: true, // Temporarily disabled due to TS config issue
    environment: 'node',
    include: ['tests/integration/**/*.test.ts', 'tests/contract/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'typescript-mcp/dist', 'rust-core/target'],
    testTimeout: 30000, // 30 second timeout for integration tests
    hookTimeout: 30000,
    setupFiles: [],
    teardownTimeout: 10000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Run tests sequentially to avoid port conflicts
        minThreads: 1,
        maxThreads: 1,
      },
    },
    // reporters: ['default', 'verbose'],
    // outputFile: {
    //   json: './test-results/integration-results.json',
    // },
    retry: 2, // Retry failed tests
    bail: 0, // Continue running tests even if some fail (0 = false)
    watch: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'test'),
  },
});