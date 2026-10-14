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
    rules: {
      // Personal preference: conventional starred JSDoc is more readable.
      'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
      'unicorn/single-line-block-comment-style': ['error', 'single-line'],
      // Personal preference: retain full words in prose while checking standard capitalisation.
      'unicorn/comment-content': [
        'error',
        {
          replacements: {
            '\\bapplication\\b(?!/)': false,
            '\\bapplications\\b': false,
          },
        },
      ],
      // Personal preference: keep comments wrapped for readability and line-length requirements.
      'unicorn/no-manually-wrapped-comments': 'off',
      // Personal preference: action-labelled UI names are clearer than forced noun-based names.
      'unicorn/no-non-function-verb-prefix': 'off',
      // Personal preference: common Date/Set expressions are clearer without extra variables.
      'unicorn/no-unreadable-new-expression': 'off',
      // Personal preference: consistent object-method syntax is more readable than short arrow properties.
      'unicorn/prefer-short-arrow-method': 'off',
      // Personal preference: logical grouping suits constructor-first and public-entrypoint-first layouts.
      'unicorn/consistent-class-member-order': 'off',
      // Personal preference: preserve semantic guard order rather than sorting conditions by syntax.
      // Reordering can skip validation, logging or other side effects.
      'unicorn/prefer-simple-condition-first': 'off',
      // Personal preference: retain deliberate promise observers, identity and cleanup ordering.
      'unicorn/prefer-await': 'off',
      // Preserve CSS-unit prefix parsing; Number coercion rejects values such as '12px'.
      'unicorn/prefer-number-coercion': 'off',
      // Personal preference: preserve descriptive full names rather than enforce abbreviation churn.
      'unicorn/name-replacements': 'off',
      // Personal preference: short whitespace fixtures are clearer as literals.
      'unicorn/prefer-string-repeat': 'off',
      // Temporal is unavailable in Node 24; GAS/browser compatibility is not established.
      'unicorn/prefer-temporal': 'off',
      // Temporarily off: review exception boundaries before enforcing a complexity limit of one.
      // https://github.com/h-arnold/AssessmentBot/issues/325
      'unicorn/try-complexity': 'off',
      // Personal preference: .forEach is readable and preserves existing iteration semantics;
      // for...of offers no readability benefit here.
      'unicorn/no-for-each': 'off',
      // Temporarily disabled pending native Error.isError runtime, typing and recognition investigation.
      // https://github.com/h-arnold/AssessmentBot/issues/326
      'unicorn/prefer-error-is-error': 'off',
      // Temporarily disabled pending a universal custom-error constructor and cause contract.
      // https://github.com/h-arnold/AssessmentBot/issues/328
      'unicorn/custom-error-definition': 'off',
      // Temporarily disabled pending native Error.cause support, descriptors/serialisation and full-cause preservation.
      // https://github.com/h-arnold/AssessmentBot/issues/328
      'unicorn/no-error-property-assignment': 'off',
      // Guard clauses and comparator tie-breaks are clearer as statements; ternaries also
      // conflict with prefer-logical-operator-over-ternary.
      'unicorn/prefer-ternary': 'off',
      // Iterator.concat is absent from Node 24 and the project's ES2024 TypeScript typings.
      'unicorn/prefer-iterator-concat': 'off',
    },
  },
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
      // TypeScript's compiler enforces this check; the base ESLint rule is disabled
      // as recommended by https://eslint.org/docs/latest/rules/no-unreachable#handled_by_typescript
      'no-unreachable': 'off',
      // unicorn rules customization for frontend
      'unicorn/catch-error-name': 'error',
      'unicorn/no-null': 'off',
      'unicorn/no-keyword-prefix': 'off',
      'unicorn/filename-case': 'off',
      // Disabled by explicit user authorisation: this rule produces hideous workarounds
      // that are no better, and can be worse, than the flagged access. Frontend security
      // relies on sanitising and validating inputs at the relevant boundaries instead.
      'security/detect-object-injection': 'off',
      'no-console': 'error',
      // Warn on oversized files so they are picked up for refactoring when touched.
      // Matches the backend 500-line threshold; currently flags several large specs.
      'max-lines': ['warn', 500],
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
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/test/**'],
              message: 'Import shared test helpers only from spec files or src/test support files.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.spec.{ts,tsx}', 'src/test/**'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/**/*.spec.{ts,tsx}', 'src/test/**', 'e2e-tests/**'],
    rules: {
      // Fresh fixtures and mocks are intentionally reassigned by test setup and reset hooks.
      'unicorn/no-top-level-assignment-in-function': 'off',
    },
  },
  {
    files: [
      'eslint.config.js',
      'playwright.config.ts',
      'vite.config.ts',
      'src/test/taskHeatmapPageMocks.ts',
    ],
    rules: {
      // Tool configs are evaluated at load time; shared Vitest mocks must register before imports.
      'unicorn/no-top-level-side-effects': 'off',
    },
  },
  {
    // This file is the canonical TS-side mapping of --app-spacing-* CSS tokens
    // (see src/frontend/src/theme/spacing.ts). Every export is a named constant
    // whose literal value IS the documented purpose of the module; extracting
    // them into further indirections would defeat the point.
    files: ['src/theme/spacing.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
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
    files: ['src/features/taskHeatmap/TaskPreviewCard.tsx'],
    rules: {
      // Preserve the reasoning fallback for empty strings; destructuring defaults replace undefined only.
      'unicorn/prefer-default-parameters': 'off',
    },
  },
  {
    files: ['src/services/apiService.ts'],
    rules: {
      // FIFO head removal is clearer with shift(); splice conflicts with no-unnecessary-splice.
      'unicorn/no-array-front-mutation': 'off',
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
            {
              group: ['./test/*', './test/**'],
              message:
                'Keep App.tsx within production source boundaries. Import shared test helpers only from spec files or src/test support files.',
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
    files: [
      'src/features/settings/backend/backendSettingsForm.zod.ts',
      'src/services/backendConfiguration.zod.ts',
      'src/services/backendConfigurationValidation.ts',
    ],
    rules: {
      '@typescript-eslint/no-magic-numbers': [
        'error',
        ...(Array.isArray(tsBaseRules['@typescript-eslint/no-magic-numbers'])
          ? tsBaseRules['@typescript-eslint/no-magic-numbers'].slice(1)
          : []),
      ],
    },
  },
  {
    files: ['src/**/*.{spec,test}.{ts,tsx}'],
    rules: {
      ...unicodeSecurityRules,
      'require-unicode-regexp': 'off',
    },
  },
  {
    // This spec file contains computeOverallComposite aggregation tests where
    // every flagged value is an expected assertion result derived from the
    // test's input data (e.g. weighted-average sums, data-point counts).
    // Extracting these into named constants adds indirection without improving
    // readability — the inline comments already document the derivation and
    // the values are immediately obvious from the inputs above each assertion.
    files: ['src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.spec.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
  {
    // These DataAnalysisService integration specs construct fixture inputs
    // (assignment/task weightings, submission scores) and assert the numeric
    // results the analyser produces from those exact inputs. The flagged
    // literals are therefore either fixture data or expected outputs whose
    // meaning is self-evident from the inputs declared immediately above each
    // expectation; hoisting them into named constants would scatter the
    // input/expected-output pairing across the file and reduce readability.
    files: [
      'src/services/dataAnalysis/dataAnalysis.integration.spec.ts',
      'src/services/dataAnalysis/dataAnalysis.integration.scenarios.spec.ts',
    ],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
]);
