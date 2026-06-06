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
          environment: 'node',
          setupFiles: ['tests/setupGlobals.js'],
          globals: true,
          include: ['tests/**/*.test.js'],
          exclude: [...removedDeprecatedLegacyTests, ...permanentlyExcludedDeprecatedTests],
        },
      },
    ],
  },
};
