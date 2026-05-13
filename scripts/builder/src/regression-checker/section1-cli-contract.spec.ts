import { describe, expect, it } from 'vitest';

type SessionIdSource = 'arg' | 'git-branch';

type SessionContext = {
  sessionId: string;
  sessionIdSource: SessionIdSource;
};

type ResolveSessionContext = (options: {
  positionalSessionId: string | undefined;
  resolveGitBranchName: () => Promise<string>;
}) => Promise<SessionContext>;

type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';

type NpmScriptRunConfig = {
  kind: 'npm-script';
  script: string;
};

type TscRunConfig = {
  kind: 'tsc';
  project: string;
};

type RegressionCheckConfig = {
  id: string;
  tool: RegressionTool;
  cwd: string;
  reporterMode?: string;
  run: NpmScriptRunConfig | TscRunConfig;
};

type RegressionConfigInput = {
  reportDirectory: string;
  parallel?: {
    enabled: boolean;
    maxWorkers?: number;
  };
  checks: RegressionCheckConfig[];
};

type RegressionConfig = {
  reportDirectory: string;
  parallel: {
    enabled: boolean;
    maxWorkers: number;
  };
  checks: RegressionCheckConfig[];
};

type ValidateRegressionConfig = (options: {
  rawConfig: unknown;
  repoRoot: string;
  packageJsonScriptsByDirectory: Record<string, Record<string, string>>;
  logicalCpuCount: number;
}) => RegressionConfig;

type SessionResolutionModule = {
  resolveSessionContext: ResolveSessionContext;
};

type ConfigValidationModule = {
  validateRegressionConfig: ValidateRegressionConfig;
};

const REPO_ROOT = '/home/developer/AssessmentBot';
const BASELINE_CHECK_COUNT = 2;
const EXPECTED_DEFAULT_MAX_WORKERS = 4;

const ROOT_PACKAGE_JSON_SCRIPTS: Record<string, string> = {
  'lint:backend:check': 'eslint --config eslint.config.js src/backend/**/*.js tests/**/*.js',
  'lint:backend': 'eslint --config eslint.config.js --fix src/backend/**/*.js tests/**/*.js',
  'lint:frontend:check': 'npm --prefix src/frontend run lint --',
  'test:backend': 'vitest run',
  'test:backend:update': 'vitest run -u',
  'test:backend:update-long': 'vitest run --update',
  'test:frontend:e2e': 'playwright test',
  'test:frontend:e2e:update': 'playwright test --update-snapshots',
  'builder:compile': 'tsc -p scripts/builder/tsconfig.json',
  'lint-and-test': 'npm run lint:backend:check && npm run test:backend',
  'custom:task': 'node scripts/custom-task.js',
  'token-spoofed-tool': 'echo eslint',
  'nested-eslint-wrapper': 'npm run nested-eslint',
  'nested-eslint': 'eslint --config eslint.config.js src/backend/**/*.js tests/**/*.js',
  'recursive-script-a': 'npm run recursive-script-b',
  'recursive-script-b': 'npm run recursive-script-a',
  'missing-nested-wrapper':
    'eslint --config eslint.config.js src/backend/**/*.js tests/**/*.js npm run does-not-exist',
  'missing-nested-value-wrapper': 'npm run missing-nested-value',
};

const FRONTEND_PACKAGE_JSON_SCRIPTS: Record<string, string> = {
  lint: 'eslint .',
  test: 'vitest run',
  'test:e2e': 'playwright test',
};

const PACKAGE_JSON_SCRIPTS_BY_DIRECTORY: Record<string, Record<string, string>> = {
  '.': ROOT_PACKAGE_JSON_SCRIPTS,
  'src/frontend': FRONTEND_PACKAGE_JSON_SCRIPTS,
};

/**
 * Creates a valid regression-checker config fixture.
 *
 * @returns {RegressionConfigInput} Valid config fixture.
 */
function createValidConfig(): RegressionConfigInput {
  return {
    reportDirectory: '.ts-regression-checker/reports',
    parallel: {
      enabled: true,
      maxWorkers: 2,
    },
    checks: [
      {
        id: 'backend-lint-check',
        tool: 'eslint',
        cwd: '.',
        run: {
          kind: 'npm-script',
          script: 'lint:backend:check',
        },
      },
      {
        id: 'builder-compile',
        tool: 'tsc',
        cwd: '.',
        run: {
          kind: 'tsc',
          project: 'scripts/builder/tsconfig.json',
        },
      },
    ],
  };
}

/**
 * Loads the session-resolution module under test.
 *
 * @returns {Promise<SessionResolutionModule>} Session-resolution exports.
 */
async function loadSessionResolutionModule(): Promise<SessionResolutionModule> {
  const modulePath = './cli/session-resolution.js';
  try {
    return (await import(modulePath)) as SessionResolutionModule;
  } catch (error) {
    throw new Error(
      `Section 1 requires ${modulePath} to provide resolveSessionContext before CLI contract tests can pass.`,
      { cause: error }
    );
  }
}

/**
 * Loads the config-validation module under test.
 *
 * @returns {Promise<ConfigValidationModule>} Config-validation exports.
 */
async function loadConfigValidationModule(): Promise<ConfigValidationModule> {
  const modulePath = './config/validate-regression-config.js';
  try {
    return (await import(modulePath)) as ConfigValidationModule;
  } catch (error) {
    throw new Error(
      `Section 1 requires ${modulePath} to provide validateRegressionConfig before schema and safety-rail tests can pass.`,
      { cause: error }
    );
  }
}

describe('Section 1 regression-checker CLI contract', () => {
  it('loads valid config with omitted sessionId and resolves sessionIdSource=git-branch', async () => {
    const { resolveSessionContext } = await loadSessionResolutionModule();
    const { validateRegressionConfig } = await loadConfigValidationModule();

    const sessionContext = await resolveSessionContext({
      positionalSessionId: undefined,
      resolveGitBranchName: async () => 'feature/section-one-contract',
    });
    const config = validateRegressionConfig({
      rawConfig: createValidConfig(),
      repoRoot: REPO_ROOT,
      packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
      logicalCpuCount: 8,
    });

    expect(sessionContext).toEqual({
      sessionId: 'feature/section-one-contract',
      sessionIdSource: 'git-branch',
    });
    expect(config.checks).toHaveLength(BASELINE_CHECK_COUNT);
  });

  it('uses explicit sessionId without git lookup and marks sessionIdSource=arg', async () => {
    const { resolveSessionContext } = await loadSessionResolutionModule();

    const gitLookup = async (): Promise<string> => {
      throw new Error('git lookup should not run for explicit session IDs');
    };

    await expect(
      resolveSessionContext({
        positionalSessionId: 'manual-session-id',
        resolveGitBranchName: gitLookup,
      })
    ).resolves.toEqual({
      sessionId: 'manual-session-id',
      sessionIdSource: 'arg',
    });
  });

  it('rejects duplicate checks[].id values during config validation', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    const config = createValidConfig();
    config.checks.push({
      id: 'backend-lint-check',
      tool: 'vitest',
      cwd: '.',
      run: {
        kind: 'npm-script',
        script: 'test:backend',
      },
    });

    expect(() =>
      validateRegressionConfig({
        rawConfig: config,
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/duplicate/i);
  });

  it('rejects unsupported tool families and unsupported reporter modes before execution', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'unknown-tool-check',
              tool: 'jest',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'test:backend',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/unsupported tool/i);

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'unsupported-reporter-mode-check',
              tool: 'vitest',
              cwd: '.',
              reporterMode: 'dot',
              run: {
                kind: 'npm-script',
                script: 'test:backend',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/unsupported reporter mode/i);

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'tsc-json-reporter-mode-check',
              tool: 'tsc',
              cwd: '.',
              reporterMode: 'json',
              run: {
                kind: 'tsc',
                project: 'scripts/builder/tsconfig.json',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/unsupported reporter mode|tool=tsc/i);
  });

  it('accepts supported reporterMode values for npm-script tool families', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'eslint-json-reporter-check',
              tool: 'eslint',
              cwd: '.',
              reporterMode: 'json',
              run: {
                kind: 'npm-script',
                script: 'lint:backend:check',
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

  it('rejects mutating npm-script commands and equivalent update flags', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'mutating-fix-check',
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

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'mutating-vitest-short-flag-check',
              tool: 'vitest',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'test:backend:update',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/mutating|-u|--update/i);

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'mutating-vitest-long-flag-check',
              tool: 'vitest',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'test:backend:update-long',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/mutating|--update/i);

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'mutating-playwright-update-snapshots-check',
              tool: 'playwright',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'test:frontend:e2e:update',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/mutating|--update-snapshots/i);
  });

  it('rejects chained npm scripts or scripts that do not map to exactly one supported tool family', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'chained-script-check',
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

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'unmappable-script-check',
              tool: 'eslint',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'custom:task',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/tool family|unsupported/i);

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'token-spoofed-tool-check',
              tool: 'eslint',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'token-spoofed-tool',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/tool family|unsupported/i);
  });

  it('resolves npm-script commands from the package.json map for checks[].cwd', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'frontend-test-check',
              tool: 'vitest',
              cwd: 'src/frontend',
              run: {
                kind: 'npm-script',
                script: 'test',
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

  it('rejects npm-script commands when script is not declared in the checks[].cwd package.json map', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'frontend-missing-script-check',
              tool: 'eslint',
              cwd: 'src/frontend',
              run: {
                kind: 'npm-script',
                script: 'lint:backend:check',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/package\.json|script/i);
  });

  it('rejects npm --prefix scripts when the relevant package.json map is unavailable', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'frontend-lint-check',
              tool: 'eslint',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'lint:frontend:check',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: {
          '.': ROOT_PACKAGE_JSON_SCRIPTS,
        },
        logicalCpuCount: 8,
      })
    ).toThrow(/relevant package.json/i);
  });

  it('rejects tool=tsc when run.kind=npm-script', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'tsc-npm-script-check',
              tool: 'tsc',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'builder:compile',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/tool=tsc|run.kind=tsc|npm-script/i);
  });

  it('rejects absolute or escaping reportDirectory, cwd, and project paths', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          reportDirectory: '/absolute/reports',
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/repo root|reportDirectory/i);

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'escaping-cwd-check',
              tool: 'eslint',
              cwd: '../outside',
              run: {
                kind: 'npm-script',
                script: 'lint:backend:check',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/repo root|cwd/i);

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'traversal-out-and-back-in-cwd-check',
              tool: 'eslint',
              cwd: '../AssessmentBot/src/frontend',
              run: {
                kind: 'npm-script',
                script: 'lint:backend:check',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/repo root|cwd/i);

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'absolute-project-check',
              tool: 'tsc',
              cwd: '.',
              run: {
                kind: 'tsc',
                project: '/outside/tsconfig.json',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/repo root|project/i);
  });

  it('returns normalised repo-relative paths for reportDirectory, checks[].cwd, and run.project', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    const config = validateRegressionConfig({
      rawConfig: {
        reportDirectory: String.raw`.ts-regression-checker\reports\..\reports\latest\.`,
        checks: [
          {
            id: 'normalised-tsc-paths-check',
            tool: 'tsc',
            cwd: String.raw`scripts\builder\..\builder\.`,
            run: {
              kind: 'tsc',
              project: String.raw`scripts\builder\..\builder\tsconfig.json`,
            },
          },
        ],
      },
      repoRoot: REPO_ROOT,
      packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
      logicalCpuCount: 8,
    });

    expect(config.reportDirectory).toBe('.ts-regression-checker/reports/latest');
    expect(config.checks[0]).toMatchObject({
      cwd: 'scripts/builder',
      run: {
        kind: 'tsc',
        project: 'scripts/builder/tsconfig.json',
      },
    });
  });

  it('defaults parallel.maxWorkers to min(4, logicalCpuCount) when omitted', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    const config = validateRegressionConfig({
      rawConfig: {
        ...createValidConfig(),
        parallel: {
          enabled: true,
        },
      },
      repoRoot: REPO_ROOT,
      packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
      logicalCpuCount: 12,
    });

    expect(config.parallel.maxWorkers).toBe(EXPECTED_DEFAULT_MAX_WORKERS);
  });

  it('rejects non-positive logicalCpuCount values', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: createValidConfig(),
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 0,
      })
    ).toThrow(/logicalCpuCount/i);
  });

  it('rejects reportDirectory when it resolves to the repo root path itself', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          reportDirectory: '.',
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/repo root|reportDirectory/i);
  });

  it('rejects recursive nested npm-script references', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'recursive-npm-script-check',
              tool: 'eslint',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'recursive-script-a',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/recursion/i);
  });

  it('continues past missing nested npm run targets when a direct supported tool is already resolved', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'missing-nested-target-continue-check',
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

  it('rejects nested npm scripts when the nested script key exists but command text is undefined', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    const packageJsonScriptsByDirectory: Record<string, Record<string, string>> = {
      '.': {
        ...ROOT_PACKAGE_JSON_SCRIPTS,
        'missing-nested-value': undefined as unknown as string,
      },
    };

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          ...createValidConfig(),
          checks: [
            {
              id: 'nested-undefined-command-check',
              tool: 'eslint',
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'missing-nested-value-wrapper',
              },
            },
          ],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory,
        logicalCpuCount: 8,
      })
    ).toThrow(/script is not declared in package\.json|missing-nested-value/i);
  });

  it('surfaces schema validation errors for invalid raw config payloads', async () => {
    const { validateRegressionConfig } = await loadConfigValidationModule();

    expect(() =>
      validateRegressionConfig({
        rawConfig: undefined,
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/Regression config is invalid/i);

    expect(() =>
      validateRegressionConfig({
        rawConfig: {
          reportDirectory: '',
          checks: [],
        },
        repoRoot: REPO_ROOT,
        packageJsonScriptsByDirectory: PACKAGE_JSON_SCRIPTS_BY_DIRECTORY,
        logicalCpuCount: 8,
      })
    ).toThrow(/reportDirectory|checks/i);
  });

  it('throws a clear error when git branch lookup fails in detached HEAD mode', async () => {
    const { resolveSessionContext } = await loadSessionResolutionModule();

    await expect(
      resolveSessionContext({
        positionalSessionId: undefined,
        resolveGitBranchName: async () => {
          throw new Error('detached HEAD');
        },
      })
    ).rejects.toThrow(/detached head|branch|session/i);
  });
});
