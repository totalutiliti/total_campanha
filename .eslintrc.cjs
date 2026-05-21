/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // RULES 8.2 — proibir any explícito.
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // RULES 8.5 — proibir console.log em código de produção (override em testes/scripts).
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-unresolved': 'off',
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    'coverage',
    '**/*.config.js',
    '**/*.config.cjs',
  ],
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/seed.ts', '**/scripts/**'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
