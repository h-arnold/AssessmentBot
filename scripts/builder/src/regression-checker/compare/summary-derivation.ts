import type {
  CheckRun,
  DerivedSummary,
  EslintFinding,
  RegressionTool,
  TestOutcome,
  TscDiagnostic,
} from './comparison-engine.js';

const ESLINT_WARNING_SEVERITY = 1;
const ESLINT_ERROR_SEVERITY = 2;
const TSC_DIAGNOSTIC_PATTERN =
  /^(?<filePath>.+)\((?<line>\d+),(?<column>\d+)\): error TS(?<code>\d+): (?<message>.+)$/u;

/**
 * Checks if a value is a record (plain object).
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

export {
  ESLINT_WARNING_SEVERITY,
  ESLINT_ERROR_SEVERITY,
  TSC_DIAGNOSTIC_PATTERN,
  isRecord,
  assertNever,
};

/**
 * Derives a summary from a check run based on its tool type.
 *
 * @param {CheckRun} checkRun - The check run to derive a summary from.
 * @returns {DerivedSummary} The derived summary for the check run.
 */
export function deriveSummary(checkRun: CheckRun): DerivedSummary {
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
 * Derives a structured summary from a tool's raw artefact output.
 * This is exported for use by the CLI report writer to display rich failure details.
 *
 * @param {RegressionTool} tool - The tool that produced the artefact.
 * @param {unknown} rawArtefact - The parsed raw artefact content (JSON object for eslint/vitest/playwright, string for tsc).
 * @returns {DerivedSummary} Structured summary with findings/diagnostics extracted from the artefact.
 */
export function deriveSummaryFromArtefact(
  tool: RegressionTool,
  rawArtefact: unknown
): DerivedSummary {
  switch (tool) {
    case 'eslint':
      return deriveEslintSummary(rawArtefact);
    case 'vitest':
      return deriveVitestSummary(rawArtefact);
    case 'playwright':
      return derivePlaywrightSummary(rawArtefact);
    case 'tsc':
      return deriveTscSummary(rawArtefact);
    default:
      return assertNever(tool);
  }
}

/**
 * Derives an ESLint summary from a raw artefact.
 *
 * @param {unknown} rawArtefact - The raw ESLint artefact (typically an array of result objects).
 * @returns {DerivedSummary} The derived ESLint summary.
 */
function deriveEslintSummary(rawArtefact: unknown): DerivedSummary {
  const entries = extractEslintEntries(rawArtefact);
  const findings = extractEslintFindings(entries);

  findings.sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));

  return buildEslintSummary(findings);
}

/**
 * Extracts ESLint entries from the raw artefact.
 *
 * @param {unknown} rawArtefact - The raw artefact to extract from.
 * @returns {unknown[]} The extracted entries or empty array.
 */
function extractEslintEntries(rawArtefact: unknown): unknown[] {
  return Array.isArray(rawArtefact) ? rawArtefact : [];
}

/**
 * Extracts ESLint findings from entries.
 *
 * @param {unknown[]} entries - The ESLint result entries.
 * @returns {EslintFinding[]} The extracted findings.
 */
function extractEslintFindings(entries: unknown[]): EslintFinding[] {
  const findings: EslintFinding[] = [];

  for (const entry of entries) {
    if (!isValidEslintEntry(entry)) {
      continue;
    }

    for (const message of entry.messages) {
      const finding = processEslintMessage(entry, message);
      if (finding !== null) {
        findings.push(finding);
      }
    }
  }

  return findings;
}

/**
 * Validates an ESLint entry has required structure.
 *
 * @param {object} entry - The entry to validate.
 * @param {string} entry.filePath - The file path property to check.
 * @param {unknown[]} entry.messages - The messages array property to check.
 * @returns {boolean} True if the entry is a valid ESLint entry.
 */
function isValidEslintEntry(entry: unknown): entry is { filePath: string; messages: unknown[] } {
  return isRecord(entry) && typeof entry.filePath === 'string' && Array.isArray(entry.messages);
}

/**
 * Processes an ESLint message into a finding.
 *
 * @param {object} entry - The entry containing the message.
 * @param {string} entry.filePath - The file path of the entry.
 * @param {unknown} message - The message to process.
 * @returns {EslintFinding | null} The finding or null if invalid.
 */
function processEslintMessage(entry: { filePath: string }, message: unknown): EslintFinding | null {
  if (!isRecord(message)) {
    return null;
  }

  const ruleId = getRuleId(message);
  const detail = getMessageDetail(message);
  const line = getMessageLine(message);
  const column = getMessageColumn(message);
  const severity = getMessageSeverity(message);

  if (severity === null) {
    return null;
  }

  return {
    fingerprint: `${ruleId}|${entry.filePath}|${String(line)}|${String(column)}|${detail}`,
    severity,
  };
}

/**
 * Extracts rule ID from a message.
 *
 * @param {Record<string, unknown>} message - The message to extract from.
 * @returns {string} The rule ID or fallback.
 */
function getRuleId(message: Record<string, unknown>): string {
  return typeof message.ruleId === 'string' ? message.ruleId : 'unknown-rule';
}

/**
 * Extracts message detail from a message.
 *
 * @param {Record<string, unknown>} message - The message to extract from.
 * @returns {string} The message detail or fallback.
 */
function getMessageDetail(message: Record<string, unknown>): string {
  return typeof message.message === 'string' ? message.message : 'Unknown ESLint message.';
}

/**
 * Extracts line number from a message.
 *
 * @param {Record<string, unknown>} message - The message to extract from.
 * @returns {number} The line number or 0.
 */
function getMessageLine(message: Record<string, unknown>): number {
  return typeof message.line === 'number' ? message.line : 0;
}

/**
 * Extracts column number from a message.
 *
 * @param {Record<string, unknown>} message - The message to extract from.
 * @returns {number} The column number or 0.
 */
function getMessageColumn(message: Record<string, unknown>): number {
  return typeof message.column === 'number' ? message.column : 0;
}

/**
 * Extracts severity from a message.
 *
 * @param {Record<string, unknown>} message - The message to extract from.
 * @returns {'warning' | 'error' | null} The severity or null if invalid.
 */
function getMessageSeverity(message: Record<string, unknown>): 'warning' | 'error' | null {
  if (typeof message.severity !== 'number') {
    return null;
  }

  if (message.severity === ESLINT_ERROR_SEVERITY) {
    return 'error';
  }

  if (message.severity === ESLINT_WARNING_SEVERITY) {
    return 'warning';
  }

  return null;
}

/**
 * Builds an ESLint summary from findings.
 *
 * @param {EslintFinding[]} findings - The ESLint findings.
 * @returns {DerivedSummary} The ESLint summary.
 */
function buildEslintSummary(findings: EslintFinding[]): DerivedSummary {
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
 * Derives a Vitest summary from a raw artefact.
 *
 * @param {unknown} rawArtefact - The raw Vitest artefact (typically a test results object).
 * @returns {DerivedSummary} The derived Vitest summary.
 */
function deriveVitestSummary(rawArtefact: unknown): DerivedSummary {
  const tests = extractVitestTests(rawArtefact);
  return buildTestSummary('vitest', tests);
}

/**
 * Extracts test outcomes from a Vitest artefact.
 *
 * @param {unknown} rawArtefact - The raw Vitest artefact.
 * @returns {TestOutcome[]} The extracted test outcomes.
 */
function extractVitestTests(rawArtefact: unknown): TestOutcome[] {
  const tests: TestOutcome[] = [];
  const records =
    isRecord(rawArtefact) && Array.isArray(rawArtefact.testResults) ? rawArtefact.testResults : [];

  for (const record of records) {
    if (!isValidVitestRecord(record)) {
      continue;
    }

    for (const assertion of record.assertionResults) {
      const test = processVitestAssertion(record, assertion);
      if (test !== null) {
        tests.push(test);
      }
    }
  }

  return tests;
}

/**
 * Validates a Vitest record has required structure.
 *
 * @param {object} record - The record to validate.
 * @param {string} record.name - The name property to check.
 * @param {unknown[]} record.assertionResults - The assertion results array property to check.
 * @returns {boolean} True if the record is a valid Vitest record.
 */
function isValidVitestRecord(record: unknown): record is {
  name: string;
  assertionResults: unknown[];
} {
  return (
    isRecord(record) && typeof record.name === 'string' && Array.isArray(record.assertionResults)
  );
}

/**
 * Processes a Vitest assertion into a test outcome.
 *
 * @param {object} record - The record containing the assertion.
 * @param {string} record.name - The name of the test record.
 * @param {unknown} assertion - The assertion to process.
 * @returns {TestOutcome | null} The test outcome or null if invalid.
 */
function processVitestAssertion(record: { name: string }, assertion: unknown): TestOutcome | null {
  if (!isRecord(assertion) || typeof assertion.title !== 'string') {
    return null;
  }

  const status = normaliseTestStatus(assertion.status);
  if (status === null) {
    return null;
  }

  const suite = buildVitestSuitePath(assertion);

  return {
    fingerprint: `${record.name}|${suite}|${assertion.title}`,
    status,
  };
}

/**
 * Builds a suite path from a Vitest assertion.
 *
 * @param {Record<string, unknown>} assertion - The assertion to extract suite path from.
 * @returns {string} The suite path.
 */
function buildVitestSuitePath(assertion: Record<string, unknown>): string {
  if (!Array.isArray(assertion.ancestorTitles)) {
    return '';
  }

  return assertion.ancestorTitles
    .filter((title): title is string => typeof title === 'string')
    .join('|');
}

/**
 * Derives a Playwright summary from a raw artefact.
 *
 * @param {unknown} rawArtefact - The raw Playwright artefact (typically a suite results object).
 * @returns {DerivedSummary} The derived Playwright summary.
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
 * Recursively visits a Playwright suite to extract test outcomes.
 *
 * @param {unknown} suite - The Playwright suite to visit.
 * @param {string} inheritedFilePath - The inherited file path from parent suites.
 * @param {string} parentTitle - The parent title from parent suites.
 * @param {TestOutcome[]} tests - The array to append test outcomes to.
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

  const filePath = getSuiteFilePath(suite, inheritedFilePath);
  const titleSegment = getSuiteTitleSegment(suite);
  const titlePath = buildSuiteTitlePath(parentTitle, titleSegment);

  processSuiteSpecs(suite, filePath, titlePath, tests);
  processSuiteSuites(suite, filePath, titlePath, tests);
}

/**
 * Gets the file path from a suite or falls back to inherited.
 *
 * @param {Record<string, unknown>} suite - The suite to extract from.
 * @param {string} inheritedFilePath - The inherited file path.
 * @returns {string} The file path.
 */
function getSuiteFilePath(suite: Record<string, unknown>, inheritedFilePath: string): string {
  return typeof suite.file === 'string' ? suite.file : inheritedFilePath;
}

/**
 * Gets the title segment from a suite.
 *
 * @param {Record<string, unknown>} suite - The suite to extract from.
 * @returns {string} The title segment.
 */
function getSuiteTitleSegment(suite: Record<string, unknown>): string {
  return typeof suite.title === 'string' && suite.title.length > 0 ? suite.title : '';
}

/**
 * Builds a title path from parent title and current segment.
 *
 * @param {string} parentTitle - The parent title.
 * @param {string} titleSegment - The current title segment.
 * @returns {string} The combined title path.
 */
function buildSuiteTitlePath(parentTitle: string, titleSegment: string): string {
  if (parentTitle.length > 0 && titleSegment.length > 0) {
    return `${parentTitle}|${titleSegment}`;
  }

  if (titleSegment.length > 0) {
    return titleSegment;
  }

  return parentTitle;
}

/**
 * Processes specs within a suite.
 *
 * @param {Record<string, unknown>} suite - The suite containing specs.
 * @param {string} filePath - The file path for the specs.
 * @param {string} titlePath - The title path for the specs.
 * @param {TestOutcome[]} tests - The array to append test outcomes to.
 */
function processSuiteSpecs(
  suite: Record<string, unknown>,
  filePath: string,
  titlePath: string,
  tests: TestOutcome[]
): void {
  if (!Array.isArray(suite.specs)) {
    return;
  }

  for (const spec of suite.specs) {
    const test = processSuiteSpec(spec, filePath, titlePath);
    if (test !== null) {
      tests.push(test);
    }
  }
}

/**
 * Processes a single spec into a test outcome.
 *
 * @param {Record<string, unknown>} spec - The spec to process.
 * @param {string} filePath - The file path.
 * @param {string} titlePath - The title path.
 * @returns {TestOutcome | null} The test outcome or null if invalid.
 */
function processSuiteSpec(
  spec: Record<string, unknown>,
  filePath: string,
  titlePath: string
): TestOutcome | null {
  if (!isRecord(spec) || typeof spec.title !== 'string' || !Array.isArray(spec.tests)) {
    return null;
  }

  const status = normalisePlaywrightStatus(spec.tests);
  if (status === null) {
    return null;
  }

  return {
    fingerprint: `${filePath}|${titlePath}|${spec.title}`,
    status,
  };
}

/**
 * Processes child suites recursively.
 *
 * @param {Record<string, unknown>} suite - The suite containing child suites.
 * @param {string} filePath - The file path to inherit.
 * @param {string} titlePath - The title path to inherit.
 * @param {TestOutcome[]} tests - The array to append test outcomes to.
 */
function processSuiteSuites(
  suite: Record<string, unknown>,
  filePath: string,
  titlePath: string,
  tests: TestOutcome[]
): void {
  if (!Array.isArray(suite.suites)) {
    return;
  }

  for (const childSuite of suite.suites) {
    visitPlaywrightSuite(childSuite, filePath, titlePath, tests);
  }
}

/**
 * Builds a test summary for Vitest or Playwright.
 *
 * @param {'vitest' | 'playwright'} kind - The kind of test summary.
 * @param {TestOutcome[]} tests - The test outcomes.
 * @returns {DerivedSummary} The test summary.
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
 * Derives a TSC summary from a raw artefact.
 *
 * @param {unknown} rawArtefact - The raw TSC artefact (typically a string of diagnostics).
 * @returns {DerivedSummary} The derived TSC summary.
 */
function deriveTscSummary(rawArtefact: unknown): DerivedSummary {
  const diagnostics = extractTscDiagnostics(rawArtefact);

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
 * Extracts TSC diagnostics from a raw artefact string.
 *
 * @param {unknown} rawArtefact - The raw artefact to extract from.
 * @returns {TscDiagnostic[]} The extracted diagnostics.
 */
function extractTscDiagnostics(rawArtefact: unknown): TscDiagnostic[] {
  const diagnostics: TscDiagnostic[] = [];

  if (typeof rawArtefact !== 'string') {
    return diagnostics;
  }

  for (const line of rawArtefact.split(/\r?\n/u)) {
    const diagnostic = parseTscDiagnostic(line);
    if (diagnostic !== null) {
      diagnostics.push(diagnostic);
    }
  }

  return diagnostics;
}

/**
 * Parses a single line into a TSC diagnostic.
 *
 * @param {string} line - The line to parse.
 * @returns {TscDiagnostic | null} The diagnostic or null if not match.
 */
function parseTscDiagnostic(line: string): TscDiagnostic | null {
  const match = TSC_DIAGNOSTIC_PATTERN.exec(line.trim());
  if (match?.groups === undefined) {
    return null;
  }

  return {
    fingerprint:
      `TS${match.groups.code}|${match.groups.filePath}|${match.groups.line}|` +
      `${match.groups.column}|${match.groups.message}`,
  };
}

/**
 * Normalises a test status value to a standard TestOutcome status.
 *
 * @param {unknown} value - The value to normalise.
 * @returns {TestOutcome['status'] | null} The normalised status or null if invalid.
 */
function normaliseTestStatus(value: unknown): TestOutcome['status'] | null {
  return value === 'passed' || value === 'failed' || value === 'skipped' ? value : null;
}

/**
 * Normalises Playwright test results to a standard TestOutcome status.
 *
 * @param {unknown[]} tests - The Playwright test results to normalise.
 * @returns {TestOutcome['status'] | null} The normalised status or null if no valid status found.
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
