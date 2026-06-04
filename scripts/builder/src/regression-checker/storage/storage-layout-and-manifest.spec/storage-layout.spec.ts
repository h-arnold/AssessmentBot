import path from 'node:path';
import { promises as fs } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  BASELINE_CREATED_AT,
  COMPARE_CREATED_AT,
  createChecksFixture,
  getTempRoot,
  loadStorageModule,
  REPORT_DIRECTORY,
} from './fixtures.js';

import type { SessionManifest } from './fixtures.js';

describe('regression-checker storage layout and baseline compatibility', () => {
  it('creates baseline storage layout and baseline manifest for a new session', async () => {
    const { prepareSessionStorage, createSessionStorageKey } = await loadStorageModule();

    const sessionId = 'feature/storage-layout/new-baseline';
    const tempRoot = getTempRoot();
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
    const tempRoot = getTempRoot();

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
    const tempRoot = getTempRoot();

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
    const tempRoot = getTempRoot();

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

  it('writes deterministic manifest ordering and persisted artefact path references', async () => {
    const { prepareSessionStorage } = await loadStorageModule();

    const checks = createChecksFixture();
    const tempRoot = getTempRoot();
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
