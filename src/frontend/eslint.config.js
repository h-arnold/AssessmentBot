import { createRequire } from 'node:module';
import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig, globalIgnores } from 'eslint/config';

const require = createRequire(import.meta.url);
const { unicodeSecurityRules } = require('../../config/eslint/unicode-security-rules.cjs');
const {
  security: securityPlugin,
  tsBaseRules,
  sonarjs: sonarjsPlugin,
} = require('../../config/eslint/ts-base-rules.cjs');

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'coverage']),
  // Apply unicorn's complete rule set (modern JS preferences + more)
  unicorn.configs.all,
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
      security: securityPlugin,
      sonarjs: sonarjsPlugin,
      unicorn,
    },
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json', './tsconfig.e2e.json'],
      },
    },
    rules: {
      ...tsBaseRules,
      // unicorn rules customization for frontend
      'unicorn/no-array-for-each': 'off',
      'unicorn/catch-error-name': 'error',
      'unicorn/no-null': 'off',
      'unicorn/prevent-abbreviations': 'warn',
      'unicorn/no-keyword-prefix': 'off',
      'unicorn/filename-case': 'off',
      'no-console': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'globalThis',
          property: 'console',
          message: 'Use the frontend logger module as the only browser console emission boundary.',
        },
      ],
    },
  },
  {
    files: ['src/logging/frontendLogger.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-properties': 'off',
    },
  },
  {
    files: ['src/App.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: [
                'useState',
                'useEffect',
                'useReducer',
                'useMemo',
                'useCallback',
                'useRef',
              ],
              message:
                'Keep App.tsx as a composition root. Move state and side effects to feature hooks/components.',
            },
            {
              name: './services/authService',
              message:
                'Keep App.tsx service-free. Access services through feature hooks/components.',
            },
          ],
          patterns: [
            {
              group: ['./services/*', './services/**'],
              message:
                'Keep App.tsx service-free. Access services through feature hooks/components.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'React',
          property: 'useState',
          message:
            'Keep App.tsx as a composition root. Move state and side effects to feature hooks/components.',
        },
        {
          object: 'React',
          property: 'useEffect',
          message:
            'Keep App.tsx as a composition root. Move state and side effects to feature hooks/components.',
        },
        {
          object: 'React',
          property: 'useReducer',
          message:
            'Keep App.tsx as a composition root. Move state and side effects to feature hooks/components.',
        },
        {
          object: 'React',
          property: 'useLayoutEffect',
          message:
            'Keep App.tsx as a composition root. Move state and side effects to feature hooks/components.',
        },
        {
          object: 'React',
          property: 'useImperativeHandle',
          message:
            'Keep App.tsx as a composition root. Move state and side effects to feature hooks/components.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{spec,test}.{ts,tsx}'],
    rules: {
      ...unicodeSecurityRules,
      'require-unicode-regexp': 'off',
      'security/detect-object-injection': 'off',
    },
  },
]);
