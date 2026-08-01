import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const {
  security: securityPlugin,
  tsBaseRules,
  sonarjs: sonarjsPlugin,
  unicorn: unicornPlugin,
} = require('../../config/eslint/ts-base-rules.cjs');

const typescriptPlugins = {
  '@typescript-eslint': tseslint,
  jsdoc,
  security: securityPlugin,
  sonarjs: sonarjsPlugin,
  unicorn: unicornPlugin,
};

const sharedRules = {
  ...tseslint.configs.recommended.rules,
  ...tsBaseRules,
  'security/detect-non-literal-fs-filename': 'off',
};

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
    plugins: typescriptPlugins,
    rules: sharedRules,
  },
  {
    // OpenCode plugins are Node-side TypeScript tooling, so they are linted to the
    // same standard as builder scripts via the shared rule set and the lint-only
    // .opencode/tsconfig.json project.
    files: ['.opencode/plugins/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: '../../.opencode/tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        ecmaVersion: 2024,
      },
    },
    plugins: typescriptPlugins,
    rules: sharedRules,
  },
  {
    files: [
      'scripts/builder/src/lib/cli-options.ts',
      'scripts/builder/src/steps/merge-manifest.ts',
      'scripts/builder/src/steps/validate-output.ts',
      'scripts/builder/src/steps/validate-output.spec.ts',
      'scripts/builder/src/regression-checker/cli/index.ts',
    ],
    rules: {
      'security/detect-object-injection': 'off',
    },
  },
];
