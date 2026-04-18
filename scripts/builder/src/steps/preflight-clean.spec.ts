import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { runPreflightClean } from './preflight-clean.js';
import { BuildStageError } from '../lib/errors.js';
import { createTempDir } from '../test/builder-fixture-test-helpers.js';
import type { BuilderPaths } from '../types.js';

const PREFLIGHT_STAGE = 'preflight-clean';
const CLASP_FILE = '.clasp.json';

/**
 * Builds a complete `BuilderPaths` object rooted at a temporary directory.
 *
 * @param {string} rootDir - Root temporary directory for the test fixture.
 * @returns {BuilderPaths} Resolved builder paths for test setup.
 */
function createBuilderPaths(rootDir: string): BuilderPaths {
  const repoRoot = path.join(rootDir, 'repo');
  const builderRoot = path.join(rootDir, 'builder');
  const configPath = path.join(builderRoot, 'builder.config.json');
  const frontendDir = path.join(repoRoot, 'src', 'frontend');
  const backendDir = path.join(repoRoot, 'src', 'backend');
  const buildDir = path.join(rootDir, 'build');
  const buildFrontendDir = path.join(buildDir, 'frontend');
  const buildWorkDir = path.join(buildDir, 'work');
  const buildGasDir = path.join(buildDir, 'gas');
  const buildGasUiDir = path.join(buildGasDir, 'UI');

  return {
    repoRoot,
    builderRoot,
    configPath,
    frontendDir,
    backendDir,
    buildDir,
    buildFrontendDir,
    buildWorkDir,
    buildGasDir,
    buildGasUiDir,
    backendManifestPath: path.join(backendDir, 'appsscript.json'),
    jsonDbAppPinnedSnapshotDir: path.join(repoRoot, 'vendor', 'jsondbapp'),
    jsonDbAppManifestPath: path.join(repoRoot, 'vendor', 'jsondbapp', 'appsscript.json'),
    jsonDbAppSourceFiles: ['src/01-core.js'],
    jsonDbAppPublicExports: ['loadDatabase'],
  };
}

import { createTempDir, createBuilderPaths } from '../test/builder-fixture-test-helpers.js';

const PREFLIGHT_STAGE = 'preflight-clean';
const CLASP_FILE = '.clasp.json';

/**
 * Ensures a file exists with placeholder content.
 *
 * @param {string} targetPath - File path to create.
 * @returns {Promise<void>} Resolves when the file is written.
 */
async function ensureFile(targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, 'content');
}

/**
 * Ensures a directory exists.
 *
 * @param {string} targetPath - Directory path to create.
 * @returns {Promise<void>} Resolves when the directory exists.
 */
async function ensureDir(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

/**
 * Recursively lists files and directories relative to a root path.
 *
 * @param {string} rootDir - Root directory to enumerate.
 * @returns {Promise<string[]>} Relative path list for comparison assertions.
 */
async function listTree(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(`${entry.name}/`);
      const childEntries = await listTree(fullPath);
      for (const childEntry of childEntries) {
        results.push(path.join(entry.name, childEntry));
      }
    } else {
      results.push(entry.name);
    }
  }

  return results;
}

describe('runPreflightClean', () => {
  let tempDir: string;
  let paths: BuilderPaths;

  beforeEach(async () => {
    tempDir = await createTempDir('preflight-clean-');
    paths = createBuilderPaths(tempDir);

    await ensureDir(paths.frontendDir);
    await ensureDir(paths.backendDir);
    await ensureFile(paths.configPath);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('throws BuildStageError with stage "preflight-clean" when backend path is missing', async () => {
    await fs.rm(paths.backendDir, { recursive: true, force: true });

    await expect(runPreflightClean(paths)).rejects.toMatchObject({
      stage: PREFLIGHT_STAGE,
      name: 'BuildStageError',
    });

    await expect(runPreflightClean(paths)).rejects.toBeInstanceOf(BuildStageError);
  });

  it('throws BuildStageError with stage "preflight-clean" when frontend path is missing', async () => {
    await fs.rm(paths.frontendDir, { recursive: true, force: true });

    await expect(runPreflightClean(paths)).rejects.toMatchObject({
      stage: PREFLIGHT_STAGE,
      name: 'BuildStageError',
    });

    await expect(runPreflightClean(paths)).rejects.toBeInstanceOf(BuildStageError);
  });

  it('throws BuildStageError with stage "preflight-clean" when config path is missing', async () => {
    await fs.rm(paths.configPath, { force: true });

    await expect(runPreflightClean(paths)).rejects.toMatchObject({
      stage: PREFLIGHT_STAGE,
      name: 'BuildStageError',
    });

    await expect(runPreflightClean(paths)).rejects.toBeInstanceOf(BuildStageError);
  });

  it('removes nested stale files under build/gas', async () => {
    const staleFile = path.join(paths.buildGasDir, 'nested', 'stale.txt');
    await ensureFile(staleFile);

    await runPreflightClean(paths);

    await expect(fs.stat(staleFile)).rejects.toBeInstanceOf(Error);
    await expect(fs.stat(paths.buildGasDir)).resolves.toBeDefined();
  });

  it('produces identical file lists across consecutive runs', async () => {
    await runPreflightClean(paths);
    const firstList = (await listTree(paths.buildDir)).sort((left, right) =>
      left.localeCompare(right),
    );

    await runPreflightClean(paths);
    const secondList = (await listTree(paths.buildDir)).sort((left, right) =>
      left.localeCompare(right),
    );

    expect(secondList).toEqual(firstList);
  });

  it('preserves build/gas/.clasp.json across preflight clean', async () => {
    const claspConfigPath = path.join(paths.buildGasDir, CLASP_FILE);
    const claspConfig = JSON.stringify({ scriptId: 'abc123' });
    await ensureFile(claspConfigPath);
    await fs.writeFile(claspConfigPath, claspConfig);
    await ensureFile(path.join(paths.buildGasDir, 'stale.js'));

    await runPreflightClean(paths);

    await expect(fs.readFile(claspConfigPath, 'utf8')).resolves.toBe(claspConfig);
    await expect(fs.stat(path.join(paths.buildGasDir, 'stale.js'))).rejects.toBeInstanceOf(Error);
  });

  it('wraps .clasp.json read failures as BuildStageError with preflight stage context', async () => {
    const claspConfigPath = path.join(paths.buildGasDir, CLASP_FILE);
    await ensureDir(claspConfigPath);

    await expect(runPreflightClean(paths)).rejects.toMatchObject({
      stage: PREFLIGHT_STAGE,
      name: 'BuildStageError',
    });
    await expect(runPreflightClean(paths)).rejects.toThrow(claspConfigPath);
  });

  it('wraps .clasp.json write failures as BuildStageError with preflight stage context', async () => {
    const claspConfigPath = path.join(paths.buildGasDir, CLASP_FILE);
    const writeErr = new Error('write failed');
    await ensureFile(claspConfigPath);

    const writeSpy = vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(writeErr);
    const run = runPreflightClean(paths);
    await expect(run).rejects.toMatchObject({
      stage: PREFLIGHT_STAGE,
      name: 'BuildStageError',
    });
    await expect(run).rejects.toThrow('Failed to restore');
    writeSpy.mockRestore();
  });
});
