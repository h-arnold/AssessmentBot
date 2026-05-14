import path from 'node:path';
import { promises as fs } from 'node:fs';

import { normalisePathSeparators, pathExists } from '../../lib/fs.js';

const MANIFEST_FILE_NAME = 'manifest.json';
const MANIFEST_JSON_INDENT_SPACES = 2;
const BASELINE_DIRECTORY_NAME = 'baseline';
const RUNS_DIRECTORY_NAME = 'runs';
const SESSION_KEY_PREFIX = 'session-';
const WINDOWS_INVALID_FILENAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001F]/gu;
const MULTIPLE_DASHES = /-{2,}/gu;

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

type BaselineCompatibilityOptions = {
  baselineManifest: SessionManifest;
  currentConfigFingerprint: string;
  currentChecks: Array<{
    id: string;
    tool: RegressionTool;
    executionMetadata: Record<string, string | number | boolean | null>;
  }>;
};

/**
 * Derives a readable filesystem-safe key for session storage directories.
 *
 * @param {string} sessionId - Logical session identifier.
 * @returns {string} Safe directory key derived from the session name.
 */
export function createSessionStorageKey(sessionId: string): string {
  const normalisedSessionId = normalisePathSeparators(sessionId.trim());
  const withoutInvalidCharacters = normalisedSessionId.replaceAll(
    WINDOWS_INVALID_FILENAME_CHARACTERS,
    '-'
  );
  const withSingleDashGroups = withoutInvalidCharacters.replaceAll(MULTIPLE_DASHES, '-');
  let withoutBoundaryDashes = withSingleDashGroups;
  while (withoutBoundaryDashes.startsWith('-')) {
    withoutBoundaryDashes = withoutBoundaryDashes.substring(1);
  }
  while (withoutBoundaryDashes.endsWith('-')) {
    withoutBoundaryDashes = withoutBoundaryDashes.substring(0, withoutBoundaryDashes.length - 1);
  }
  const fallbackSafeName = withoutBoundaryDashes.length > 0 ? withoutBoundaryDashes : 'session';
  return `${SESSION_KEY_PREFIX}${fallbackSafeName}`;
}

/**
 * Creates a stable filesystem-safe directory segment from the run timestamp.
 *
 * @param {string} createdAt - Run timestamp used in manifests.
 * @returns {string} Safe run-directory segment derived from the timestamp.
 */
function sanitiseRunDirectoryTimestamp(createdAt: string): string {
  const trimmedTimestamp = createdAt.trim();
  const withoutInvalidCharacters = trimmedTimestamp.replaceAll(
    WINDOWS_INVALID_FILENAME_CHARACTERS,
    '-'
  );
  let withoutTrailingWindowsCharacters = withoutInvalidCharacters;
  while (
    withoutTrailingWindowsCharacters.endsWith('.') ||
    withoutTrailingWindowsCharacters.endsWith(' ')
  ) {
    withoutTrailingWindowsCharacters = withoutTrailingWindowsCharacters.substring(
      0,
      withoutTrailingWindowsCharacters.length - 1
    );
  }

  return withoutTrailingWindowsCharacters.length > 0 ? withoutTrailingWindowsCharacters : 'run';
}

/**
 * Creates session storage directories and writes a baseline or compare manifest.
 *
 * @param {PrepareSessionStorageOptions} options - Session storage context and manifest inputs.
 * @returns {Promise<PrepareSessionStorageResult>} Storage mode, paths, and persisted manifest.
 */
export async function prepareSessionStorage(
  options: PrepareSessionStorageOptions
): Promise<PrepareSessionStorageResult> {
  const reportRoot = resolveSafeReportRoot(options.repoRoot, options.reportDirectory);
  const sessionStorageKey = createSessionStorageKey(options.sessionId);
  const sessionDirectory = path.join(reportRoot, sessionStorageKey);
  const baselineDirectory = path.join(sessionDirectory, BASELINE_DIRECTORY_NAME);
  const baselineManifestPath = path.join(baselineDirectory, MANIFEST_FILE_NAME);
  const hasExistingBaseline = await pathExists(baselineManifestPath);

  if (!hasExistingBaseline) {
    await fs.mkdir(baselineDirectory, { recursive: true });
    const manifest = buildSessionManifest({
      ...options,
      sessionStorageKey,
      mode: 'baseline',
      baselineCreatedThisRun: true,
    });
    await writeManifest(baselineManifestPath, manifest);

    return {
      mode: 'baseline',
      sessionStorageKey,
      sessionDirectory,
      baselineDirectory,
      baselineManifestPath,
      currentRunDirectory: null,
      currentManifestPath: baselineManifestPath,
      manifest,
    };
  }

  const runDirectoryTimestamp = sanitiseRunDirectoryTimestamp(options.createdAt);
  const currentRunDirectory = path.join(
    sessionDirectory,
    RUNS_DIRECTORY_NAME,
    runDirectoryTimestamp
  );
  const currentManifestPath = path.join(currentRunDirectory, MANIFEST_FILE_NAME);

  await fs.mkdir(currentRunDirectory, { recursive: true });

  const manifest = buildSessionManifest({
    ...options,
    sessionStorageKey,
    mode: 'compare',
    baselineCreatedThisRun: false,
  });
  await writeManifest(currentManifestPath, manifest);

  return {
    mode: 'compare',
    sessionStorageKey,
    sessionDirectory,
    baselineDirectory,
    baselineManifestPath,
    currentRunDirectory,
    currentManifestPath,
    manifest,
  };
}

/**
 * Compares baseline manifest identity metadata to current run metadata.
 *
 * @param {BaselineCompatibilityOptions} options - Baseline and current metadata.
 * @returns {BaselineCompatibilityResult} Compatibility result for diff preflight.
 */
export function evaluateBaselineCompatibility(
  options: BaselineCompatibilityOptions
): BaselineCompatibilityResult {
  if (options.baselineManifest.configFingerprint !== options.currentConfigFingerprint) {
    return {
      compatible: false,
      reason: {
        code: 'config-fingerprint-mismatch',
        message: 'Baseline is incompatible: config fingerprint differs from the current run.',
      },
    };
  }

  const baselineCheckIds = options.baselineManifest.checks.map((check) => check.id);
  const currentCheckIds = options.currentChecks.map((check) => check.id);
  if (!areArraysEqual(baselineCheckIds, currentCheckIds)) {
    return {
      compatible: false,
      reason: {
        code: 'check-ids-mismatch',
        message: 'Baseline is incompatible: check IDs differ from the current run.',
      },
    };
  }

  const baselineChecksById = new Map(
    options.baselineManifest.checks.map((check) => [check.id, check])
  );
  for (const currentCheck of options.currentChecks) {
    const baselineCheck = baselineChecksById.get(currentCheck.id);
    if (baselineCheck === undefined) {
      return {
        compatible: false,
        reason: {
          code: 'check-ids-mismatch',
          message: 'Baseline is incompatible: check IDs differ from the current run.',
        },
      };
    }

    if (baselineCheck.tool !== currentCheck.tool) {
      return {
        compatible: false,
        reason: {
          code: 'tool-families-mismatch',
          message: 'Baseline is incompatible: check tool families differ from the current run.',
        },
      };
    }

    if (
      stableStringify(baselineCheck.executionMetadata) !==
      stableStringify(currentCheck.executionMetadata)
    ) {
      return {
        compatible: false,
        reason: {
          code: 'execution-metadata-mismatch',
          message:
            'Baseline is incompatible: check execution metadata differs from the current run.',
        },
      };
    }
  }

  return { compatible: true };
}

/**
 * Resolves the report directory path and rejects paths escaping the repository root.
 *
 * @param {string} repoRoot - Absolute repository root path.
 * @param {string} reportDirectory - Configured report directory path.
 * @returns {string} Absolute resolved report directory path.
 */
function resolveSafeReportRoot(repoRoot: string, reportDirectory: string): string {
  const normalisedReportDirectory = normalisePathSeparators(reportDirectory.trim());
  if (normalisedReportDirectory.length === 0) {
    throw new Error('reportDirectory must be a non-empty path.');
  }

  const resolvedPath = path.resolve(repoRoot, normalisedReportDirectory);
  const relativePath = path.relative(repoRoot, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`reportDirectory must resolve inside repo root: ${reportDirectory}`);
  }

  return resolvedPath;
}

/**
 * Creates a deterministic manifest object with stable top-level key ordering.
 *
 * @param {PrepareSessionStorageOptions & { sessionStorageKey: string; mode: StorageMode; baselineCreatedThisRun: boolean; }} options - Manifest source fields.
 * @returns {SessionManifest} Ordered manifest payload.
 */
function buildSessionManifest(
  options: PrepareSessionStorageOptions & {
    sessionStorageKey: string;
    mode: StorageMode;
    baselineCreatedThisRun: boolean;
  }
): SessionManifest {
  return {
    sessionId: options.sessionId,
    sessionStorageKey: options.sessionStorageKey,
    sessionIdSource: options.sessionIdSource,
    mode: options.mode,
    createdAt: options.createdAt,
    baselineCreatedThisRun: options.baselineCreatedThisRun,
    configFingerprint: options.configFingerprint,
    checks: options.checks.map((check) => ({
      id: check.id,
      tool: check.tool,
      cwd: check.cwd,
      executionMetadata: check.executionMetadata,
      rawArtefactPath: check.rawArtefactPath,
      derivedSummaryPath: check.derivedSummaryPath,
    })),
  };
}

/**
 * Writes a manifest JSON file using deterministic serialisation.
 *
 * @param {string} manifestPath - Absolute manifest path.
 * @param {SessionManifest} manifest - Manifest payload.
 * @returns {Promise<void>} Resolves after writing completes.
 */
async function writeManifest(manifestPath: string, manifest: SessionManifest): Promise<void> {
  const manifestText = `${JSON.stringify(manifest, null, MANIFEST_JSON_INDENT_SPACES)}
`;
  await fs.writeFile(manifestPath, manifestText, 'utf8');
}

/**
 * Compares two arrays by strict positional equality.
 *
 * @param {readonly string[]} left - Left array.
 * @param {readonly string[]} right - Right array.
 * @returns {boolean} true when arrays are equal in size and order.
 */
function areArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightIterator = right.values();
  for (const leftValue of left) {
    const rightValue = rightIterator.next();
    if (rightValue.done || leftValue !== rightValue.value) {
      return false;
    }
  }

  return true;
}

/**
 * Produces stable JSON for object comparisons where key ordering should not matter.
 *
 * @param {Record<string, string | number | boolean | null>} value - Metadata object.
 * @returns {string} Deterministic serialised representation.
 */
function stableStringify(value: Record<string, string | number | boolean | null>): string {
  const sortedEntries = Object.entries(value).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey)
  );
  return JSON.stringify(Object.fromEntries(sortedEntries));
}
