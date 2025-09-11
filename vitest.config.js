// Plain config object to avoid ESM import of vite in current Node version.
module.exports = {
  test: {
    environment: 'node',
    setupFiles: ['tests/setupGlobals.js'],
    include: ['tests/**/*.test.js']
  }
};
