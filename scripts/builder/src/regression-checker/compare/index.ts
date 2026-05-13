type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';

type StructuredExecutionFailure = {
  code: string;
  message: string;
};

type CheckRun = {
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

const ESLINT_WARNING_SEVERITY = 1;
const ESLINT_ERROR_SEVERITY = 2;
const TSC_DIAGNOSTIC_PATTERN =
  /^(?<filePath>.+)\((?<line>\d+),(?<column>\d+)\): error TS(?<code>\d+): (?<message>.+)$/u;

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
    overallStatus: totals.regressionsCount > 0 ? 'FAILING' : 'GREEN',
    baselineCompatibility: options.baselineCompatibility,
    checks,
    totals,
  };
}

/**
 *
 * @param options
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
 *
 * @param checkPair
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
  const status =
    comparison.regressions.length === 0 &&
    comparison.newFailures.length === 0 &&
    comparison.fixes.length === 0
      ? 'passing'
      : 'failing';

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
 *
 * @param tool
 * @param baselineSummary
 * @param currentSummary
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
 *
 * @param baselineSummary
 * @param currentSummary
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

  return {
    regressions: currentFingerprints.filter(
      (fingerprint) => !baselineFingerprints.has(fingerprint)
    ),
    newFailures: currentFingerprints.filter(
      (fingerprint) => !baselineFingerprints.has(fingerprint)
    ),
    fixes: baselineSummary.findings
      .map((finding) => finding.fingerprint)
      .filter((fingerprint) => !new Set(currentFingerprints).has(fingerprint)),
  };
}

/**
 *
 * @param baselineSummary
 * @param currentSummary
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

  const baselineOutcomes = new Map(
    baselineSummary.tests.map((outcome) => [outcome.fingerprint, outcome.status])
  );
  const currentOutcomes = new Map(
    currentSummary.tests.map((outcome) => [outcome.fingerprint, outcome.status])
  );
  const regressions: string[] = [];
  const newFailures: string[] = [];
  const fixes: string[] = [];

  for (const [fingerprint, currentStatus] of currentOutcomes) {
    const baselineStatus = baselineOutcomes.get(fingerprint);
    if (isRegressionTransition(baselineStatus, currentStatus)) {
      regressions.push(fingerprint);
    }
    if (isNewFailureTransition(baselineStatus, currentStatus)) {
      newFailures.push(fingerprint);
    }
  }

  for (const [fingerprint, baselineStatus] of baselineOutcomes) {
    const currentStatus = currentOutcomes.get(fingerprint);
    if (isFixTransition(baselineStatus, currentStatus)) {
      fixes.push(fingerprint);
    }
  }

  regressions.sort();
  newFailures.sort();
  fixes.sort();

  return { regressions, newFailures, fixes };
}

/**
 *
 * @param baselineSummary
 * @param currentSummary
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
 *
 * @param baselineStatus
 * @param currentStatus
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
 *
 * @param baselineStatus
 * @param currentStatus
 */
function isNewFailureTransition(
  baselineStatus: TestOutcome['status'] | undefined,
  currentStatus: TestOutcome['status']
): boolean {
  return currentStatus === 'failed' && baselineStatus !== 'failed';
}

/**
 *
 * @param baselineStatus
 * @param currentStatus
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
 *
 * @param checkRun
 */
function deriveSummary(checkRun: CheckRun): DerivedSummary {
  switch (checkRun.tool) {
    case 'eslint':
      return deriveEslintSummary(checkRun.rawArtefact);
    case 'vitest':
      return deriveVitestSummary(checkRun.rawArtefact);
    case 'playwright':
      return derivePlaywrightSummary(checkRun.rawArtefact);
    case 'tsc':
      return deriveTscSummary(checkRun.rawArtefact);
    default:
      return assertNever(checkRun.tool);
  }
}

/**
 *
 * @param rawArtefact
 */
function deriveEslintSummary(rawArtefact: unknown): DerivedSummary {
  const entries = Array.isArray(rawArtefact) ? rawArtefact : [];
  const findings: EslintFinding[] = [];

  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.filePath !== 'string' || !Array.isArray(entry.messages)) {
      continue;
    }

    for (const message of entry.messages) {
      if (!isRecord(message)) {
        continue;
      }

      const ruleId = typeof message.ruleId === 'string' ? message.ruleId : 'unknown-rule';
      const detail =
        typeof message.message === 'string' ? message.message : 'Unknown ESLint message.';
      const line = typeof message.line === 'number' ? message.line : 0;
      const column = typeof message.column === 'number' ? message.column : 0;
      const severity = message.severity === ESLINT_ERROR_SEVERITY ? 'error' : 'warning';

      if (
        message.severity !== ESLINT_WARNING_SEVERITY &&
        message.severity !== ESLINT_ERROR_SEVERITY
      ) {
        continue;
      }

      findings.push({
        fingerprint: `${ruleId}|${entry.filePath}|${String(line)}|${String(column)}|${detail}`,
        severity,
      });
    }
  }

  findings.sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));

  return {
    kind: 'eslint',
    findings,
    counts: {
      errors: findings.filter((finding) => finding.severity === 'error').length,
      warnings: findings.filter((finding) => finding.severity === 'warning').length,
    },
  };
}

/**
 *
 * @param rawArtefact
 */
function deriveVitestSummary(rawArtefact: unknown): DerivedSummary {
  const tests: TestOutcome[] = [];
  const records =
    isRecord(rawArtefact) && Array.isArray(rawArtefact.testResults) ? rawArtefact.testResults : [];

  for (const record of records) {
    if (
      !isRecord(record) ||
      typeof record.name !== 'string' ||
      !Array.isArray(record.assertionResults)
    ) {
      continue;
    }

    for (const assertion of record.assertionResults) {
      if (!isRecord(assertion) || typeof assertion.title !== 'string') {
        continue;
      }

      const status = normaliseTestStatus(assertion.status);
      if (status === null) {
        continue;
      }

      const suite = Array.isArray(assertion.ancestorTitles)
        ? assertion.ancestorTitles
            .filter((title): title is string => typeof title === 'string')
            .join('|')
        : '';

      tests.push({
        fingerprint: `${record.name}|${suite}|${assertion.title}`,
        status,
      });
    }
  }

  return buildTestSummary('vitest', tests);
}

/**
 *
 * @param rawArtefact
 */
function derivePlaywrightSummary(rawArtefact: unknown): DerivedSummary {
  const tests: TestOutcome[] = [];

  if (isRecord(rawArtefact) && Array.isArray(rawArtefact.suites)) {
    for (const suite of rawArtefact.suites) {
      visitPlaywrightSuite(suite, '', '', tests);
    }
  }

  return buildTestSummary('playwright', tests);
}

/**
 *
 * @param suite
 * @param inheritedFilePath
 * @param parentTitle
 * @param tests
 */
function visitPlaywrightSuite(
  suite: unknown,
  inheritedFilePath: string,
  parentTitle: string,
  tests: TestOutcome[]
): void {
  if (!isRecord(suite)) {
    return;
  }

  const filePath = typeof suite.file === 'string' ? suite.file : inheritedFilePath;
  const titleSegment = typeof suite.title === 'string' && suite.title.length > 0 ? suite.title : '';
  const titlePath =
    parentTitle.length > 0 && titleSegment.length > 0
      ? `${parentTitle}|${titleSegment}`
      : titleSegment.length > 0
        ? titleSegment
        : parentTitle;

  if (Array.isArray(suite.specs)) {
    for (const spec of suite.specs) {
      if (!isRecord(spec) || typeof spec.title !== 'string' || !Array.isArray(spec.tests)) {
        continue;
      }

      const status = normalisePlaywrightStatus(spec.tests);
      if (status === null) {
        continue;
      }

      tests.push({
        fingerprint: `${filePath}|${titlePath}|${spec.title}`,
        status,
      });
    }
  }

  if (Array.isArray(suite.suites)) {
    for (const childSuite of suite.suites) {
      visitPlaywrightSuite(childSuite, filePath, titlePath, tests);
    }
  }
}

/**
 *
 * @param kind
 * @param tests
 */
function buildTestSummary(kind: 'vitest' | 'playwright', tests: TestOutcome[]): DerivedSummary {
  tests.sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));

  return {
    kind,
    tests,
    counts: {
      total: tests.length,
      passed: tests.filter((test) => test.status === 'passed').length,
      failed: tests.filter((test) => test.status === 'failed').length,
      skipped: tests.filter((test) => test.status === 'skipped').length,
    },
  };
}

/**
 *
 * @param rawArtefact
 */
function deriveTscSummary(rawArtefact: unknown): DerivedSummary {
  const diagnostics: TscDiagnostic[] = [];

  if (typeof rawArtefact === 'string') {
    for (const line of rawArtefact.split(/\r?\n/u)) {
      const match = TSC_DIAGNOSTIC_PATTERN.exec(line.trim());
      if (match?.groups === undefined) {
        continue;
      }

      diagnostics.push({
        fingerprint:
          `TS${match.groups.code}|${match.groups.filePath}|${match.groups.line}|` +
          `${match.groups.column}|${match.groups.message}`,
      });
    }
  }

  diagnostics.sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));

  return {
    kind: 'tsc',
    diagnostics,
    counts: {
      diagnostics: diagnostics.length,
    },
  };
}

/**
 *
 * @param value
 */
function normaliseTestStatus(value: unknown): TestOutcome['status'] | null {
  return value === 'passed' || value === 'failed' || value === 'skipped' ? value : null;
}

/**
 *
 * @param tests
 */
function normalisePlaywrightStatus(tests: unknown[]): TestOutcome['status'] | null {
  for (const entry of tests) {
    if (!isRecord(entry) || !Array.isArray(entry.results)) {
      continue;
    }

    for (const result of entry.results) {
      if (!isRecord(result)) {
        continue;
      }

      const status = normaliseTestStatus(result.status);
      if (status !== null) {
        return status;
      }
    }
  }

  return null;
}

/**
 *
 * @param error
 */
function createExecutionErrorFingerprint(error: StructuredExecutionFailure | null): string {
  if (error === null) {
    return 'execution-error|unknown|Unknown execution failure.';
  }

  return `execution-error|${error.code}|${error.message}`;
}

/**
 *
 * @param checks
 */
function calculateTotals(checks: ComparisonCheckResult[]): ComparisonResult['totals'] {
  return {
    regressionsCount: checks.reduce((total, check) => total + check.regressions.length, 0),
    newFailuresCount: checks.reduce(
      (total, check) => total + Math.max(check.newFailures.length, check.regressions.length),
      0
    ),
    fixesCount: checks.reduce((total, check) => total + check.fixes.length, 0),
    checksPassing: checks.filter((check) => check.status === 'passing').length,
    checksFailing: checks.filter((check) => check.status !== 'passing').length,
  };
}

/**
 *
 * @param summary
 * @param expectedKind
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
 *
 * @param value
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 *
 * @param value
 */
function assertNever(value: never): never {
  throw new Error('Unsupported regression tool: ' + String(value));
}
