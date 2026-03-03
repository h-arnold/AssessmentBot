import { describe, expect, it } from 'vitest';

import type { BuilderPaths } from '../types.js';
import { BuildStageError } from '../lib/errors.js';
import { resolveJsonDbSourceFilePaths, runResolveJsonDbSource } from './resolve-jsondb-source.js';

/**
 * Builds a representative `BuilderPaths` fixture for step tests.
 *
 * @return {BuilderPaths} Fully resolved builder path values.
 */
function createBuilderPaths(): BuilderPaths {
  return {
    repoRoot: '/repo',
    builderRoot: '/repo/scripts/builder',
    configPath: '/repo/scripts/builder/builder.config.json',
    frontendDir: '/repo/src/frontend',
    backendDir: '/repo/src/backend',
    buildDir: '/repo/build',
    buildFrontendDir: '/repo/build/frontend',
    buildWorkDir: '/repo/build/work',
    buildGasDir: '/repo/build/gas',
    buildGasUiDir: '/repo/build/gas/UI',
    jsonDbAppPinnedSnapshotDir: '/repo/vendor/jsondbapp',
    jsonDbAppSourceFiles: ['src/z-last.js', 'src/a-first.js', 'src/m-middle.js'],
  };
}

describe('resolveJsonDbSourceFilePaths', () => {
  it('returns deterministic load order from configured source files', () => {
    const paths = createBuilderPaths();
    expect(resolveJsonDbSourceFilePaths(paths)).toEqual([
      '/repo/vendor/jsondbapp/src/a-first.js',
      '/repo/vendor/jsondbapp/src/m-middle.js',
      '/repo/vendor/jsondbapp/src/z-last.js',
    ]);
  });
});

describe('runResolveJsonDbSource', () => {
  it('throws explicit failure when a required file is missing', async () => {
    const paths = createBuilderPaths();
    paths.jsonDbAppSourceFiles = ['src/missing.js'];

    await expect(runResolveJsonDbSource(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runResolveJsonDbSource(paths)).rejects.toThrow(
      'Pinned JsonDbApp source file is missing:',
    );
  });
});
