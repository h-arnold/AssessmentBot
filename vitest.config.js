// Plain config object to avoid ESM import of vite in current Node version.
const path = require('node:path');

const permanentlyExcludedDeprecatedTests = ['tests/controllers/initController.test.js'];
const removedDeprecatedLegacyTests = ['tests/ui/**', 'tests/singletons/uiLazyProbe.test.js'];

module.exports = {
  resolve: {
    // Synthetic-analysis suites import frontend Zod contracts and their
    // transitive modules, which use the frontend `@/*` alias internally.
    alias: {
      '@synthetic': path.resolve(__dirname, 'tests/__mocks__/data/synthetic-analysis'),
      '@': path.resolve(__dirname, 'src/frontend/src'),
    },
  },
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
        name: 'plugins',
        test: {
          name: 'plugins',
          environment: 'node',
          globals: true,
          include: ['.opencode/plugins/**/*.test.ts'],
        },
      },
      {
        // Opt-in stress project: generates and validates the rescaled large graph of
        // 48 classes x 30 students (1,440 students) and 48 x 50 assignments (2,400).
        // It is never selected by the normal `test:synthetic` or
        // `test:synthetic:coverage` commands. The raised timeout is an intentional
        // stress budget covering generation plus validation, not a caller-supplied override.
        name: 'synthetic-analysis-stress',
        test: {
          name: 'synthetic-analysis-stress',
          environment: 'node',
          setupFiles: ['tests/setupGlobals.js'],
          globals: true,
          include: ['tests/synthetic-analysis-stress/**/*.test.ts'],
          testTimeout: 120_000,
        },
      },
    ],
  },
};
