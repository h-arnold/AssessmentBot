import path from 'node:path';

import { BuildStageError } from '../lib/errors.js';
import { pathExists } from '../lib/fs.js';
import type { BuilderPaths, ResolveJsonDbSourceResult } from '../types.js';

const STAGE_ID = 'resolve-jsondb-source' as const;

/**
 * Resolves absolute source file paths for the configured JsonDbApp snapshot.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @return {string[]} Absolute file paths in deterministic order.
 */
export function resolveJsonDbSourceFilePaths(paths: BuilderPaths): string[] {
  return [...paths.jsonDbAppSourceFiles]
    .sort((left, right) => left.localeCompare(right))
    .map((relativeFilePath) => path.join(paths.jsonDbAppPinnedSnapshotDir, relativeFilePath));
}

/**
 * Validates and resolves JsonDbApp source files from a pinned snapshot.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @return {Promise<ResolveJsonDbSourceResult>} Deterministic source file list.
 */
export async function runResolveJsonDbSource(paths: BuilderPaths): Promise<ResolveJsonDbSourceResult> {
  const sourceFilePaths = resolveJsonDbSourceFilePaths(paths);
  const sourceFiles: string[] = [];

  for (const sourcePath of sourceFilePaths) {
    const exists = await pathExists(sourcePath);
    if (!exists) {
      throw new BuildStageError(
        STAGE_ID,
        `Pinned JsonDbApp source file is missing: ${sourcePath}`,
      );
    }

    sourceFiles.push(path.relative(paths.jsonDbAppPinnedSnapshotDir, sourcePath).replace(/\\/g, '/'));
  }

  return {
    stage: STAGE_ID,
    sourceFiles,
  };
}
