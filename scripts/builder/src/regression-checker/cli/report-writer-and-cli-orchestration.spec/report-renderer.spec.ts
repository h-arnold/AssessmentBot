import { describe, expect, it, test } from 'vitest';

import { CREATED_AT, SESSION_ID, SESSION_STORAGE_KEY, loadCliModule } from './fixtures.js';

describe('report writer and CLI orchestration', () => {
  it('renders compare reports with explicit per-check details and baseline-incompatible status', async () => {
    const { renderComparisonReport } = await loadCliModule();

    const report = renderComparisonReport({
      sessionId: 'feature/regression-checker',
      sessionStorageKey: 'session-feature-regression-checker',
      sessionIdSource: 'arg',
      baselineTimestamp: CREATED_AT,
      currentTimestamp: CREATED_AT,
      comparison: {
        overallStatus: 'BASELINE-INCOMPATIBLE',
        baselineCompatibility: {
          compatible: false,
          reason: {
            code: 'check-ids-mismatch',
            message: 'Mismatch.',
          },
        },
        checks: [
          {
            id: 'builder-lint',
            tool: 'eslint',
            status: 'baseline-incompatible',
            baselineSummary: {},
            currentSummary: {},
            regressions: [],
            newFailures: [],
            fixes: [],
            executionError: null,
            baselineIncompatibility: {
              code: 'check-ids-mismatch',
              message: 'Mismatch.',
            },
          },
        ],
        totals: {
          regressionsCount: 0,
          newFailuresCount: 0,
          fixesCount: 0,
          checksPassing: 0,
          checksFailing: 1,
        },
      },
    });

    expect(report).toContain('Overall Status: BASELINE-INCOMPATIBLE');
    expect(report).toContain('builder-lint: baseline-incompatible');
  });

  it('renders baseline report with multiple tools sorted in tool summary', async () => {
    const { renderBaselineReport } = await loadCliModule();

    const report = await renderBaselineReport({
      sessionId: SESSION_ID,
      sessionStorageKey: SESSION_STORAGE_KEY,
      sessionIdSource: 'arg',
      createdAt: CREATED_AT,
      checks: [
        {
          id: 'builder-lint',
          tool: 'eslint',
          rawArtefactPath: 'baseline/checks/builder-lint/raw.json',
          status: 'passing',
          exitCode: 0,
          error: null,
        },
        {
          id: 'builder-test',
          tool: 'vitest',
          rawArtefactPath: 'baseline/checks/builder-test/raw.json',
          status: 'passing',
          exitCode: 0,
          error: null,
        },
        {
          id: 'builder-typecheck',
          tool: 'tsc',
          rawArtefactPath: 'baseline/checks/builder-typecheck/raw.txt',
          status: 'passing',
          exitCode: 0,
          error: null,
        },
      ],
      readRawArtefact: async () => ({}),
    });

    // Should contain sorted tool summary (eslint, playwright, tsc, vitest)
    expect(report).toContain('Tool Summary: eslint=1, tsc=1, vitest=1');
    expect(report).not.toContain('--- FAILED CHECKS ---');
  });

  test.each([
    {
      name: 'single fix showing singular form',
      checkId: 'builder-lint',
      tool: 'eslint' as const,
      fixesCount: 1,
      fixes: ['no-alert|src/example.ts|1|1|Alert removed.'],
      expectedCheckLine: 'builder-lint (1 fix): passing',
      expectedTotalsLine: 'Fixes Count: 1',
      baselineSummary: { kind: 'eslint' as const, counts: { errors: 1, warnings: 0 } },
      currentSummary: { kind: 'eslint' as const, counts: { errors: 0, warnings: 0 } },
    },
    {
      name: 'multiple fixes showing plural form',
      checkId: 'frontend-e2e-check',
      tool: 'playwright' as const,
      fixesCount: 3,
      fixes: ['spec-a.ts|suite|test-a', 'spec-b.ts|suite|test-b', 'spec-c.ts|suite|test-c'],
      expectedCheckLine: 'frontend-e2e-check (3 fixes): passing',
      expectedTotalsLine: 'Fixes Count: 3',
      baselineSummary: {
        kind: 'playwright' as const,
        counts: { total: 3, passed: 0, failed: 3, skipped: 0 },
      },
      currentSummary: {
        kind: 'playwright' as const,
        counts: { total: 3, passed: 3, failed: 0, skipped: 0 },
      },
    },
  ])(
    'renders comparison report with $name',
    async ({
      checkId,
      tool,
      fixesCount,
      fixes,
      expectedCheckLine,
      expectedTotalsLine,
      baselineSummary,
      currentSummary,
    }) => {
      const { renderComparisonReport } = await loadCliModule();

      const report = renderComparisonReport({
        sessionId: SESSION_ID,
        sessionStorageKey: SESSION_STORAGE_KEY,
        sessionIdSource: 'arg',
        baselineTimestamp: CREATED_AT,
        currentTimestamp: CREATED_AT,
        comparison: {
          overallStatus: 'GREEN',
          baselineCompatibility: { compatible: true },
          checks: [
            {
              id: checkId,
              tool,
              status: 'passing',
              baselineSummary,
              currentSummary,
              regressions: [],
              newFailures: [],
              fixes,
              executionError: null,
              baselineIncompatibility: null,
            },
          ],
          totals: {
            regressionsCount: 0,
            newFailuresCount: 0,
            fixesCount,
            checksPassing: 1,
            checksFailing: 0,
          },
        },
      });

      expect(report).toContain(expectedCheckLine);
      expect(report).toContain(expectedTotalsLine);
      expect(report).not.toContain('--- FAILED CHECKS ---');
    }
  );

  it('renders baseline report with failing checks and failed checks list', async () => {
    const { renderBaselineReport } = await loadCliModule();

    const report = await renderBaselineReport({
      sessionId: SESSION_ID,
      sessionStorageKey: SESSION_STORAGE_KEY,
      sessionIdSource: 'arg',
      createdAt: CREATED_AT,
      checks: [
        {
          id: 'builder-lint',
          tool: 'eslint',
          rawArtefactPath: 'baseline/checks/builder-lint/raw.json',
          status: 'failing',
          exitCode: 1,
          error: null,
        },
      ],
      readRawArtefact: async () => ({}),
    });

    // Should contain the FAILED CHECKS section when there are failed checks
    expect(report).toContain('--- FAILED CHECKS ---');
    expect(report).toContain('builder-lint: failing');
    expect(report).toContain('Overall Status: FAILING');
  });

  it('renders baseline report with empty failed checks list when all checks pass', async () => {
    const { renderBaselineReport } = await loadCliModule();

    const report = await renderBaselineReport({
      sessionId: SESSION_ID,
      sessionStorageKey: SESSION_STORAGE_KEY,
      sessionIdSource: 'arg',
      createdAt: CREATED_AT,
      checks: [
        {
          id: 'builder-lint',
          tool: 'eslint',
          rawArtefactPath: 'baseline/checks/builder-lint/raw.json',
          status: 'passing',
          exitCode: 0,
          error: null,
        },
      ],
      readRawArtefact: async () => ({}),
    });

    // Should not contain the FAILED CHECKS section when all checks pass
    expect(report).not.toContain('--- FAILED CHECKS ---');
    expect(report).toContain('--- PER-COMMAND SUMMARY ---');
    expect(report).toContain('builder-lint: passing');
    expect(report).toContain('Overall Status: GREEN');
  });

  it('renders rich failure details across eslint, vitest/playwright, and tsc checks', async () => {
    const { renderBaselineReport } = await loadCliModule();

    const report = await renderBaselineReport({
      sessionId: SESSION_ID,
      sessionStorageKey: SESSION_STORAGE_KEY,
      sessionIdSource: 'arg',
      createdAt: CREATED_AT,
      checks: [
        {
          id: 'lint-rich',
          tool: 'eslint',
          rawArtefactPath: 'baseline/checks/lint-rich/raw.json',
          status: 'failing',
          exitCode: 1,
          error: null,
        },
        {
          id: 'vitest-rich',
          tool: 'vitest',
          rawArtefactPath: 'baseline/checks/vitest-rich/raw.json',
          status: 'failing',
          exitCode: 1,
          error: null,
        },
        {
          id: 'playwright-empty',
          tool: 'playwright',
          rawArtefactPath: 'baseline/checks/playwright-empty/raw.json',
          status: 'failing',
          exitCode: 1,
          error: null,
        },
        {
          id: 'tsc-rich',
          tool: 'tsc',
          rawArtefactPath: 'baseline/checks/tsc-rich/raw.txt',
          status: 'failing',
          exitCode: 2,
          error: null,
        },
      ],
      readRawArtefact: async (rawArtefactPath) => {
        if (rawArtefactPath.includes('lint-rich')) {
          return [
            {
              filePath: 'src/rich.ts',
              messages: [
                { ruleId: 'a', severity: 2, message: 'a', line: 1, column: 1 },
                { ruleId: 'b', severity: 2, message: 'b', line: 2, column: 1 },
                { ruleId: 'c', severity: 1, message: 'c', line: 3, column: 1 },
                { ruleId: 'd', severity: 1, message: 'd', line: 4, column: 1 },
                { ruleId: 'e', severity: 1, message: 'e', line: 5, column: 1 },
                { ruleId: 'f', severity: 1, message: 'f', line: 6, column: 1 },
              ],
            },
          ];
        }

        if (rawArtefactPath.includes('vitest-rich')) {
          return {
            testResults: [
              {
                name: 'src/example.spec.ts',
                assertionResults: [
                  { ancestorTitles: ['suite'], title: 'pass', status: 'passed' },
                  { ancestorTitles: ['suite'], title: 'skip', status: 'skipped' },
                  { ancestorTitles: ['suite'], title: 'fail one', status: 'failed' },
                  { ancestorTitles: ['suite'], title: 'fail two', status: 'failed' },
                ],
              },
            ],
          };
        }

        if (rawArtefactPath.includes('playwright-empty')) {
          return {
            suites: [
              {
                title: 'pw',
                file: 'e2e/sample.spec.ts',
                specs: [],
              },
            ],
          };
        }

        if (rawArtefactPath.includes('tsc-rich')) {
          return [
            'src/a.ts(1,1): error TS1001: one',
            'src/b.ts(2,1): error TS1002: two',
            'src/c.ts(3,1): error TS1003: three',
            'src/d.ts(4,1): error TS1004: four',
            'src/e.ts(5,1): error TS1005: five',
            'src/f.ts(6,1): error TS1006: six',
          ].join('\n');
        }

        return {};
      },
    });

    expect(report).toContain('Errors: 2, Warnings: 4');
    expect(report).toContain('... and 1 more issues');
    expect(report).toContain('Failed: 2, Passed: 1, Skipped: 1');
    expect(report).toContain('Failed Tests:');
    expect(report).toContain('Diagnostics: 6');
    expect(report).toContain('... and 1 more diagnostics');
  });

  it('omits rich details when artefact reads fail or summaries contain no actionable failures', async () => {
    const { renderBaselineReport } = await loadCliModule();

    const report = await renderBaselineReport({
      sessionId: SESSION_ID,
      sessionStorageKey: SESSION_STORAGE_KEY,
      sessionIdSource: 'arg',
      createdAt: CREATED_AT,
      checks: [
        {
          id: 'lint-read-error',
          tool: 'eslint',
          rawArtefactPath: 'baseline/checks/lint-read-error/raw.json',
          status: 'failing',
          exitCode: null,
          error: null,
        },
        {
          id: 'tsc-empty',
          tool: 'tsc',
          rawArtefactPath: 'baseline/checks/tsc-empty/raw.txt',
          status: 'failing',
          exitCode: 2,
          error: null,
        },
      ],
      readRawArtefact: async (rawArtefactPath) => {
        if (rawArtefactPath.includes('lint-read-error')) {
          throw new Error('disk read failed');
        }

        return '';
      },
    });

    expect(report).toContain('lint-read-error (eslint)');
    expect(report).toContain('Exit Code: N/A');
    expect(report).not.toContain('Issues:');
    expect(report).not.toContain('Diagnostics:');
  });

  describe('extractCurrentFailures', () => {
    it('extracts eslint findings as fingerprints', async () => {
      const { extractCurrentFailures } = await loadCliModule();
      const result = extractCurrentFailures({
        kind: 'eslint',
        findings: [
          { fingerprint: 'rule-a|src/a.ts|1|1|msg a', severity: 2 },
          { fingerprint: 'rule-b|src/b.ts|2|1|msg b', severity: 2 },
        ],
        counts: { errors: 2, warnings: 0 },
      });
      expect(result).toEqual(['rule-a|src/a.ts|1|1|msg a', 'rule-b|src/b.ts|2|1|msg b']);
    });

    it('returns empty array when eslint findings is empty', async () => {
      const { extractCurrentFailures } = await loadCliModule();
      const result = extractCurrentFailures({
        kind: 'eslint',
        findings: [],
        counts: { errors: 0, warnings: 0 },
      });
      expect(result).toEqual([]);
    });

    it('returns empty array when eslint findings is missing', async () => {
      const { extractCurrentFailures } = await loadCliModule();
      const result = extractCurrentFailures({
        kind: 'eslint',
        counts: { errors: 0, warnings: 0 },
      });
      expect(result).toEqual([]);
    });

    it('extracts vitest failed test fingerprints', async () => {
      const { extractCurrentFailures } = await loadCliModule();
      const result = extractCurrentFailures({
        kind: 'vitest',
        tests: [
          { fingerprint: 'suite-a|test-a', status: 'failed' },
          { fingerprint: 'suite-a|test-b', status: 'passed' },
          { fingerprint: 'suite-b|test-c', status: 'failed' },
        ],
        counts: { total: 3, passed: 1, failed: 2, skipped: 0 },
      });
      expect(result).toEqual(['suite-a|test-a', 'suite-b|test-c']);
    });

    it('returns empty array when vitest has no failed tests', async () => {
      const { extractCurrentFailures } = await loadCliModule();
      const result = extractCurrentFailures({
        kind: 'vitest',
        tests: [
          { fingerprint: 'suite-a|test-a', status: 'passed' },
          { fingerprint: 'suite-a|test-b', status: 'passed' },
        ],
        counts: { total: 2, passed: 2, failed: 0, skipped: 0 },
      });
      expect(result).toEqual([]);
    });

    it('extracts playwright failed test fingerprints', async () => {
      const { extractCurrentFailures } = await loadCliModule();
      const result = extractCurrentFailures({
        kind: 'playwright',
        tests: [{ fingerprint: 'spec.ts|suite|test-x', status: 'failed' }],
        counts: { total: 1, passed: 0, failed: 1, skipped: 0 },
      });
      expect(result).toEqual(['spec.ts|suite|test-x']);
    });

    it('returns empty array when tests array is missing', async () => {
      const { extractCurrentFailures } = await loadCliModule();
      const result = extractCurrentFailures({
        kind: 'vitest',
        counts: { total: 0, passed: 0, failed: 0, skipped: 0 },
      } as Record<string, unknown>);
      expect(result).toEqual([]);
    });

    it('returns empty array for unsupported summary kinds', async () => {
      const { extractCurrentFailures } = await loadCliModule();
      const result = extractCurrentFailures({
        kind: 'unknown-kind',
        counts: {},
      } as Record<string, unknown>);
      expect(result).toEqual([]);
    });

    it('extracts tsc diagnostic fingerprints', async () => {
      const { extractCurrentFailures } = await loadCliModule();
      const result = extractCurrentFailures({
        kind: 'tsc',
        diagnostics: [
          { fingerprint: "TS1005|src/a.ts|1|1|';' expected." },
          { fingerprint: 'TS2304|src/b.ts|4|2|Cannot find name.' },
        ],
        counts: { diagnostics: 2 },
      });
      expect(result).toEqual([
        "TS1005|src/a.ts|1|1|';' expected.",
        'TS2304|src/b.ts|4|2|Cannot find name.',
      ]);
    });

    it('returns empty array when tsc diagnostics is empty', async () => {
      const { extractCurrentFailures } = await loadCliModule();
      const result = extractCurrentFailures({
        kind: 'tsc',
        diagnostics: [],
        counts: { diagnostics: 0 },
      });
      expect(result).toEqual([]);
    });
  });
});
