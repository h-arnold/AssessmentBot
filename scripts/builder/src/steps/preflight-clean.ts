import path from 'node:path';
import { promises as fs } from 'node:fs';

import type { BuilderPaths, PreflightCleanResult } from '../types.js';
import { BuildStageError } from '../lib/errors.js';
import { ensureDirs, removeDir, requireDirectory, requireFile } from '../lib/fs.js';

const STAGE_ID = 'preflight-clean' as const;

/**
 * Validates required source/config paths and recreates build directories.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @returns {Promise<PreflightCleanResult>} Summary of directories created.
 */
export async function runPreflightClean(
  paths: BuilderPaths,
): Promise<PreflightCleanResult> {
  await requireDirectory(paths.frontendDir, 'src/frontend', STAGE_ID);
  await requireDirectory(paths.backendDir, 'src/backend', STAGE_ID);
  await requireFile(paths.configPath, 'builder config', STAGE_ID);

  const claspConfigPath = path.join(paths.buildGasDir, '.clasp.json');
  let claspConfigContents: Buffer | null;
  try {
    claspConfigContents = await readOptionalFile(claspConfigPath);
  } catch (err) {
    throw new BuildStageError(
      STAGE_ID,
      `Failed to read existing ${claspConfigPath} while preserving clasp configuration.`,
      err,
    );
  }

  await removeDir(paths.buildDir);

  const dirsToCreate = [
    paths.buildDir,
    paths.buildFrontendDir,
    paths.buildWorkDir,
    paths.buildGasDir,
    paths.buildGasUiDir,
  ];

  await ensureDirs(dirsToCreate);
  if (claspConfigContents !== null) {
    try {
      await fs.writeFile(claspConfigPath, claspConfigContents);
    } catch (err) {
      throw new BuildStageError(
        STAGE_ID,
        `Failed to restore ${claspConfigPath} while preserving clasp configuration.`,
        err,
      );
    }
  }

  return {
    stage: STAGE_ID,
    createdDirs: dirsToCreate,
  };
}

/**
 * Reads a file if it exists.
 *
 * @param {string} filePath - Absolute file path.
 * @returns {Promise<Buffer | null>} File contents, or null when absent.
 */
async function readOptionalFile(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch (err) {
    const candidate = err as NodeJS.ErrnoException;
    if (candidate.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}
