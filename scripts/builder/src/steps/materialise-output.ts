import path from 'node:path';
import { promises as fs } from 'node:fs';

import { BuildStageError } from '../lib/errors.js';
import type { BuilderPaths, MaterialiseOutputResult } from '../types.js';

const STAGE_ID = 'materialise-output' as const;
const REQUIRED_LAYOUT_FILES = ['appsscript.json', 'JsonDbApp.inlined.js', 'UI/ReactApp.html'];
const FORBIDDEN_ROOT_SEGMENTS = ['work', 'frontend'];

/**
 * Recursively lists all files under a directory in deterministic order.
 *
 * @param {string} rootDir - Directory root to enumerate.
 * @returns {Promise<string[]>} Absolute file paths sorted lexicographically.
 */
async function listFilesRecursive(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];

  for (const entry of sortedEntries) {
    const entryPath = path.join(rootDir, entry.name);
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
 * Validates that required GAS layout files exist.
 *
 * @param {Set<string>} materialisedFiles - Materialised file paths relative to gas root.
 * @returns {void} No return value.
 */
function validateRequiredLayout(materialisedFiles: Set<string>): void {
  const missing = REQUIRED_LAYOUT_FILES.filter((requiredPath) => !materialisedFiles.has(requiredPath));
  if (missing.length > 0) {
    throw new BuildStageError(
      STAGE_ID,
      `Missing required files in build/gas: ${missing.join(', ')}`,
    );
  }
}

/**
 * Validates that temporary workspace segments do not leak into final GAS output.
 *
 * @param {string[]} relativeFiles - Materialised relative output files.
 * @returns {void} No return value.
 */
function validateNoWorkdirLeakage(relativeFiles: string[]): void {
  const leakedPaths = relativeFiles.filter((relativePath) => {
    const rootSegment = relativePath.split('/')[0];
    return FORBIDDEN_ROOT_SEGMENTS.includes(rootSegment);
  });

  if (leakedPaths.length > 0) {
    throw new BuildStageError(
      STAGE_ID,
      `Temporary build assets leaked into build/gas: ${leakedPaths.join(', ')}`,
    );
  }
}

/**
 * Materialises and verifies final GAS output directory structure.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @returns {Promise<MaterialiseOutputResult>} Deterministic output metadata.
 */
export async function runMaterialiseOutput(paths: BuilderPaths): Promise<MaterialiseOutputResult> {
  let absoluteFiles: string[];
  try {
    absoluteFiles = await listFilesRecursive(paths.buildGasDir);
  } catch (err) {
    throw new BuildStageError(STAGE_ID, `Unable to read build/gas output at ${paths.buildGasDir}`, err);
  }

  const relativeFiles = absoluteFiles
    .map((absolutePath) => path.relative(paths.buildGasDir, absolutePath).replaceAll('\\\\', '/'))
    .sort((left, right) => left.localeCompare(right));

  validateRequiredLayout(new Set(relativeFiles));
  validateNoWorkdirLeakage(relativeFiles);

  let totalBytes = 0;
  for (const absolutePath of absoluteFiles) {
    const stats = await fs.stat(absolutePath);
    totalBytes += stats.size;
  }

  return {
    stage: STAGE_ID,
    gasRootPath: paths.buildGasDir,
    fileCount: relativeFiles.length,
    totalBytes,
  };
}
