import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach } from 'vitest';

export type SessionIdSource = 'arg' | 'git-branch';
export type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';
export type StorageMode = 'baseline' | 'compare';

export type SessionManifestCheck = {
  id: string;
  tool: RegressionTool;
  cwd: string;
  executionMetadata: Record<string, string | number | boolean | null>;
  rawArtefactPath: string;
  derivedSummaryPath: string;
};

export type SessionManifest = {
  sessionId: string;
  sessionStorageKey: string;
  sessionIdSource: SessionIdSource;
  mode: StorageMode;
  createdAt: string;
  baselineCreatedThisRun: boolean;
  configFingerprint: string;
  checks: SessionManifestCheck[];
};

export type PrepareSessionStorageOptions = {
  repoRoot: string;
  reportDirectory: string;
  sessionId: string;
  sessionIdSource: SessionIdSource;
  createdAt: string;
  configFingerprint: string;
  checks: SessionManifestCheck[];
};

export type PrepareSessionStorageResult = {
  mode: StorageMode;
  sessionStorageKey: string;
  sessionDirectory: string;
  baselineDirectory: string;
  baselineManifestPath: string;
  currentRunDirectory: string | null;
  currentManifestPath: string;
  manifest: SessionManifest;
};

export type BaselineCompatibilityResult =
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

export type StorageModule = {
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

export const REPORT_DIRECTORY = '.ts-regression-checker/reports';
export const BASELINE_CREATED_AT = '2026-03-01T09:00:00.000Z';
export const COMPARE_CREATED_AT = '2026-03-01T10:30:45.000Z';

let tempRoot = '';

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-storage-red-spec-'));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

/**
 * Returns a fresh temporary root directory for test filesystem operations.
 *
 * @returns {string} Absolute path to the current temporary root.
 */
export function getTempRoot(): string {
  return tempRoot;
}

/**
 * Loads the storage module under test.
 *
 * @returns {Promise<StorageModule>} Storage exports for session layout and manifest writing.
 */
export async function loadStorageModule(): Promise<StorageModule> {
  const modulePath = '../session-storage.js';
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
export function createChecksFixture(): SessionManifestCheck[] {
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
