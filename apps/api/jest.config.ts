import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/?(*.)+(spec|e2e-spec).ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]
  },
  collectCoverage: false,
  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/../../packages/domain/src/$1',
    '^@ui/(.*)$': '<rootDir>/../../packages/ui/src/$1',
    '^@vtex-client$': '<rootDir>/../../packages/vtex-client/src/index.ts',
    '^@vtex-client/(.*)$': '<rootDir>/../../packages/vtex-client/src/$1'
  }
};

export default config;
