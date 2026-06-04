import { describe, expect, it } from 'vitest';

import type { RegressionCheckConfig } from './fixtures.js';
import {
  BASELINE_ARTEFACT_ROOT,
  CURRENT_RUN_ARTEFACT_ROOT,
  FAILING_CHECK_MESSAGE,
  GENERAL_DELAY_FAST_MS,
  GENERAL_DELAY_SLOW_MS,
  GENERAL_WORKER_LIMIT,
  NPM_SCRIPT_E2E,
  NPM_SCRIPT_LINT,
  NPM_SCRIPT_TEST,
  PLAYWRIGHT_DELAY_MS,
  REPO_ROOT,
  TSC_PROJECT_PATH,
  createCheckFixture,
  createNpmScriptCheck,
  loadRunnerModule,
  rawArtefactPathFor,
} from './fixtures.js';

describe('tool runner command construction and bounded scheduling', () => {
  it('schedules general checks with bounded workers and keeps playwright in a dedicated single-worker lane', async () => {
    const { runChecksWithBoundedScheduler } = await loadRunnerModule();

    const checks: RegressionCheckConfig[] = [
      createNpmScriptCheck({ id: 'general-eslint-1', tool: 'eslint', script: NPM_SCRIPT_LINT }),
      createNpmScriptCheck({ id: 'general-vitest-1', tool: 'vitest', script: NPM_SCRIPT_TEST }),
      createNpmScriptCheck({ id: 'playwright-1', tool: 'playwright', script: NPM_SCRIPT_E2E }),
      createNpmScriptCheck({ id: 'general-eslint-2', tool: 'eslint', script: NPM_SCRIPT_LINT }),
      createNpmScriptCheck({ id: 'playwright-2', tool: 'playwright', script: NPM_SCRIPT_E2E }),
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
      createNpmScriptCheck({ id: 'first-general-check', tool: 'eslint', script: NPM_SCRIPT_LINT }),
      createNpmScriptCheck({ id: 'failing-check', tool: 'vitest', script: NPM_SCRIPT_TEST }),
      createNpmScriptCheck({ id: 'playwright-check', tool: 'playwright', script: NPM_SCRIPT_E2E }),
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
      createNpmScriptCheck({
        id: 'failing-literal-error-check',
        tool: 'eslint',
        script: NPM_SCRIPT_LINT,
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
