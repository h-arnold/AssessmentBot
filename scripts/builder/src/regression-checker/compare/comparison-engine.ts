import { deriveSummary } from './summary-derivation.js';

export type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';

export type { ComparisonCheckResult, ComparisonResult, DerivedSummary };

export type { EslintFinding, TestOutcome, TscDiagnostic };

type StructuredExecutionFailure = {
  code: string;
  message: string;
};

export type CheckRun = {
  id: string;
  tool: RegressionTool;
  status: 'passing' | 'failing' | 'execution-error';
  rawArtefact: unknown;
  rawArtefactPath: string;
  error: StructuredExecutionFailure | null;
};

type CheckPair = {
  baseline: CheckRun;
  current: CheckRun;
};

type BaselineCompatibility =
  | { compatible: true }
  | { compatible: false; reason: StructuredExecutionFailure };

type ComparisonCheckResult = {
  id: string;
  tool: RegressionTool;
  status: 'passing' | 'failing' | 'execution-error' | 'baseline-incompatible';
  baselineSummary: DerivedSummary;
  currentSummary: DerivedSummary;
  regressions: string[];
  newFailures: string[];
  fixes: string[];
  executionError: StructuredExecutionFailure | null;
  baselineIncompatibility: StructuredExecutionFailure | null;
};

type CompareRegressionChecksOptions = {
  checksInConfigOrder: CheckPair[];
  baselineCompatibility: BaselineCompatibility;
};

type ComparisonResult = {
  overallStatus: 'GREEN' | 'FAILING' | 'BASELINE-INCOMPATIBLE';
  baselineCompatibility: BaselineCompatibility;
  checks: ComparisonCheckResult[];
  totals: {
    regressionsCount: number;
    newFailuresCount: number;
    fixesCount: number;
    checksPassing: number;
    checksFailing: number;
  };
};

type EslintFinding = {
  fingerprint: string;
  severity: 'warning' | 'error';
};

type TestOutcome = {
  fingerprint: string;
  status: 'passed' | 'failed' | 'skipped';
};

type TscDiagnostic = {
  fingerprint: string;
};

type DerivedSummary =
  | {
      kind: 'eslint';
      findings: EslintFinding[];
      counts: { errors: number; warnings: number };
    }
  | {
      kind: 'vitest' | 'playwright';
      tests: TestOutcome[];
      counts: { total: number; passed: number; failed: number; skipped: number };
    }
  | {
      kind: 'tsc';
      diagnostics: TscDiagnostic[];
      counts: { diagnostics: number };
    };

/**
 * Derives per-tool summaries from raw artefacts and compares current results against the baseline.
 *
 * @param {CompareRegressionChecksOptions} options - Ordered baseline/current pairs plus compatibility state.
 * @returns {ComparisonResult} Deterministic comparison model for reporting and exit-code decisions.
 */
export function compareRegressionChecks(options: CompareRegressionChecksOptions): ComparisonResult {
  if (!options.baselineCompatibility.compatible) {
    return buildBaselineIncompatibleResult(options);
  }

  const checks = options.checksInConfigOrder.map((checkPair) => compareCheckPair(checkPair));
  const totals = calculateTotals(checks);

  return {
    overallStatus: totals.checksFailing > 0 ? 'FAILING' : 'GREEN',
    baselineCompatibility: options.baselineCompatibility,
    checks,
    totals,
  };
}

/**
 * Builds a baseline-incompatible comparison result when the baseline cannot be used.
 *
 * @param {CompareRegressionChecksOptions} options - The comparison options containing incompatible baseline.
 * @returns {ComparisonResult} Comparison result with baseline-incompatible status for all checks.
 * @throws {Error} If baseline is actually compatible.
 */
function buildBaselineIncompatibleResult(
  options: CompareRegressionChecksOptions
): ComparisonResult {
  if (options.baselineCompatibility.compatible) {
    throw new Error('Baseline incompatibility result requires an incompatible baseline state.');
  }
  const baselineIncompatibility = options.baselineCompatibility.reason;

  const checks = options.checksInConfigOrder.map((checkPair) => ({
    id: checkPair.current.id,
    tool: checkPair.current.tool,
    status: 'baseline-incompatible' as const,
    baselineSummary: deriveSummary(checkPair.baseline),
    currentSummary: deriveSummary(checkPair.current),
    regressions: [],
    newFailures: [],
    fixes: [],
    executionError: null,
    baselineIncompatibility,
  }));

  return {
    overallStatus: 'BASELINE-INCOMPATIBLE',
    baselineCompatibility: options.baselineCompatibility,
    checks,
    totals: calculateTotals(checks),
  };
}

/**
 * Compares a baseline and current check run pair to produce a comparison result.
 *
 * @param {CheckPair} checkPair - The baseline and current check runs to compare.
 * @returns {ComparisonCheckResult} The comparison result for this check pair.
 */
function compareCheckPair(checkPair: CheckPair): ComparisonCheckResult {
  const baselineSummary = deriveSummary(checkPair.baseline);
  const currentSummary = deriveSummary(checkPair.current);

  if (checkPair.current.status === 'execution-error') {
    const executionFingerprint = createExecutionErrorFingerprint(checkPair.current.error);

    return {
      id: checkPair.current.id,
      tool: checkPair.current.tool,
      status: 'execution-error',
      baselineSummary,
      currentSummary,
      regressions: [executionFingerprint],
      newFailures: [executionFingerprint],
      fixes: [],
      executionError: checkPair.current.error,
      baselineIncompatibility: null,
    };
  }

  const comparison = compareDerivedSummaries(
    checkPair.current.tool,
    baselineSummary,
    currentSummary
  );
  const hasFailureDelta = comparison.regressions.length > 0 || comparison.newFailures.length > 0;
  const status = checkPair.current.status === 'failing' || hasFailureDelta ? 'failing' : 'passing';

  return {
    id: checkPair.current.id,
    tool: checkPair.current.tool,
    status,
    baselineSummary,
    currentSummary,
    regressions: comparison.regressions,
    newFailures: comparison.newFailures,
    fixes: comparison.fixes,
    executionError: null,
    baselineIncompatibility: null,
  };
}

/**
 * Compares derived summaries using the appropriate tool-specific comparison function.
 *
 * @param {RegressionTool} tool - The regression tool type.
 * @param {DerivedSummary} baselineSummary - The baseline derived summary.
 * @param {DerivedSummary} currentSummary - The current derived summary.
 * @returns {{regressions: string[], newFailures: string[], fixes: string[]}} The comparison results.
 */
function compareDerivedSummaries(
  tool: RegressionTool,
  baselineSummary: DerivedSummary,
  currentSummary: DerivedSummary
): { regressions: string[]; newFailures: string[]; fixes: string[] } {
  switch (tool) {
    case 'eslint':
      return compareEslintSummaries(baselineSummary, currentSummary);
    case 'vitest':
    case 'playwright':
      return compareTestSummaries(baselineSummary, currentSummary);
    case 'tsc':
      return compareTscSummaries(baselineSummary, currentSummary);
    default:
      return assertNever(tool);
  }
}

/**
 * Compares ESLint summaries to find regressions, new failures, and fixes.
 *
 * @param {DerivedSummary} baselineSummary - The baseline ESLint summary.
 * @param {DerivedSummary} currentSummary - The current ESLint summary.
 * @returns {{regressions: string[], newFailures: string[], fixes: string[]}} The comparison results.
 */
function compareEslintSummaries(
  baselineSummary: DerivedSummary,
  currentSummary: DerivedSummary
): { regressions: string[]; newFailures: string[]; fixes: string[] } {
  assertSummaryKind(baselineSummary, 'eslint');
  assertSummaryKind(currentSummary, 'eslint');

  const baselineFingerprints = new Set(
    baselineSummary.findings.map((finding) => finding.fingerprint)
  );
  const currentFingerprints = currentSummary.findings.map((finding) => finding.fingerprint);
  const currentFingerprintSet = new Set(currentFingerprints);

  return {
    regressions: currentFingerprints.filter(
      (fingerprint) => !baselineFingerprints.has(fingerprint)
    ),
    newFailures: currentFingerprints.filter(
      (fingerprint) => !baselineFingerprints.has(fingerprint)
    ),
    fixes: baselineSummary.findings
      .map((finding) => finding.fingerprint)
      .filter((fingerprint) => !currentFingerprintSet.has(fingerprint)),
  };
}

/**
 * Compares test summaries to find regressions, new failures, and fixes.
 *
 * @param {DerivedSummary} baselineSummary - The baseline test summary.
 * @param {DerivedSummary} currentSummary - The current test summary.
 * @returns {{regressions: string[], newFailures: string[], fixes: string[]}} The comparison results.
 * @throws {Error} If summaries are not Vitest or Playwright.
 */
function compareTestSummaries(
  baselineSummary: DerivedSummary,
  currentSummary: DerivedSummary
): { regressions: string[]; newFailures: string[]; fixes: string[] } {
  if (
    (baselineSummary.kind !== 'vitest' && baselineSummary.kind !== 'playwright') ||
    (currentSummary.kind !== 'vitest' && currentSummary.kind !== 'playwright')
  ) {
    throw new Error('Test comparison requires Vitest or Playwright summaries.');
  }

  const baselineOutcomes = buildTestOutcomeMap(baselineSummary.tests);
  const currentOutcomes = buildTestOutcomeMap(currentSummary.tests);

  const { regressions, newFailures } = collectCurrentOutcomeDeltas(
    currentOutcomes,
    baselineOutcomes
  );
  const fixes = collectFixOutcomes(baselineOutcomes, currentOutcomes);

  return sortAndReturnResults(regressions, newFailures, fixes);
}

/**
 * Builds a map from test fingerprints to their statuses.
 *
 * @param {TestOutcome[]} tests - The test outcomes to map.
 * @returns {Map<string, TestOutcome['status']>} Map from fingerprint to status.
 */
function buildTestOutcomeMap(tests: TestOutcome[]): Map<string, TestOutcome['status']> {
  return new Map(tests.map((outcome) => [outcome.fingerprint, outcome.status]));
}

/**
 * Collects regressions and new failures from current outcomes compared to baseline.
 *
 * @param {Map<string, TestOutcome['status']>} currentOutcomes - Map of current test outcomes.
 * @param {Map<string, TestOutcome['status']>} baselineOutcomes - Map of baseline test outcomes.
 * @returns {{regressions: string[], newFailures: string[]}} Regressions and new failures.
 */
function collectCurrentOutcomeDeltas(
  currentOutcomes: Map<string, TestOutcome['status']>,
  baselineOutcomes: Map<string, TestOutcome['status']>
): { regressions: string[]; newFailures: string[] } {
  const regressions: string[] = [];
  const newFailures: string[] = [];

  for (const [fingerprint, currentStatus] of currentOutcomes) {
    const baselineStatus = baselineOutcomes.get(fingerprint);
    if (isRegressionTransition(baselineStatus, currentStatus)) {
      regressions.push(fingerprint);
    }
    if (isNewFailureTransition(baselineStatus, currentStatus)) {
      newFailures.push(fingerprint);
    }
  }

  return { regressions, newFailures };
}

/**
 * Collects fixes from baseline outcomes compared to current.
 *
 * @param {Map<string, TestOutcome['status']>} baselineOutcomes - Map of baseline test outcomes.
 * @param {Map<string, TestOutcome['status']>} currentOutcomes - Map of current test outcomes.
 * @returns {string[]} Fixed test fingerprints.
 */
function collectFixOutcomes(
  baselineOutcomes: Map<string, TestOutcome['status']>,
  currentOutcomes: Map<string, TestOutcome['status']>
): string[] {
  const fixes: string[] = [];

  for (const [fingerprint, baselineStatus] of baselineOutcomes) {
    const currentStatus = currentOutcomes.get(fingerprint);
    if (isFixTransition(baselineStatus, currentStatus)) {
      fixes.push(fingerprint);
    }
  }

  return fixes;
}

/**
 * Sorts and returns the comparison results.
 *
 * @param {string[]} regressions - The regression fingerprints.
 * @param {string[]} newFailures - The new failure fingerprints.
 * @param {string[]} fixes - The fix fingerprints.
 * @returns {{regressions: string[], newFailures: string[], fixes: string[]}} Sorted results.
 */
function sortAndReturnResults(
  regressions: string[],
  newFailures: string[],
  fixes: string[]
): { regressions: string[]; newFailures: string[]; fixes: string[] } {
  regressions.sort((left, right) => left.localeCompare(right));
  newFailures.sort((left, right) => left.localeCompare(right));
  fixes.sort((left, right) => left.localeCompare(right));

  return { regressions, newFailures, fixes };
}

/**
 * Compares TSC summaries to find regressions, new failures, and fixes.
 *
 * @param {DerivedSummary} baselineSummary - The baseline TSC summary.
 * @param {DerivedSummary} currentSummary - The current TSC summary.
 * @returns {{regressions: string[], newFailures: string[], fixes: string[]}} The comparison results.
 */
function compareTscSummaries(
  baselineSummary: DerivedSummary,
  currentSummary: DerivedSummary
): { regressions: string[]; newFailures: string[]; fixes: string[] } {
  assertSummaryKind(baselineSummary, 'tsc');
  assertSummaryKind(currentSummary, 'tsc');

  const baselineFingerprints = new Set(
    baselineSummary.diagnostics.map((diagnostic) => diagnostic.fingerprint)
  );
  const currentFingerprints = currentSummary.diagnostics.map(
    (diagnostic) => diagnostic.fingerprint
  );
  const currentFingerprintSet = new Set(currentFingerprints);

  return {
    regressions: currentFingerprints.filter(
      (fingerprint) => !baselineFingerprints.has(fingerprint)
    ),
    newFailures: currentFingerprints.filter(
      (fingerprint) => !baselineFingerprints.has(fingerprint)
    ),
    fixes: baselineSummary.diagnostics
      .map((diagnostic) => diagnostic.fingerprint)
      .filter((fingerprint) => !currentFingerprintSet.has(fingerprint)),
  };
}

/**
 * Determines if a test status transition represents a regression.
 *
 * @param {TestOutcome['status'] | undefined} baselineStatus - The baseline test status.
 * @param {TestOutcome['status']} currentStatus - The current test status.
 * @returns {boolean} True if this is a regression transition.
 */
function isRegressionTransition(
  baselineStatus: TestOutcome['status'] | undefined,
  currentStatus: TestOutcome['status']
): boolean {
  if (currentStatus === 'failed') {
    return baselineStatus !== 'failed';
  }

  if (currentStatus === 'skipped') {
    return baselineStatus !== 'skipped';
  }

  return false;
}

/**
 * Determines if a test status transition represents a new failure.
 *
 * @param {TestOutcome['status'] | undefined} baselineStatus - The baseline test status.
 * @param {TestOutcome['status']} currentStatus - The current test status.
 * @returns {boolean} True if this is a new failure transition.
 */
function isNewFailureTransition(
  baselineStatus: TestOutcome['status'] | undefined,
  currentStatus: TestOutcome['status']
): boolean {
  return currentStatus === 'failed' && baselineStatus !== 'failed';
}

/**
 * Determines if a test status transition represents a fix.
 *
 * @param {TestOutcome['status']} baselineStatus - The baseline test status.
 * @param {TestOutcome['status'] | undefined} currentStatus - The current test status.
 * @returns {boolean} True if this is a fix transition.
 */
function isFixTransition(
  baselineStatus: TestOutcome['status'],
  currentStatus: TestOutcome['status'] | undefined
): boolean {
  if (baselineStatus === 'failed') {
    return currentStatus !== 'failed';
  }

  if (baselineStatus === 'skipped') {
    return currentStatus === 'passed';
  }

  return false;
}

/**
 * Creates a fingerprint string for an execution error.
 *
 * @param {StructuredExecutionFailure | null} error - The execution error or null.
 * @returns {string} The execution error fingerprint.
 */
function createExecutionErrorFingerprint(error: StructuredExecutionFailure | null): string {
  if (error === null) {
    return 'execution-error|unknown|Unknown execution failure.';
  }

  return `execution-error|${error.code}|${error.message}`;
}

/**
 * Calculates aggregate totals from comparison check results.
 *
 * @param {ComparisonCheckResult[]} checks - The comparison check results.
 * @returns {ComparisonResult['totals']} The calculated totals.
 */
function calculateTotals(checks: ComparisonCheckResult[]): ComparisonResult['totals'] {
  return {
    regressionsCount: checks.reduce((total, check) => total + check.regressions.length, 0),
    newFailuresCount: checks.reduce((total, check) => total + check.newFailures.length, 0),
    fixesCount: checks.reduce((total, check) => total + check.fixes.length, 0),
    checksPassing: checks.filter((check) => check.status === 'passing').length,
    checksFailing: checks.filter((check) => check.status !== 'passing').length,
  };
}

/**
 * Asserts that a derived summary has the expected kind.
 *
 * @param {DerivedSummary} summary - The summary to check.
 * @param {DerivedSummary['kind']} expectedKind - The expected kind.
 * @returns {asserts summary is Extract<DerivedSummary, { kind: TKind }>} Type assertion.
 * @throws {Error} If the summary kind does not match.
 */
function assertSummaryKind<TKind extends DerivedSummary['kind']>(
  summary: DerivedSummary,
  expectedKind: TKind
): asserts summary is Extract<DerivedSummary, { kind: TKind }> {
  if (summary.kind !== expectedKind) {
    throw new Error(`Expected ${expectedKind} summary but received ${summary.kind}.`);
  }
}

/**
 * Throws an error for an unsupported regression tool value.
 *
 * @param {never} value - The unsupported value.
 * @returns {never} Never returns; always throws.
 * @throws {Error} Always throws for unsupported tool.
 */
function assertNever(value: never): never {
  throw new Error('Unsupported regression tool: ' + String(value));
}
