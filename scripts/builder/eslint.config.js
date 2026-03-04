import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { tsBaseRules } = require('../../config/eslint/ts-base-rules.cjs');

export default [
  {
    files: ['scripts/builder/src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        ecmaVersion: 2024,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      jsdoc,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...tsBaseRules,
    },
  },
];
