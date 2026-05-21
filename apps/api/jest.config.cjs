/** @type {import('jest').Config} */
// Config do `pnpm test` (testes unitários). Os testes ficam ao lado do código
// em src/**/*.spec.ts. As suítes de tenant-isolation e e2e usam configs
// próprias (test/jest-tenant-isolation.json, test/jest-e2e.json) via --config.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
};
