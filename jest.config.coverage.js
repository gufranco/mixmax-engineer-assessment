module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/**/*.spec.ts', '<rootDir>/tests/integration/**/*.spec.ts'],
  testTimeout: 30000,
  maxWorkers: 1,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/logging/logger.ts',
    '!src/infrastructure/dynamo.client.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },
};
