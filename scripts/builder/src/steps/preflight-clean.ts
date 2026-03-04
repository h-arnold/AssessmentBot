import type { BuilderPaths, PreflightCleanResult } from '../types.js';
import { ensureDirs, removeDir, requireDirectory, requireFile } from '../lib/fs.js';

const STAGE_ID = 'preflight-clean' as const;

/**
 * Validates required source/config paths and recreates build directories.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @return {Promise<PreflightCleanResult>} Summary of directories created.
 */
export async function runPreflightClean(
  paths: BuilderPaths,
): Promise<PreflightCleanResult> {
  await requireDirectory(paths.frontendDir, 'src/frontend', STAGE_ID);
  await requireDirectory(paths.backendDir, 'src/backend', STAGE_ID);
  await requireFile(paths.configPath, 'builder config', STAGE_ID);

  await removeDir(paths.buildDir);

  const dirsToCreate = [
    paths.buildDir,
    paths.buildFrontendDir,
    paths.buildWorkDir,
    paths.buildGasDir,
    paths.buildGasUiDir,
  ];

  await ensureDirs(dirsToCreate);

  return {
    stage: STAGE_ID,
    createdDirs: dirsToCreate,
  };
}
