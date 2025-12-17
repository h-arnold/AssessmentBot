// Plain config object to avoid ESM import of vite in current Node version.
module.exports = {
  test: {
    projects: [
      {
        name: 'node',
        environment: 'node',
        setupFiles: ['tests/setupGlobals.js'],
        globals: true,
        include: ['tests/**/*.test.js'],
        exclude: ['tests/ui/**'],
      },
      {
        name: 'ui-jsdom',
        environment: 'jsdom',
        setupFiles: ['tests/setupGlobals.js'],
        globals: true,
        include: ['tests/ui/**/*.test.js'],
      },
    ],
  },
};
