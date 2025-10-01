// Rule 15: ESLint configuration for CodeSight MCP Server
// This configuration balances strictness with practical development needs

module.exports = {
  root: true,
  ignorePatterns: [
    'dist/**',
    'node_modules/**',
    '*.node',
    'codesight-native.node',
    'target/**',
    '*.d.ts',
  ],
  env: {
    node: true,
    es2022: true,
  },
  globals: {
    // Node.js globals that should be available
    process: 'readonly',
    console: 'readonly',
    require: 'readonly',
    setTimeout: 'readonly',
    Buffer: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    module: 'readonly',
    exports: 'readonly',
  },
  extends: [
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // Rule 15: Rely on TypeScript's own type checking instead of ESLint variable rules
    'no-unused-vars': 'off',
    'no-undef': 'off',

    // Rule 15: Core TypeScript rules
    '@typescript-eslint/no-explicit-any': 'error',
    // Use TypeScript's own unused variable detection which is more accurate
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'warn',

    // Allow console for logging (Rule 15 exception for development)
    'no-console': 'off',

    // Allow require for native modules
    '@typescript-eslint/no-var-requires': 'off',

    // Rule 15: Constructor injection is not useless
    'no-useless-constructor': 'off',

    // Rule 15: Allow await in loops for mock implementations
    'no-await-in-loop': 'warn',

    // Rule 15: Allow destructuring preference warnings
    'prefer-destructuring': 'warn',

    // Rule 15: Allow function signatures in interfaces
    '@typescript-eslint/ban-types': 'off',

    // Rule 15: Allow setTimeout return values
    'no-promise-executor-return': 'off',

    // Rule 15: Allow void return in Promise executors
    '@typescript-eslint/no-invalid-void-type': 'off',
  },
  overrides: [
    {
      files: ['**/*.ts'],
      rules: {
        // Rule 15: TypeScript specific relaxations for practical development
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
      },
    },
  ],
};