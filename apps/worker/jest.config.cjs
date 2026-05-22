/** @type {import('jest').Config} */
// Config do `pnpm test` (testes unitários) — testes em src/**/*.spec.ts.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  // Imports ESM com sufixo .js (NodeNext) — mapeia .js→sem extensão.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
