import js from '@eslint/js';
import { createRequire } from 'node:module';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

const require = createRequire(import.meta.url);
const { tsBaseRules } = require('../../config/eslint/ts-base-rules.cjs');

export default defineConfig([
  globalIgnores(['dist', 'playwright-report']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      jsdoc,
    },
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.browser,
    },
    rules: {
      ...tsBaseRules,
    },
  },
]);
