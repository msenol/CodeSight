// Simplified ESLint configuration for CodeSight Project
// Supports: React frontend, TypeScript MCP server, Express API, and general JavaScript/TypeScript
// Generated: 2025-01-27

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,ts,jsx,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // General best practices
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-unused-expressions': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'all'],
      'comma-dangle': ['error', 'always-multiline'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json', './typescript-mcp/tsconfig.json'],
        sourceType: 'module',
      },
    },
  },
  {
    files: ['*.config.ts', '*.config.js', 'vitest.config.ts', 'vite.config.ts', 'docusaurus.config.ts', 'docs/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: false, // Disable project-based parsing for config files
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-expressions': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'], // Re-define the main TS files config
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json', './typescript-mcp/tsconfig.json'],
        sourceType: 'module',
      },
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
    },
  },
  {
    files: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.vitest,
      },
    },
    rules: {
      // Relax rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
      'no-unused-expressions': 'off',
    },
  },
  {
    files: ['tests/load/*.js'],
    languageOptions: {
      globals: {
        __ENV: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/scripts/**/*.js'],
    rules: {
      // Build scripts can use require() and console
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off', // Use TypeScript's rule
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'build/**',
      'coverage/**',
      '*.node',
      'rust-core/target/**',
      'typescript-mcp/codesight-native.node',
      'api/dist/**',
      'src/dist/**',
      'types/definitions/**',
      '**/*.d.ts',
      '.next/**',
      '.nuxt/**',
      '.output/**',
      '.vitepress/cache/**',
      '.vitepress/dist/**',
    ],
  },
];