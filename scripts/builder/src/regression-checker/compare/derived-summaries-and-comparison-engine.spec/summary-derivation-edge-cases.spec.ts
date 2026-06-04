import { describe, expect, it } from 'vitest';

import {
  ALERT_FAILURE_COLUMN,
  ALERT_FAILURE_LINE,
  ESLINT_ERROR_SEVERITY,
  EXPECTED_FAILING_CHECKS_TOTAL,
  EXPECTED_FIXES_TOTAL,
  EXPECTED_NEW_FAILURES_TOTAL,
  EXPECTED_PASSING_CHECKS_TOTAL,
  EXPECTED_REGRESSIONS_TOTAL,
  loadCompareModule,
} from './fixtures.js';

describe('derived summaries and comparison engine', () => {
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
    expect(result.checks.find((check) => check.id === 'tsc-malformed')?.newFailures).toEqual([
      "TS1005|src/file.ts|1|2|';' expected.",
    ]);
    expect(result.checks.find((check) => check.id === 'unknown-exec-error')?.regressions).toEqual([
      'execution-error|unknown|Unknown execution failure.',
    ]);
  });
});
