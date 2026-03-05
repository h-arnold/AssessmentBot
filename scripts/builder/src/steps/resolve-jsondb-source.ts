import path from 'node:path';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { BuildStageError } from '../lib/errors.js';
import { pathExists } from '../lib/fs.js';
import type { BuilderPaths, ResolveJsonDbSourceResult } from '../types.js';

const STAGE_ID = 'resolve-jsondb-source' as const;
const JSON_DB_RELEASE_TAG = 'v0.1.0';
const JSON_DB_RELEASE_TARBALL_URL =
  'https://github.com/h-arnold/JsonDbApp/archive/refs/tags/v0.1.0.tar.gz';
const execFileAsync = promisify(execFile);
const TAR_VERBOSE_NAME_FIELD_INDEX = 5;

/**
 * Downloads a URL to disk using fetch with curl fallback.
 *
 * @param {string} url - Source URL to download.
 * @param {string} outputPath - Absolute destination file path.
 * @return {Promise<void>} Resolves when download is complete.
 */
async function downloadArchive(url: string, outputPath: string): Promise<void> {
  try {
    const releaseResponse = await fetch(url);
    if (!releaseResponse.ok) {
      throw new BuildStageError(
        STAGE_ID,
        `Failed to download JsonDbApp release archive: ${url} (HTTP ${releaseResponse.status} ${releaseResponse.statusText})`,
      );
    }

    const archiveBytes = new Uint8Array(await releaseResponse.arrayBuffer());
    await fs.writeFile(outputPath, archiveBytes);
    return;
  } catch (err) {
    if (err instanceof BuildStageError) {
      throw err;
    }
  }

  try {
    await execFileAsync('curl', ['-fsSL', url, '-o', outputPath]);
  } catch (err) {
    throw new BuildStageError(STAGE_ID, `Failed to download JsonDbApp release archive: ${url}`, err);
  }
}

/**
 * Recursively lists JavaScript source files under a directory.
 *
 * @param {string} rootDir - Absolute directory to scan.
 * @param {string} baseDir - Base directory for relative output paths.
 * @return {Promise<string[]>} Relative JavaScript file paths.
 */
async function listJavaScriptFilesRecursive(rootDir: string, baseDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];

  for (const entry of sortedEntries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJavaScriptFilesRecursive(entryPath, baseDir)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(path.relative(baseDir, entryPath).replace(/\\/g, '/'));
    }
  }

  return files;
}

/**
 * Validates archive entries to prevent path traversal and link attacks.
 *
 * @param {string} archivePath - Absolute path to the tar.gz archive.
 * @return {Promise<void>} Resolves when all entries are safe.
 */
async function validateArchiveContents(archivePath: string): Promise<void> {
  // Use verbose listing so we can inspect entry types and reject links.
  const { stdout } = await execFileAsync('tar', ['-tzvf', archivePath]);
  const lines = stdout.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    const trimmed = line.trim();
    const columns = trimmed.split(/\s+/);
    const perms = columns[0];

    // perms starts with a character indicating the entry type: '-', 'd', 'l', 'h', etc.
    if (perms && (perms[0] === 'l' || perms[0] === 'h')) {
      throw new BuildStageError(
        STAGE_ID,
        `Unsafe archive entry with link type '${perms[0]}' detected in: ${trimmed}`,
      );
    }

    // The entry path is the name field; for symlinks it is before ' -> target'.
    const nameWithMaybeTarget = columns.slice(TAR_VERBOSE_NAME_FIELD_INDEX).join(' ');
    const [entryPath] = nameWithMaybeTarget.split(' -> ');

    if (path.isAbsolute(entryPath)) {
      throw new BuildStageError(
        STAGE_ID,
        `Unsafe archive entry with absolute path: ${entryPath}`,
      );
    }
    if (entryPath.split('/').includes('..')) {
      throw new BuildStageError(
        STAGE_ID,
        `Unsafe archive entry with path traversal: ${entryPath}`,
      );
    }
  }
}

/**
 * Downloads and extracts the pinned JsonDbApp release snapshot.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @return {Promise<string>} Absolute extraction root path.
 */
async function materialisePinnedJsonDbRelease(paths: BuilderPaths): Promise<string> {
  const archivePath = path.join(paths.buildWorkDir, `jsondbapp-${JSON_DB_RELEASE_TAG}.tar.gz`);
  const extractRoot = path.join(paths.buildWorkDir, `jsondbapp-${JSON_DB_RELEASE_TAG}`);

  await fs.mkdir(paths.buildWorkDir, { recursive: true });
  await downloadArchive(JSON_DB_RELEASE_TARBALL_URL, archivePath);
  await validateArchiveContents(archivePath);
  await fs.rm(extractRoot, { recursive: true, force: true });
  await fs.mkdir(extractRoot, { recursive: true });

  await execFileAsync('tar', ['-xzf', archivePath, '-C', extractRoot, '--strip-components=1']);

  return extractRoot;
}

/**
 * Validates and resolves JsonDbApp source files from the pinned GitHub release.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @return {Promise<ResolveJsonDbSourceResult>} Deterministic source file list.
 */
export async function runResolveJsonDbSource(paths: BuilderPaths): Promise<ResolveJsonDbSourceResult> {
  try {
    const releaseRoot = await materialisePinnedJsonDbRelease(paths);
    const sourceRoot = path.join(releaseRoot, 'src');
    const manifestPath = path.join(releaseRoot, 'appsscript.json');

    if (!(await pathExists(sourceRoot))) {
      throw new BuildStageError(STAGE_ID, `JsonDbApp release is missing source directory: ${sourceRoot}`);
    }
    if (!(await pathExists(manifestPath))) {
      throw new BuildStageError(STAGE_ID, `JsonDbApp release is missing manifest: ${manifestPath}`);
    }

    const sourceFiles = await listJavaScriptFilesRecursive(sourceRoot, releaseRoot);
    if (sourceFiles.length === 0) {
      throw new BuildStageError(STAGE_ID, 'JsonDbApp release contains no JavaScript source files in src/.');
    }

    paths.jsonDbAppPinnedSnapshotDir = releaseRoot;
    paths.jsonDbAppManifestPath = manifestPath;
    paths.jsonDbAppSourceFiles = sourceFiles;

    return {
      stage: STAGE_ID,
      sourceFiles,
    };
  } catch (err) {
    if (err instanceof BuildStageError) {
      throw err;
    }
    throw new BuildStageError(STAGE_ID, 'Failed to resolve JsonDbApp release sources.', err);
  }
}
