// Plain config object to avoid ESM import of vite in current Node version.
const includeLegacyUiTests = process.env.INCLUDE_LEGACY_UI_TESTS === 'true';
const permanentlyExcludedDeprecatedTests = [
  'tests/controllers/initController.test.js',
  'tests/controllers/createDefinitionFromWizardInputs.test.js',
];
const legacyUiTestPatterns = ['tests/ui/**', 'tests/singletons/uiLazyProbe.test.js'];

module.exports = {
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/backend/Api/**/*.js'],
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
          exclude: includeLegacyUiTests
            ? permanentlyExcludedDeprecatedTests
            : [...legacyUiTestPatterns, ...permanentlyExcludedDeprecatedTests],
        },
      },
      {
        name: 'ui-jsdom',
        test: {
          environment: 'jsdom',
          setupFiles: ['tests/setupGlobals.js'],
          globals: true,
          include: includeLegacyUiTests
            ? ['tests/ui/**/*.test.js']
            : ['tests/__legacy_ui_disabled__/**/*.test.js'],
        },
      },
    ],
  },
};
