import path from 'node:path';
import { promises as fs } from 'node:fs';

import { BuildStageError } from '../lib/errors.js';
import type { BackendCopyResult, BuilderPaths } from '../types.js';

const STAGE_ID = 'backend-copy' as const;

/**
 * Returns whether a backend file is runtime-relevant for GAS output.
 *
 * @param {string} filePath - Absolute backend source file path.
 * @returns {boolean} `true` when the file should be copied.
 */
export function isRuntimeBackendFile(filePath: string): boolean {
  const normalised = filePath.replaceAll('\\', '/');
  if (!normalised.endsWith('.js')) {
    return false;
  }
  return !/\.(test|spec)\./i.test(normalised) &&
    !/\.(tmp|temp)\.js$/i.test(normalised) &&
    !/~\.js$/i.test(normalised);
}

/**
 * Recursively lists all files under a directory.
 *
 * @param {string} rootDir - Directory to enumerate.
 * @returns {Promise<string[]>} Absolute file paths.
 */
async function listFilesRecursive(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
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
 * Copies runtime backend source files into final GAS output.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @returns {Promise<BackendCopyResult>} Stage metadata with copied file list.
 */
export async function runBackendCopy(paths: BuilderPaths): Promise<BackendCopyResult> {
  let sourceFiles: string[];
  try {
    sourceFiles = await listFilesRecursive(paths.backendDir);
  } catch (err) {
    throw new BuildStageError(STAGE_ID, `Unable to enumerate backend source: ${paths.backendDir}`, err);
  }

  const runtimeFiles = sourceFiles.filter(isRuntimeBackendFile);
  const copiedFiles: string[] = [];

  for (const sourcePath of runtimeFiles) {
    const relativePath = path.relative(paths.backendDir, sourcePath);
    const destinationPath = path.join(paths.buildGasDir, relativePath);
    const destinationDir = path.dirname(destinationPath);
    await fs.mkdir(destinationDir, { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
    copiedFiles.push(relativePath.replaceAll('\\', '/'));
  }

  copiedFiles.sort((a, b) => a.localeCompare(b));

  return {
    stage: STAGE_ID,
    copiedFiles,
  };
}
