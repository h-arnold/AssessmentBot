import path from 'node:path';
import { promises as fs } from 'node:fs';

import { compareRegressionChecks } from '../compare/index.js';
import { validateRegressionConfig } from '../config/validate-regression-config.js';
import type { RegressionConfigInput } from '../config/validate-regression-config.zod.js';
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

type ResolvedRunContext = {
  sessionContext: Awaited<ReturnType<typeof resolveSessionContext>>;
  config: RegressionConfig;
  configFingerprint: string;
  storageResult: Awaited<ReturnType<typeof prepareSessionStorage>>;
  currentManifest: SessionManifest;
  runResults: ScheduledCheckResult[];
};

const REGRESSION_HEADER_START = '=== REGRESSION HEADER START ===';
const REGRESSION_HEADER_END = '=== REGRESSION HEADER END ===';
const REGRESSION_CONFIG_PATH = '.ts-regression-checker/regression.config.json';
const INVALID_CONFIG_EXIT_CODE = 2;
const REGRESSION_FOUND_EXIT_CODE = 1;
const JSON_INDENT_SPACES = 2;
const UNEXPECTED_FAILURE_EXIT_CODE = 3;
const BASELINE_NO_DIFF_TEXT =
  'This run created the baseline and did not perform comparison diffing.';

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
    const context = await buildRunContext(options);

    if (context.storageResult.mode === 'baseline') {
      return buildBaselineModeResult(context, options.createdAt);
    }

    return await buildCompareModeResult(context, options);
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
 * Resolves config, storage, manifests, and current run results before report rendering.
 *
 * @param {RunRegressionCheckerCliOptions} options - Runtime inputs and injectable helpers.
 * @returns {Promise<ResolvedRunContext>} Normalised run context for baseline or compare flows.
 */
async function buildRunContext(
  options: RunRegressionCheckerCliOptions
): Promise<ResolvedRunContext> {
  const sessionContext = await resolveSessionContext({
    positionalSessionId: options.positionalSessionId,
    resolveGitBranchName: options.resolveGitBranchName,
  });
  const rawConfig = await options.loadRawConfig();
  const validatedConfig = validateRegressionConfig({
    rawConfig,
    repoRoot: options.repoRoot,
    packageJsonScriptsByDirectory: options.packageJsonScriptsByDirectory,
    logicalCpuCount: options.logicalCpuCount,
  });
  const config = normaliseValidatedConfig(validatedConfig);
  const configFingerprint =
    options.computeConfigFingerprint?.(config) ?? createConfigFingerprint(config);
  const baselineManifestChecks = createSessionManifestChecks(config, options.createdAt, 'baseline');

  const storageResult = await (options.prepareSessionStorage ?? prepareSessionStorage)({
    repoRoot: options.repoRoot,
    reportDirectory: config.reportDirectory,
    sessionId: sessionContext.sessionId,
    sessionIdSource: sessionContext.sessionIdSource,
    createdAt: options.createdAt,
    configFingerprint,
    checks: baselineManifestChecks,
  });

  const currentManifestChecks = createSessionManifestChecks(
    config,
    options.createdAt,
    storageResult.mode
  );
  const currentManifest: SessionManifest = {
    ...storageResult.manifest,
    mode: storageResult.mode,
    baselineCreatedThisRun: storageResult.mode === 'baseline',
    checks: currentManifestChecks,
  };
  if (storageResult.mode === 'compare' && options.prepareSessionStorage === undefined) {
    await writeSessionManifest(storageResult.currentManifestPath, currentManifest);
  }

  const runResults = await (options.runChecks ?? runChecksFromConfig)({
    config,
    repoRoot: options.repoRoot,
    rawArtefactDirectory: resolveRawArtefactDirectory(storageResult),
    runCommandImpl: options.runCommand ?? runCommand,
  });

  return {
    sessionContext,
    config,
    configFingerprint,
    storageResult,
    currentManifest,
    runResults,
  };
}

/**
 * Narrows validator output into the strict runtime config shape used by this module.
 *
 * @param {RegressionConfigInput & { reportDirectory: string; parallel: { enabled: boolean; maxWorkers: number } }} validatedConfig
 * Validator output to normalise.
 * @returns {RegressionConfig} Normalised config with strict `RegressionTool` literals.
 */
function normaliseValidatedConfig(
  validatedConfig: RegressionConfigInput & {
    reportDirectory: string;
    parallel: { enabled: boolean; maxWorkers: number };
  }
): RegressionConfig {
  return {
    reportDirectory: validatedConfig.reportDirectory,
    parallel: validatedConfig.parallel,
    checks: validatedConfig.checks.map((check) => ({
      ...check,
      tool: assertRegressionTool(check.tool),
    })),
  };
}

/**
 * Validates and narrows a configured tool family.
 *
 * @param {string} tool - Raw tool family from validated config.
 * @returns {RegressionTool} Narrowed supported tool family.
 */
function assertRegressionTool(tool: string): RegressionTool {
  switch (tool) {
    case 'eslint':
    case 'vitest':
    case 'playwright':
    case 'tsc':
      return tool;
    default:
      throw new Error(`Unsupported tool family configured: ${tool}`);
  }
}

/**
 * Resolves the raw artefact directory based on baseline vs compare mode.
 *
 * @param {Awaited<ReturnType<typeof prepareSessionStorage>>} storageResult - Storage plan for the active run.
 * @returns {string} Directory where check raw artefacts should be written.
 */
function resolveRawArtefactDirectory(
  storageResult: Awaited<ReturnType<typeof prepareSessionStorage>>
): string {
  if (storageResult.mode === 'baseline') {
    return storageResult.baselineDirectory;
  }

  return storageResult.currentRunDirectory ?? storageResult.baselineDirectory;
}

/**
 * Builds the baseline-mode CLI result.
 *
 * @param {ResolvedRunContext} context - Resolved run context.
 * @param {string} createdAt - Current run timestamp.
 * @returns {RunRegressionCheckerCliResult} Baseline-mode report output and exit code.
 */
function buildBaselineModeResult(
  context: ResolvedRunContext,
  createdAt: string
): RunRegressionCheckerCliResult {
  const outputText = renderBaselineReport({
    sessionId: context.sessionContext.sessionId,
    sessionStorageKey: context.storageResult.sessionStorageKey,
    sessionIdSource: context.sessionContext.sessionIdSource,
    createdAt,
    checks: context.runResults,
  });

  return {
    exitCode: 0,
    outputText,
    mode: 'baseline',
  };
}

/**
 * Builds the compare-mode CLI result and writes comparison artefacts.
 *
 * @param {ResolvedRunContext} context - Resolved run context.
 * @param {RunRegressionCheckerCliOptions} options - Runtime inputs and injectable helpers.
 * @returns {Promise<RunRegressionCheckerCliResult>} Compare-mode report output and exit code.
 */
async function buildCompareModeResult(
  context: ResolvedRunContext,
  options: RunRegressionCheckerCliOptions
): Promise<RunRegressionCheckerCliResult> {
  const baselineManifest = await (options.readBaselineManifest ?? readBaselineManifest)(
    context.storageResult.baselineManifestPath
  );
  const baselineCompatibility = (
    options.evaluateBaselineCompatibility ?? evaluateBaselineCompatibility
  )({
    baselineManifest,
    currentConfigFingerprint: context.configFingerprint,
    currentChecks: context.currentManifest.checks.map((check) => ({
      id: check.id,
      tool: check.tool,
      executionMetadata: check.executionMetadata,
    })),
  });

  const readableChecks = await hydrateReadableCheckPairs({
    baselineManifest,
    currentManifest: context.currentManifest,
    sessionDirectory: context.storageResult.sessionDirectory,
    currentResults: context.runResults,
    readRawArtefact: options.readRawArtefact ?? readRawArtefactFromDisk,
  });

  const comparison = (options.compareRegressionChecks ?? compareRegressionChecks)({
    checksInConfigOrder: readableChecks,
    baselineCompatibility,
  });

  const outputText = renderComparisonReport({
    sessionId: context.sessionContext.sessionId,
    sessionStorageKey: context.storageResult.sessionStorageKey,
    sessionIdSource: context.sessionContext.sessionIdSource,
    baselineTimestamp: baselineManifest.createdAt,
    currentTimestamp: options.createdAt,
    comparison,
  });

  await persistComparisonReports(
    context.storageResult.currentRunDirectory,
    comparison,
    outputText,
    options.writeFile ?? writeFileToDisk
  );

  return {
    exitCode: mapComparisonStatusToExitCode(comparison.overallStatus),
    outputText,
    mode: 'compare',
  };
}

/**
 * Persists compare-mode JSON and text artefacts.
 *
 * @param {string | null} comparisonRunDirectory - Active compare run directory.
 * @param {ComparisonResult} comparison - Structured comparison result.
 * @param {string} outputText - Human-readable comparison report.
 * @param {(targetPath: string, content: string) => Promise<void>} writeFile - File writer callback.
 * @returns {Promise<void>} Resolves once both artefacts are written.
 */
async function persistComparisonReports(
  comparisonRunDirectory: string | null,
  comparison: ComparisonResult,
  outputText: string,
  writeFile: (targetPath: string, content: string) => Promise<void>
): Promise<void> {
  if (comparisonRunDirectory === null) {
    throw new Error('Compare mode requires a current run directory.');
  }

  await writeFile(
    path.join(comparisonRunDirectory, 'comparison.json'),
    JSON.stringify(comparison, null, JSON_INDENT_SPACES)
  );
  await writeFile(path.join(comparisonRunDirectory, 'comparison.txt'), outputText);
}

/**
 * Maps compare status values to CLI exit codes.
 *
 * @param {'GREEN' | 'FAILING' | 'BASELINE-INCOMPATIBLE'} status - Comparison status.
 * @returns {number} Process-compatible exit code.
 */
function mapComparisonStatusToExitCode(
  status: 'GREEN' | 'FAILING' | 'BASELINE-INCOMPATIBLE'
): number {
  switch (status) {
    case 'GREEN':
      return 0;
    case 'FAILING':
      return REGRESSION_FOUND_EXIT_CODE;
    case 'BASELINE-INCOMPATIBLE':
      return UNEXPECTED_FAILURE_EXIT_CODE;
    default:
      return UNEXPECTED_FAILURE_EXIT_CODE;
  }
}

/**
 * Renders the baseline report text with deterministic header order.
 *
 * @param {{ sessionId: string; sessionStorageKey: string; sessionIdSource: SessionIdSource; createdAt: string; checks: ScheduledCheckResult[]; }} options
 * Baseline report rendering options.
 * @param {string} options.sessionId - Logical session identifier.
 * @param {string} options.sessionStorageKey - Filesystem-safe session storage key.
 * @param {SessionIdSource} options.sessionIdSource - Session-ID source label.
 * @param {string} options.createdAt - Current run ISO timestamp.
 * @param {ScheduledCheckResult[]} options.checks - Ordered check outcomes.
 * @returns {string} Human-readable baseline report text.
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
    BASELINE_NO_DIFF_TEXT,
  ];

  return lines.join('\n');
}

/**
 * Renders the compare report text with deterministic header and per-check sections.
 *
 * @param {{ sessionId: string; sessionStorageKey: string; sessionIdSource: SessionIdSource; baselineTimestamp: string; currentTimestamp: string; comparison: ComparisonResult; }} options
 * Compare report rendering options.
 * @param {string} options.sessionId - Logical session identifier.
 * @param {string} options.sessionStorageKey - Filesystem-safe session storage key.
 * @param {SessionIdSource} options.sessionIdSource - Session-ID source label.
 * @param {string} options.baselineTimestamp - Baseline run timestamp.
 * @param {string} options.currentTimestamp - Current run timestamp.
 * @param {ComparisonResult} options.comparison - Structured comparison model.
 * @returns {string} Human-readable compare report text.
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
    lines.push(
      ...[
        `checkId: ${check.id}`,
        `status: ${check.status}`,
        `tool: ${check.tool}`,
        `regressions: ${check.regressions.join(', ') || 'none'}`,
        `newFailures: ${check.newFailures.join(', ') || 'none'}`,
        `fixes: ${check.fixes.join(', ') || 'none'}`,
        '',
      ]
    );
  }

  return lines.join('\n');
}

/**
 * Produces deterministic `tool=count` summary text sorted alphabetically by tool.
 *
 * @param {RegressionTool[]} tools - Tools executed in the run.
 * @returns {string} Comma-separated summary string.
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
 * Creates session-manifest check entries for baseline or compare mode.
 *
 * @param {RegressionConfig} config - Validated regression config.
 * @param {string} createdAt - ISO timestamp for the current run.
 * @param {'baseline' | 'compare'} mode - Active storage mode.
 * @returns {SessionManifest['checks']} Ordered check entries for manifest persistence.
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
 * Maps tool families to raw artefact file names.
 *
 * @param {RegressionTool} tool - Tool family.
 * @returns {'raw.json' | 'raw.txt'} Raw artefact file name.
 */
export function getRawFileName(tool: RegressionTool): string {
  return tool === 'tsc' ? 'raw.txt' : 'raw.json';
}

/**
 * Creates a deterministic config fingerprint string.
 *
 * @param {RegressionConfig} config - Validated regression config.
 * @returns {string} Deterministic config fingerprint.
 */
function createConfigFingerprint(config: RegressionConfig): string {
  return JSON.stringify(config);
}

/**
 * Reads and parses the baseline manifest JSON document.
 *
 * @param {string} baselineManifestPath - Absolute baseline manifest path.
 * @returns {Promise<SessionManifest>} Parsed baseline manifest object.
 */
async function readBaselineManifest(baselineManifestPath: string): Promise<SessionManifest> {
  const manifestText = await fs.readFile(baselineManifestPath, 'utf8');
  return JSON.parse(manifestText) as SessionManifest;
}

/**
 * Reads a raw artefact from disk and decodes JSON artefacts automatically.
 *
 * @param {string} rawArtefactPath - Absolute raw artefact path.
 * @returns {Promise<unknown>} Parsed JSON or raw text content.
 */
async function readRawArtefactFromDisk(rawArtefactPath: string): Promise<unknown> {
  const artefactText = await fs.readFile(rawArtefactPath, 'utf8');
  return rawArtefactPath.endsWith('.json') ? JSON.parse(artefactText) : artefactText;
}

/**
 * Writes UTF-8 file content, creating parent directories as needed.
 *
 * @param {string} targetPath - Absolute path to write.
 * @param {string} content - File content.
 * @returns {Promise<void>} Resolves after writing completes.
 */
export async function writeFileToDisk(targetPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf8');
}

/**
 * Writes a session manifest to disk.
 *
 * @param {string} manifestPath - Absolute manifest path.
 * @param {SessionManifest} manifest - Manifest data.
 * @returns {Promise<void>} Resolves after writing completes.
 */
async function writeSessionManifest(
  manifestPath: string,
  manifest: SessionManifest
): Promise<void> {
  await writeFileToDisk(manifestPath, JSON.stringify(manifest, null, JSON_INDENT_SPACES));
}

/**
 * Builds ordered baseline/current check pairs with hydrated raw artefacts.
 *
 * @param {{ baselineManifest: SessionManifest; currentManifest: SessionManifest; sessionDirectory: string; currentResults: ScheduledCheckResult[]; readRawArtefact: (rawArtefactPath: string) => Promise<unknown>; }} options
 * Pair-hydration options.
 * @param {SessionManifest} options.baselineManifest - Baseline manifest.
 * @param {SessionManifest} options.currentManifest - Current manifest.
 * @param {string} options.sessionDirectory - Session root directory.
 * @param {ScheduledCheckResult[]} options.currentResults - Current check outcomes.
 * @param {(rawArtefactPath: string) => Promise<unknown>} options.readRawArtefact - Artefact reader.
 * @returns {Promise<Array<{ baseline: ReadableCheckResult; current: ReadableCheckResult }>>} Ordered readable check pairs.
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
 * Runs all configured checks and persists raw artefacts for later comparison.
 *
 * @param {{ config: RegressionConfig; repoRoot: string; rawArtefactDirectory: string; runCommandImpl: typeof runCommand; }} options
 * Runner orchestration options.
 * @param {RegressionConfig} options.config - Validated check configuration.
 * @param {string} options.repoRoot - Absolute repository root.
 * @param {string} options.rawArtefactDirectory - Target directory for raw outputs.
 * @param {typeof runCommand} options.runCommandImpl - Command execution implementation.
 * @returns {Promise<ScheduledCheckResult[]>} Ordered scheduled check results.
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
 * Persists tool-specific command output to a raw artefact file.
 *
 * @param {{ tool: RegressionTool; rawArtefactPath: string; commandOutput: { stdout: string; stderr: string } }} options
 * Persistence inputs.
 * @param {RegressionTool} options.tool - Tool family for output handling.
 * @param {string} options.rawArtefactPath - Absolute raw artefact path.
 * @param {{ stdout: string; stderr: string }} options.commandOutput - Command output payload.
 * @param {string} options.commandOutput.stdout - Captured stdout.
 * @param {string} options.commandOutput.stderr - Captured stderr.
 * @returns {Promise<void>} Resolves once any required write completes.
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
 * Resolves a session artefact path to an absolute path within the session directory.
 *
 * @param {string} sessionDirectory - Absolute session directory.
 * @param {string} relativeArtefactPath - Manifest path stored for the artefact.
 * @returns {string} Absolute artefact path within the session directory.
 */
export function resolveSessionArtefactPath(
  sessionDirectory: string,
  relativeArtefactPath: string
): string {
  const resolvedPath = path.resolve(sessionDirectory, relativeArtefactPath);
  const relativePath = path.relative(sessionDirectory, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(
      `Unsafe session artefact path escapes the session directory: ${relativeArtefactPath}`
    );
  }

  return resolvedPath;
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
