export type Tool = 'eslint' | 'vitest' | 'playwright' | 'tsc';

type CheckRun = {
  id: string;
  tool: Tool;
  status: 'passing' | 'failing' | 'execution-error';
  rawArtefact: unknown;
  rawArtefactPath: string;
  error: { code: string; message: string } | null;
};

type CheckPair = { baseline: CheckRun; current: CheckRun };

type BaselineCompatibility =
  | { compatible: true }
  | { compatible: false; reason: { code: string; message: string } };

type ComparisonResult = {
  overallStatus: 'GREEN' | 'FAILING' | 'BASELINE-INCOMPATIBLE';
  baselineCompatibility: BaselineCompatibility;
  checks: Array<{
    id: string;
    tool: Tool;
    status: 'passing' | 'failing' | 'execution-error' | 'baseline-incompatible';
    baselineSummary: unknown;
    currentSummary: unknown;
    regressions: string[];
    newFailures: string[];
    fixes: string[];
    executionError: { code: string; message: string } | null;
    baselineIncompatibility: { code: string; message: string } | null;
  }>;
  totals: {
    regressionsCount: number;
    newFailuresCount: number;
    fixesCount: number;
    checksPassing: number;
    checksFailing: number;
  };
};

type CompareModule = {
  compareRegressionChecks: (options: {
    checksInConfigOrder: CheckPair[];
    baselineCompatibility: BaselineCompatibility;
  }) => ComparisonResult | Promise<ComparisonResult>;
  deriveSummaryFromArtefact: (tool: Tool, rawArtefact: unknown) => unknown;
};

export const ESLINT_WARNING_SEVERITY = 1;
export const ESLINT_ERROR_SEVERITY = 2;
export const BASELINE_CONSOLE_LINE = 7;
export const BASELINE_CONSOLE_COLUMN = 3;
export const CURRENT_EQEQEQ_LINE = 18;
export const CURRENT_EQEQEQ_COLUMN = 16;
export const CURRENT_DEBUGGER_LINE = 12;
export const CURRENT_DEBUGGER_COLUMN = 1;
export const TSC_BASELINE_FIRST_LINE = 2;
export const TSC_BASELINE_FIRST_COLUMN = 5;
export const TSC_SHARED_LINE = 9;
export const TSC_SHARED_COLUMN = 12;
export const TSC_CURRENT_REGRESSION_LINE = 1;
export const TSC_CURRENT_REGRESSION_COLUMN = 1;
export const NEWLINE_SEPARATOR = '\n';
export const EXPECTED_REGRESSIONS_TOTAL = 2;
export const EXPECTED_NEW_FAILURES_TOTAL = 1;
export const EXPECTED_FIXES_TOTAL = 1;
export const EXPECTED_FAILING_CHECKS_TOTAL = 2;
export const EXPECTED_PASSING_CHECKS_TOTAL = 1;
export const ALERT_FAILURE_LINE = 3;
export const ALERT_FAILURE_COLUMN = 2;

/**
 * Loads the comparison module under test for Section 4 RED-phase coverage.
 *
 * @returns {Promise<CompareModule>} Promise resolving to the comparison module contract used by this spec.
 */
export async function loadCompareModule(): Promise<CompareModule> {
  try {
    return await import('../index.js');
  } catch (error) {
    throw new Error(
      'Section 4 requires ./index.js to export compareRegressionChecks for derived-summary and comparison semantics.',
      { cause: error }
    );
  }
}
