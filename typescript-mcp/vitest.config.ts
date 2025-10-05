import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Test file patterns
    include: ['tests/**/*.{test,spec}.{ts,tsx,js,jsx}', 'src/**/*.{test,spec}.{ts,tsx,js,jsx}'],

    // Exclude patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      'rust-core/**',
      '.idea/**',
      '.vscode/**',
      '.git/**',
      'coverage/**',
    ],

    // Test timeout
    testTimeout: 30000,

    // Enable global test setup
    globals: true,

    // Hook configuration
    hookTimeout: 10000,

    // Test isolation
    isolate: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'rust-core/**',
        'tests/**',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '**/setup/**',
        '**/mocks/**',
        '**/fixtures/**',
      ],
      include: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.config.{ts,js}',
        '!src/**/*.test.{ts,js}',
        '!src/**/*.spec.{ts,js}',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@tests': resolve(__dirname, 'tests'),
      '@services': resolve(__dirname, 'src/services'),
      '@tools': resolve(__dirname, 'src/tools'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },

  
  // Test reporters
  reporters: ['verbose', 'json'],

  // Output configuration
  outputFile: {
    json: './test-results/test-results.json',
    junit: './test-results/junit.xml',
  },
});
