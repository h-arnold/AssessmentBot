import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { BuilderPaths } from '../types.js';
import { isRuntimeBackendFile, runBackendCopy } from './backend-copy.js';

/**
 * Creates a unique temporary directory for a test case.
 *
 * @return {Promise<string>} Path to the created temporary directory.
 */
async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'backend-copy-'));
}

/**
 * Builds a complete `BuilderPaths` object rooted at a temporary directory.
 *
 * @param {string} rootDir - Root temporary directory for the test fixture.
 * @return {BuilderPaths} Fully resolved builder path values.
 */
function createBuilderPaths(rootDir: string): BuilderPaths {
  const repoRoot = rootDir;
  const buildDir = path.join(repoRoot, 'build');
  const buildGasDir = path.join(buildDir, 'gas');
  return {
    repoRoot,
    builderRoot: path.join(repoRoot, 'scripts', 'builder'),
    configPath: path.join(repoRoot, 'scripts', 'builder', 'builder.config.json'),
    frontendDir: path.join(repoRoot, 'src', 'frontend'),
    backendDir: path.join(repoRoot, 'src', 'backend'),
    buildDir,
    buildFrontendDir: path.join(buildDir, 'frontend'),
    buildWorkDir: path.join(buildDir, 'work'),
    buildGasDir,
    buildGasUiDir: path.join(buildGasDir, 'UI'),
    jsonDbAppPinnedSnapshotDir: path.join(repoRoot, 'vendor', 'jsondbapp'),
    jsonDbAppSourceFiles: ['src/01-core.js'],
    jsonDbAppPublicExports: ['loadDatabase'],
  };
}

describe('isRuntimeBackendFile', () => {
  it('includes runtime JavaScript files and excludes tests/noise', () => {
    expect(isRuntimeBackendFile('/repo/src/backend/Main.js')).toBe(true);
    expect(isRuntimeBackendFile('/repo/src/backend/lib/util.spec.js')).toBe(false);
    expect(isRuntimeBackendFile('/repo/src/backend/lib/util.test.js')).toBe(false);
    expect(isRuntimeBackendFile('/repo/src/backend/lib/util.js.map')).toBe(false);
    expect(isRuntimeBackendFile('/repo/src/backend/lib/util.tmp')).toBe(false);
    expect(isRuntimeBackendFile('/repo/src/backend/lib/util.ts')).toBe(false);
  });
});

describe('runBackendCopy', () => {
  let tempRoot: string;
  let paths: BuilderPaths;

  beforeEach(async () => {
    tempRoot = await createTempDir();
    paths = createBuilderPaths(tempRoot);
    await fs.mkdir(paths.backendDir, { recursive: true });
    await fs.mkdir(paths.buildGasDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('copies runtime backend files preserving relative structure', async () => {
    await fs.mkdir(path.join(paths.backendDir, 'nested'), { recursive: true });
    await fs.writeFile(path.join(paths.backendDir, 'Main.js'), 'function main() {}', 'utf-8');
    await fs.writeFile(path.join(paths.backendDir, 'nested', 'Helper.js'), 'const x = 1;', 'utf-8');
    await fs.writeFile(path.join(paths.backendDir, 'nested', 'Helper.test.js'), 'ignored', 'utf-8');
    await fs.writeFile(path.join(paths.backendDir, 'nested', 'Helper.js.map'), 'ignored', 'utf-8');

    const result = await runBackendCopy(paths);

    expect(result.stage).toBe('backend-copy');
    expect(result.copiedFiles).toEqual(['Main.js', 'nested/Helper.js']);
    await expect(fs.stat(path.join(paths.buildGasDir, 'Main.js'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(paths.buildGasDir, 'nested', 'Helper.js'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(paths.buildGasDir, 'nested', 'Helper.test.js'))).rejects.toBeDefined();
  });
});
