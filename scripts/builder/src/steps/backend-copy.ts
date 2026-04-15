import path from 'node:path';
import { promises as fs } from 'node:fs';

import { BuildStageError } from '../lib/errors.js';
import { listFilesRecursive, normalisePathSeparators } from '../lib/fs.js';
import type { BackendCopyResult, BuilderPaths } from '../types.js';

const STAGE_ID = 'backend-copy' as const;

/**
 * Returns whether a backend file is runtime-relevant for GAS output.
 *
 * @param {string} filePath - Absolute backend source file path.
 * @returns {boolean} `true` when the file should be copied.
 */
export function isRuntimeBackendFile(filePath: string): boolean {
  const normalised = normalisePathSeparators(filePath);
  if (!normalised.endsWith('.js')) {
    return false;
  }
  return !/\.(test|spec)\./i.test(normalised) &&
    !/\.(tmp|temp)\.js$/i.test(normalised) &&
    !/~\.js$/i.test(normalised);
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
    const normalisedRelativePath = normalisePathSeparators(relativePath);
    const destinationPath = path.join(paths.buildGasDir, relativePath);
    const destinationDir = path.dirname(destinationPath);

    try {
      await fs.mkdir(destinationDir, { recursive: true });
    } catch (err) {
      throw new BuildStageError(
        STAGE_ID,
        'Unable to create destination directory for backend file ' +
          normalisedRelativePath +
          ': ' +
          destinationDir,
        err,
      );
    }

    try {
      await fs.copyFile(sourcePath, destinationPath);
    } catch (err) {
      throw new BuildStageError(
        STAGE_ID,
        'Unable to copy backend file ' +
          normalisedRelativePath +
          ' from ' +
          sourcePath +
          ' to ' +
          destinationPath,
        err,
      );
    }

    copiedFiles.push(normalisedRelativePath);
  }

  copiedFiles.sort((a, b) => a.localeCompare(b));

  return {
    stage: STAGE_ID,
    copiedFiles,
  };
}
