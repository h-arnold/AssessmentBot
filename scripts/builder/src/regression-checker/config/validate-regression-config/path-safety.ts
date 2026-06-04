import path from 'node:path';

import {
  isCrossPlatformAbsolutePath,
  normalisePathSeparators,
  normaliseRelativeSegments,
} from '../../../lib/fs.js';

/**
 * Validates a repo-relative config path and returns the normalised value.
 *
 * @param {string} repoRoot - Absolute repository root.
 * @param {string} configuredPath - Raw configured path.
 * @param {string} label - Path label for errors.
 * @param {{allowRepoRoot?: boolean}} [options] - Path safety options.
 * @param {boolean} [options.allowRepoRoot] - Allow the repo root itself as a valid result.
 * @returns {string} Normalised repo-relative path.
 */
function validateRepoRelativePath(
  repoRoot: string,
  configuredPath: string,
  label: string,
  options: { allowRepoRoot?: boolean } = {}
): string {
  const trimmedPath = configuredPath.trim();
  const separatorNormalisedPath = normalisePathSeparators(trimmedPath);
  assertRepoRelativePathIsValid(repoRoot, configuredPath, separatorNormalisedPath, label, options);

  return path.posix.normalize(separatorNormalisedPath);
}

/**
 * Enforces repo-root containment for a validated path candidate.
 *
 * @param {string} repoRoot - Absolute repository root.
 * @param {string} configuredPath - Raw configured path for error messages.
 * @param {string} separatorNormalisedPath - Path with normalised separators.
 * @param {string} label - Path label for errors.
 * @param {{allowRepoRoot?: boolean}} [options] - Path safety options.
 * @param {boolean} [options.allowRepoRoot] - Allow the repository root itself as a valid result.
 * @returns {void}
 */
function assertRepoRelativePathIsValid(
  repoRoot: string,
  configuredPath: string,
  separatorNormalisedPath: string,
  label: string,
  options: { allowRepoRoot?: boolean } = {}
): void {
  assertPathIsNotEmpty(separatorNormalisedPath, label);
  assertPathIsNotAbsolute(separatorNormalisedPath, configuredPath, label);
  assertPathDoesNotEscapeRepoRoot(separatorNormalisedPath, configuredPath, label);
  assertPathResolvesInsideRepoRoot(
    repoRoot,
    separatorNormalisedPath,
    configuredPath,
    label,
    options
  );
}

/**
 * Ensures a normalised path is not empty.
 *
 * @param {string} separatorNormalisedPath - Path with normalised separators.
 * @param {string} label - Path label for errors.
 * @returns {void}
 */
function assertPathIsNotEmpty(separatorNormalisedPath: string, label: string): void {
  if (separatorNormalisedPath.length === 0) {
    throw new Error(`${label} must be a non-empty path.`);
  }
}

/**
 * Ensures a normalised path is not absolute.
 *
 * @param {string} separatorNormalisedPath - Path with normalised separators.
 * @param {string} configuredPath - Raw configured path for errors.
 * @param {string} label - Path label for errors.
 * @returns {void}
 */
function assertPathIsNotAbsolute(
  separatorNormalisedPath: string,
  configuredPath: string,
  label: string
): void {
  if (isCrossPlatformAbsolutePath(separatorNormalisedPath)) {
    throw new Error(`${label} must resolve inside repo root: ${configuredPath}`);
  }
}

/**
 * Ensures a normalised path does not traverse above the repository root.
 *
 * @param {string} separatorNormalisedPath - Path with normalised separators.
 * @param {string} configuredPath - Raw configured path for errors.
 * @param {string} label - Path label for errors.
 * @returns {void}
 */
function assertPathDoesNotEscapeRepoRoot(
  separatorNormalisedPath: string,
  configuredPath: string,
  label: string
): void {
  if (normaliseRelativeSegments(separatorNormalisedPath.split('/')) === null) {
    throw new Error(`${label} must resolve inside repo root: ${configuredPath}`);
  }
}

/**
 * Ensures a path resolves within the repository root.
 *
 * @param {string} repoRoot - Absolute repository root.
 * @param {string} separatorNormalisedPath - Path with normalised separators.
 * @param {string} configuredPath - Raw configured path for errors.
 * @param {string} label - Path label for errors.
 * @param {{allowRepoRoot?: boolean}} options - Path safety options.
 * @param {boolean} [options.allowRepoRoot] - Allow the repository root itself as a valid result.
 * @returns {void}
 */
function assertPathResolvesInsideRepoRoot(
  repoRoot: string,
  separatorNormalisedPath: string,
  configuredPath: string,
  label: string,
  options: { allowRepoRoot?: boolean }
): void {
  const resolvedPath = path.resolve(repoRoot, separatorNormalisedPath);
  const relativePath = path.relative(repoRoot, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must resolve inside repo root: ${configuredPath}`);
  }

  if (!options.allowRepoRoot && relativePath.length === 0) {
    throw new Error(`${label} must resolve inside repo root: ${configuredPath}`);
  }
}

export {
  validateRepoRelativePath,
  assertRepoRelativePathIsValid,
  assertPathIsNotEmpty,
  assertPathIsNotAbsolute,
  assertPathDoesNotEscapeRepoRoot,
  assertPathResolvesInsideRepoRoot,
};
