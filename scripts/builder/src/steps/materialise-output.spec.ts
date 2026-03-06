import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { BuilderPaths } from '../types.js';
import { BuildStageError } from '../lib/errors.js';
import { runMaterialiseOutput } from './materialise-output.js';

const EXPECTED_GAS_FILE_COUNT = 4;
const UTF8 = 'utf-8';
const APPS_SCRIPT_JSON = 'appsscript.json';
const JSONDB_INLINED = 'JsonDbApp.inlined.js';
const MATERIALISE_OUTPUT_STAGE = 'materialise-output';
const REACT_APP_HTML = 'ReactApp.html';
const MANIFEST_JSON = '{"oauthScopes":["a"]}';

/**
 * Creates a unique temporary directory for each test run.
 *
 * @return {Promise<string>} Temporary root directory path.
 */
async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'materialise-output-'));
}

/**
 * Creates a complete builder paths object for tests.
 *
 * @param {string} rootDir - Temporary repository root path.
 * @return {BuilderPaths} Resolved path structure.
 */
function createBuilderPaths(rootDir: string): BuilderPaths {
  const buildDir = path.join(rootDir, 'build');
  const buildGasDir = path.join(buildDir, 'gas');

  return {
    repoRoot: rootDir,
    builderRoot: path.join(rootDir, 'scripts', 'builder'),
    configPath: path.join(rootDir, 'scripts', 'builder', 'builder.config.json'),
    frontendDir: path.join(rootDir, 'src', 'frontend'),
    backendDir: path.join(rootDir, 'src', 'backend'),
    buildDir,
    buildFrontendDir: path.join(buildDir, 'frontend'),
    buildWorkDir: path.join(buildDir, 'work'),
    buildGasDir,
    buildGasUiDir: path.join(buildGasDir, 'UI'),
    backendManifestPath: path.join(rootDir, 'src', 'backend', APPS_SCRIPT_JSON),
    jsonDbAppPinnedSnapshotDir: path.join(rootDir, 'vendor', 'jsondbapp'),
    jsonDbAppManifestPath: path.join(rootDir, 'vendor', 'jsondbapp', APPS_SCRIPT_JSON),
    jsonDbAppSourceFiles: ['src/01-core.js'],
    jsonDbAppPublicExports: ['loadDatabase'],
  };
}

describe('runMaterialiseOutput', () => {
  let tempRoot: string;
  let paths: BuilderPaths;

  beforeEach(async () => {
    tempRoot = await createTempDir();
    paths = createBuilderPaths(tempRoot);
    await fs.mkdir(paths.buildGasUiDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('returns deterministic metadata for complete gas output', async () => {
    await fs.writeFile(path.join(paths.buildGasDir, APPS_SCRIPT_JSON), MANIFEST_JSON, UTF8);
    await fs.writeFile(path.join(paths.buildGasDir, JSONDB_INLINED), 'const JsonDbApp = {};', UTF8);
    await fs.writeFile(path.join(paths.buildGasUiDir, REACT_APP_HTML), '<div id="root"></div>', UTF8);
    await fs.mkdir(path.join(paths.buildGasDir, 'Models'), { recursive: true });
    await fs.writeFile(path.join(paths.buildGasDir, 'Models', 'Thing.js'), 'class Thing {}', UTF8);

    const result = await runMaterialiseOutput(paths);

    expect(result.stage).toBe(MATERIALISE_OUTPUT_STAGE);
    expect(result.gasRootPath).toBe(paths.buildGasDir);
    expect(result.fileCount).toBe(EXPECTED_GAS_FILE_COUNT);
    expect(result.totalBytes).toBeGreaterThan(0);
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
