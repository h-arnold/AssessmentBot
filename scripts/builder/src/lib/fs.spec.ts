import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BuildStageError, asError, isBuildStageError } from './errors.js';
import { ensureDirs, pathExists, removeDir, requireDirectory, requireFile } from './fs.js';

let tempRoot = '';
const PREFLIGHT_STAGE = 'preflight-clean';

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'builder-fs-spec-'));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe('pathExists', () => {
  it('returns true when the path exists', async () => {
    const existing = path.join(tempRoot, 'exists.txt');
    await fs.writeFile(existing, 'x');

    await expect(pathExists(existing)).resolves.toBe(true);
  });

  it('returns false when the path is missing', async () => {
    await expect(pathExists(path.join(tempRoot, 'missing.txt'))).resolves.toBe(false);
  });
});

describe('requireDirectory and requireFile', () => {
  it('accepts valid directory and file paths', async () => {
    const folder = path.join(tempRoot, 'folder');
    const file = path.join(tempRoot, 'file.txt');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(file, 'ok');

    await expect(requireDirectory(folder, 'Folder', PREFLIGHT_STAGE)).resolves.toBeUndefined();
    await expect(requireFile(file, 'File', PREFLIGHT_STAGE)).resolves.toBeUndefined();
  });

  it('throws stage errors for invalid directory and file path types', async () => {
    const file = path.join(tempRoot, 'file.txt');
    const folder = path.join(tempRoot, 'folder');
    await fs.writeFile(file, 'ok');
    await fs.mkdir(folder, { recursive: true });

    await expect(requireDirectory(file, 'Folder', PREFLIGHT_STAGE)).rejects.toBeInstanceOf(
      BuildStageError,
    );
    await expect(requireFile(folder, 'File', PREFLIGHT_STAGE)).rejects.toBeInstanceOf(
      BuildStageError,
    );
  });

  it('throws stage errors when required paths are missing', async () => {
    await expect(
      requireDirectory(path.join(tempRoot, 'none'), 'Folder', PREFLIGHT_STAGE),
    ).rejects.toBeInstanceOf(BuildStageError);
    await expect(
      requireFile(path.join(tempRoot, 'none.txt'), 'File', PREFLIGHT_STAGE),
    ).rejects.toBeInstanceOf(BuildStageError);
  });
});

describe('ensureDirs and removeDir', () => {
  it('creates one or more directories and removes directories recursively', async () => {
    const singleDir = path.join(tempRoot, 'single');
    const nestedDir = path.join(tempRoot, 'a', 'b', 'c');

    await ensureDirs(singleDir);
    await ensureDirs([nestedDir]);

    await expect(pathExists(singleDir)).resolves.toBe(true);
    await expect(pathExists(nestedDir)).resolves.toBe(true);

    await removeDir(path.join(tempRoot, 'a'));

    await expect(pathExists(nestedDir)).resolves.toBe(false);
  });
});

describe('error helpers', () => {
  it('identifies BuildStageError instances', () => {
    const stageError = new BuildStageError('frontend-build', 'failed');

    expect(isBuildStageError(stageError)).toBe(true);
    expect(isBuildStageError(new Error('nope'))).toBe(false);
  });

  it('normalises unknown values to Error', () => {
    const existing = new Error('existing');

    expect(asError(existing)).toBe(existing);
    expect(asError('wrapped').message).toBe('wrapped');
  });
});
