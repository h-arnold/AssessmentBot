import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { BuilderPaths } from '../types.js';
import { BuildStageError } from '../lib/errors.js';
import { createBuilderPaths, createTempDir } from '../test/builder-fixture-test-helpers.js';
import { runMaterialiseOutput } from './materialise-output.js';

const EXPECTED_GAS_FILE_COUNT = 4;
const UTF8 = 'utf-8';
const APPS_SCRIPT_JSON = 'appsscript.json';
const JSONDB_INLINED = 'JsonDbApp.inlined.js';
const MATERIALISE_OUTPUT_STAGE = 'materialise-output';
const REACT_APP_HTML = 'ReactApp.html';
const MANIFEST_JSON = '{"oauthScopes":["a"]}';

/**
 * Writes a complete final GAS output fixture for materialisation tests.
 *
 * @param {BuilderPaths} paths - Builder paths for the test fixture.
 * @returns {Promise<void>} Resolves once the fixture files are written.
 */
async function writeCompleteGasOutput(paths: BuilderPaths): Promise<void> {
  await fs.writeFile(path.join(paths.buildGasDir, APPS_SCRIPT_JSON), MANIFEST_JSON, UTF8);
  await fs.writeFile(path.join(paths.buildGasDir, JSONDB_INLINED), 'const JsonDbApp = {};', UTF8);
  await fs.writeFile(path.join(paths.buildGasUiDir, REACT_APP_HTML), '<div id="root"></div>', UTF8);
  await fs.mkdir(path.join(paths.buildGasDir, 'Models'), { recursive: true });
  await fs.writeFile(path.join(paths.buildGasDir, 'Models', 'Thing.js'), 'class Thing {}', UTF8);
}

describe('runMaterialiseOutput', () => {
  let tempRoot: string;
  let paths: BuilderPaths;

  beforeEach(async () => {
    tempRoot = await createTempDir('materialise-output-');
    paths = createBuilderPaths(tempRoot, {
      jsonDbAppSourceFiles: ['src/01-core.js'],
      jsonDbAppPublicExports: ['loadDatabase'],
    });
    await fs.mkdir(paths.buildGasUiDir, { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.doUnmock('../lib/fs.js');
    vi.resetModules();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('returns deterministic metadata for complete gas output', async () => {
    await writeCompleteGasOutput(paths);

    const result = await runMaterialiseOutput(paths);

    expect(result.stage).toBe(MATERIALISE_OUTPUT_STAGE);
    expect(result.gasRootPath).toBe(paths.buildGasDir);
    expect(result.fileCount).toBe(EXPECTED_GAS_FILE_COUNT);
    expect(result.totalBytes).toBeGreaterThan(0);
  });

  it('normalises Windows-style relative paths to forward slashes before layout validation', async () => {
    await writeCompleteGasOutput(paths);

    const windowsRelativePaths = new Map<string, string>([
      [path.join(paths.buildGasDir, APPS_SCRIPT_JSON), APPS_SCRIPT_JSON],
      [path.join(paths.buildGasDir, JSONDB_INLINED), JSONDB_INLINED],
      [path.join(paths.buildGasUiDir, REACT_APP_HTML), String.raw`UI\ReactApp.html`],
      [path.join(paths.buildGasDir, 'Models', 'Thing.js'), String.raw`Models\Thing.js`],
    ]);

    vi.spyOn(path, 'relative').mockImplementation((_from, to) => {
      const relativePath = windowsRelativePaths.get(String(to));
      if (!relativePath) {
        throw new Error(`Unexpected relative-path input: ${String(to)}`);
      }
      return relativePath;
    });

    const result = await runMaterialiseOutput(paths);

    expect(result.stage).toBe(MATERIALISE_OUTPUT_STAGE);
    expect(result.fileCount).toBe(EXPECTED_GAS_FILE_COUNT);
  });

  it('treats Windows-style leaked work paths as forbidden output leakage', async () => {
    await writeCompleteGasOutput(paths);
    await fs.mkdir(path.join(paths.buildGasDir, 'work'), { recursive: true });
    await fs.writeFile(path.join(paths.buildGasDir, 'work', 'leftover.txt'), 'stale', UTF8);

    const windowsLeakPaths = new Map<string, string>([
      [path.join(paths.buildGasDir, APPS_SCRIPT_JSON), APPS_SCRIPT_JSON],
      [path.join(paths.buildGasDir, JSONDB_INLINED), JSONDB_INLINED],
      [path.join(paths.buildGasUiDir, REACT_APP_HTML), 'UI/ReactApp.html'],
      [path.join(paths.buildGasDir, 'Models', 'Thing.js'), 'Models/Thing.js'],
      [path.join(paths.buildGasDir, 'work', 'leftover.txt'), String.raw`work\leftover.txt`],
    ]);

    vi.spyOn(path, 'relative').mockImplementation((_from, to) => {
      const relativePath = windowsLeakPaths.get(String(to));
      if (!relativePath) {
        throw new Error('Unexpected relative-path input: ' + String(to));
      }
      return relativePath;
    });

    const error = await runMaterialiseOutput(paths).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(BuildStageError);
    expect(error).toMatchObject({
      stage: MATERIALISE_OUTPUT_STAGE,
    });
    expect((error as BuildStageError).message).toContain('work/leftover.txt');
  });

  it('uses the shared recursive walker when enumerating materialised gas files', async () => {
    await writeCompleteGasOutput(paths);

    const absoluteFiles = [
      path.join(paths.buildGasDir, APPS_SCRIPT_JSON),
      path.join(paths.buildGasDir, JSONDB_INLINED),
      path.join(paths.buildGasDir, 'Models', 'Thing.js'),
      path.join(paths.buildGasUiDir, REACT_APP_HTML),
    ];
    const listFilesRecursive = vi.fn().mockResolvedValue(absoluteFiles);

    vi.resetModules();
    vi.doMock('../lib/fs.js', () => ({
      listFilesRecursive,
    }));

    const { runMaterialiseOutput: runMaterialiseOutputWithSharedWalker } = await import(
      './materialise-output.js'
    );
    const result = await runMaterialiseOutputWithSharedWalker(paths);

    expect(listFilesRecursive).toHaveBeenCalledWith(paths.buildGasDir);
    expect(result.fileCount).toBe(EXPECTED_GAS_FILE_COUNT);
  });

  it('fails fast when required layout files are missing', async () => {
    await fs.writeFile(path.join(paths.buildGasDir, APPS_SCRIPT_JSON), MANIFEST_JSON, UTF8);

    await expect(runMaterialiseOutput(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runMaterialiseOutput(paths)).rejects.toMatchObject({
      stage: MATERIALISE_OUTPUT_STAGE,
    });
  });

  it('fails when work directory artefacts leak into gas output', async () => {
    await fs.mkdir(path.join(paths.buildGasDir, 'work'), { recursive: true });
    await fs.writeFile(path.join(paths.buildGasDir, APPS_SCRIPT_JSON), MANIFEST_JSON, UTF8);
    await fs.writeFile(path.join(paths.buildGasDir, JSONDB_INLINED), 'const JsonDbApp = {};', UTF8);
    await fs.writeFile(path.join(paths.buildGasUiDir, REACT_APP_HTML), '<div id="root"></div>', UTF8);
    await fs.writeFile(path.join(paths.buildGasDir, 'work', 'leftover.txt'), 'stale', UTF8);

    await expect(runMaterialiseOutput(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runMaterialiseOutput(paths)).rejects.toMatchObject({
      stage: MATERIALISE_OUTPUT_STAGE,
    });
  });
});
