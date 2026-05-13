import path from 'node:path';
import { promises as fs } from 'node:fs';

import {
  compareRegressionChecks,
  deriveSummaryFromArtefact,
  type ComparisonCheckResult,
  type ComparisonResult,
  type DerivedSummary,
  type EslintFinding,
  type TestOutcome,
  type TscDiagnostic,
} from '../compare/index.js';
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
import { CommandExecutionError, logError, logInfo, runCommand } from '../../lib/process.js';

type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';

/**
 * Converts camelCase field names to Title Case for display.
 *
 * @param {string} name - The camelCase field name to convert.
 * @returns {string} The Title Case formatted name.
 */
function formatFieldName(name: string): string {
  // Handle special cases for acronyms
  const specialCases: Record<string, string> = {
    sessionId: 'Session ID',
    sessionStorageKey: 'Session Storage Key',
    sessionIdSource: 'Session ID Source',
    baselineCreatedThisRun: 'Baseline Created This Run',
    baselineTimestamp: 'Baseline Timestamp',
    currentTimestamp: 'Current Timestamp',
    overallStatus: 'Overall Status',
    totalChecks: 'Total Checks',
    checksPassing: 'Checks Passing',
    checksFailing: 'Checks Failing',
    regressionsCount: 'Regressions Count',
    newFailuresCount: 'New Failures Count',
    fixesCount: 'Fixes Count',
    toolSummary: 'Tool Summary',
    mode: 'Mode',
  };

  if (name in specialCases) {
    return specialCases[name as keyof typeof specialCases];
  }

  // Default: convert camelCase to Title Case
  return name.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
}

/**
 * Renders a per-command summary section showing each check's status.
 *
 * @param {Array<{ id: string; tool: RegressionTool; status: string }>} checks - The check results to render.
 * @returns {string} Formatted per-command summary text.
 */
function renderPerCommandSummary(
  checks: Array<{ id: string; tool: RegressionTool; status: string }>
): string {
  const lines: string[] = ['--- PER-COMMAND SUMMARY ---'];
  for (const check of checks) {
    lines.push(`${check.id}: ${check.status}`);
  }
  return lines.join('\n');
}

/**
 * Renders a list of failed checks for baseline mode with rich failure details.
 *
 * @param {ScheduledCheckResult[]} checks - The check results to filter and render.
 * @param {(rawArtefactPath: string) => Promise<unknown>} readRawArtefact - Async function to read raw artefacts.
 * @returns {Promise<string>} Formatted string listing failed checks with details.
 */
async function renderFailedChecksListBaseline(
  checks: ScheduledCheckResult[],
  readRawArtefact: (rawArtefactPath: string) => Promise<unknown>
): Promise<string> {
  const failedChecks = checks.filter((check) => check.status !== 'passing');
  if (failedChecks.length === 0) {
    return '';
  }

  const lines: string[] = ['--- FAILED CHECKS ---'];
  let index = 1;
  for (const check of failedChecks) {
    lines.push(`${index}. ${check.id} (${check.tool})`);
    lines.push(`   Status: ${check.status}`);
    lines.push(`   Exit Code: ${check.exitCode ?? 'N/A'}`);

    // Add rich failure details from raw artefact
    const richDetails = await renderRichFailureDetails(check, readRawArtefact);
    if (richDetails) {
      lines.push(richDetails);
    }

    lines.push('');
    index++;
  }
  return lines.join('\n');
}

const MAX_FAILURE_DETAILS = 5;
// Fingerprint format: "ruleId|filePath|line|column|message"
const FP_RULE_ID = 0;
const FP_FILE_PATH = 1;
const FP_LINE = 2;
const FP_COLUMN = 3;
const FP_MESSAGE = 4;

/**
 * Safely extracts a pipe-delimited fingerprint part by index.
 *
 * @param {string} fingerprint - The fingerprint string.
 * @param {number} index - Zero-based part index.
 * @param {string} fallback - Fallback value when missing.
 * @returns {string} The extracted part or fallback.
 */
function extractPart(fingerprint: string, index: number, fallback = 'unknown'): string {
  return fingerprint.split('|')[index] ?? fallback;
}

/**
 * Renders rich failure details from a check's raw artefact.
 *
 * @param {ScheduledCheckResult} check - The failing check result.
 * @param {(rawArtefactPath: string) => Promise<unknown>} readRawArtefact - Async function to read raw artefact.
 * @returns {Promise<string>} Formatted details string, or empty string if no details available.
 */
async function renderRichFailureDetails(
  check: ScheduledCheckResult,
  readRawArtefact: (rawArtefactPath: string) => Promise<unknown>
): Promise<string> {
  try {
    const rawArtefact = await readRawArtefact(check.rawArtefactPath);
    const summary = deriveSummaryFromArtefact(check.tool, rawArtefact);

    return renderSummaryDetails(summary);
  } catch {
    // If we can't read or parse the artefact, just return empty string
    return '';
  }
}

/**
 * Renders failure details from a derived summary.
 *
 * @param {DerivedSummary} summary - The derived summary object.
 * @returns {string} Formatted details string.
 */
function renderSummaryDetails(summary: DerivedSummary): string {
  const detailsLines: string[] = [];

  switch (summary.kind) {
    case 'eslint':
      renderEslintDetails(summary, detailsLines);
      break;
    case 'vitest':
    case 'playwright':
      renderTestDetails(summary, detailsLines);
      break;
    case 'tsc':
      renderTscDetails(summary, detailsLines);
      break;
  }

  return detailsLines.length > 0 ? detailsLines.join('\n') : '';
}

/**
 * Renders ESLint failure details.
 *
 * @param {DerivedSummary} summary - The ESLint summary.
 * @param {string[]} detailsLines - Array to append details to.
 */
function renderEslintDetails(summary: DerivedSummary, detailsLines: string[]): void {
  const esSummary = summary as DerivedSummary & {
    kind: 'eslint';
    findings: EslintFinding[];
    counts: { errors: number; warnings: number };
  };
  if (esSummary.counts.errors === 0 && esSummary.counts.warnings === 0) {
    return;
  }
  detailsLines.push(
    `   Errors: ${esSummary.counts.errors}, Warnings: ${esSummary.counts.warnings}`
  );
  renderEslintFindings(esSummary.findings, detailsLines);
}

/**
 * Renders ESLint findings list.
 *
 * @param {Array<{ fingerprint: string; severity: 'warning' | 'error' }>} findings - The ESLint findings to render.
 * @param {string[]} detailsLines - Array to append details to.
 */
function renderEslintFindings(
  findings: Array<{ fingerprint: string; severity: 'warning' | 'error' }>,
  detailsLines: string[]
): void {
  if (findings.length === 0) {
    return;
  }
  detailsLines.push('   Issues:');
  const count = Math.min(findings.length, MAX_FAILURE_DETAILS);
  for (let i = 0; i < count; i++) {
    const finding = findings[i];
    const ruleId = extractPart(finding.fingerprint, 0);
    const filePath = extractPart(finding.fingerprint, 1);
    const line = extractPart(finding.fingerprint, 2);
    detailsLines.push(`   - ${ruleId} at ${filePath}:${line} (${finding.severity})`);
  }
  if (findings.length > MAX_FAILURE_DETAILS) {
    detailsLines.push(`   ... and ${findings.length - MAX_FAILURE_DETAILS} more issues`);
  }
}

/**
 * Renders test failure details.
 *
 * @param {DerivedSummary} summary - The test summary.
 * @param {string[]} detailsLines - Array to append details to.
 */
function renderTestDetails(summary: DerivedSummary, detailsLines: string[]): void {
  const testSummary = summary as DerivedSummary & {
    kind: 'vitest' | 'playwright';
    tests: TestOutcome[];
    counts: { failed: number; passed: number; skipped: number };
  };
  if (testSummary.counts.failed === 0) {
    return;
  }
  detailsLines.push(
    `   Failed: ${testSummary.counts.failed}, Passed: ${testSummary.counts.passed}, Skipped: ${testSummary.counts.skipped}`
  );
  if (testSummary.tests.length === 0) {
    return;
  }
  const failedTests = testSummary.tests.filter((t) => t.status === 'failed');
  if (failedTests.length === 0) {
    return;
  }
  detailsLines.push('   Failed Tests:');
  const count = Math.min(failedTests.length, MAX_FAILURE_DETAILS);
  for (let i = 0; i < count; i++) {
    const test = failedTests[i];
    const parts = test.fingerprint.split('|');
    const LAST_INDEX = -1;
    const testName = parts.at(LAST_INDEX) ?? test.fingerprint;
    detailsLines.push(`   - ${testName}`);
  }
  if (failedTests.length > MAX_FAILURE_DETAILS) {
    detailsLines.push(`   ... and ${failedTests.length - MAX_FAILURE_DETAILS} more failed tests`);
  }
}

/**
 * Renders TypeScript diagnostic details.
 *
 * @param {DerivedSummary} summary - The TSC summary.
 * @param {string[]} detailsLines - Array to append details to.
 */
function renderTscDetails(summary: DerivedSummary, detailsLines: string[]): void {
  const tscSummary = summary as DerivedSummary & {
    kind: 'tsc';
    diagnostics: TscDiagnostic[];
    counts: { diagnostics: number };
  };
  if (tscSummary.counts.diagnostics === 0) {
    return;
  }
  detailsLines.push(`   Diagnostics: ${tscSummary.counts.diagnostics}`);
  renderTscDiagnostics(tscSummary.diagnostics, detailsLines);
}

/**
 * Renders TypeScript diagnostics list.
 *
 * @param {Array<{ fingerprint: string }>} diagnostics - The TSC diagnostics to render.
 * @param {string[]} detailsLines - Array to append details to.
 */
function renderTscDiagnostics(
  diagnostics: Array<{ fingerprint: string }>,
  detailsLines: string[]
): void {
  if (diagnostics.length === 0) {
    return;
  }
  detailsLines.push('   Errors:');
  const count = Math.min(diagnostics.length, MAX_FAILURE_DETAILS);
  for (let i = 0; i < count; i++) {
    const diagnostic = diagnostics[i];
    detailsLines.push(
      `   - ${extractPart(diagnostic.fingerprint, FP_RULE_ID, 'unknown')} at ${extractPart(
        diagnostic.fingerprint,
        FP_FILE_PATH,
        'unknown'
      )}:${extractPart(diagnostic.fingerprint, FP_LINE, '0')}:${extractPart(
        diagnostic.fingerprint,
        FP_COLUMN,
        '0'
      )} - ${extractPart(diagnostic.fingerprint, FP_MESSAGE, '')}`
    );
  }
  if (diagnostics.length > MAX_FAILURE_DETAILS) {
    detailsLines.push(`   ... and ${diagnostics.length - MAX_FAILURE_DETAILS} more diagnostics`);
  }
}

/**
 * Renders a list of failed checks for compare mode with regression and fix details.
 *
 * @param {ComparisonCheckResult[]} checks - The comparison check results to filter and render.
 * @param {Map<string, ScheduledCheckResult>} currentResultsById - Map of check IDs to current results for exit code lookup.
 * @returns {string} Formatted string listing failed checks with regression/fix details.
 */
function renderFailedChecksListCompare(
  checks: ComparisonCheckResult[],
  currentResultsById: Map<string, ScheduledCheckResult>
): string {
  const failedChecks = checks.filter((check) => check.status !== 'passing');
  if (failedChecks.length === 0) {
    return '';
  }

  const lines: string[] = ['--- FAILED CHECKS ---'];
  let index = 1;
  for (const check of failedChecks) {
    renderFailedCheckCompare(check, currentResultsById, lines, index);
    lines.push('');
    index++;
  }
  return lines.join('\n');
}

/**
 * Renders a single failed check for compare mode.
 *
 * @param {ComparisonCheckResult} check - The comparison check result.
 * @param {Map<string, ScheduledCheckResult>} currentResultsById - Map of check IDs to current results.
 * @param {string[]} lines - Array to append details to.
 * @param {number} index - The check index number.
 */
function renderFailedCheckCompare(
  check: ComparisonCheckResult,
  currentResultsById: Map<string, ScheduledCheckResult>,
  lines: string[],
  index: number
): void {
  const currentResult = currentResultsById.get(check.id);
  lines.push(`${index}. ${check.id} (${check.tool})`);
  lines.push(`   Status: ${check.status}`);
  lines.push(`   Exit Code: ${currentResult?.exitCode ?? 'N/A'}`);

  renderRegressionList('Regressions', check.regressions, lines);
  renderRegressionList('New Failures', check.newFailures, lines);
  renderRegressionList('Fixes', check.fixes, lines);
}

/**
 * Renders a list of regression/new failure/fix items.
 *
 * @param {string} label - The label for the list (Regressions, New Failures, Fixes).
 * @param {string[]} items - The items to render.
 * @param {string[]} lines - Array to append details to.
 */
function renderRegressionList(label: string, items: string[], lines: string[]): void {
  if (items.length === 0) {
    return;
  }
  lines.push(`   ${label}: ${items.length}`);
  for (const item of items) {
    lines.push(`   - ${item}`);
  }
}
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

const REGRESSION_HEADER_START = '=== REGRESSION HEADER START ===';
const REGRESSION_HEADER_END = '=== REGRESSION HEADER END ===';
const REGRESSION_CONFIG_PATH = '.ts-regression-checker/regression.config.json';
const INVALID_CONFIG_EXIT_CODE = 2;
const REGRESSION_FOUND_EXIT_CODE = 1;
const JSON_INDENT_SPACES = 2;
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
 * Renders the baseline report text with deterministic header order.
 *
 * @param {{ sessionId: string; sessionStorageKey: string; sessionIdSource: SessionIdSource; createdAt: string; checks: ScheduledCheckResult[]; }} options
 * Baseline report rendering options.
 * @param {string} options.sessionId - Logical session identifier.
 * @param {string} options.sessionStorageKey - Filesystem-safe session storage key.
 * @param {SessionIdSource} options.sessionIdSource - Session-ID source label.
 * @param {string} options.createdAt - Current run ISO timestamp.
 * @param {ScheduledCheckResult[]} options.checks - Ordered check outcomes.
 * @param {(rawArtefactPath: string) => Promise<unknown>} options.readRawArtefact - Async function to read raw artefacts for rich failure details.
 * @returns {Promise<string>} Human-readable baseline report text.
 */
export async function renderBaselineReport(options: {
  sessionId: string;
  sessionStorageKey: string;
  sessionIdSource: SessionIdSource;
  createdAt: string;
  checks: ScheduledCheckResult[];
  readRawArtefact: (rawArtefactPath: string) => Promise<unknown>;
}): Promise<string> {
  const checksPassing = options.checks.filter((check) => check.status === 'passing').length;
  const checksFailing = options.checks.length - checksPassing;
  const headerLines = [
    REGRESSION_HEADER_START,
    `${formatFieldName('sessionId')}: ${options.sessionId}`,
    `${formatFieldName('sessionStorageKey')}: ${options.sessionStorageKey}`,
    `${formatFieldName('sessionIdSource')}: ${options.sessionIdSource}`,
    `${formatFieldName('mode')}: baseline`,
    `${formatFieldName('baselineCreatedThisRun')}: true`,
    `${formatFieldName('baselineTimestamp')}: N/A`,
    `${formatFieldName('currentTimestamp')}: ${options.createdAt}`,
    `${formatFieldName('overallStatus')}: ${checksFailing > 0 ? 'FAILING' : 'GREEN'}`,
    `${formatFieldName('totalChecks')}: ${String(options.checks.length)}`,
    `${formatFieldName('checksPassing')}: ${String(checksPassing)}`,
    `${formatFieldName('checksFailing')}: ${String(checksFailing)}`,
    `${formatFieldName('regressionsCount')}: 0`,
    `${formatFieldName('newFailuresCount')}: 0`,
    `${formatFieldName('fixesCount')}: 0`,
    `${formatFieldName('toolSummary')}: ${renderToolSummary(options.checks.map((check) => check.tool))}`,
    REGRESSION_HEADER_END,
  ];

  const bodyParts: string[] = [];

  // Per-command summary
  bodyParts.push(renderPerCommandSummary(options.checks));

  // Failed checks list with rich details
  const failedChecksOutput = await renderFailedChecksListBaseline(
    options.checks,
    options.readRawArtefact
  );
  if (failedChecksOutput) {
    bodyParts.push(failedChecksOutput);
  }

  return [...headerLines, '', ...bodyParts].join('\n');
}

/**
 * Renders per-command summary for compare mode with regression/new failure/fix counts.
 *
 * @param {ComparisonCheckResult[]} checks - The comparison check results to render.
 * @returns {string} Formatted per-command summary text.
 */
function renderPerCommandSummaryCompare(checks: ComparisonCheckResult[]): string {
  const lines: string[] = ['--- PER-COMMAND SUMMARY ---'];
  for (const check of checks) {
    lines.push(renderPerCheckSummaryCompare(check));
  }
  return lines.join('\n');
}

/**
 * Renders a single check summary for compare mode.
 *
 * @param {ComparisonCheckResult} check - The comparison check result.
 * @returns {string} Formatted check summary line.
 */
function renderPerCheckSummaryCompare(check: ComparisonCheckResult): string {
  const parts: string[] = [check.id];

  // Add counts in parentheses for failing checks
  if (check.status !== 'passing') {
    const counts: string[] = buildCheckCounts(check);
    if (counts.length > 0) {
      parts.push(`(${counts.join(', ')})`);
    }
  }

  return `${parts.join(' ')}: ${check.status}`;
}

/**
 * Builds count strings for a check's regressions, new failures, and fixes.
 *
 * @param {ComparisonCheckResult} check - The comparison check result.
 * @returns {string[]} Array of count strings.
 */
function buildCheckCounts(check: ComparisonCheckResult): string[] {
  const counts: string[] = [];
  addCount(counts, check.regressions.length, 'regression');
  addCount(counts, check.newFailures.length, 'new failure');
  addCount(counts, check.fixes.length, 'fix', 'es');
  return counts;
}

/**
 * Adds a count string to an array if the count is greater than 0.
 *
 * @param {string[]} counts - Array to append to.
 * @param {number} value - The count value.
 * @param {string} singular - The singular form of the label.
 * @param {string} plural - Optional plural suffix (defaults to adding 's').
 */
function addCount(counts: string[], value: number, singular: string, plural?: string): void {
  if (value > 0) {
    const suffix = value !== 1 ? (plural ?? `${singular}s`) : singular;
    counts.push(`${value} ${suffix}`);
  }
}

/**
 * Renders the compare report text with deterministic header and per-check sections.
 *
 * @param {{ sessionId: string; sessionStorageKey: string; sessionIdSource: SessionIdSource; baselineTimestamp: string; currentTimestamp: string; comparison: ComparisonResult; currentResultsById?: Map<string, ScheduledCheckResult>; }} options
 * Compare report rendering options.
 * @param {string} options.sessionId - Logical session identifier.
 * @param {string} options.sessionStorageKey - Filesystem-safe session storage key.
 * @param {SessionIdSource} options.sessionIdSource - Session-ID source label.
 * @param {string} options.baselineTimestamp - Baseline run timestamp.
 * @param {string} options.currentTimestamp - Current run timestamp.
 * @param {ComparisonResult} options.comparison - Structured comparison model.
 * @param {Map<string, ScheduledCheckResult>} [options.currentResultsById] - Map of check IDs to current results for exit codes.
 * @returns {string} Human-readable compare report text.
 */
export function renderComparisonReport(options: {
  sessionId: string;
  sessionStorageKey: string;
  sessionIdSource: SessionIdSource;
  baselineTimestamp: string;
  currentTimestamp: string;
  comparison: ComparisonResult;
  currentResultsById?: Map<string, ScheduledCheckResult>;
}): string {
  const currentResultsById = options.currentResultsById ?? new Map();
  const headerLines = [
    REGRESSION_HEADER_START,
    `${formatFieldName('sessionId')}: ${options.sessionId}`,
    `${formatFieldName('sessionStorageKey')}: ${options.sessionStorageKey}`,
    `${formatFieldName('sessionIdSource')}: ${options.sessionIdSource}`,
    `${formatFieldName('mode')}: compare`,
    `${formatFieldName('baselineCreatedThisRun')}: false`,
    `${formatFieldName('baselineTimestamp')}: ${options.baselineTimestamp}`,
    `${formatFieldName('currentTimestamp')}: ${options.currentTimestamp}`,
    `${formatFieldName('overallStatus')}: ${options.comparison.overallStatus}`,
    `${formatFieldName('totalChecks')}: ${String(options.comparison.checks.length)}`,
    `${formatFieldName('checksPassing')}: ${String(options.comparison.totals.checksPassing)}`,
    `${formatFieldName('checksFailing')}: ${String(options.comparison.totals.checksFailing)}`,
    `${formatFieldName('regressionsCount')}: ${String(options.comparison.totals.regressionsCount)}`,
    `${formatFieldName('newFailuresCount')}: ${String(options.comparison.totals.newFailuresCount)}`,
    `${formatFieldName('fixesCount')}: ${String(options.comparison.totals.fixesCount)}`,
    `${formatFieldName('toolSummary')}: ${renderToolSummary(options.comparison.checks.map((check) => check.tool))}`,
    REGRESSION_HEADER_END,
  ];

  const bodyParts: string[] = [];

  // Per-command summary with regression/fix info
  bodyParts.push(renderPerCommandSummaryCompare(options.comparison.checks));

  // Failed checks list with regression details
  const failedChecksOutput = renderFailedChecksListCompare(
    options.comparison.checks,
    currentResultsById
  );
  if (failedChecksOutput) {
    bodyParts.push(failedChecksOutput);
  }

  return [...headerLines, '', ...bodyParts].join('\n');
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
export async function persistCapturedArtefact(options: {
  tool: RegressionTool;
  rawArtefactPath: string;
  commandOutput: { stdout: string; stderr: string };
}): Promise<void> {
  // For eslint and vitest, check if the tool already wrote its own file
  // (they use --output-file or --outputFile flags). If the file exists and
  // has content, assume the tool wrote it successfully. Otherwise, fall back
  // to writing the captured output (which includes error messages for failures).
  if (options.tool === 'eslint' || options.tool === 'vitest') {
    try {
      const existingContent = await fs.readFile(options.rawArtefactPath, 'utf8');
      if (existingContent.trim().length > 0) {
        // Tool already wrote valid output, don't overwrite
        return;
      }
    } catch {
      // File doesn't exist or is empty, fall through to write captured output
    }
  }

  // For all tools (or when eslint/vitest didn't write their own output),
  // write the captured output. Combine stdout and stderr, with stderr first
  // since error messages are typically in stderr.
  const stdoutContent = options.commandOutput.stdout.trim();
  const stderrContent = options.commandOutput.stderr.trim();
  const content = [stderrContent, stdoutContent].filter((s) => s.length > 0).join('\n');

  await writeFileToDisk(options.rawArtefactPath, content);
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
