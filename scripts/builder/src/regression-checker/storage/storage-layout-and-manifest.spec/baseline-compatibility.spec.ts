import { describe, expect, it } from 'vitest';

import { BASELINE_CREATED_AT, createChecksFixture, loadStorageModule } from './fixtures.js';

import type { SessionManifest } from './fixtures.js';

describe('regression-checker storage layout and baseline compatibility', () => {
  it('flags baseline incompatibility before diffing for fingerprint, check IDs, and tool families', async () => {
    const { evaluateBaselineCompatibility } = await loadStorageModule();

    const baselineManifest: SessionManifest = {
      sessionId: 'feature/baseline-compatibility',
      sessionStorageKey: 'feature-baseline-compatibility',
      sessionIdSource: 'arg',
      mode: 'baseline',
      createdAt: BASELINE_CREATED_AT,
      baselineCreatedThisRun: true,
      configFingerprint: 'config-fingerprint-v1',
      checks: createChecksFixture(),
    };

    expect(
      evaluateBaselineCompatibility({
        baselineManifest,
        currentConfigFingerprint: 'config-fingerprint-v2',
        currentChecks: baselineManifest.checks.map((check) => ({
          id: check.id,
          tool: check.tool,
          executionMetadata: check.executionMetadata,
        })),
      })
    ).toMatchObject({
      compatible: false,
      reason: {
        code: 'config-fingerprint-mismatch',
        message: expect.stringContaining('config fingerprint'),
      },
    });

    expect(
      evaluateBaselineCompatibility({
        baselineManifest,
        currentConfigFingerprint: baselineManifest.configFingerprint,
        currentChecks: [
          {
            id: 'single-check-only',
            tool: 'eslint',
            executionMetadata: { reporterMode: 'json' },
          },
        ],
      })
    ).toMatchObject({
      compatible: false,
      reason: {
        code: 'check-ids-mismatch',
        message: expect.stringContaining('check IDs'),
      },
    });

    expect(
      evaluateBaselineCompatibility({
        baselineManifest,
        currentConfigFingerprint: baselineManifest.configFingerprint,
        currentChecks: baselineManifest.checks.map((check) => ({
          id: check.id,
          tool: check.id === 'builder-compile' ? 'vitest' : check.tool,
          executionMetadata: check.executionMetadata,
        })),
      })
    ).toMatchObject({
      compatible: false,
      reason: {
        code: 'tool-families-mismatch',
        message: expect.stringContaining('tool families'),
      },
    });
  });

  it('flags baseline incompatibility before diffing when the same checks are listed in a different order', async () => {
    const { evaluateBaselineCompatibility } = await loadStorageModule();

    const baselineManifest: SessionManifest = {
      sessionId: 'feature/baseline-compatibility-metadata',
      sessionStorageKey: 'feature-baseline-compatibility-metadata',
      sessionIdSource: 'arg',
      mode: 'baseline',
      createdAt: BASELINE_CREATED_AT,
      baselineCreatedThisRun: true,
      configFingerprint: 'config-fingerprint-v1',
      checks: createChecksFixture(),
    };

    expect(
      evaluateBaselineCompatibility({
        baselineManifest,
        currentConfigFingerprint: baselineManifest.configFingerprint,
        currentChecks: [
          {
            id: 'builder-compile',
            tool: 'tsc',
            executionMetadata: {
              project: 'scripts/builder/tsconfig.json',
            },
          },
          {
            id: 'backend-lint-check',
            tool: 'eslint',
            executionMetadata: {
              reporterMode: 'json',
            },
          },
        ],
      })
    ).toMatchObject({
      compatible: false,
      reason: {
        code: 'check-ids-mismatch',
        message: expect.stringContaining('check IDs'),
      },
    });
  });

  it('treats matching metadata objects as compatible even when key order differs', async () => {
    const { evaluateBaselineCompatibility } = await loadStorageModule();

    const baselineManifest: SessionManifest = {
      sessionId: 'feature/baseline-compatibility-metadata-order',
      sessionStorageKey: 'feature-baseline-compatibility-metadata-order',
      sessionIdSource: 'arg',
      mode: 'baseline',
      createdAt: BASELINE_CREATED_AT,
      baselineCreatedThisRun: true,
      configFingerprint: 'config-fingerprint-v1',
      checks: [
        {
          id: 'backend-lint-check',
          tool: 'eslint',
          cwd: '.',
          executionMetadata: {
            reporterMode: 'json',
            cache: 'enabled',
          },
          rawArtefactPath: 'checks/backend-lint-check/raw.json',
          derivedSummaryPath: 'checks/backend-lint-check/derived.json',
        },
        {
          id: 'builder-compile',
          tool: 'tsc',
          cwd: '.',
          executionMetadata: {
            project: 'scripts/builder/tsconfig.json',
            incremental: false,
          },
          rawArtefactPath: 'checks/builder-compile/raw.txt',
          derivedSummaryPath: 'checks/builder-compile/derived.json',
        },
      ],
    };

    expect(
      evaluateBaselineCompatibility({
        baselineManifest,
        currentConfigFingerprint: baselineManifest.configFingerprint,
        currentChecks: baselineManifest.checks.map((check) => {
          const executionMetadata: Record<string, string | number | boolean | null> =
            check.id === 'backend-lint-check'
              ? {
                  cache: 'enabled',
                  reporterMode: 'json',
                }
              : {
                  incremental: false,
                  project: 'scripts/builder/tsconfig.json',
                };

          return {
            id: check.id,
            tool: check.tool,
            executionMetadata,
          };
        }),
      })
    ).toEqual({ compatible: true });
  });

  it('flags baseline incompatibility before diffing when execution metadata differs', async () => {
    const { evaluateBaselineCompatibility } = await loadStorageModule();

    const baselineManifest: SessionManifest = {
      sessionId: 'feature/baseline-compatibility-metadata',
      sessionStorageKey: 'feature-baseline-compatibility-metadata',
      sessionIdSource: 'arg',
      mode: 'baseline',
      createdAt: BASELINE_CREATED_AT,
      baselineCreatedThisRun: true,
      configFingerprint: 'config-fingerprint-v1',
      checks: createChecksFixture(),
    };

    expect(
      evaluateBaselineCompatibility({
        baselineManifest,
        currentConfigFingerprint: baselineManifest.configFingerprint,
        currentChecks: baselineManifest.checks.map((check) => ({
          id: check.id,
          tool: check.tool,
          executionMetadata:
            check.id === 'backend-lint-check'
              ? {
                  reporterMode: 'stylish',
                }
              : check.executionMetadata,
        })),
      })
    ).toMatchObject({
      compatible: false,
      reason: {
        code: 'execution-metadata-mismatch',
        message: expect.stringContaining('execution metadata'),
      },
    });
  });
});
