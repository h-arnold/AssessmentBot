import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type SessionIdSource = 'arg' | 'git-branch';
type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';
type StorageMode = 'baseline' | 'compare';

type SessionManifestCheck = {
  id: string;
  tool: RegressionTool;
  cwd: string;
  executionMetadata: Record<string, string | number | boolean | null>;
  rawArtefactPath: string;
  derivedSummaryPath: string;
};

type SessionManifest = {
  sessionId: string;
  sessionStorageKey: string;
  sessionIdSource: SessionIdSource;
  mode: StorageMode;
  createdAt: string;
  baselineCreatedThisRun: boolean;
  configFingerprint: string;
  checks: SessionManifestCheck[];
};

type PrepareSessionStorageOptions = {
  repoRoot: string;
  reportDirectory: string;
  sessionId: string;
  sessionIdSource: SessionIdSource;
  createdAt: string;
  configFingerprint: string;
  checks: SessionManifestCheck[];
};

type PrepareSessionStorageResult = {
  mode: StorageMode;
  sessionStorageKey: string;
  sessionDirectory: string;
  baselineDirectory: string;
  baselineManifestPath: string;
  currentRunDirectory: string | null;
  currentManifestPath: string;
  manifest: SessionManifest;
};

type BaselineCompatibilityResult =
  | { compatible: true }
  | {
      compatible: false;
      reason: {
        code:
          | 'config-fingerprint-mismatch'
          | 'check-ids-mismatch'
          | 'tool-families-mismatch'
          | 'execution-metadata-mismatch';
        message: string;
      };
    };

type StorageModule = {
  createSessionStorageKey: (sessionId: string) => string;
  prepareSessionStorage: (
    options: PrepareSessionStorageOptions
  ) => Promise<PrepareSessionStorageResult>;
  evaluateBaselineCompatibility: (options: {
    baselineManifest: SessionManifest;
    currentConfigFingerprint: string;
    currentChecks: Array<{
      id: string;
      tool: RegressionTool;
      executionMetadata: Record<string, string | number | boolean | null>;
    }>;
  }) => BaselineCompatibilityResult;
};

const REPORT_DIRECTORY = '.ts-regression-checker/reports';
const BASELINE_CREATED_AT = '2026-03-01T09:00:00.000Z';
const COMPARE_CREATED_AT = '2026-03-01T10:30:45.000Z';

let tempRoot = '';

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-storage-red-spec-'));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

/**
 * Loads the storage module under test.
 *
 * @returns {Promise<StorageModule>} Storage exports for session layout and manifest writing.
 */
async function loadStorageModule(): Promise<StorageModule> {
  const modulePath = './session-storage.js';
  try {
    return (await import(modulePath)) as StorageModule;
  } catch (error) {
    throw new Error(
      'Section 2 requires ' +
        modulePath +
        ' to provide createSessionStorageKey, prepareSessionStorage, and evaluateBaselineCompatibility.',
      { cause: error }
    );
  }
}

/**
 * Creates deterministic check metadata for manifest tests.
 *
 * @returns {SessionManifestCheck[]} Ordered check metadata fixture.
 */
function createChecksFixture(): SessionManifestCheck[] {
  return [
    {
      id: 'backend-lint-check',
      tool: 'eslint',
      cwd: '.',
      executionMetadata: {
        reporterMode: 'json',
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
      },
      rawArtefactPath: 'checks/builder-compile/raw.txt',
      derivedSummaryPath: 'checks/builder-compile/derived.json',
    },
  ];
}

describe('regression-checker storage layout and baseline compatibility', () => {
  it('creates baseline storage layout and baseline manifest for a new session', async () => {
    const { prepareSessionStorage, createSessionStorageKey } = await loadStorageModule();

    const sessionId = 'feature/storage-layout/new-baseline';
    const expectedStorageKey = createSessionStorageKey(sessionId);
    const result = await prepareSessionStorage({
      repoRoot: tempRoot,
      reportDirectory: REPORT_DIRECTORY,
      sessionId,
      sessionIdSource: 'arg',
      createdAt: BASELINE_CREATED_AT,
      configFingerprint: 'config-fingerprint-v1',
      checks: createChecksFixture(),
    });

    const expectedBaselineDirectory = path.join(
      tempRoot,
      REPORT_DIRECTORY,
      expectedStorageKey,
      'baseline'
    );

    expect(result.mode).toBe('baseline');
    expect(result.sessionStorageKey).toBe(expectedStorageKey);
    expect(result.baselineDirectory).toBe(expectedBaselineDirectory);
    expect(result.currentRunDirectory).toBeNull();

    await expect(fs.stat(expectedBaselineDirectory)).resolves.toMatchObject({
      isDirectory: expect.any(Function),
    });

    const baselineManifest = JSON.parse(
      await fs.readFile(result.baselineManifestPath, 'utf8')
    ) as SessionManifest;

    expect(baselineManifest).toMatchObject({
      sessionId,
      sessionStorageKey: expectedStorageKey,
      sessionIdSource: 'arg',
      mode: 'baseline',
      createdAt: BASELINE_CREATED_AT,
      baselineCreatedThisRun: true,
      configFingerprint: 'config-fingerprint-v1',
    });
  });

  it('rejects empty report directories and report directories outside the repository root', async () => {
    const { prepareSessionStorage } = await loadStorageModule();

    await expect(
      prepareSessionStorage({
        repoRoot: tempRoot,
        reportDirectory: '   ',
        sessionId: 'feature/report-directory-validation',
        sessionIdSource: 'arg',
        createdAt: BASELINE_CREATED_AT,
        configFingerprint: 'config-fingerprint-v1',
        checks: createChecksFixture(),
      })
    ).rejects.toThrow('reportDirectory must be a non-empty path.');

    await expect(
      prepareSessionStorage({
        repoRoot: tempRoot,
        reportDirectory: '../outside',
        sessionId: 'feature/report-directory-validation',
        sessionIdSource: 'arg',
        createdAt: BASELINE_CREATED_AT,
        configFingerprint: 'config-fingerprint-v1',
        checks: createChecksFixture(),
      })
    ).rejects.toThrow('reportDirectory must resolve inside repo root: ../outside');
  });

  it('creates compare-mode run storage when a baseline already exists', async () => {
    const { prepareSessionStorage, createSessionStorageKey } = await loadStorageModule();

    const sessionId = 'feature/storage-layout/compare-existing-baseline';

    const expectedStorageKey = createSessionStorageKey(sessionId);

    await prepareSessionStorage({
      repoRoot: tempRoot,
      reportDirectory: REPORT_DIRECTORY,
      sessionId,
      sessionIdSource: 'git-branch',
      createdAt: BASELINE_CREATED_AT,
      configFingerprint: 'config-fingerprint-v1',
      checks: createChecksFixture(),
    });

    const compareResult = await prepareSessionStorage({
      repoRoot: tempRoot,
      reportDirectory: REPORT_DIRECTORY,
      sessionId,
      sessionIdSource: 'git-branch',
      createdAt: COMPARE_CREATED_AT,
      configFingerprint: 'config-fingerprint-v1',
      checks: createChecksFixture(),
    });

    const repeatedCompareResult = await prepareSessionStorage({
      repoRoot: tempRoot,
      reportDirectory: REPORT_DIRECTORY,
      sessionId,
      sessionIdSource: 'git-branch',
      createdAt: COMPARE_CREATED_AT,
      configFingerprint: 'config-fingerprint-v1',
      checks: createChecksFixture(),
    });

    expect(compareResult.mode).toBe('compare');
    expect(compareResult.sessionStorageKey).toBe(expectedStorageKey);
    expect(compareResult.currentRunDirectory).not.toBeNull();

    if (compareResult.currentRunDirectory === null) {
      throw new Error('currentRunDirectory must be present for compare mode.');
    }

    const runDirectorySegment = path.basename(compareResult.currentRunDirectory);
    const expectedRunDirectory = path.join(
      tempRoot,
      REPORT_DIRECTORY,
      expectedStorageKey,
      'runs',
      runDirectorySegment
    );

    expect(compareResult.currentRunDirectory).toBe(expectedRunDirectory);
    expect(repeatedCompareResult.currentRunDirectory).toBe(compareResult.currentRunDirectory);
    expect(runDirectorySegment).toBe(COMPARE_CREATED_AT.replaceAll(':', '-'));
    expect(runDirectorySegment).toMatch(/^[A-Za-z0-9._-]+$/u);
    expect(runDirectorySegment).not.toMatch(/[<>:"/\\|?*]/u);

    await expect(fs.stat(compareResult.currentRunDirectory)).resolves.toMatchObject({
      isDirectory: expect.any(Function),
    });

    const compareManifest = JSON.parse(
      await fs.readFile(compareResult.currentManifestPath, 'utf8')
    ) as SessionManifest;
    expect(compareManifest).toMatchObject({
      mode: 'compare',
      baselineCreatedThisRun: false,
      sessionId,
      sessionStorageKey: expectedStorageKey,
      sessionIdSource: 'git-branch',
      createdAt: COMPARE_CREATED_AT,
    });
  });

  it('derives stable filesystem-safe storage keys from branch-like session IDs', async () => {
    const { createSessionStorageKey } = await loadStorageModule();

    const sessionId = 'feature/AB-123/fix.storage-layout.v1';

    const firstKey = createSessionStorageKey(sessionId);
    const secondKey = createSessionStorageKey(sessionId);

    expect(firstKey).toBe(secondKey);
    expect(firstKey).toMatch(/^[A-Za-z0-9._-]+$/u);
    expect(firstKey).not.toContain('/');
    expect(firstKey).not.toContain('\\');
  });

  it('falls back to the default storage key when the session ID contains only invalid characters', async () => {
    const { createSessionStorageKey } = await loadStorageModule();

    expect(createSessionStorageKey('///')).toBe('session-session');
  });

  it('falls back to the default compare run directory when the timestamp sanitises to nothing', async () => {
    const { prepareSessionStorage } = await loadStorageModule();

    const sessionId = 'feature/default-compare-run-directory';

    await prepareSessionStorage({
      repoRoot: tempRoot,
      reportDirectory: REPORT_DIRECTORY,
      sessionId,
      sessionIdSource: 'git-branch',
      createdAt: BASELINE_CREATED_AT,
      configFingerprint: 'config-fingerprint-v1',
      checks: createChecksFixture(),
    });

    const compareResult = await prepareSessionStorage({
      repoRoot: tempRoot,
      reportDirectory: REPORT_DIRECTORY,
      sessionId,
      sessionIdSource: 'git-branch',
      createdAt: '...   ',
      configFingerprint: 'config-fingerprint-v1',
      checks: createChecksFixture(),
    });

    if (compareResult.currentRunDirectory === null) {
      throw new Error('currentRunDirectory must be present for compare mode.');
    }

    expect(path.basename(compareResult.currentRunDirectory)).toBe('run');
  });

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

  it('writes deterministic manifest ordering and persisted artefact path references', async () => {
    const { prepareSessionStorage } = await loadStorageModule();

    const checks = createChecksFixture();
    const result = await prepareSessionStorage({
      repoRoot: tempRoot,
      reportDirectory: REPORT_DIRECTORY,
      sessionId: 'feature/deterministic-manifest-ordering',
      sessionIdSource: 'arg',
      createdAt: BASELINE_CREATED_AT,
      configFingerprint: 'config-fingerprint-v1',
      checks,
    });

    const manifestText = await fs.readFile(result.baselineManifestPath, 'utf8');
    const manifest = JSON.parse(manifestText) as SessionManifest;

    expect(Object.keys(manifest)).toEqual([
      'sessionId',
      'sessionStorageKey',
      'sessionIdSource',
      'mode',
      'createdAt',
      'baselineCreatedThisRun',
      'configFingerprint',
      'checks',
    ]);

    expect(manifest.checks.map((check) => check.id)).toEqual(checks.map((check) => check.id));
    expect(manifest.checks.map((check) => check.rawArtefactPath)).toEqual(
      checks.map((check) => check.rawArtefactPath)
    );
    expect(manifest.checks.map((check) => check.derivedSummaryPath)).toEqual(
      checks.map((check) => check.derivedSummaryPath)
    );
  });
});
