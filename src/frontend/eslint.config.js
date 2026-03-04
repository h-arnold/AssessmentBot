import js from '@eslint/js';
import { createRequire } from 'node:module';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig, globalIgnores } from 'eslint/config';

const require = createRequire(import.meta.url);
const { tsBaseRules } = require('../../config/eslint/ts-base-rules.cjs');

export default defineConfig([
  globalIgnores(['dist', 'playwright-report']),
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
    },
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.browser,
    },
    rules: {
      ...tsBaseRules,
      // unicorn rules customization for frontend
      'unicorn/no-array-for-each': 'off',
      'unicorn/catch-error-name': 'error',
      'unicorn/no-null': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-keyword-prefix': 'off',
      'unicorn/filename-case': 'off',
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
]);
