module.exports = {
  env: {
    browser: true,
    es2021: true,
    'googleappsscript/googleappsscript': true,
  },
  extends: 'eslint:recommended',
  plugins: ['googleappsscript'],
  overrides: [],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
};