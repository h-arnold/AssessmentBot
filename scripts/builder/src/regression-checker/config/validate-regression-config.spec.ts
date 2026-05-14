import { describe, expect, it } from 'vitest';

import type { RegressionConfigInput } from './validate-regression-config.zod.js';
import { validateRegressionConfig } from './validate-regression-config.js';

const REPO_ROOT = '/home/developer/AssessmentBot';

const PACKAGE_JSON_SCRIPTS_BY_DIRECTORY: Record<string, Record<string, string>> = {
  '.': {
    'lint:backend': 'eslint --config eslint.config.js --fix src/backend/**/*.js tests/**/*.js',
    'lint-and-test': 'npm run lint:backend:check && npm run test:backend',
    'lint:backend:check': 'eslint --config eslint.config.js src/backend/**/*.js tests/**/*.js',
    'missing-nested-wrapper':
      'eslint --config eslint.config.js src/backend/**/*.js tests/**/*.js npm run does-not-exist',
    'missing-nested-value-wrapper': 'npm run missing-nested-value',
  },
};

/**
 * Builds a minimal valid regression config fixture.
 *
 * @returns {RegressionConfigInput} Minimal regression config for validation tests.
 */
function createValidConfig(): RegressionConfigInput {
  return {
    reportDirectory: '.ts-regression-checker/reports',
    parallel: {
      enabled: true,
      maxWorkers: 2,
    },
    checks: [],
  };
}

describe('validateRegressionConfig', () => {
  it('rejects mutating npm-script commands through the shared safety helper', () => {
    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'mutating-check',
              tool: 'eslint',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'lint:backend',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/mutating|--fix|--write/i);
  });

  it('rejects chained npm-script commands through the shared safety helper', () => {
    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'chained-check',
              tool: 'eslint',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'lint-and-test',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/single tool|chained/i);
  });

  it('continues past missing nested npm run targets when a direct supported tool is already resolved', () => {
    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'missing-nested-target-check',
              tool: 'eslint',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'missing-nested-wrapper',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).not.toThrow();
  });
});
