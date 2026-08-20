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
      // TypeScript's compiler enforces this check; the base ESLint rule is disabled
      // as recommended by https://eslint.org/docs/latest/rules/no-unreachable#handled_by_typescript
      'no-unreachable': 'off',
      // unicorn rules customization for frontend
      'unicorn/no-array-for-each': 'off',
      'unicorn/catch-error-name': 'error',
      'unicorn/no-null': 'off',
      'unicorn/prevent-abbreviations': 'warn',
      'unicorn/no-keyword-prefix': 'off',
      'unicorn/filename-case': 'off',
      // Disabled by explicit user authorisation: this rule produces spaghetti
      // workarounds (switch statements / indexed-union lookups) without improving
      // security for the controlled, compile-time-checked property access used here.
      'security/detect-object-injection': 'off',
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
      'unicorn/prevent-abbreviations': 'warn',
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
  {
    // TaskHeatmapTable accesses heatmap cells by numeric index (`cells[index]`)
    // where the index is a bounded loop variable or a pre-computed task index
    // that has been validated upstream by the heatmap adapter (Zod schema). The
    // `security/detect-object-injection` rule flags all bracket access with a
    // variable index, but in this case the index is thoroughly validated and
    // satisfies the data contract before it reaches this component. Disabling
    // at file level avoids repetitive inline suppressions while keeping the
    // rule active for genuinely untrusted input elsewhere.
    files: ['src/features/classPage/TaskHeatmapTable.tsx'],
    rules: {
      'security/detect-object-injection': 'off',
    },
  },
  {
    // `studentAveragesTableColumns` colours each metric cell via
    // `METRIC_TONE_CELL_STYLE[color]`, where `color` is the bounded
    // `MetricToneColor` union (resolved by `resolveMetricTone` against a fixed
    // scoring range). The lookup is therefore type-safe and cannot address an
    // arbitrary property; the `security/detect-object-injection` heuristic
    // cannot see the union narrowing and would otherwise flag it. Mirror the
    // TaskHeatmapTable exception so the band-colour pattern stays consistent
    // across both class-page tables.
    files: ['src/features/classPage/studentAveragesTableColumns.tsx'],
    rules: {
      'security/detect-object-injection': 'off',
    },
  },
  {
    // AppAuthGate memoises getWarmupForbiddenMessage over [queryClient, warmupCycleState].
    // The warm-up cycle snapshot is a genuine (if indirect) dependency: it is the re-render
    // trigger that fires once warm-up resolves, without which the FORBIDDEN denial lookup
    // would never re-run. ESLint's react-hooks/exhaustive-deps rule cannot see the reference
    // because the lookup reads the React Query cache directly rather than the snapshot value,
    // so the dependency is intentionally retained and the rule is disabled for this file only
    // by explicit user authorisation.
    files: ['src/features/auth/AppAuthGate.tsx'],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
]);
