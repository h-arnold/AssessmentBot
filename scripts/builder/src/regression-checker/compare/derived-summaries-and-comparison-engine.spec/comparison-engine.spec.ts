import { describe, expect, it } from 'vitest';

import {
  BASELINE_CONSOLE_COLUMN,
  BASELINE_CONSOLE_LINE,
  CURRENT_DEBUGGER_COLUMN,
  CURRENT_DEBUGGER_LINE,
  CURRENT_EQEQEQ_COLUMN,
  CURRENT_EQEQEQ_LINE,
  ESLINT_ERROR_SEVERITY,
  ESLINT_WARNING_SEVERITY,
  loadCompareModule,
  NEWLINE_SEPARATOR,
  TSC_BASELINE_FIRST_COLUMN,
  TSC_BASELINE_FIRST_LINE,
  TSC_CURRENT_REGRESSION_COLUMN,
  TSC_CURRENT_REGRESSION_LINE,
  TSC_SHARED_COLUMN,
  TSC_SHARED_LINE,
} from './fixtures.js';

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
      newFailures: [
        "eqeqeq|src/a.ts|18|16|Expected '===' and instead saw '=='.",
        'no-debugger|src/a.ts|12|1|Unexpected debugger statement.',
      ],
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
      newFailures: ['e2e/settings.spec.ts|settings|saves panel'],
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
      newFailures: ["TS1005|src/c.ts|1|1|';' expected."],
      fixes: ["TS2304|src/a.ts|2|5|Cannot find name 'x'."],
    });
  });
});
