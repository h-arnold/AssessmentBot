// Plain config object to avoid ESM import of vite in current Node version.
module.exports = {
  test: {
    environment: 'node',
    setupFiles: ['tests/setupGlobals.js'],
    include: [
      'tests/**/*.test.js',
      'tests/models/**/*.test.js',
      'tests/requestHandlers/**/*.test.js',
      'tests/assignment/**/*.test.js',
      'tests/parsers/**/*.test.js',
      'tests/singletons/**/*.test.js',
    ],
  },
};
