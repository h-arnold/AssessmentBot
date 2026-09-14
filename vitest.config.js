// Plain config object to avoid ESM import of vite in current Node version.
const permanentlyExcludedDeprecatedTests = ['tests/controllers/initController.test.js'];
const removedDeprecatedLegacyTests = ['tests/ui/**', 'tests/singletons/uiLazyProbe.test.js'];

module.exports = {
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/backend/**/*.js'],
      exclude: [
        'src/backend/appsscript.json',
        'src/backend/AssignmentProcessor/globals.js',
        '**/AssignmentProcessor/globals.js',
      ],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 85,
      },
    },
    projects: [
      {
        name: 'node',
        test: {
          name: 'node',
          environment: 'node',
          setupFiles: ['tests/setupGlobals.js'],
          globals: true,
          include: ['tests/**/*.test.js'],
          exclude: [...removedDeprecatedLegacyTests, ...permanentlyExcludedDeprecatedTests],
        },
      },
      {
        name: 'synthetic-analysis',
        test: {
          name: 'synthetic-analysis',
          environment: 'node',
          setupFiles: ['tests/setupGlobals.js'],
          globals: true,
          include: ['tests/synthetic-analysis/**/*.test.ts'],
        },
      },
      {
        // Opt-in stress project: generates and validates the full 3,000-student /
        // 10,000-assignment large graph. It is never selected by the normal
        // `test:synthetic` or `test:synthetic:coverage` commands. The raised
        // timeout is an intentional stress budget, not a caller-supplied override.
        name: 'synthetic-analysis-stress',
        test: {
          name: 'synthetic-analysis-stress',
          environment: 'node',
          setupFiles: ['tests/setupGlobals.js'],
          globals: true,
          include: ['tests/synthetic-analysis-stress/**/*.test.ts'],
          testTimeout: 30_000,
        },
      },
    ],
  },
};
