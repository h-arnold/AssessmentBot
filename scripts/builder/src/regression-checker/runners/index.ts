import path from 'node:path';

type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';

type NpmScriptRunConfig = { kind: 'npm-script'; script: string };
type TscRunConfig = { kind: 'tsc'; project: string };

type RegressionCheckConfig = {
  id: string;
  tool: RegressionTool;
  cwd: string;
  timeoutMs?: number;
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

type StructuredExecutionFailure = { code: 'runner-execution-failed'; message: string };

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

const PLAYWRIGHT_WORKER_LIMIT = 1;
/**
 * Builds a tool command invocation with enforced output mode.
 *
 * @param {{ repoRoot: string; check: RegressionCheckConfig; rawArtefactPath: string }} options - Invocation inputs.
 * @param {string} options.repoRoot - Absolute repository root path.
 * @param {RegressionCheckConfig} options.check - Check configuration for runner resolution.
 * @param {string} options.rawArtefactPath - Absolute raw artefact path used for tool output.
 * @returns {RunnerInvocation} Tool-specific invocation.
 */
export function buildRunnerInvocation(options: {
  repoRoot: string;
  check: RegressionCheckConfig;
  rawArtefactPath: string;
}): RunnerInvocation {
  const cwd = path.resolve(options.repoRoot, options.check.cwd);
  const rawArtefactPath = options.rawArtefactPath;
  const rawArtefactCommandPath = path.resolve(options.repoRoot, rawArtefactPath);

  switch (options.check.tool) {
    case 'eslint': {
      const scriptName = getNpmScriptName(options.check);
      return {
        executable: 'npm',
        args: [
          'run',
          scriptName,
          '--',
          '--format',
          'json',
          '--output-file',
          rawArtefactCommandPath,
        ],
        cwd,
        rawArtefactPath,
        rawArtefactExtension: '.json',
      };
    }
    case 'vitest': {
      const scriptName = getNpmScriptName(options.check);
      return {
        executable: 'npm',
        args: [
          'run',
          scriptName,
          '--',
          '--reporter=json',
          '--outputFile=' + rawArtefactCommandPath,
        ],
        cwd,
        rawArtefactPath,
        rawArtefactExtension: '.json',
      };
    }
    case 'playwright': {
      const scriptName = getNpmScriptName(options.check);
      return {
        executable: 'npm',
        args: ['run', scriptName, '--', '--reporter=json'],
        cwd,
        rawArtefactPath,
        rawArtefactExtension: '.json',
      };
    }
    case 'tsc':
      return {
        executable: 'tsc',
        args: [
          '-p',
          path.resolve(options.repoRoot, getTscProjectPath(options.check)),
          '--pretty',
          'false',
        ],
        cwd,
        rawArtefactPath,
        rawArtefactExtension: '.txt',
      };
    default:
      return assertNever(options.check.tool);
  }
}

/**
 * Reads npm script name for npm-script checks.
 *
 * @param {RegressionCheckConfig} check - Check config.
 * @returns {string} npm script name.
 */
function getNpmScriptName(check: RegressionCheckConfig): string {
  if (check.run.kind === 'npm-script') {
    return check.run.script;
  }

  throw new Error('Check ' + check.id + ' (' + check.tool + ') must use run.kind=npm-script.');
}

/**
 * Reads project path for tsc checks.
 *
 * @param {RegressionCheckConfig} check - Check config.
 * @returns {string} tsc project path.
 */
function getTscProjectPath(check: RegressionCheckConfig): string {
  if (check.run.kind === 'tsc') {
    return check.run.project;
  }

  throw new Error('Check ' + check.id + ' (' + check.tool + ') must use run.kind=tsc.');
}

/**
 * Guards unsupported tools in exhaustive switches.
 *
 * @param {never} value - Unexpected tool value.
 * @returns {never} Never returns.
 */
function assertNever(value: never): never {
  throw new Error('Unsupported regression tool: ' + String(value));
}

/**
 * Runs checks for a single lane with a fixed worker limit.
 *
 * @param {ReadonlyArray<{ check: RegressionCheckConfig; index: number }>} indexedChecks - Checks assigned to one lane.
 * @param {number} workerCount - Worker limit.
 * @param {(indexedCheck: { check: RegressionCheckConfig; index: number }) => Promise<void>} runIndexedCheck - Per-check executor.
 * @returns {Promise<void>} Completion promise.
 */
async function runChecksInLane(
  indexedChecks: ReadonlyArray<{ check: RegressionCheckConfig; index: number }>,
  workerCount: number,
  runIndexedCheck: (indexedCheck: { check: RegressionCheckConfig; index: number }) => Promise<void>
): Promise<void> {
  if (indexedChecks.length === 0) {
    return;
  }

  let nextIndex = 0;
  const laneWorkers = Array.from({ length: Math.min(workerCount, indexedChecks.length) }, () =>
    (async () => {
      while (nextIndex < indexedChecks.length) {
        const activeIndex = nextIndex;
        nextIndex += 1;
        const indexedCheck = indexedChecks.at(activeIndex);

        if (indexedCheck === undefined) {
          return;
        }

        await runIndexedCheck(indexedCheck);
      }
    })()
  );

  await Promise.all(laneWorkers);
}

/**
 * Schedules checks with bounded general workers and a single Playwright lane.
 *
 * @param {{ checks: ReadonlyArray<RegressionCheckConfig>; maxWorkers: number; getPlannedRawArtefactPath: (check: RegressionCheckConfig) => string; runCheck: (check: RegressionCheckConfig) => Promise<Omit<ScheduledCheckResult, "error">>; }} options - Scheduler options.
 * @returns {Promise<ScheduledCheckResult[]>} Ordered check results.
 */
export const runChecksWithBoundedScheduler: RunChecksWithBoundedScheduler = async (options) => {
  if (!Number.isInteger(options.maxWorkers) || options.maxWorkers < 1) {
    throw new Error('maxWorkers must be an integer greater than or equal to 1.');
  }
  const results: Array<ScheduledCheckResult | undefined> = new Array(options.checks.length);
  const indexedChecks = options.checks.map((check, index) => ({ check, index }));
  const generalChecks = indexedChecks.filter((entry) => entry.check.tool !== 'playwright');
  const playwrightChecks = indexedChecks.filter((entry) => entry.check.tool === 'playwright');

  const runIndexedCheck = async (indexedCheck: {
    check: RegressionCheckConfig;
    index: number;
  }): Promise<void> => {
    const plannedRawArtefactPath = options.getPlannedRawArtefactPath(indexedCheck.check);

    try {
      const result = await options.runCheck(indexedCheck.check);
      results[indexedCheck.index] = { ...result, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results[indexedCheck.index] = {
        id: indexedCheck.check.id,
        tool: indexedCheck.check.tool,
        rawArtefactPath: plannedRawArtefactPath,
        status: 'execution-error',
        exitCode: null,
        error: {
          code: 'runner-execution-failed',
          message: 'Check ' + indexedCheck.check.id + ' execution failed: ' + message,
        },
      };
    }
  };

  await Promise.all([
    runChecksInLane(generalChecks, options.maxWorkers, runIndexedCheck),
    runChecksInLane(playwrightChecks, PLAYWRIGHT_WORKER_LIMIT, runIndexedCheck),
  ]);

  return results.map((result, index) => {
    if (result === undefined) {
      throw new Error('Scheduler did not produce a result for check index ' + String(index) + '.');
    }

    return result;
  });
};
