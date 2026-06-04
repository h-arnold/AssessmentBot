import {
  deriveSummaryFromArtefact,
  type ComparisonCheckResult,
  type ComparisonResult,
  type DerivedSummary,
  type EslintFinding,
  type TestOutcome,
  type TscDiagnostic,
} from '../compare/index.js';
import type { ScheduledCheckResult } from '../runners/index.js';
import type { SessionIdSource } from './session-resolution.js';

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
    // eslint-disable-next-line security/detect-object-injection
    return specialCases[name];
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
    lines.push(
      `${index}. ${check.id} (${check.tool})`,
      `   Status: ${check.status}`,
      `   Exit Code: ${check.exitCode ?? 'N/A'}`
    );

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
  // eslint-disable-next-line security/detect-object-injection
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
    // eslint-disable-next-line security/detect-object-injection
    const finding = findings[i];
    const ruleId = extractPart(finding.fingerprint, 0);
    const filePath = extractPart(finding.fingerprint, 1);
    const line = extractPart(finding.fingerprint, FP_LINE);
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
    // eslint-disable-next-line security/detect-object-injection
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
    // eslint-disable-next-line security/detect-object-injection
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
  lines.push(
    `${index}. ${check.id} (${check.tool})`,
    `   Status: ${check.status}`,
    `   Exit Code: ${currentResult?.exitCode ?? 'N/A'}`
  );

  const currentFailures = extractCurrentFailures(check.currentSummary);
  if (currentFailures.length > 0) {
    lines.push(`   Current Failures: ${currentFailures.length}`);
    for (const failure of currentFailures) {
      lines.push(`   - ${failure}`);
    }
  }

  renderRegressionList('Regressions', check.regressions, lines);
  renderRegressionList('New Failures', check.newFailures, lines);
  renderRegressionList('Fixes', check.fixes, lines);
}

/**
 * Extracts fingerprint strings of all currently-failing items from a derived summary.
 *
 * @param {DerivedSummary} summary - The derived summary for the current run.
 * @returns {string[]} Fingerprints of items that are currently failing.
 */
export function extractCurrentFailures(summary: DerivedSummary): string[] {
  if (summary.kind === 'eslint') {
    return extractEslintCurrentFailures(summary);
  }
  if (summary.kind === 'vitest') {
    return extractTestCurrentFailures(summary);
  }
  if (summary.kind === 'playwright') {
    return extractTestCurrentFailures(summary);
  }
  if (summary.kind === 'tsc') {
    return extractTscCurrentFailures(summary);
  }
  return [];
}

/**
 * Extracts eslint finding fingerprints from a derived summary.
 *
 * @param {DerivedSummary} summary - The eslint derived summary.
 * @returns {string[]} Finding fingerprint strings.
 */
function extractEslintCurrentFailures(summary: DerivedSummary): string[] {
  const eslintSummary = summary as unknown as {
    findings: Array<{ fingerprint: string }>;
  };
  if (!Array.isArray(eslintSummary.findings)) {
    return [];
  }
  return eslintSummary.findings.map((finding) => finding.fingerprint);
}

/**
 * Extracts failed test fingerprints from a vitest or playwright derived summary.
 *
 * @param {DerivedSummary} summary - The test derived summary.
 * @returns {string[]} Failed test fingerprint strings.
 */
function extractTestCurrentFailures(summary: DerivedSummary): string[] {
  const testSummary = summary as unknown as {
    tests: Array<{ status: string; fingerprint: string }>;
  };
  if (!Array.isArray(testSummary.tests)) {
    return [];
  }
  return testSummary.tests
    .filter((test) => test.status === 'failed')
    .map((test) => test.fingerprint);
}

/**
 * Extracts tsc diagnostic fingerprints from a derived summary.
 *
 * @param {DerivedSummary} summary - The tsc derived summary.
 * @returns {string[]} Diagnostic fingerprint strings.
 */
function extractTscCurrentFailures(summary: DerivedSummary): string[] {
  const tscSummary = summary as unknown as {
    diagnostics: Array<{ fingerprint: string }>;
  };
  if (!Array.isArray(tscSummary.diagnostics)) {
    return [];
  }
  return tscSummary.diagnostics.map((diagnostic) => diagnostic.fingerprint);
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

  // Include delta counts for both failing checks and fix-only passing checks.
  const counts: string[] = buildCheckCounts(check);
  if (counts.length > 0) {
    parts.push(`(${counts.join(', ')})`);
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
  addCount(counts, check.fixes.length, 'fix', 'fixes');
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
    const suffix = value === 1 ? singular : (plural ?? `${singular}s`);
    counts.push(`${value} ${suffix}`);
  }
}

const REGRESSION_HEADER_START = '=== REGRESSION HEADER START ===';
const REGRESSION_HEADER_END = '=== REGRESSION HEADER END ===';
const REGRESSION_WARNING =
  '*** REGRESSION CREATED! THIS IS AN ISSUE THAT DID NOT EXIST PRIOR TO THIS RUN.\n' +
  '*** YOU CREATED THIS ISSUE AND MUST ADDRESS IT PROPERLY FOR THIS TASK TO BE SUCCESSFUL.\n' +
  '*** FAILURE TO ADDRESS THE REGRESSION WILL RESULT IN THE TASK FAILING.';

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

  // Prepend regression warning when regressions are detected (before body so agents using head see it)
  const hasRegressions = options.comparison.totals.regressionsCount > 0;
  if (hasRegressions) {
    bodyParts.push(REGRESSION_WARNING, '');
  }

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

  // Append regression warning at the end so agents using tail also see it
  if (hasRegressions) {
    bodyParts.push('', REGRESSION_WARNING);
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
