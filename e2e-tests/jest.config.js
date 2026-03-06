export default {
  rootDir: '..',
  testEnvironment: 'node',
  testTimeout: 120000,
  maxWorkers: 1,
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/e2e-tests/setup.js'],
  testMatch: ['<rootDir>/e2e-tests/specs/**/*.spec.js'],
  modulePathIgnorePatterns: ['<rootDir>/backups/'],
  testPathIgnorePatterns: ['<rootDir>/backups/']
};
