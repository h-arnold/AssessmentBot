import path from 'node:path';
import { promises as fs } from 'node:fs';

import { BuildStageError } from '../lib/errors.js';
import { requireDirectory, requireFile } from '../lib/fs.js';
import type { BuilderPaths, ResolveJsonDbSourceResult } from '../types.js';

const STAGE_ID = 'resolve-jsondb-source' as const;
const PLACEHOLDER_SENTINELS = [
  'JsonDbApp snapshot placeholder',
  'Legacy entry point retained for compatibility.',
  'This placeholder file remains to satisfy legacy loaders',
];

/**
 * Resolves and validates an absolute configured JsonDbApp source-file path.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @param {string} relativePath - Configured source-file path relative to the vendored snapshot.
 * @returns {string} Absolute file path beneath the vendored snapshot root.
 */
function resolveConfiguredSourcePath(paths: BuilderPaths, relativePath: string): string {
  const absolutePath = path.resolve(paths.jsonDbAppPinnedSnapshotDir, relativePath);
  const relativeToSnapshotRoot = path.relative(paths.jsonDbAppPinnedSnapshotDir, absolutePath);

  if (
    relativeToSnapshotRoot === '' ||
    relativeToSnapshotRoot.startsWith('..') ||
    path.isAbsolute(relativeToSnapshotRoot)
  ) {
    throw new BuildStageError(
      STAGE_ID,
      `Configured JsonDbApp source file must resolve inside the vendored snapshot: ${relativePath}`,
    );
  }

  return absolutePath;
}

/**
 * Rejects placeholder vendored-source files before namespace inlining begins.
 *
 * @param {string} sourcePath - Absolute vendored source-file path.
 * @param {string} sourceContent - Raw file content.
 * @returns {void}
 */
function validateNoPlaceholderSource(sourcePath: string, sourceContent: string): void {
  const matchedPlaceholder = PLACEHOLDER_SENTINELS.find((sentinel) => sourceContent.includes(sentinel));

  if (matchedPlaceholder) {
    throw new BuildStageError(
      STAGE_ID,
      `Configured JsonDbApp source file contains placeholder content: ${sourcePath}`,
    );
  }
}

/**
 * Validates and resolves JsonDbApp source files from the committed vendored snapshot.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @returns {Promise<ResolveJsonDbSourceResult>} Deterministic source file list.
 */
export async function runResolveJsonDbSource(paths: BuilderPaths): Promise<ResolveJsonDbSourceResult> {
  try {
    await requireDirectory(
      paths.jsonDbAppPinnedSnapshotDir,
      'JsonDbApp pinned snapshot directory',
      STAGE_ID,
    );
    await requireFile(paths.jsonDbAppManifestPath, 'JsonDbApp pinned snapshot manifest', STAGE_ID);

    for (const relativePath of paths.jsonDbAppSourceFiles) {
      const absolutePath = resolveConfiguredSourcePath(paths, relativePath);
      await requireFile(absolutePath, 'Configured JsonDbApp source file', STAGE_ID);
      const sourceContent = await fs.readFile(absolutePath, 'utf-8');
      validateNoPlaceholderSource(absolutePath, sourceContent);
    }

    return {
      stage: STAGE_ID,
      sourceFiles: [...paths.jsonDbAppSourceFiles],
    };
  } catch (err) {
    if (err instanceof BuildStageError) {
      throw err;
    }
    throw new BuildStageError(STAGE_ID, 'Failed to resolve vendored JsonDbApp sources.', err);
  }
}
