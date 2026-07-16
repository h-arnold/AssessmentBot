import { describe, expect, it } from 'vitest';

type Tool = 'eslint' | 'vitest' | 'playwright' | 'tsc';

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
  { compatible: true } | { compatible: false; reason: { code: string; message: string } };

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

const ESLINT_WARNING_SEVERITY = 1;
const ESLINT_ERROR_SEVERITY = 2;
const BASELINE_CONSOLE_LINE = 7;
const BASELINE_CONSOLE_COLUMN = 3;
const CURRENT_EQEQEQ_LINE = 18;
const CURRENT_EQEQEQ_COLUMN = 16;
const CURRENT_DEBUGGER_LINE = 12;
const CURRENT_DEBUGGER_COLUMN = 1;
const TSC_BASELINE_FIRST_LINE = 2;
const TSC_BASELINE_FIRST_COLUMN = 5;
const TSC_SHARED_LINE = 9;
const TSC_SHARED_COLUMN = 12;
const TSC_CURRENT_REGRESSION_LINE = 1;
const TSC_CURRENT_REGRESSION_COLUMN = 1;
const NEWLINE_SEPARATOR = '\n';
const EXPECTED_REGRESSIONS_TOTAL = 2;
const EXPECTED_NEW_FAILURES_TOTAL = 0;
const EXPECTED_FIXES_TOTAL = 1;
const EXPECTED_FAILING_CHECKS_TOTAL = 2;
const EXPECTED_PASSING_CHECKS_TOTAL = 1;
const ALERT_FAILURE_LINE = 3;
const ALERT_FAILURE_COLUMN = 2;

/**
 * Loads the comparison module under test for Section 4 RED-phase coverage.
 *
 * @returns {Promise<CompareModule>} Promise resolving to the comparison module contract used by this spec.
 */
async function loadCompareModule(): Promise<CompareModule> {
  try {
    return await import('./index.js');
  } catch (error) {
    throw new Error(
      'Section 4 requires ./index.js to export compareRegressionChecks for derived-summary and comparison semantics.',
      { cause: error }
    );
  }
}

describe('derived summaries and comparison engine', () => {
  it('returns GREEN when every check stays passing and unchanged', async () => {
    const { compareRegressionChecks } = await loadCompareModule();

    const result = await compareRegressionChecks({
      baselineCompatibility: { compatible: true },
      checksInConfigOrder: [
        {
          baseline: {
            id: 'eslint-clean',
            tool: 'eslint',
            status: 'passing',
            rawArtefactPath: 'baseline/eslint.json',
            error: null,
            rawArtefact: [],
          },
          current: {
            id: 'eslint-clean',
            tool: 'eslint',
            status: 'passing',
            rawArtefactPath: 'run/eslint.json',
            error: null,
            rawArtefact: [],
          },
        },
      ],
    });

    expect(result).toMatchObject({
      overallStatus: 'GREEN',
      totals: {
        regressionsCount: 0,
        newFailuresCount: 0,
        fixesCount: 0,
        checksPassing: 1,
        checksFailing: 0,
      },
      checks: [
        {
          status: 'passing',
          regressions: [],
          newFailures: [],
          fixes: [],
        },
      ],
    });
  });

  it('derives eslint warning/error fingerprints with regression semantics', async () => {
    const { compareRegressionChecks } = await loadCompareModule();

    const result = await compareRegressionChecks({
      baselineCompatibility: { compatible: true },
      checksInConfigOrder: [
        {
          baseline: {
            id: 'eslint-check',
            tool: 'eslint',
            status: 'failing',
            rawArtefactPath: 'baseline/eslint.json',
            error: null,
            rawArtefact: [
              {
                filePath: 'src/a.ts',
                messages: [
                  {
                    ruleId: 'no-console',
                    severity: ESLINT_WARNING_SEVERITY,
                    message: 'Unexpected console statement.',
                    line: BASELINE_CONSOLE_LINE,
                    column: BASELINE_CONSOLE_COLUMN,
                  },
                ],
              },
            ],
          },
          current: {
            id: 'eslint-check',
            tool: 'eslint',
            status: 'failing',
            rawArtefactPath: 'run/eslint.json',
            error: null,
            rawArtefact: [
              {
                filePath: 'src/a.ts',
                messages: [
                  {
                    ruleId: 'eqeqeq',
                    severity: ESLINT_ERROR_SEVERITY,
                    message: "Expected '===' and instead saw '=='.",
                    line: CURRENT_EQEQEQ_LINE,
                    column: CURRENT_EQEQEQ_COLUMN,
                  },
                  {
                    ruleId: 'no-console',
                    severity: ESLINT_WARNING_SEVERITY,
                    message: 'Unexpected console statement.',
                    line: BASELINE_CONSOLE_LINE,
                    column: BASELINE_CONSOLE_COLUMN,
                  },
                  {
                    ruleId: 'no-debugger',
                    severity: ESLINT_WARNING_SEVERITY,
                    message: 'Unexpected debugger statement.',
                    line: CURRENT_DEBUGGER_LINE,
                    column: CURRENT_DEBUGGER_COLUMN,
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    expect(result.checks[0]?.baselineSummary).toBeDefined();
    expect(result.checks[0]?.currentSummary).toBeDefined();
    expect(result.checks[0]).toMatchObject({
      regressions: [
        "eqeqeq|src/a.ts|18|16|Expected '===' and instead saw '=='.",
        'no-debugger|src/a.ts|12|1|Unexpected debugger statement.',
      ],
      // ESLint findings have no "previously passing" state, so newly appearing
      // findings are regressions only, not new failures.
      newFailures: [],
      fixes: [],
    });
  });

  it('derives vitest/playwright failures plus skipped-state regressions', async () => {
    const { compareRegressionChecks } = await loadCompareModule();

    const result = await compareRegressionChecks({
      baselineCompatibility: { compatible: true },
      checksInConfigOrder: [
        {
          baseline: {
            id: 'vitest-check',
            tool: 'vitest',
            status: 'failing',
            rawArtefactPath: 'baseline/vitest.json',
            error: null,
            rawArtefact: {
              testResults: [
                {
                  name: 'src/auth.spec.ts',
                  assertionResults: [
                    { ancestorTitles: ['auth'], title: 'shows toast', status: 'failed' },
                    { ancestorTitles: ['auth'], title: 'shows state', status: 'passed' },
                  ],
                },
              ],
            },
          },
          current: {
            id: 'vitest-check',
            tool: 'vitest',
            status: 'failing',
            rawArtefactPath: 'run/vitest.json',
            error: null,
            rawArtefact: {
              testResults: [
                {
                  name: 'src/auth.spec.ts',
                  assertionResults: [
                    { ancestorTitles: ['auth'], title: 'shows toast', status: 'failed' },
                    { ancestorTitles: ['auth'], title: 'shows state', status: 'skipped' },
                  ],
                },
              ],
            },
          },
        },
        {
          baseline: {
            id: 'playwright-check',
            tool: 'playwright',
            status: 'passing',
            rawArtefactPath: 'baseline/pw.json',
            error: null,
            rawArtefact: {
              suites: [
                {
                  title: 'settings',
                  file: 'e2e/settings.spec.ts',
                  specs: [
                    {
                      title: 'opens panel',
                      tests: [{ results: [{ status: 'passed' }] }],
                    },
                  ],
                },
              ],
            },
          },
          current: {
            id: 'playwright-check',
            tool: 'playwright',
            status: 'failing',
            rawArtefactPath: 'run/pw.json',
            error: null,
            rawArtefact: {
              suites: [
                {
                  title: 'settings',
                  file: 'e2e/settings.spec.ts',
                  specs: [
                    {
                      title: 'opens panel',
                      tests: [{ results: [{ status: 'skipped' }] }],
                    },
                    {
                      title: 'saves panel',
                      tests: [{ results: [{ status: 'failed' }] }],
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    });

    expect(result.checks[0]?.baselineSummary).toBeDefined();
    expect(result.checks[0]?.currentSummary).toBeDefined();
    expect(result.checks[0]).toMatchObject({
      regressions: ['src/auth.spec.ts|auth|shows state'],
      newFailures: [],
    });
    expect(result.checks[1]?.baselineSummary).toBeDefined();
    expect(result.checks[1]?.currentSummary).toBeDefined();
    expect(result.checks[1]).toMatchObject({
      regressions: [
        'e2e/settings.spec.ts|settings|opens panel',
        'e2e/settings.spec.ts|settings|saves panel',
      ],
      // `saves panel` had no baseline entry (it is a newly introduced test that
      // now fails), so it is a regression, not a new failure (new failures are
      // restricted to previously-passing tests that now fail).
      newFailures: [],
    });
  });

  it('parses tsc diagnostics and fingerprints for regressions/new-failures/fixes', async () => {
    const { compareRegressionChecks } = await loadCompareModule();

    const result = await compareRegressionChecks({
      baselineCompatibility: { compatible: true },
      checksInConfigOrder: [
        {
          baseline: {
            id: 'tsc-check',
            tool: 'tsc',
            status: 'failing',
            rawArtefactPath: 'baseline/tsc.txt',
            error: null,
            rawArtefact: [
              `src/a.ts(${TSC_BASELINE_FIRST_LINE},${TSC_BASELINE_FIRST_COLUMN}): error TS2304: Cannot find name 'x'.`,
              `src/b.ts(${TSC_SHARED_LINE},${TSC_SHARED_COLUMN}): error TS2322: Type 'string' is not assignable to type 'number'.`,
            ].join(NEWLINE_SEPARATOR),
          },
          current: {
            id: 'tsc-check',
            tool: 'tsc',
            status: 'failing',
            rawArtefactPath: 'run/tsc.txt',
            error: null,
            rawArtefact: [
              `src/b.ts(${TSC_SHARED_LINE},${TSC_SHARED_COLUMN}): error TS2322: Type 'string' is not assignable to type 'number'.`,
              `src/c.ts(${TSC_CURRENT_REGRESSION_LINE},${TSC_CURRENT_REGRESSION_COLUMN}): error TS1005: ';' expected.`,
            ].join(NEWLINE_SEPARATOR),
          },
        },
      ],
    });

    expect(result.checks[0]?.baselineSummary).toBeDefined();
    expect(result.checks[0]?.currentSummary).toBeDefined();
    expect(result.checks[0]).toMatchObject({
      regressions: ["TS1005|src/c.ts|1|1|';' expected."],
      // TypeScript diagnostics are regressions only, not new failures.
      newFailures: [],
      fixes: ["TS2304|src/a.ts|2|5|Cannot find name 'x'."],
    });
  });

  it('treats execution errors as regressions and baseline incompatibility as explicit state', async () => {
    const { compareRegressionChecks } = await loadCompareModule();

    const executionResult = await compareRegressionChecks({
      baselineCompatibility: { compatible: true },
      checksInConfigOrder: [
        {
          baseline: {
            id: 'lint',
            tool: 'eslint',
            status: 'passing',
            rawArtefactPath: 'baseline/lint.json',
            error: null,
            rawArtefact: [],
          },
          current: {
            id: 'lint',
            tool: 'eslint',
            status: 'execution-error',
            rawArtefactPath: 'run/lint.json',
            error: { code: 'runner-execution-failed', message: 'spawn eslint ENOENT' },
            rawArtefact: [],
          },
        },
      ],
    });

    expect(executionResult.checks[0]).toMatchObject({
      status: 'execution-error',
      regressions: ['execution-error|runner-execution-failed|spawn eslint ENOENT'],
      newFailures: ['execution-error|runner-execution-failed|spawn eslint ENOENT'],
    });

    const incompatibleResult = await compareRegressionChecks({
      baselineCompatibility: {
        compatible: false,
        reason: {
          code: 'check-ids-mismatch',
          message: 'Baseline is incompatible: check IDs differ from the current run.',
        },
      },
      checksInConfigOrder: [
        {
          baseline: {
            id: 'lint',
            tool: 'eslint',
            status: 'passing',
            rawArtefactPath: 'baseline/lint.json',
            error: null,
            rawArtefact: [],
          },
          current: {
            id: 'lint',
            tool: 'eslint',
            status: 'passing',
            rawArtefactPath: 'run/lint.json',
            error: null,
            rawArtefact: [],
          },
        },
      ],
    });

    expect(incompatibleResult).toMatchObject({
      overallStatus: 'BASELINE-INCOMPATIBLE',
      baselineCompatibility: { compatible: false, reason: { code: 'check-ids-mismatch' } },
    });
    expect(incompatibleResult.checks[0]).toMatchObject({
      status: 'baseline-incompatible',
      baselineIncompatibility: { code: 'check-ids-mismatch' },
    });
  });

  it('aggregates counts and preserves deterministic config-order output', async () => {
    const { compareRegressionChecks } = await loadCompareModule();

    const result = await compareRegressionChecks({
      baselineCompatibility: { compatible: true },
      checksInConfigOrder: [
        {
          baseline: {
            id: 'second',
            tool: 'tsc',
            status: 'failing',
            rawArtefactPath: 'b/tsc.txt',
            error: null,
            rawArtefact: "src/a.ts(1,1): error TS1005: ';' expected.",
          },
          current: {
            id: 'second',
            tool: 'tsc',
            status: 'passing',
            rawArtefactPath: 'r/tsc.txt',
            error: null,
            rawArtefact: '',
          },
        },
        {
          baseline: {
            id: 'first',
            tool: 'eslint',
            status: 'passing',
            rawArtefactPath: 'b/eslint.json',
            error: null,
            rawArtefact: [],
          },
          current: {
            id: 'first',
            tool: 'eslint',
            status: 'failing',
            rawArtefactPath: 'r/eslint.json',
            error: null,
            rawArtefact: [
              {
                filePath: 'src/z.ts',
                messages: [
                  {
                    ruleId: 'no-alert',
                    severity: ESLINT_ERROR_SEVERITY,
                    message: 'Unexpected alert.',
                    line: ALERT_FAILURE_LINE,
                    column: ALERT_FAILURE_COLUMN,
                  },
                ],
              },
            ],
          },
        },
        {
          baseline: {
            id: 'third',
            tool: 'vitest',
            status: 'passing',
            rawArtefactPath: 'b/vitest.json',
            error: null,
            rawArtefact: {
              testResults: [
                {
                  name: 'src/sample.spec.ts',
                  assertionResults: [
                    {
                      ancestorTitles: ['suite'],
                      title: 'sample',
                      status: 'passed',
                    },
                  ],
                },
              ],
            },
          },
          current: {
            id: 'third',
            tool: 'vitest',
            status: 'failing',
            rawArtefactPath: 'r/vitest.json',
            error: null,
            rawArtefact: {
              testResults: [
                {
                  name: 'src/sample.spec.ts',
                  assertionResults: [
                    {
                      ancestorTitles: ['suite'],
                      title: 'sample',
                      status: 'skipped',
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    });

    expect(result.checks.map((check) => check.id)).toEqual(['second', 'first', 'third']);
    expect(result.checks[0]?.status).toBe('passing');
    expect(result.totals).toEqual({
      regressionsCount: EXPECTED_REGRESSIONS_TOTAL,
      newFailuresCount: EXPECTED_NEW_FAILURES_TOTAL,
      fixesCount: EXPECTED_FIXES_TOTAL,
      checksPassing: EXPECTED_PASSING_CHECKS_TOTAL,
      checksFailing: EXPECTED_FAILING_CHECKS_TOTAL,
    });
  });

  it('handles malformed artefacts, unknown severities, and unknown execution errors deterministically', async () => {
    const { compareRegressionChecks } = await loadCompareModule();

    const result = await compareRegressionChecks({
      baselineCompatibility: { compatible: true },
      checksInConfigOrder: [
        {
          baseline: {
            id: 'eslint-malformed',
            tool: 'eslint',
            status: 'passing',
            rawArtefactPath: 'baseline/eslint-malformed.json',
            error: null,
            rawArtefact: [{ filePath: 'src/b.ts', messages: [{ severity: 99 }] }],
          },
          current: {
            id: 'eslint-malformed',
            tool: 'eslint',
            status: 'failing',
            rawArtefactPath: 'run/eslint-malformed.json',
            error: null,
            rawArtefact: [
              {
                filePath: 'src/b.ts',
                messages: [{ severity: 2, message: 'Unexpected issue.', line: 1, column: 1 }],
              },
            ],
          },
        },
        {
          baseline: {
            id: 'playwright-malformed',
            tool: 'playwright',
            status: 'passing',
            rawArtefactPath: 'baseline/pw-malformed.json',
            error: null,
            rawArtefact: { suites: [{ title: 'suite', specs: [{ title: 'missing tests' }] }] },
          },
          current: {
            id: 'playwright-malformed',
            tool: 'playwright',
            status: 'passing',
            rawArtefactPath: 'run/pw-malformed.json',
            error: null,
            rawArtefact: {
              suites: [
                {
                  title: '',
                  specs: [{ title: 'scenario', tests: [{ results: [{ status: 'passed' }] }] }],
                },
              ],
            },
          },
        },
        {
          baseline: {
            id: 'tsc-malformed',
            tool: 'tsc',
            status: 'passing',
            rawArtefactPath: 'baseline/tsc-malformed.txt',
            error: null,
            rawArtefact: 100,
          },
          current: {
            id: 'tsc-malformed',
            tool: 'tsc',
            status: 'passing',
            rawArtefactPath: 'run/tsc-malformed.txt',
            error: null,
            rawArtefact: "bad line\nsrc/file.ts(1,2): error TS1005: ';' expected.",
          },
        },
        {
          baseline: {
            id: 'unknown-exec-error',
            tool: 'vitest',
            status: 'passing',
            rawArtefactPath: 'baseline/exec.json',
            error: null,
            rawArtefact: {},
          },
          current: {
            id: 'unknown-exec-error',
            tool: 'vitest',
            status: 'execution-error',
            rawArtefactPath: 'run/exec.json',
            error: null,
            rawArtefact: {},
          },
        },
      ],
    });

    expect(result.checks.find((check) => check.id === 'eslint-malformed')?.regressions).toEqual([
      'unknown-rule|src/b.ts|1|1|Unexpected issue.',
    ]);
    expect(result.checks.find((check) => check.id === 'playwright-malformed')?.status).toBe(
      'passing'
    );
    expect(result.checks.find((check) => check.id === 'tsc-malformed')?.newFailures).toEqual([]);
    expect(result.checks.find((check) => check.id === 'unknown-exec-error')?.regressions).toEqual([
      'execution-error|unknown|Unknown execution failure.',
    ]);
  });

  it('marks compare results as failing when the current command exits non-zero without summary deltas', async () => {
    const { compareRegressionChecks } = await loadCompareModule();

    const result = await compareRegressionChecks({
      baselineCompatibility: { compatible: true },
      checksInConfigOrder: [
        {
          baseline: {
            id: 'builder-test-coverage-check',
            tool: 'vitest',
            status: 'passing',
            rawArtefactPath: 'baseline/vitest.json',
            error: null,
            rawArtefact: {
              testResults: [
                {
                  name: 'src/sample.spec.ts',
                  assertionResults: [
                    {
                      ancestorTitles: ['suite'],
                      title: 'sample',
                      status: 'passed',
                    },
                  ],
                },
              ],
            },
          },
          current: {
            id: 'builder-test-coverage-check',
            tool: 'vitest',
            status: 'failing',
            rawArtefactPath: 'run/vitest.json',
            error: null,
            rawArtefact: {
              testResults: [
                {
                  name: 'src/sample.spec.ts',
                  assertionResults: [
                    {
                      ancestorTitles: ['suite'],
                      title: 'sample',
                      status: 'passed',
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    });

    expect(result.overallStatus).toBe('FAILING');
    expect(result.totals.checksFailing).toBe(1);
    expect(result.checks[0]).toMatchObject({
      id: 'builder-test-coverage-check',
      status: 'failing',
      regressions: [],
      newFailures: [],
      fixes: [],
    });
  });

  it('throws for unsupported regression tool values when deriving summaries directly', async () => {
    const { deriveSummaryFromArtefact } = await loadCompareModule();

    expect(() => deriveSummaryFromArtefact('made-up' as Tool, {})).toThrow(
      'Unsupported regression tool: made-up'
    );
  });

  it('keeps regressions and newFailures semantically distinct (no double-count)', async () => {
    const { compareRegressionChecks } = await loadCompareModule();

    const result = await compareRegressionChecks({
      baselineCompatibility: { compatible: true },
      checksInConfigOrder: [
        {
          baseline: {
            id: 'vitest-check',
            tool: 'vitest',
            status: 'failing',
            rawArtefactPath: 'baseline/vitest.json',
            error: null,
            rawArtefact: {
              testResults: [
                {
                  name: 'src/auth.spec.ts',
                  assertionResults: [
                    { ancestorTitles: ['auth'], title: 'used to pass', status: 'passed' },
                    { ancestorTitles: ['auth'], title: 'used to be skipped', status: 'skipped' },
                  ],
                },
              ],
            },
          },
          current: {
            id: 'vitest-check',
            tool: 'vitest',
            status: 'failing',
            rawArtefactPath: 'run/vitest.json',
            error: null,
            rawArtefact: {
              testResults: [
                {
                  name: 'src/auth.spec.ts',
                  assertionResults: [
                    { ancestorTitles: ['auth'], title: 'used to pass', status: 'failed' },
                    { ancestorTitles: ['auth'], title: 'used to be skipped', status: 'failed' },
                  ],
                },
              ],
            },
          },
        },
        {
          baseline: {
            id: 'eslint-check',
            tool: 'eslint',
            status: 'passing',
            rawArtefactPath: 'baseline/eslint.json',
            error: null,
            rawArtefact: [],
          },
          current: {
            id: 'eslint-check',
            tool: 'eslint',
            status: 'failing',
            rawArtefactPath: 'run/eslint.json',
            error: null,
            rawArtefact: [
              {
                filePath: 'src/a.ts',
                messages: [
                  {
                    ruleId: 'eqeqeq',
                    severity: ESLINT_ERROR_SEVERITY,
                    message: "Expected '===' and instead saw '=='.",
                    line: CURRENT_EQEQEQ_LINE,
                    column: CURRENT_EQEQEQ_COLUMN,
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    const vitestCheck = result.checks.find((check) => check.id === 'vitest-check');
    const eslintCheck = result.checks.find((check) => check.id === 'eslint-check');

    // A test that newly fails (passed -> failed) is BOTH a regression and a
    // new failure, and must NOT be erroneously duplicated across both lists.
    expect(vitestCheck?.newFailures).toEqual(['src/auth.spec.ts|auth|used to pass']);
    expect(vitestCheck?.regressions).toEqual([
      'src/auth.spec.ts|auth|used to be skipped',
      'src/auth.spec.ts|auth|used to pass',
    ]);

    // An ESLint finding that did not exist in the baseline is a REGRESSION only
    // (lint diagnostics have no "previously passing" state), never a new failure.
    expect(eslintCheck?.regressions).toEqual([
      "eqeqeq|src/a.ts|18|16|Expected '===' and instead saw '=='.",
    ]);
    expect(eslintCheck?.newFailures).toEqual([]);

    // Aggregate totals must reflect the distinction (no double-counting):
    // 3 regressions (2 vitest + 1 eslint) and 1 new failure (the passed -> failed test).
    expect(result.totals.regressionsCount).toBe(3);
    expect(result.totals.newFailuresCount).toBe(1);
  });
});
