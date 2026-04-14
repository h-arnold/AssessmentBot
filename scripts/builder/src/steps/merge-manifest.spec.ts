import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { BuilderPaths } from '../types.js';
import { BuildStageError } from '../lib/errors.js';
import { createBuilderPaths, createTempDir } from '../test/builder-fixture-test-helpers.js';
import { mergeScopes, mergeServices, runMergeManifest, sortKeysDeep } from './merge-manifest.js';

const APPS_SCRIPT_JSON = 'appsscript.json';


describe('sortKeysDeep', () => {
  it('sorts object keys recursively while preserving arrays', () => {
    const sorted = sortKeysDeep({
      b: { d: 1, c: 2 },
      a: [{ z: 1, y: 2 }],
    }) as { a: Array<Record<string, number>>; b: Record<string, number> };

    expect(Object.keys(sorted)).toEqual(['a', 'b']);
    expect(Object.keys(sorted.b)).toEqual(['c', 'd']);
    expect(Object.keys(sorted.a[0])).toEqual(['y', 'z']);
  });
});

describe('mergeScopes', () => {
  it('de-duplicates and sorts scopes deterministically', () => {
    expect(mergeScopes(['scope.b', 'scope.a'], ['scope.b', 'scope.c'])).toEqual([
      'scope.a',
      'scope.b',
      'scope.c',
    ]);
  });

  it('returns an empty list when both scope lists are undefined', () => {
    expect(mergeScopes(undefined, undefined)).toEqual([]);
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

  it('returns an empty list when both service lists are undefined', () => {
    expect(mergeServices(undefined, undefined)).toEqual([]);
  });

});

describe('runMergeManifest', () => {
  let tempRoot: string;
  let paths: BuilderPaths;

  beforeEach(async () => {
    tempRoot = await createTempDir('merge-manifest-');
    paths = createBuilderPaths(tempRoot, {
      jsonDbAppSourceFiles: ['src/01-core.js'],
      jsonDbAppPublicExports: ['loadDatabase'],
    });
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
    expect(result.outputPath).toBe(path.join(paths.buildGasDir, APPS_SCRIPT_JSON));
    expect(parsed.oauthScopes).toEqual(['scope.a', 'scope.b', 'scope.c']);
    expect(parsed.dependencies.enabledAdvancedServices).toEqual([
      { userSymbol: 'Drive', serviceId: 'drive', version: 'v3' },
      { userSymbol: 'Sheets', serviceId: 'sheets', version: 'v4' },
    ]);
    expect(Object.keys(parsed)).toEqual(['dependencies', 'oauthScopes', 'runtimeVersion']);
  });


  it('fails with BuildStageError when output directory does not exist', async () => {
    await fs.writeFile(paths.backendManifestPath, JSON.stringify({ oauthScopes: [] }), 'utf-8');
    await fs.writeFile(paths.jsonDbAppManifestPath, JSON.stringify({ oauthScopes: [] }), 'utf-8');

    paths.buildGasDir = path.join(tempRoot, 'missing-output-dir');

    await expect(runMergeManifest(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runMergeManifest(paths)).rejects.toThrow('Unable to write merged manifest');
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
