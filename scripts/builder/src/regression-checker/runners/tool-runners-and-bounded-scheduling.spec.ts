import path from 'node:path';

import { describe, expect, it } from 'vitest';

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

type RunnerInvocation = {
  executable: string;
  args: string[];
  cwd: string;
  rawArtefactPath: string;
  rawArtefactExtension: '.json' | '.txt';
};

type RunnerCommandBuilder = (options: {
  repoRoot: string;
  check: RegressionCheckConfig;
  rawArtefactPath: string;
}) => RunnerInvocation;

type StructuredExecutionFailure = {
  code: 'runner-execution-failed';
  message: string;
};

type ScheduledCheckResult = {
  id: string;
  tool: RegressionTool;
  rawArtefactPath: string;
  status: 'passing' | 'failing' | 'execution-error';
  exitCode: number | null;
  error: StructuredExecutionFailure | null;
};

type RunChecksWithBoundedScheduler = (options: {
  checks: ReadonlyArray<RegressionCheckConfig>;
  maxWorkers: number;
  getPlannedRawArtefactPath: (check: RegressionCheckConfig) => string;
  runCheck: (check: RegressionCheckConfig) => Promise<Omit<ScheduledCheckResult, 'error'>>;
}) => Promise<ScheduledCheckResult[]>;

type RunnerModule = {
  buildRunnerInvocation: RunnerCommandBuilder;
  runChecksWithBoundedScheduler: RunChecksWithBoundedScheduler;
};

const REPO_ROOT = '/home/developer/AssessmentBot';
const SESSION_REPORT_ROOT = '.ts-regression-checker/reports/session-example';
const BASELINE_ARTEFACT_ROOT = path.posix.join(SESSION_REPORT_ROOT, 'baseline');
const CURRENT_RUN_ARTEFACT_ROOT = path.posix.join(
  SESSION_REPORT_ROOT,
  'runs',
  '2026-03-02T09-00-00.000Z'
);
const GENERAL_WORKER_LIMIT = 2;
const GENERAL_DELAY_FAST_MS = 20;
const GENERAL_DELAY_SLOW_MS = 80;
const PLAYWRIGHT_DELAY_MS = 60;
const FAILING_CHECK_MESSAGE = 'spawn ENOENT';
const TSC_PROJECT_PATH = 'scripts/builder/tsconfig.json';

/**
 * Loads the planned runner layer module.
 *
 * @returns {Promise<RunnerModule>} Runner command and scheduling contracts.
 */
async function loadRunnerModule(): Promise<RunnerModule> {
  const modulePath = './index.js';
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
function createCheckFixture(partial: RegressionCheckConfig): RegressionCheckConfig {
  return {
    ...partial,
  };
}

/**
 * Resolves the raw artefact path used for a check fixture.
 *
 * @param {string} artefactRootDirectory - Current baseline or run directory.
 * @param {string} checkId - Check identifier.
 * @param {'.json' | '.txt'} extension - Required extension by tool family.
 * @returns {string} Raw artefact path under the current baseline or run directory.
 */
function rawArtefactPathFor(
  artefactRootDirectory: string,
  checkId: string,
  extension: '.json' | '.txt'
): string {
  return path.posix.join(artefactRootDirectory, 'checks', checkId, `raw${extension}`);
}

describe('tool runner command construction and bounded scheduling', () => {
  it('builds runner invocations for eslint, vitest, playwright, and tsc with tool-appropriate output modes', async () => {
    const { buildRunnerInvocation } = await loadRunnerModule();

    const eslintCheck = createCheckFixture({
      id: 'backend-lint-check',
      tool: 'eslint',
      cwd: '.',
      run: {
        kind: 'npm-script',
        script: 'lint:backend:check',
      },
    });
    const vitestCheck = createCheckFixture({
      id: 'backend-tests',
      tool: 'vitest',
      cwd: '.',
      run: {
        kind: 'npm-script',
        script: 'test:backend',
      },
    });
    const playwrightCheck = createCheckFixture({
      id: 'frontend-e2e',
      tool: 'playwright',
      cwd: '.',
      run: {
        kind: 'npm-script',
        script: 'test:frontend:e2e',
      },
    });
    const tscCheck = createCheckFixture({
      id: 'builder-compile',
      tool: 'tsc',
      cwd: '.',
      run: {
        kind: 'tsc',
        project: TSC_PROJECT_PATH,
      },
    });

    const eslintInvocation = buildRunnerInvocation({
      repoRoot: REPO_ROOT,
      check: eslintCheck,
      rawArtefactPath: rawArtefactPathFor(BASELINE_ARTEFACT_ROOT, eslintCheck.id, '.json'),
    });
    expect(eslintInvocation).toMatchObject({
      executable: 'npm',
      cwd: REPO_ROOT,
      rawArtefactPath: rawArtefactPathFor(BASELINE_ARTEFACT_ROOT, eslintCheck.id, '.json'),
      rawArtefactExtension: '.json',
    });
    expect(eslintInvocation.rawArtefactPath).toContain('/baseline/checks/');
    expect(eslintInvocation.args).toEqual(
      expect.arrayContaining(['run', 'lint:backend:check', '--', '--format', 'json'])
    );

    const vitestInvocation = buildRunnerInvocation({
      repoRoot: REPO_ROOT,
      check: vitestCheck,
      rawArtefactPath: rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, vitestCheck.id, '.json'),
    });
    expect(vitestInvocation).toMatchObject({
      executable: 'npm',
      cwd: REPO_ROOT,
      rawArtefactPath: rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, vitestCheck.id, '.json'),
      rawArtefactExtension: '.json',
    });
    expect(vitestInvocation.rawArtefactPath).toContain('/runs/2026-03-02T09-00-00.000Z/checks/');
    expect(vitestInvocation.args.join(' ')).toContain('--reporter=json');

    const playwrightInvocation = buildRunnerInvocation({
      repoRoot: REPO_ROOT,
      check: playwrightCheck,
      rawArtefactPath: rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, playwrightCheck.id, '.json'),
    });
    expect(playwrightInvocation).toMatchObject({
      executable: 'npm',
      cwd: REPO_ROOT,
      rawArtefactPath: rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, playwrightCheck.id, '.json'),
      rawArtefactExtension: '.json',
    });
    expect(playwrightInvocation.rawArtefactPath).toContain(
      '/runs/2026-03-02T09-00-00.000Z/checks/'
    );
    expect(playwrightInvocation.args.join(' ')).toContain('--reporter=json');

    const tscInvocation = buildRunnerInvocation({
      repoRoot: REPO_ROOT,
      check: tscCheck,
      rawArtefactPath: rawArtefactPathFor(BASELINE_ARTEFACT_ROOT, tscCheck.id, '.txt'),
    });
    expect(tscInvocation).toMatchObject({
      executable: 'tsc',
      cwd: REPO_ROOT,
      rawArtefactPath: rawArtefactPathFor(BASELINE_ARTEFACT_ROOT, tscCheck.id, '.txt'),
      rawArtefactExtension: '.txt',
    });
    expect(tscInvocation.rawArtefactPath).toContain('/baseline/checks/');
    expect(tscInvocation.args).toEqual(
      expect.arrayContaining(['-p', path.resolve(REPO_ROOT, TSC_PROJECT_PATH), '--pretty', 'false'])
    );
  });

  it('resolves command-facing output and project paths from repo root for non-root cwd checks', async () => {
    const { buildRunnerInvocation } = await loadRunnerModule();

    const nestedCheck = createCheckFixture({
      id: 'frontend-vitest',
      tool: 'vitest',
      cwd: 'src/frontend',
      run: {
        kind: 'npm-script',
        script: 'test',
      },
    });
    const nestedTscCheck = createCheckFixture({
      id: 'frontend-tsc',
      tool: 'tsc',
      cwd: 'src/frontend',
      run: {
        kind: 'tsc',
        project: TSC_PROJECT_PATH,
      },
    });

    const rawArtefactPath = rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, nestedCheck.id, '.json');
    const nestedInvocation = buildRunnerInvocation({
      repoRoot: REPO_ROOT,
      check: nestedCheck,
      rawArtefactPath,
    });

    expect(nestedInvocation.cwd).toBe(path.resolve(REPO_ROOT, nestedCheck.cwd));
    expect(nestedInvocation.rawArtefactPath).toBe(rawArtefactPath);
    expect(nestedInvocation.args).toEqual(
      expect.arrayContaining(['--outputFile=' + path.resolve(REPO_ROOT, rawArtefactPath)])
    );

    const nestedTscInvocation = buildRunnerInvocation({
      repoRoot: REPO_ROOT,
      check: nestedTscCheck,
      rawArtefactPath: rawArtefactPathFor(BASELINE_ARTEFACT_ROOT, nestedTscCheck.id, '.txt'),
    });
    expect(nestedTscInvocation.cwd).toBe(path.resolve(REPO_ROOT, nestedTscCheck.cwd));
    expect(nestedTscInvocation.args).toEqual(
      expect.arrayContaining(['-p', path.resolve(REPO_ROOT, TSC_PROJECT_PATH), '--pretty', 'false'])
    );
  });

  it('schedules general checks with bounded workers and keeps playwright in a dedicated single-worker lane', async () => {
    const { runChecksWithBoundedScheduler } = await loadRunnerModule();

    const checks: RegressionCheckConfig[] = [
      createCheckFixture({
        id: 'general-eslint-1',
        tool: 'eslint',
        cwd: '.',
        run: { kind: 'npm-script', script: 'lint:backend:check' },
      }),
      createCheckFixture({
        id: 'general-vitest-1',
        tool: 'vitest',
        cwd: '.',
        run: { kind: 'npm-script', script: 'test:backend' },
      }),
      createCheckFixture({
        id: 'playwright-1',
        tool: 'playwright',
        cwd: '.',
        run: { kind: 'npm-script', script: 'test:frontend:e2e' },
      }),
      createCheckFixture({
        id: 'general-eslint-2',
        tool: 'eslint',
        cwd: '.',
        run: { kind: 'npm-script', script: 'lint:backend:check' },
      }),
      createCheckFixture({
        id: 'playwright-2',
        tool: 'playwright',
        cwd: '.',
        run: { kind: 'npm-script', script: 'test:frontend:e2e' },
      }),
    ];

    let activeGeneralWorkers = 0;
    let activePlaywrightWorkers = 0;
    let observedMaxGeneralWorkers = 0;
    let observedMaxPlaywrightWorkers = 0;
    let observedDedicatedLaneOverlap = false;

    const results = await runChecksWithBoundedScheduler({
      checks,
      maxWorkers: GENERAL_WORKER_LIMIT,
      getPlannedRawArtefactPath: (check) =>
        rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, check.id, '.json'),
      runCheck: async (check) => {
        let delayMs = GENERAL_DELAY_FAST_MS;
        if (check.tool === 'playwright') {
          delayMs = PLAYWRIGHT_DELAY_MS;
        } else if (check.id === 'general-eslint-1') {
          delayMs = GENERAL_DELAY_SLOW_MS;
        }

        if (check.tool === 'playwright') {
          activePlaywrightWorkers += 1;
          observedMaxPlaywrightWorkers = Math.max(
            observedMaxPlaywrightWorkers,
            activePlaywrightWorkers
          );
          if (activeGeneralWorkers > 0) {
            observedDedicatedLaneOverlap = true;
          }
        } else {
          activeGeneralWorkers += 1;
          observedMaxGeneralWorkers = Math.max(observedMaxGeneralWorkers, activeGeneralWorkers);
          if (activePlaywrightWorkers > 0) {
            observedDedicatedLaneOverlap = true;
          }
        }

        await new Promise((resolve) => {
          setTimeout(resolve, delayMs);
        });

        if (check.tool === 'playwright') {
          activePlaywrightWorkers -= 1;
        } else {
          activeGeneralWorkers -= 1;
        }

        return {
          id: check.id,
          tool: check.tool,
          rawArtefactPath: rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, check.id, '.json'),
          status: 'passing',
          exitCode: 0,
        };
      },
    });

    expect(observedMaxGeneralWorkers).toBeLessThanOrEqual(GENERAL_WORKER_LIMIT);
    expect(observedMaxPlaywrightWorkers).toBe(1);
    expect(observedDedicatedLaneOverlap).toBe(true);
    expect(results.map((result) => result.id)).toEqual(checks.map((check) => check.id));
    expect(results.map((result) => result.rawArtefactPath)).toEqual(
      checks.map((check) => rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, check.id, '.json'))
    );
  });

  it('captures execution errors as structured check failures while preserving deterministic ordering', async () => {
    const { runChecksWithBoundedScheduler } = await loadRunnerModule();

    const checks: RegressionCheckConfig[] = [
      createCheckFixture({
        id: 'first-general-check',
        tool: 'eslint',
        cwd: '.',
        run: { kind: 'npm-script', script: 'lint:backend:check' },
      }),
      createCheckFixture({
        id: 'failing-check',
        tool: 'vitest',
        cwd: '.',
        run: { kind: 'npm-script', script: 'test:backend' },
      }),
      createCheckFixture({
        id: 'playwright-check',
        tool: 'playwright',
        cwd: '.',
        run: { kind: 'npm-script', script: 'test:frontend:e2e' },
      }),
    ];

    const results = await runChecksWithBoundedScheduler({
      checks,
      maxWorkers: GENERAL_WORKER_LIMIT,
      getPlannedRawArtefactPath: (check) =>
        rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, check.id, '.json'),
      runCheck: async (check) => {
        if (check.id === 'failing-check') {
          throw new Error(FAILING_CHECK_MESSAGE);
        }

        return {
          id: check.id,
          tool: check.tool,
          rawArtefactPath: rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, check.id, '.json'),
          status: 'passing',
          exitCode: 0,
        };
      },
    });

    expect(results.map((result) => result.id)).toEqual(checks.map((check) => check.id));

    const failingResult = results.find((result) => result.id === 'failing-check');
    expect(failingResult).toMatchObject({
      rawArtefactPath: rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, 'failing-check', '.json'),
      id: 'failing-check',
      tool: 'vitest',
      status: 'execution-error',
      exitCode: null,
      error: {
        code: 'runner-execution-failed',
        message: expect.stringContaining(FAILING_CHECK_MESSAGE),
      },
    });
  });

  it('rejects invalid scheduler worker limits and validates run kinds per tool', async () => {
    const { buildRunnerInvocation, runChecksWithBoundedScheduler } = await loadRunnerModule();

    await expect(
      runChecksWithBoundedScheduler({
        checks: [],
        maxWorkers: 0,
        getPlannedRawArtefactPath: () => 'unused',
        runCheck: async () => {
          throw new Error('runCheck should not be called for invalid maxWorkers.');
        },
      })
    ).rejects.toThrow('maxWorkers must be an integer greater than or equal to 1.');

    expect(() =>
      buildRunnerInvocation({
        repoRoot: REPO_ROOT,
        rawArtefactPath: rawArtefactPathFor(BASELINE_ARTEFACT_ROOT, 'eslint-invalid', '.json'),
        check: createCheckFixture({
          id: 'eslint-invalid',
          tool: 'eslint',
          cwd: '.',
          run: { kind: 'tsc', project: TSC_PROJECT_PATH },
        }),
      })
    ).toThrow('must use run.kind=npm-script');

    expect(() =>
      buildRunnerInvocation({
        repoRoot: REPO_ROOT,
        rawArtefactPath: rawArtefactPathFor(BASELINE_ARTEFACT_ROOT, 'tsc-invalid', '.txt'),
        check: createCheckFixture({
          id: 'tsc-invalid',
          tool: 'tsc',
          cwd: '.',
          run: { kind: 'npm-script', script: 'lint:builder' },
        }),
      })
    ).toThrow('must use run.kind=tsc');
  });

  it('returns empty results for empty check sets and stringifies non-Error failures', async () => {
    const { runChecksWithBoundedScheduler } = await loadRunnerModule();

    await expect(
      runChecksWithBoundedScheduler({
        checks: [],
        maxWorkers: 1,
        getPlannedRawArtefactPath: () => 'unused',
        runCheck: async () => {
          throw new Error('runCheck should not be called for empty checks.');
        },
      })
    ).resolves.toEqual([]);

    const checks: RegressionCheckConfig[] = [
      createCheckFixture({
        id: 'failing-literal-error-check',
        tool: 'eslint',
        cwd: '.',
        run: { kind: 'npm-script', script: 'lint:backend:check' },
      }),
    ];

    const [result] = await runChecksWithBoundedScheduler({
      checks,
      maxWorkers: 1,
      getPlannedRawArtefactPath: (check) =>
        rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, check.id, '.json'),
      runCheck: async () => {
        throw new Error('literal-failure');
      },
    });

    expect(result).toMatchObject({
      id: 'failing-literal-error-check',
      status: 'execution-error',
      error: {
        code: 'runner-execution-failed',
        message: expect.stringContaining('literal-failure'),
      },
    });
  });
});
