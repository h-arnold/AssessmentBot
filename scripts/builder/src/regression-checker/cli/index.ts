import path from 'node:path';
import { promises as fs } from 'node:fs';

import { compareRegressionChecks } from '../compare/index.js';
import { validateRegressionConfig } from '../config/validate-regression-config.js';
import {
  buildRunnerInvocation,
  runChecksWithBoundedScheduler,
  type ScheduledCheckResult,
} from '../runners/index.js';
import {
  evaluateBaselineCompatibility,
  prepareSessionStorage,
  type SessionManifest,
} from '../storage/session-storage.js';
import { resolveSessionContext, type SessionIdSource } from './session-resolution.js';
import { CommandExecutionError, runCommand } from '../../lib/process.js';

type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';
type RegressionCheckConfig = {
  id: string;
  tool: RegressionTool;
  cwd: string;
  reporterMode?: string;
  run: { kind: 'npm-script'; script: string } | { kind: 'tsc'; project: string };
};

type RegressionConfig = {
  reportDirectory: string;
  parallel: {
    enabled: boolean;
    maxWorkers: number;
  };
  checks: RegressionCheckConfig[];
};

type ComparisonResult = ReturnType<typeof compareRegressionChecks>;

type ReadableCheckResult = ScheduledCheckResult & {
  rawArtefact: unknown;
};

type RunRegressionCheckerCliOptions = {
  positionalSessionId?: string;
  repoRoot: string;
  createdAt: string;
  logicalCpuCount: number;
  loadRawConfig: () => Promise<unknown>;
  packageJsonScriptsByDirectory: Record<string, Record<string, string>>;
  resolveGitBranchName: () => Promise<string>;
  computeConfigFingerprint?: (config: RegressionConfig) => string;
  prepareSessionStorage?: typeof prepareSessionStorage;
  readBaselineManifest?: (baselineManifestPath: string) => Promise<SessionManifest>;
  evaluateBaselineCompatibility?: typeof evaluateBaselineCompatibility;
  runChecks?: (options: {
    config: RegressionConfig;
    rawArtefactDirectory: string;
  }) => Promise<ScheduledCheckResult[]>;
  compareRegressionChecks?: typeof compareRegressionChecks;
  readRawArtefact?: (rawArtefactPath: string) => Promise<unknown>;
  writeFile?: (targetPath: string, content: string) => Promise<void>;
  runCommand?: typeof runCommand;
};

type RunRegressionCheckerCliResult = {
  exitCode: number;
  outputText: string;
  mode: 'baseline' | 'compare';
};

const REGRESSION_HEADER_START = '=== REGRESSION HEADER START ===';
const REGRESSION_HEADER_END = '=== REGRESSION HEADER END ===';
const REGRESSION_CONFIG_PATH = '.ts-regression-checker/regression.config.json';
const INVALID_CONFIG_EXIT_CODE = 2;
const UNEXPECTED_FAILURE_EXIT_CODE = 3;

/**
 * Runs the regression-checker CLI flow with explicit dependency injection for tests and wrappers.
 *
 * @param {RunRegressionCheckerCliOptions} options - Runtime inputs plus injectable side-effect helpers.
 * @returns {Promise<RunRegressionCheckerCliResult>} Exit code, rendered text, and resolved mode.
 */
export async function runRegressionCheckerCli(
  options: RunRegressionCheckerCliOptions
): Promise<RunRegressionCheckerCliResult> {
  try {
    const sessionContext = await resolveSessionContext({
      positionalSessionId: options.positionalSessionId,
      resolveGitBranchName: options.resolveGitBranchName,
    });
    const rawConfig = await options.loadRawConfig();
    const config = validateRegressionConfig({
      rawConfig,
      repoRoot: options.repoRoot,
      packageJsonScriptsByDirectory: options.packageJsonScriptsByDirectory,
      logicalCpuCount: options.logicalCpuCount,
    }) as RegressionConfig;
    const configFingerprint =
      options.computeConfigFingerprint?.(config) ?? createConfigFingerprint(config);
    const sessionChecks = createSessionManifestChecks(config, options.createdAt, 'compare');
    const storageResult = await (options.prepareSessionStorage ?? prepareSessionStorage)({
      repoRoot: options.repoRoot,
      reportDirectory: config.reportDirectory,
      sessionId: sessionContext.sessionId,
      sessionIdSource: sessionContext.sessionIdSource,
      createdAt: options.createdAt,
      configFingerprint,
      checks: sessionChecks,
    });
    const currentManifest: SessionManifest = {
      ...storageResult.manifest,
      checks: createSessionManifestChecks(config, options.createdAt, storageResult.mode),
    };
    if (options.prepareSessionStorage === undefined) {
      await writeSessionManifest(storageResult.currentManifestPath, currentManifest);
    }
    const runResults = await (options.runChecks ?? runChecksFromConfig)({
      config,
      repoRoot: options.repoRoot,
      rawArtefactDirectory:
        storageResult.mode === 'baseline'
          ? storageResult.baselineDirectory
          : (storageResult.currentRunDirectory ?? storageResult.baselineDirectory),
      runCommandImpl: options.runCommand ?? runCommand,
    });

    if (storageResult.mode === 'baseline') {
      const outputText = renderBaselineReport({
        sessionId: sessionContext.sessionId,
        sessionStorageKey: storageResult.sessionStorageKey,
        sessionIdSource: sessionContext.sessionIdSource,
        createdAt: options.createdAt,
        checks: runResults,
      });

      return {
        exitCode: 0,
        outputText,
        mode: 'baseline',
      };
    }

    const baselineManifest = await (options.readBaselineManifest ?? readBaselineManifest)(
      storageResult.baselineManifestPath
    );
    const baselineCompatibility = (
      options.evaluateBaselineCompatibility ?? evaluateBaselineCompatibility
    )({
      baselineManifest,
      currentConfigFingerprint: configFingerprint,
      currentChecks: currentManifest.checks.map((check) => ({
        id: check.id,
        tool: check.tool,
        executionMetadata: check.executionMetadata,
      })),
    });
    const readableChecks = await hydrateReadableCheckPairs({
      baselineManifest,
      currentManifest,
      sessionDirectory: storageResult.sessionDirectory,
      currentResults: runResults,
      readRawArtefact: options.readRawArtefact ?? readRawArtefactFromDisk,
    });
    const comparison = (options.compareRegressionChecks ?? compareRegressionChecks)({
      checksInConfigOrder: readableChecks,
      baselineCompatibility,
    });
    const outputText = renderComparisonReport({
      sessionId: sessionContext.sessionId,
      sessionStorageKey: storageResult.sessionStorageKey,
      sessionIdSource: sessionContext.sessionIdSource,
      baselineTimestamp: baselineManifest.createdAt,
      currentTimestamp: options.createdAt,
      comparison,
    });
    const comparisonRunDirectory = storageResult.currentRunDirectory;

    if (comparisonRunDirectory === null) {
      throw new Error('Compare mode requires a current run directory.');
    }

    const writeFile = options.writeFile ?? writeFileToDisk;
    await writeFile(
      path.join(comparisonRunDirectory, 'comparison.json'),
      JSON.stringify(comparison, null, 2)
    );
    await writeFile(path.join(comparisonRunDirectory, 'comparison.txt'), outputText);

    return {
      exitCode:
        comparison.overallStatus === 'FAILING'
          ? 1
          : comparison.overallStatus === 'BASELINE-INCOMPATIBLE'
            ? UNEXPECTED_FAILURE_EXIT_CODE
            : 0,
      outputText,
      mode: 'compare',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: message.includes('Regression config is invalid')
        ? INVALID_CONFIG_EXIT_CODE
        : UNEXPECTED_FAILURE_EXIT_CODE,
      outputText: message,
      mode: 'baseline',
    };
  }
}

/**
 *
 * @param options
 * @param options.sessionId
 * @param options.sessionStorageKey
 * @param options.sessionIdSource
 * @param options.createdAt
 * @param options.checks
 */
export function renderBaselineReport(options: {
  sessionId: string;
  sessionStorageKey: string;
  sessionIdSource: SessionIdSource;
  createdAt: string;
  checks: ScheduledCheckResult[];
}): string {
  const checksPassing = options.checks.filter((check) => check.status === 'passing').length;
  const checksFailing = options.checks.length - checksPassing;
  const lines = [
    REGRESSION_HEADER_START,
    `sessionId: ${options.sessionId}`,
    `sessionStorageKey: ${options.sessionStorageKey}`,
    `sessionIdSource: ${options.sessionIdSource}`,
    'mode: baseline',
    'baselineCreatedThisRun: true',
    'baselineTimestamp: N/A',
    `currentTimestamp: ${options.createdAt}`,
    `overallStatus: ${checksFailing > 0 ? 'FAILING' : 'GREEN'}`,
    `totalChecks: ${String(options.checks.length)}`,
    `checksPassing: ${String(checksPassing)}`,
    `checksFailing: ${String(checksFailing)}`,
    'regressionsCount: 0',
    'newFailuresCount: 0',
    'fixesCount: 0',
    `toolSummary: ${renderToolSummary(options.checks.map((check) => check.tool))}`,
    REGRESSION_HEADER_END,
    '',
    'This run created the baseline and did not perform comparison diffing.',
  ];

  return lines.join('\n');
}

/**
 *
 * @param options
 * @param options.sessionId
 * @param options.sessionStorageKey
 * @param options.sessionIdSource
 * @param options.baselineTimestamp
 * @param options.currentTimestamp
 * @param options.comparison
 */
export function renderComparisonReport(options: {
  sessionId: string;
  sessionStorageKey: string;
  sessionIdSource: SessionIdSource;
  baselineTimestamp: string;
  currentTimestamp: string;
  comparison: ComparisonResult;
}): string {
  const lines = [
    REGRESSION_HEADER_START,
    `sessionId: ${options.sessionId}`,
    `sessionStorageKey: ${options.sessionStorageKey}`,
    `sessionIdSource: ${options.sessionIdSource}`,
    'mode: compare',
    'baselineCreatedThisRun: false',
    `baselineTimestamp: ${options.baselineTimestamp}`,
    `currentTimestamp: ${options.currentTimestamp}`,
    `overallStatus: ${options.comparison.overallStatus}`,
    `totalChecks: ${String(options.comparison.checks.length)}`,
    `checksPassing: ${String(options.comparison.totals.checksPassing)}`,
    `checksFailing: ${String(options.comparison.totals.checksFailing)}`,
    `regressionsCount: ${String(options.comparison.totals.regressionsCount)}`,
    `newFailuresCount: ${String(options.comparison.totals.newFailuresCount)}`,
    `fixesCount: ${String(options.comparison.totals.fixesCount)}`,
    `toolSummary: ${renderToolSummary(options.comparison.checks.map((check) => check.tool))}`,
    REGRESSION_HEADER_END,
    '',
  ];

  for (const check of options.comparison.checks) {
    lines.push(`checkId: ${check.id}`);
    lines.push(`status: ${check.status}`);
    lines.push(`tool: ${check.tool}`);
    lines.push(`regressions: ${check.regressions.join(', ') || 'none'}`);
    lines.push(`newFailures: ${check.newFailures.join(', ') || 'none'}`);
    lines.push(`fixes: ${check.fixes.join(', ') || 'none'}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 *
 * @param tools
 */
function renderToolSummary(tools: RegressionTool[]): string {
  const counts = new Map<RegressionTool, number>();
  for (const tool of tools) {
    counts.set(tool, (counts.get(tool) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tool, count]) => `${tool}=${String(count)}`)
    .join(', ');
}

/**
 *
 * @param config
 * @param createdAt
 * @param mode
 */
export function createSessionManifestChecks(
  config: RegressionConfig,
  createdAt: string,
  mode: 'baseline' | 'compare'
): SessionManifest['checks'] {
  const runDirectorySegment = createdAt.replaceAll(':', '-');
  const rootSegments =
    mode === 'baseline' ? ['baseline', 'checks'] : ['runs', runDirectorySegment, 'checks'];

  return config.checks.map((check) => {
    const executionMetadata: Record<string, string | number | boolean | null> =
      check.run.kind === 'tsc'
        ? { project: check.run.project }
        : {
            reporterMode: check.reporterMode ?? 'json',
            script: check.run.script,
          };

    return {
      id: check.id,
      tool: check.tool,
      cwd: check.cwd,
      executionMetadata,
      rawArtefactPath: path.posix.join(...rootSegments, check.id, getRawFileName(check.tool)),
      derivedSummaryPath: path.posix.join(...rootSegments, check.id, 'derived.json'),
    };
  });
}

/**
 *
 * @param tool
 */
export function getRawFileName(tool: RegressionTool): string {
  return tool === 'tsc' ? 'raw.txt' : 'raw.json';
}

/**
 *
 * @param config
 */
function createConfigFingerprint(config: RegressionConfig): string {
  return JSON.stringify(config);
}

/**
 *
 * @param baselineManifestPath
 */
async function readBaselineManifest(baselineManifestPath: string): Promise<SessionManifest> {
  const manifestText = await fs.readFile(baselineManifestPath, 'utf8');
  return JSON.parse(manifestText) as SessionManifest;
}

/**
 *
 * @param rawArtefactPath
 */
async function readRawArtefactFromDisk(rawArtefactPath: string): Promise<unknown> {
  const artefactText = await fs.readFile(rawArtefactPath, 'utf8');
  return rawArtefactPath.endsWith('.json') ? JSON.parse(artefactText) : artefactText;
}

/**
 *
 * @param targetPath
 * @param content
 */
export async function writeFileToDisk(targetPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf8');
}

/**
 *
 * @param manifestPath
 * @param manifest
 */
async function writeSessionManifest(
  manifestPath: string,
  manifest: SessionManifest
): Promise<void> {
  await writeFileToDisk(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 *
 * @param options
 * @param options.baselineManifest
 * @param options.currentManifest
 * @param options.sessionDirectory
 * @param options.currentResults
 * @param options.readRawArtefact
 */
async function hydrateReadableCheckPairs(options: {
  baselineManifest: SessionManifest;
  currentManifest: SessionManifest;
  sessionDirectory: string;
  currentResults: ScheduledCheckResult[];
  readRawArtefact: (rawArtefactPath: string) => Promise<unknown>;
}): Promise<Array<{ baseline: ReadableCheckResult; current: ReadableCheckResult }>> {
  const currentResultsById = new Map(options.currentResults.map((check) => [check.id, check]));
  const currentManifestChecksById = new Map(
    options.currentManifest.checks.map((check) => [check.id, check])
  );

  const pairs: Array<{ baseline: ReadableCheckResult; current: ReadableCheckResult }> = [];
  for (const baselineCheck of options.baselineManifest.checks) {
    const currentResult = currentResultsById.get(baselineCheck.id);
    const currentManifestCheck = currentManifestChecksById.get(baselineCheck.id);
    if (currentResult === undefined || currentManifestCheck === undefined) {
      continue;
    }

    pairs.push({
      baseline: {
        id: baselineCheck.id,
        tool: baselineCheck.tool,
        rawArtefactPath: baselineCheck.rawArtefactPath,
        rawArtefact: await options.readRawArtefact(
          resolveSessionArtefactPath(options.sessionDirectory, baselineCheck.rawArtefactPath)
        ),
        status: 'passing',
        exitCode: 0,
        error: null,
      },
      current: {
        ...currentResult,
        rawArtefact: await options.readRawArtefact(
          resolveSessionArtefactPath(options.sessionDirectory, currentManifestCheck.rawArtefactPath)
        ),
      },
    });
  }

  return pairs;
}

/**
 *
 * @param options
 * @param options.config
 * @param options.repoRoot
 * @param options.rawArtefactDirectory
 * @param options.runCommandImpl
 */
export async function runChecksFromConfig(options: {
  config: RegressionConfig;
  repoRoot: string;
  rawArtefactDirectory: string;
  runCommandImpl: typeof runCommand;
}): Promise<ScheduledCheckResult[]> {
  return runChecksWithBoundedScheduler({
    checks: options.config.checks,
    maxWorkers: options.config.parallel.enabled ? options.config.parallel.maxWorkers : 1,
    getPlannedRawArtefactPath: (check) =>
      path.join(options.rawArtefactDirectory, 'checks', check.id, getRawFileName(check.tool)),
    runCheck: async (check) => {
      const rawArtefactPath = path.join(
        options.rawArtefactDirectory,
        'checks',
        check.id,
        getRawFileName(check.tool)
      );
      await fs.mkdir(path.dirname(rawArtefactPath), { recursive: true });
      const invocation = buildRunnerInvocation({
        repoRoot: options.repoRoot,
        check,
        rawArtefactPath,
      });

      try {
        const commandOutput = await options.runCommandImpl(invocation.executable, invocation.args, {
          cwd: invocation.cwd,
        });
        await persistCapturedArtefact({
          tool: check.tool,
          rawArtefactPath,
          commandOutput,
        });

        return {
          id: check.id,
          tool: check.tool,
          rawArtefactPath,
          status: 'passing',
          exitCode: 0,
        };
      } catch (error) {
        if (error instanceof CommandExecutionError && error.diagnostics.exitCode !== null) {
          await persistCapturedArtefact({
            tool: check.tool,
            rawArtefactPath,
            commandOutput: {
              stdout: error.diagnostics.stdout,
              stderr: error.diagnostics.stderr,
            },
          });

          return {
            id: check.id,
            tool: check.tool,
            rawArtefactPath,
            status: 'failing',
            exitCode: error.diagnostics.exitCode,
          };
        }

        throw error;
      }
    },
  });
}

/**
 *
 * @param options
 * @param options.tool
 * @param options.rawArtefactPath
 * @param options.commandOutput
 * @param options.commandOutput.stdout
 * @param options.commandOutput.stderr
 */
export async function persistCapturedArtefact(options: {
  tool: RegressionTool;
  rawArtefactPath: string;
  commandOutput: { stdout: string; stderr: string };
}): Promise<void> {
  if (options.tool === 'playwright') {
    await writeFileToDisk(options.rawArtefactPath, options.commandOutput.stdout);
    return;
  }

  if (options.tool === 'tsc') {
    const diagnosticText =
      options.commandOutput.stdout.trim().length > 0
        ? options.commandOutput.stdout
        : options.commandOutput.stderr;
    await writeFileToDisk(options.rawArtefactPath, diagnosticText);
  }
}

/**
 *
 * @param sessionDirectory
 * @param relativeArtefactPath
 */
export function resolveSessionArtefactPath(
  sessionDirectory: string,
  relativeArtefactPath: string
): string {
  return path.join(sessionDirectory, relativeArtefactPath);
}

/**
 * Loads the default CLI config file from the repository root.
 *
 * @param {string} repoRoot - Absolute repository root.
 * @returns {Promise<unknown>} Raw config payload.
 */
export async function loadDefaultRegressionCheckerConfig(repoRoot: string): Promise<unknown> {
  const configText = await fs.readFile(path.join(repoRoot, REGRESSION_CONFIG_PATH), 'utf8');
  return JSON.parse(configText) as unknown;
}
