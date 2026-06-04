import path from 'node:path';
import { promises as fs } from 'node:fs';

import { compareRegressionChecks, type ComparisonResult } from '../compare/index.js';
import { validateRegressionConfig } from '../config/validate-regression-config/index.js';
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
import { resolveSessionContext } from './session-resolution.js';
import { CommandExecutionError, logError, logInfo, runCommand } from '../../lib/process.js';

import { renderBaselineReport, renderComparisonReport } from './report-renderer.js';
import {
  JSON_INDENT_SPACES,
  persistCapturedArtefact,
  readRawArtefactFromDisk,
  resolveSessionArtefactPath,
  writeFileToDisk,
  writeSessionManifest,
} from './artefact-processor.js';

export {
  extractCurrentFailures,
  renderBaselineReport,
  renderComparisonReport,
} from './report-renderer.js';
export {
  persistCapturedArtefact,
  resolveSessionArtefactPath,
  writeFileToDisk,
} from './artefact-processor.js';

type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';

type RegressionCheckConfig = {
  id: string;
  tool: RegressionTool;
  cwd: string;
  timeoutMs?: number;
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

const REGRESSION_CONFIG_PATH = '.ts-regression-checker/regression.config.json';
const INVALID_CONFIG_EXIT_CODE = 2;
const REGRESSION_FOUND_EXIT_CODE = 1;
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
    const context = await buildRunContext(options);

    if (context.storageResult.mode === 'baseline') {
      return await buildBaselineModeResult(context, options.createdAt, options);
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

  const runResults = await runChecksForContext(options, config, storageResult);

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
 * Runs configured checks using injected or default runner implementations.
 *
 * @param {RunRegressionCheckerCliOptions} options - Runtime inputs and injectable helpers.
 * @param {RegressionConfig} config - Normalised regression-checker config.
 * @param {Awaited<ReturnType<typeof prepareSessionStorage>>} storageResult - Storage plan for the active run.
 * @returns {Promise<ScheduledCheckResult[]>} Collected check execution results.
 */
async function runChecksForContext(
  options: RunRegressionCheckerCliOptions,
  config: RegressionConfig,
  storageResult: Awaited<ReturnType<typeof prepareSessionStorage>>
): Promise<ScheduledCheckResult[]> {
  return await (options.runChecks ?? runChecksFromConfig)({
    config,
    repoRoot: options.repoRoot,
    rawArtefactDirectory: resolveRawArtefactDirectory(storageResult),
    runCommandImpl: options.runCommand ?? runCommand,
  });
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
 * Persists baseline report to disk.
 *
 * @param {string} baselineDirectory - Baseline directory path.
 * @param {string} outputText - Human-readable baseline report.
 * @param {(targetPath: string, content: string) => Promise<void>} writeFile - File writer callback.
 * @returns {Promise<void>} Resolves once file is written.
 */
async function persistBaselineReport(
  baselineDirectory: string,
  outputText: string,
  writeFile: (targetPath: string, content: string) => Promise<void>
): Promise<void> {
  await writeFile(path.join(baselineDirectory, 'baseline.txt'), outputText);
}

/**
 * Builds the baseline-mode CLI result and writes baseline artefacts.
 *
 * @param {ResolvedRunContext} context - Resolved run context.
 * @param {string} createdAt - Current run timestamp.
 * @param {RunRegressionCheckerCliOptions} options - Runtime inputs and injectable helpers.
 * @returns {Promise<RunRegressionCheckerCliResult>} Baseline-mode report output and exit code.
 */
async function buildBaselineModeResult(
  context: ResolvedRunContext,
  createdAt: string,
  options: RunRegressionCheckerCliOptions
): Promise<RunRegressionCheckerCliResult> {
  const outputText = await renderBaselineReport({
    sessionId: context.sessionContext.sessionId,
    sessionStorageKey: context.storageResult.sessionStorageKey,
    sessionIdSource: context.sessionContext.sessionIdSource,
    createdAt,
    checks: context.runResults,
    readRawArtefact: options.readRawArtefact ?? readRawArtefactFromDisk,
  });

  // Write baseline report to file
  await persistBaselineReport(
    context.storageResult.baselineDirectory,
    outputText,
    options.writeFile ?? writeFileToDisk
  );

  // Determine exit code based on failing checks
  const checksFailing = context.runResults.filter((check) => check.status !== 'passing').length;
  const exitCode = checksFailing > 0 ? REGRESSION_FOUND_EXIT_CODE : 0;

  return {
    exitCode,
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

  // Extract exit codes from current results for display
  const currentResultsById = new Map(context.runResults.map((r) => [r.id, r]));

  const outputText = renderComparisonReport({
    sessionId: context.sessionContext.sessionId,
    sessionStorageKey: context.storageResult.sessionStorageKey,
    sessionIdSource: context.sessionContext.sessionIdSource,
    baselineTimestamp: baselineManifest.createdAt,
    currentTimestamp: options.createdAt,
    comparison,
    currentResultsById,
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
  const mirrorCommandOutput = shouldMirrorCommandOutput();

  return runChecksWithBoundedScheduler({
    checks: options.config.checks,
    maxWorkers: options.config.parallel.enabled ? options.config.parallel.maxWorkers : 1,
    getPlannedRawArtefactPath: (check) =>
      path.join(options.rawArtefactDirectory, 'checks', check.id, getRawFileName(check.tool)),
    runCheck: async (check) => {
      const startedAt = Date.now();
      logInfo(`regression-checker: start ${check.id} (${check.tool})`);
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
          timeoutMs: check.timeoutMs,
          streamOutput: mirrorCommandOutput,
        });
        await persistCapturedArtefact({
          tool: check.tool,
          rawArtefactPath,
          commandOutput,
        });

        logInfo(
          `regression-checker: pass ${check.id} (${check.tool}) in ${String(Date.now() - startedAt)}ms`
        );

        return {
          id: check.id,
          tool: check.tool,
          rawArtefactPath,
          status: 'passing',
          exitCode: 0,
        };
      } catch (error) {
        if (error instanceof CommandExecutionError) {
          await persistCapturedArtefact({
            tool: check.tool,
            rawArtefactPath,
            commandOutput: {
              stdout: error.diagnostics.stdout,
              stderr: error.diagnostics.stderr,
            },
          });

          if (error.diagnostics.exitCode !== null) {
            logInfo(
              `regression-checker: fail ${check.id} (${check.tool}) exit ${String(error.diagnostics.exitCode)} in ${String(Date.now() - startedAt)}ms`
            );

            return {
              id: check.id,
              tool: check.tool,
              rawArtefactPath,
              status: 'failing',
              exitCode: error.diagnostics.exitCode,
            };
          }

          logError(
            `regression-checker: error ${check.id} (${check.tool}) in ${String(Date.now() - startedAt)}ms: ${error.message}`
          );

          return {
            id: check.id,
            tool: check.tool,
            rawArtefactPath,
            status: 'execution-error',
            exitCode: null,
          };
        }

        throw error;
      }
    },
  });
}

/**
 * Determines whether child command output should be mirrored live.
 *
 * @returns {boolean} True when output mirroring is enabled via environment flag.
 */
function shouldMirrorCommandOutput(): boolean {
  const flag = process.env.REGRESSION_CHECKER_STREAM_OUTPUT;
  if (flag === undefined) {
    return false;
  }

  const canonicalFlag = flag.trim().toLowerCase();
  return canonicalFlag === '1' || canonicalFlag === 'true' || canonicalFlag === 'yes';
}

/**
 * Persists tool-specific command output to a raw artefact file.
 * For eslint and vitest, the tool writes its own JSON output via CLI flags,
 * but on failure the tool may not write anything, so we fallback to captured output.
 * For tsc and playwright, we always write the captured output.
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
