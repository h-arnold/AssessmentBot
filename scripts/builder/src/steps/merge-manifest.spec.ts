import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { BuilderPaths } from '../types.js';
import { BuildStageError } from '../lib/errors.js';
import { mergeScopes, mergeServices, runMergeManifest } from './merge-manifest.js';

/**
 * Creates a unique temporary directory for a test case.
 *
 * @return {Promise<string>} Path to the created temporary directory.
 */
async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'merge-manifest-'));
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
  const backendDir = path.join(repoRoot, 'src', 'backend');
  const jsonDbAppPinnedSnapshotDir = path.join(repoRoot, 'vendor', 'jsondbapp');

  return {
    repoRoot,
    builderRoot: path.join(repoRoot, 'scripts', 'builder'),
    configPath: path.join(repoRoot, 'scripts', 'builder', 'builder.config.json'),
    frontendDir: path.join(repoRoot, 'src', 'frontend'),
    backendDir,
    buildDir,
    buildFrontendDir: path.join(buildDir, 'frontend'),
    buildWorkDir: path.join(buildDir, 'work'),
    buildGasDir,
    buildGasUiDir: path.join(buildGasDir, 'UI'),
    backendManifestPath: path.join(backendDir, 'appsscript.json'),
    jsonDbAppPinnedSnapshotDir,
    jsonDbAppManifestPath: path.join(jsonDbAppPinnedSnapshotDir, 'appsscript.json'),
    jsonDbAppSourceFiles: ['src/01-core.js'],
    jsonDbAppPublicExports: ['loadDatabase'],
  };
}

describe('mergeScopes', () => {
  it('de-duplicates and sorts scopes deterministically', () => {
    expect(mergeScopes(['scope.b', 'scope.a'], ['scope.b', 'scope.c'])).toEqual([
      'scope.a',
      'scope.b',
      'scope.c',
    ]);
  });
});

describe('mergeServices', () => {
  it('keeps base service versions when service IDs overlap', () => {
    const merged = mergeServices(
      [
        { userSymbol: 'Drive', serviceId: 'drive', version: 'v3' },
        { userSymbol: 'Sheets', serviceId: 'sheets', version: 'v4' },
      ],
      [
        { userSymbol: 'Drive', serviceId: 'drive', version: 'v2' },
        { userSymbol: 'Slides', serviceId: 'slides', version: 'v1' },
      ],
    );

    expect(merged).toEqual([
      { userSymbol: 'Drive', serviceId: 'drive', version: 'v3' },
      { userSymbol: 'Sheets', serviceId: 'sheets', version: 'v4' },
      { userSymbol: 'Slides', serviceId: 'slides', version: 'v1' },
    ]);
  });
});

describe('runMergeManifest', () => {
  let tempRoot: string;
  let paths: BuilderPaths;

  beforeEach(async () => {
    tempRoot = await createTempDir();
    paths = createBuilderPaths(tempRoot);
    await fs.mkdir(paths.buildGasDir, { recursive: true });
    await fs.mkdir(path.dirname(paths.backendManifestPath), { recursive: true });
    await fs.mkdir(path.dirname(paths.jsonDbAppManifestPath), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('writes one merged appsscript.json with deterministic key order', async () => {
    await fs.writeFile(
      paths.backendManifestPath,
      JSON.stringify({
        runtimeVersion: 'V8',
        oauthScopes: ['scope.b', 'scope.a'],
        dependencies: {
          enabledAdvancedServices: [{ userSymbol: 'Drive', serviceId: 'drive', version: 'v3' }],
        },
      }),
      'utf-8',
    );
    await fs.writeFile(
      paths.jsonDbAppManifestPath,
      JSON.stringify({
        oauthScopes: ['scope.c', 'scope.a'],
        dependencies: {
          enabledAdvancedServices: [
            { userSymbol: 'Drive', serviceId: 'drive', version: 'v2' },
            { userSymbol: 'Sheets', serviceId: 'sheets', version: 'v4' },
          ],
        },
      }),
      'utf-8',
    );

    const result = await runMergeManifest(paths);
    const output = await fs.readFile(result.outputPath, 'utf-8');
    const parsed = JSON.parse(output) as {
      dependencies: { enabledAdvancedServices: { serviceId: string; version: string }[] };
      oauthScopes: string[];
    };

    expect(result.stage).toBe('merge-manifest');
    expect(result.outputPath).toBe(path.join(paths.buildGasDir, 'appsscript.json'));
    expect(parsed.oauthScopes).toEqual(['scope.a', 'scope.b', 'scope.c']);
    expect(parsed.dependencies.enabledAdvancedServices).toEqual([
      { userSymbol: 'Drive', serviceId: 'drive', version: 'v3' },
      { userSymbol: 'Sheets', serviceId: 'sheets', version: 'v4' },
    ]);
    expect(Object.keys(parsed)).toEqual(['dependencies', 'oauthScopes', 'runtimeVersion']);
  });

  it('fails with BuildStageError when JsonDb manifest is missing', async () => {
    await fs.writeFile(paths.backendManifestPath, JSON.stringify({ oauthScopes: [] }), 'utf-8');

    await expect(runMergeManifest(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runMergeManifest(paths)).rejects.toMatchObject({
      stage: 'merge-manifest',
      name: 'BuildStageError',
    });
  });
});
