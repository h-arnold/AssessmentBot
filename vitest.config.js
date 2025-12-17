// Plain config object to avoid ESM import of vite in current Node version.
module.exports = {
  test: {
    environment: 'node',
    environmentMatchGlobs: [['tests/ui/**', 'jsdom']],
    setupFiles: ['tests/setupGlobals.js'],
    globals: true,
    include: [
      'tests/**/*.test.js',
      'tests/models/**/*.test.js',
      'tests/requestHandlers/**/*.test.js',
      'tests/assignment/**/*.test.js',
      'tests/parsers/**/*.test.js',
      'tests/singletons/**/*.test.js',
      'tests/ui/**/*.test.js',
    ],
  },
};
