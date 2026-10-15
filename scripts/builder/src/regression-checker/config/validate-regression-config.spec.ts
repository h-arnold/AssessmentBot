import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { RegressionConfigInput } from './validate-regression-config.zod.js';
import { validateRegressionConfig } from './validate-regression-config.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const EXPECTED_CHECK_COUNT = 2;

const PACKAGE_JSON_SCRIPTS_BY_DIRECTORY: Record<string, Record<string, string>> = {
  '.': {
    'lint:backend': 'eslint --config eslint.config.js --fix src/backend/**/*.js tests/**/*.js',
    'lint-and-test': 'npm run lint:backend:check && npm run test:backend',
    'lint:backend:check': 'eslint --config eslint.config.js src/backend/**/*.js tests/**/*.js',
    'missing-nested-wrapper':
      'eslint --config eslint.config.js src/backend/**/*.js tests/**/*.js npm run does-not-exist',
    'missing-nested-value-wrapper': 'npm run missing-nested-value',
    'prefix-equals-wrapper': 'npm --prefix=packages/regression-checker run nested-eslint',
    'prefix-without-value-wrapper': 'npm --prefix',
    'option-value-wrapper': 'npm --foo bar run lint:backend:check',
    'option-without-value-wrapper': 'npm --foo',
  },
  'packages/regression-checker': {
    'nested-eslint': 'eslint --config eslint.config.js src/backend/**/*.js tests/**/*.js',
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
  it('validates the committed regression config against the real root npm scripts', () => {
    const repoRoot = REPO_ROOT;
    const rawConfig: unknown = JSON.parse(
      fs.readFileSync(path.join(repoRoot, '.ts-regression-checker/regression.config.json'), 'utf8')
    );
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
    ) as {
      scripts: Record<string, string>;
    };
    const frontendPackageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'src/frontend/package.json'), 'utf8')
    ) as { scripts: Record<string, string> };

    const result = validateRegressionConfig({
      rawConfig,
      repoRoot,
      packageJsonScriptsByDirectory: {
        '.': packageJson.scripts,
        'src/frontend': frontendPackageJson.scripts,
      },
      logicalCpuCount: 8,
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({
        id: 'typescript-compile-check',
        tool: 'tsc',
        run: { kind: 'npm-script', script: 'typecheck:all' },
      })
    );
  });

  it('allows only the named aggregate for npm-script tsc and retains mutation and chain safety', () => {
    const configForScript = (script: string) => ({
      ...createValidConfig(),
      checks: [
        { id: 'aggregate-check', tool: 'tsc', cwd: '.', run: { kind: 'npm-script', script } },
      ],
    });
    const options = {
      repoRoot: REPO_ROOT,
      packageJsonScriptsByDirectory: {
        '.': {
          'typecheck:all': 'npm run builder:compile && node typescript/bin/tsc -p tsconfig.json',
          'builder:compile': 'node typescript/bin/tsc -p scripts/builder/tsconfig.json',
          'chained:compile': 'npm run typecheck:all && npm run builder:compile',
          'mutating:compile': 'tsc -p tsconfig.json --update',
        },
      },
      logicalCpuCount: 8,
    };

    expect(
      validateRegressionConfig({ rawConfig: configForScript('typecheck:all'), ...options }).checks
    ).toHaveLength(1);
    expect(() =>
      validateRegressionConfig({
        rawConfig: configForScript('typecheck:all'),
        ...options,
        packageJsonScriptsByDirectory: {
          '.': {
            ...options.packageJsonScriptsByDirectory['.'],
            'typecheck:all': 'npm run builder:compile && tsc -p tsconfig.json --update',
          },
        },
      })
    ).toThrow(/mutating/i);
    for (const script of ['builder:compile', 'chained:compile', 'mutating:compile']) {
      expect(() =>
        validateRegressionConfig({ rawConfig: configForScript(script), ...options })
      ).toThrow();
    }
  });

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

  it('resolves nested npm-script wrappers that use explicit prefix directories and option values', () => {
    const result = validateRegressionConfig({
      rawConfig: {
        ...createValidConfig(),
        checks: [
          {
            id: 'prefix-equals-check',
            tool: 'eslint',
            cwd: '.',
            run: {
              kind: 'npm-script',
              script: 'prefix-equals-wrapper',
            },
          },
          {
            id: 'option-value-check',
            tool: 'eslint',
            cwd: '.',
            run: {
              kind: 'npm-script',
              script: 'option-value-wrapper',
            },
          },
        ],
      },
      repoRoot: REPO_ROOT,
      packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
      logicalCpuCount: 8,
    });

    expect(result.checks).toHaveLength(EXPECTED_CHECK_COUNT);
  });

  it('rejects npm-script wrappers that stop before providing a nested script target', () => {
    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'prefix-without-value-check',
              tool: 'eslint',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'prefix-without-value-wrapper',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/does not map to a supported tool family/i);
  });

  it('rejects npm-script wrappers that declare an option without a value', () => {
    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'option-without-value-check',
              tool: 'eslint',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'option-without-value-wrapper',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/does not map to a supported tool family/i);
  });
});
