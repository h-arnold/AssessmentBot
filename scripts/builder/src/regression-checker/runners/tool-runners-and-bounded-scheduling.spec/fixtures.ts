import path from 'node:path';

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

export type RunnerInvocation = {
  executable: string;
  args: string[];
  cwd: string;
  rawArtefactPath: string;
  rawArtefactExtension: '.json' | '.txt';
};

export type RunnerCommandBuilder = (options: {
  repoRoot: string;
  check: RegressionCheckConfig;
  rawArtefactPath: string;
}) => RunnerInvocation;

export type StructuredExecutionFailure = {
  code: 'runner-execution-failed';
  message: string;
};

export type ScheduledCheckResult = {
  id: string;
  tool: RegressionTool;
  rawArtefactPath: string;
  status: 'passing' | 'failing' | 'execution-error';
  exitCode: number | null;
  error: StructuredExecutionFailure | null;
};

export type RunChecksWithBoundedScheduler = (options: {
  checks: ReadonlyArray<RegressionCheckConfig>;
  maxWorkers: number;
  getPlannedRawArtefactPath: (check: RegressionCheckConfig) => string;
  runCheck: (check: RegressionCheckConfig) => Promise<Omit<ScheduledCheckResult, 'error'>>;
}) => Promise<ScheduledCheckResult[]>;

export type RunnerModule = {
  buildRunnerInvocation: RunnerCommandBuilder;
  runChecksWithBoundedScheduler: RunChecksWithBoundedScheduler;
};

export const REPO_ROOT = '/home/developer/AssessmentBot';
export const SESSION_REPORT_ROOT = '.ts-regression-checker/reports/session-example';
export const BASELINE_ARTEFACT_ROOT = path.posix.join(SESSION_REPORT_ROOT, 'baseline');
export const CURRENT_RUN_ARTEFACT_ROOT = path.posix.join(
  SESSION_REPORT_ROOT,
  'runs',
  '2026-03-02T09-00-00.000Z'
);
export const GENERAL_WORKER_LIMIT = 2;
export const GENERAL_DELAY_FAST_MS = 20;
export const GENERAL_DELAY_SLOW_MS = 80;
export const PLAYWRIGHT_DELAY_MS = 60;
export const FAILING_CHECK_MESSAGE = 'spawn ENOENT';
export const TSC_PROJECT_PATH = 'scripts/builder/tsconfig.json';
export const NPM_SCRIPT_LINT = 'lint:backend:check';
export const NPM_SCRIPT_TEST = 'test:backend';
export const NPM_SCRIPT_E2E = 'test:frontend:e2e';

/**
 * Loads the planned runner layer module.
 *
 * @returns {Promise<RunnerModule>} Runner command and scheduling contracts.
 */
export async function loadRunnerModule(): Promise<RunnerModule> {
  const modulePath = '../index.js';
  try {
    return (await import(modulePath)) as RunnerModule;
  } catch (error) {
    throw new Error(
      'Tool runner contracts are required: ./index.js must export buildRunnerInvocation and runChecksWithBoundedScheduler.',
      { cause: error }
    );
  }
}

/**
 * Builds a check fixture with deterministic defaults.
 *
 * @param {RegressionCheckConfig} partial - Tool-specific fixture fields.
 * @returns {RegressionCheckConfig} Check configuration fixture.
 */
export function createCheckFixture(partial: RegressionCheckConfig): RegressionCheckConfig {
  return {
    ...partial,
  };
}

/**
 * Builds a npm-script check fixture.
 *
 * @param {{ id: string; tool: Exclude<RegressionTool, 'tsc'>; script: string }} options - Fixture options.
 * @param {string} options.id - Check identifier.
 * @param {Exclude<RegressionTool, 'tsc'>} options.tool - Tool family.
 * @param {string} options.script - npm script name.
 * @returns {RegressionCheckConfig} npm-script check fixture.
 */
export function createNpmScriptCheck(options: {
  id: string;
  tool: Exclude<RegressionTool, 'tsc'>;
  script: string;
}): RegressionCheckConfig {
  return createCheckFixture({
    id: options.id,
    tool: options.tool,
    cwd: '.',
    run: { kind: 'npm-script', script: options.script },
  });
}

/**
 * Resolves the raw artefact path used for a check fixture.
 *
 * @param {string} artefactRootDirectory - Current baseline or run directory.
 * @param {string} checkId - Check identifier.
 * @param {'.json' | '.txt'} extension - Required extension by tool family.
 * @returns {string} Raw artefact path under the current baseline or run directory.
 */
export function rawArtefactPathFor(
  artefactRootDirectory: string,
  checkId: string,
  extension: '.json' | '.txt'
): string {
  return path.posix.join(artefactRootDirectory, 'checks', checkId, `raw${extension}`);
}
