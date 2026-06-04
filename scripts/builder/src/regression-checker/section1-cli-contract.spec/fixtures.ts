export type SessionIdSource = 'arg' | 'git-branch';

export type SessionContext = {
  sessionId: string;
  sessionIdSource: SessionIdSource;
};

export type ResolveSessionContext = (options: {
  positionalSessionId: string | undefined;
  resolveGitBranchName: () => Promise<string>;
}) => Promise<SessionContext>;

export type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';

export type NpmScriptRunConfig = {
  kind: 'npm-script';
  script: string;
};

export type TscRunConfig = {
  kind: 'tsc';
  project: string;
};

export type RegressionCheckConfig = {
  id: string;
  tool: RegressionTool;
  cwd: string;
  reporterMode?: string;
  run: NpmScriptRunConfig | TscRunConfig;
};

export type RegressionConfigInput = {
  reportDirectory: string;
  parallel?: {
    enabled: boolean;
    maxWorkers?: number;
  };
  checks: RegressionCheckConfig[];
};

export type RegressionConfig = {
  reportDirectory: string;
  parallel: {
    enabled: boolean;
    maxWorkers: number;
  };
  checks: RegressionCheckConfig[];
};

export type ValidateRegressionConfig = (options: {
  rawConfig: unknown;
  repoRoot: string;
  packageJsonScriptsByDirectory: Record<string, Record<string, string>>;
  logicalCpuCount: number;
}) => RegressionConfig;

export type SessionResolutionModule = {
  resolveSessionContext: ResolveSessionContext;
};

export type ConfigValidationModule = {
  validateRegressionConfig: ValidateRegressionConfig;
};

export const REPO_ROOT = '/home/developer/AssessmentBot';
export const BASELINE_CHECK_COUNT = 2;
export const EXPECTED_DEFAULT_MAX_WORKERS = 4;

export const ROOT_PACKAGE_JSON_SCRIPTS: Record<string, string> = {
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

export const ROOT_PACKAGE_JSON_SCRIPTS_WITH_QUOTED_ENV_ASSIGNMENT: Record<string, string> = {
  ...ROOT_PACKAGE_JSON_SCRIPTS,
  'quoted-env-eslint':
    'NODE_ENV="test" eslint --config eslint.config.js src/backend/**/*.js tests/**/*.js',
};

export const FRONTEND_PACKAGE_JSON_SCRIPTS: Record<string, string> = {
  lint: 'eslint .',
  test: 'vitest run',
  'test:e2e': 'playwright test',
};

export const PACKAGE_JSON_SCRIPTS_BY_DIRECTORY: Record<string, Record<string, string>> = {
  '.': ROOT_PACKAGE_JSON_SCRIPTS,
  'src/frontend': FRONTEND_PACKAGE_JSON_SCRIPTS,
};

/**
 * Creates a valid regression-checker config fixture.
 *
 * @returns {RegressionConfigInput} Valid config fixture.
 */
export function createValidConfig(): RegressionConfigInput {
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
export async function loadSessionResolutionModule(): Promise<SessionResolutionModule> {
  const modulePath = '../cli/session-resolution.js';
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
export async function loadConfigValidationModule(): Promise<ConfigValidationModule> {
  const modulePath = '../config/validate-regression-config/index.js';
  try {
    return (await import(modulePath)) as ConfigValidationModule;
  } catch (error) {
    throw new Error(
      `Section 1 requires ${modulePath} to provide validateRegressionConfig before schema and safety-rail tests can pass.`,
      { cause: error }
    );
  }
}
