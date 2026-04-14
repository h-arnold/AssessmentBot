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
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
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
  stage: BuildStageId,
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
  stage: BuildStageId,
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
    const entryPath = `${rootDir}/${entry.name}`;
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
