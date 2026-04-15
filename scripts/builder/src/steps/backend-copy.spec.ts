import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { BuilderPaths } from '../types.js';
import { BuildStageError } from '../lib/errors.js';
import { createBuilderPaths, createTempDir } from '../test/builder-fixture-test-helpers.js';
import { isRuntimeBackendFile, runBackendCopy } from './backend-copy.js';

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
    tempRoot = await createTempDir('backend-copy-');
    paths = createBuilderPaths(tempRoot, {
      jsonDbAppSourceFiles: ['src/01-core.js'],
      jsonDbAppPublicExports: ['loadDatabase'],
    });
    await fs.mkdir(paths.backendDir, { recursive: true });
    await fs.mkdir(paths.buildGasDir, { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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

  it('wraps destination-directory creation failures with backend-copy stage context and file detail', async () => {
    await fs.mkdir(path.join(paths.backendDir, 'nested'), { recursive: true });
    await fs.writeFile(path.join(paths.backendDir, 'nested', 'Helper.js'), 'const x = 1;', 'utf-8');

    const destinationDir = path.join(paths.buildGasDir, 'nested');
    const mkdirFailure = new Error('mkdir failed');
    const originalMkdir = fs.mkdir.bind(fs);

    vi.spyOn(fs, 'mkdir').mockImplementation(async (target, options) => {
      if (String(target) === destinationDir) {
        throw mkdirFailure;
      }
      return originalMkdir(target, options);
    });

    const error = await runBackendCopy(paths).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(BuildStageError);
    expect(error).toMatchObject({
      stage: 'backend-copy',
      cause: mkdirFailure,
      message: expect.stringContaining('nested/Helper.js'),
    });
  });

  it('wraps file-copy failures with backend-copy stage context and file detail', async () => {
    await fs.writeFile(path.join(paths.backendDir, 'Main.js'), 'function main() {}', 'utf-8');

    const sourcePath = path.join(paths.backendDir, 'Main.js');
    const destinationPath = path.join(paths.buildGasDir, 'Main.js');
    const copyFailure = new Error('copy failed');
    const originalCopyFile = fs.copyFile.bind(fs);

    vi.spyOn(fs, 'copyFile').mockImplementation(async (source, destination, mode) => {
      if (String(source) === sourcePath && String(destination) === destinationPath) {
        throw copyFailure;
      }
      return originalCopyFile(source, destination, mode);
    });

    const error = await runBackendCopy(paths).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(BuildStageError);
    expect(error).toMatchObject({
      stage: 'backend-copy',
      cause: copyFailure,
      message: expect.stringContaining('Main.js'),
    });
  });
});
