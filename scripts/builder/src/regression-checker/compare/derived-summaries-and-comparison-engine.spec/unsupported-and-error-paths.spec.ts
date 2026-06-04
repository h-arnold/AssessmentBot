import { describe, expect, it } from 'vitest';

import { loadCompareModule, type Tool } from './fixtures.js';

describe('derived summaries and comparison engine', () => {
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
});
