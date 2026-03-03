import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runPreflightClean } from './preflight-clean.js';
import { BuildStageError } from '../lib/errors.js';
import type { BuilderPaths } from '../types.js';

const createTempDir = async (): Promise<string> => {
  return fs.mkdtemp(path.join(os.tmpdir(), 'preflight-clean-'));
};

const createBuilderPaths = (rootDir: string): BuilderPaths => {
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
  };
};

const ensureFile = async (targetPath: string): Promise<void> => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, 'content');
};

const ensureDir = async (targetPath: string): Promise<void> => {
  await fs.mkdir(targetPath, { recursive: true });
};

const listTree = async (rootDir: string): Promise<string[]> => {
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
};

describe('runPreflightClean', () => {
  let tempDir: string;
  let paths: BuilderPaths;

  beforeEach(async () => {
    tempDir = await createTempDir();
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
      stage: 'preflight-clean',
      name: 'BuildStageError',
    });

    await expect(runPreflightClean(paths)).rejects.toBeInstanceOf(BuildStageError);
  });

  it('throws BuildStageError with stage "preflight-clean" when frontend path is missing', async () => {
    await fs.rm(paths.frontendDir, { recursive: true, force: true });

    await expect(runPreflightClean(paths)).rejects.toMatchObject({
      stage: 'preflight-clean',
      name: 'BuildStageError',
    });

    await expect(runPreflightClean(paths)).rejects.toBeInstanceOf(BuildStageError);
  });

  it('throws BuildStageError with stage "preflight-clean" when config path is missing', async () => {
    await fs.rm(paths.configPath, { force: true });

    await expect(runPreflightClean(paths)).rejects.toMatchObject({
      stage: 'preflight-clean',
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
    const firstList = (await listTree(paths.buildDir)).sort();

    await runPreflightClean(paths);
    const secondList = (await listTree(paths.buildDir)).sort();

    expect(secondList).toEqual(firstList);
  });
});
