module.exports = {
  preset: '@shelf/jest-dynamodb',
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  testMatch: ['<rootDir>/tests/e2e/**/*.spec.ts'],
  testTimeout: 30000,
};
