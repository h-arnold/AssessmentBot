import path from 'node:path';
import { promises as fs } from 'node:fs';

import { BuildStageError } from './errors.js';
import type { BuildStageId } from '../types.js';

/**
 * Checks whether a path exists.
 *
 * @param {string} targetPath - Absolute or relative path to inspect.
 * @returns {Promise<boolean>} `true` when the path exists.
 */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch (err) {
    if (isErrnoExceptionWithCode(err, 'ENOENT')) {
      return false;
    }
    throw err;
  }
}

/**
 * Verifies that a path exists and is a directory.
 *
 * @param {string} targetPath - Path to validate.
 * @param {string} label - Friendly label used in error messages.
 * @param {BuildStageId} stage - Build stage identifier for failure context.
 * @returns {Promise<void>} Resolves when the path is a valid directory.
 */
export async function requireDirectory(
  targetPath: string,
  label: string,
  stage: BuildStageId
): Promise<void> {
  try {
    const stats = await fs.stat(targetPath);
    if (!stats.isDirectory()) {
      throw new BuildStageError(stage, `${label} is not a directory: ${targetPath}`);
    }
  } catch (err) {
    if (err instanceof BuildStageError) {
      throw err;
    }
    throw new BuildStageError(stage, `${label} is missing: ${targetPath}`, err);
  }
}

/**
 * Verifies that a path exists and is a file.
 *
 * @param {string} targetPath - Path to validate.
 * @param {string} label - Friendly label used in error messages.
 * @param {BuildStageId} stage - Build stage identifier for failure context.
 * @returns {Promise<void>} Resolves when the path is a valid file.
 */
export async function requireFile(
  targetPath: string,
  label: string,
  stage: BuildStageId
): Promise<void> {
  try {
    const stats = await fs.stat(targetPath);
    if (!stats.isFile()) {
      throw new BuildStageError(stage, `${label} is not a file: ${targetPath}`);
    }
  } catch (err) {
    if (err instanceof BuildStageError) {
      throw err;
    }
    throw new BuildStageError(stage, `${label} is missing: ${targetPath}`, err);
  }
}

/**
 * Normalises path separators to forward slashes.
 *
 * @param {string} targetPath - Path string to normalise.
 * @returns {string} Path using forward-slash separators.
 */
export function normalisePathSeparators(targetPath: string): string {
  return targetPath.replaceAll('\\', '/');
}

/**
 * Detects absolute paths across POSIX and Windows formats.
 *
 * @param {string} value - Separator-normalised path.
 * @returns {boolean} `true` when the path is absolute.
 */
export function isCrossPlatformAbsolutePath(value: string): boolean {
  return value.startsWith('/') || value.startsWith('//') || /^[A-Za-z]:\//u.test(value);
}

/**
 * Determines whether path segments attempt to traverse above repo root.
 *
 * @param {string[]} segments - Path segments.
 * @returns {string[] | null} Canonical segments or `null` when traversal escapes root.
 */
export function normaliseRelativeSegments(segments: string[]): string[] | null {
  const canonicalSegments: string[] = [];

  for (const segment of segments) {
    if (segment === '' || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (canonicalSegments.length === 0) {
        return null;
      }

      canonicalSegments.pop();
      continue;
    }

    canonicalSegments.push(segment);
  }

  return canonicalSegments;
}

/**
 * Narrows an error to an errno exception with a matching code.
 *
 * @param {unknown} error - Candidate error value.
 * @param {string} code - Error code to match.
 * @returns {error is NodeJS.ErrnoException} `true` when the error matches the code.
 */
export function isErrnoExceptionWithCode(
  error: unknown,
  code: string
): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

/**
 * Joins a child path using the separator style implied by the root path.
 *
 * @param {string} rootDir - Root directory being traversed.
 * @param {string} childName - Directory entry name to append.
 * @returns {string} Joined child path preserving the root path style.
 */
function joinChildPath(rootDir: string, childName: string): string {
  return rootDir.includes('\\')
    ? path.win32.join(rootDir, childName)
    : path.join(rootDir, childName);
}

/**
 * Recursively lists files beneath a directory in deterministic order.
 *
 * @param {string} rootDir - Directory to scan.
 * @returns {Promise<string[]>} Absolute file paths.
 */
export async function listFilesRecursive(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];

  for (const entry of sortedEntries) {
    const entryPath = joinChildPath(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(entryPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * Removes a directory recursively.
 *
 * @param {string} targetPath - Directory path to remove.
 * @returns {Promise<void>} Resolves when removal completes.
 */
export async function removeDir(targetPath: string): Promise<void> {
  await fs.rm(targetPath, { recursive: true, force: true });
}

/**
 * Ensures one or more directories exist.
 *
 * @param {string | string[]} targets - Directory path or paths to create.
 * @returns {Promise<void>} Resolves when all target directories exist.
 */
export async function ensureDirs(targets: string | string[]): Promise<void> {
  const targetList = Array.isArray(targets) ? targets : [targets];

  for (const target of targetList) {
    await fs.mkdir(target, { recursive: true });
  }
}
