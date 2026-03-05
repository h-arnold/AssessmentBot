import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { BuilderPaths } from '../types.js';
import { BuildStageError } from '../lib/errors.js';
import { runResolveJsonDbSource } from './resolve-jsondb-source.js';

const execFileAsync = promisify(execFile);

/**
 * Builds a complete `BuilderPaths` object rooted at a temporary directory.
 *
 * @param {string} rootDir - Root temporary directory for the test fixture.
 * @return {BuilderPaths} Fully resolved builder path values.
 */
function createBuilderPaths(rootDir: string): BuilderPaths {
  return {
    repoRoot: rootDir,
    builderRoot: path.join(rootDir, 'scripts', 'builder'),
    configPath: path.join(rootDir, 'scripts', 'builder', 'builder.config.json'),
    frontendDir: path.join(rootDir, 'src', 'frontend'),
    backendDir: path.join(rootDir, 'src', 'backend'),
    buildDir: path.join(rootDir, 'build'),
    buildFrontendDir: path.join(rootDir, 'build', 'frontend'),
    buildWorkDir: path.join(rootDir, 'build', 'work'),
    buildGasDir: path.join(rootDir, 'build', 'gas'),
    buildGasUiDir: path.join(rootDir, 'build', 'gas', 'UI'),
    backendManifestPath: path.join(rootDir, 'src', 'backend', 'appsscript.json'),
    jsonDbAppPinnedSnapshotDir: path.join(rootDir, 'vendor', 'jsondbapp'),
    jsonDbAppManifestPath: path.join(rootDir, 'vendor', 'jsondbapp', 'appsscript.json'),
    jsonDbAppSourceFiles: [],
    jsonDbAppPublicExports: ['loadDatabase', 'createAndInitialiseDatabase'],
  };
}


async function createReleaseArchive(
  tempRoot: string,
  setup: (releaseFixtureRoot: string) => Promise<void>,
): Promise<Uint8Array> {
  const releaseFixtureDir = path.join(tempRoot, 'release-fixture');
  const releaseFixtureRoot = path.join(releaseFixtureDir, 'JsonDbApp-0.1.0');
  const archivePath = path.join(tempRoot, 'jsondbapp-release.tar.gz');

  await fs.mkdir(releaseFixtureRoot, { recursive: true });
  await setup(releaseFixtureRoot);
  await execFileAsync('tar', ['-czf', archivePath, '-C', releaseFixtureDir, 'JsonDbApp-0.1.0']);

  return fs.readFile(archivePath);
}

describe('runResolveJsonDbSource', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'resolve-jsondb-source-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('downloads, extracts, and resolves sorted src JavaScript files from the release archive', async () => {
    const paths = createBuilderPaths(tempRoot);

    const archiveBytes = await createReleaseArchive(tempRoot, async (releaseFixtureRoot) => {
      await fs.mkdir(path.join(releaseFixtureRoot, 'src', 'nested'), { recursive: true });
      await fs.writeFile(path.join(releaseFixtureRoot, 'appsscript.json'), '{"oauthScopes":[]}', 'utf-8');
      await fs.writeFile(path.join(releaseFixtureRoot, 'src', 'z-last.js'), 'function z(){}', 'utf-8');
      await fs.writeFile(path.join(releaseFixtureRoot, 'src', 'a-first.js'), 'function a(){}', 'utf-8');
      await fs.writeFile(path.join(releaseFixtureRoot, 'src', 'nested', 'b-middle.js'), 'function b(){}', 'utf-8');
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(archiveBytes, { status: 200, statusText: 'OK' }),
    );

    const result = await runResolveJsonDbSource(paths);

    expect(result.sourceFiles).toEqual(['src/a-first.js', 'src/nested/b-middle.js', 'src/z-last.js']);
    expect(paths.jsonDbAppPinnedSnapshotDir).toBe(path.join(paths.buildWorkDir, 'jsondbapp-v0.1.0'));
    expect(paths.jsonDbAppManifestPath).toBe(
      path.join(paths.buildWorkDir, 'jsondbapp-v0.1.0', 'appsscript.json'),
    );
    expect(paths.jsonDbAppSourceFiles).toEqual(result.sourceFiles);
  });



  it('throws BuildStageError when the release is missing a source directory', async () => {
    const paths = createBuilderPaths(tempRoot);
    const archiveBytes = await createReleaseArchive(tempRoot, async (releaseFixtureRoot) => {
      await fs.writeFile(path.join(releaseFixtureRoot, 'appsscript.json'), '{"oauthScopes":[]}', 'utf-8');
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(archiveBytes, { status: 200, statusText: 'OK' }),
    );

    await expect(runResolveJsonDbSource(paths)).rejects.toThrow('missing source directory');
  });

  it('throws BuildStageError when the release is missing a manifest', async () => {
    const paths = createBuilderPaths(tempRoot);
    const archiveBytes = await createReleaseArchive(tempRoot, async (releaseFixtureRoot) => {
      await fs.mkdir(path.join(releaseFixtureRoot, 'src'), { recursive: true });
      await fs.writeFile(path.join(releaseFixtureRoot, 'src', 'entry.js'), 'const x = 1;', 'utf-8');
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(archiveBytes, { status: 200, statusText: 'OK' }),
    );

    await expect(runResolveJsonDbSource(paths)).rejects.toThrow('missing manifest');
  });

  it('throws BuildStageError when src has no JavaScript files', async () => {
    const paths = createBuilderPaths(tempRoot);
    const archiveBytes = await createReleaseArchive(tempRoot, async (releaseFixtureRoot) => {
      await fs.mkdir(path.join(releaseFixtureRoot, 'src'), { recursive: true });
      await fs.writeFile(path.join(releaseFixtureRoot, 'appsscript.json'), '{"oauthScopes":[]}', 'utf-8');
      await fs.writeFile(path.join(releaseFixtureRoot, 'src', 'README.md'), '# not js', 'utf-8');
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(archiveBytes, { status: 200, statusText: 'OK' }),
    );

    await expect(runResolveJsonDbSource(paths)).rejects.toThrow('contains no JavaScript source files');
  });

  it('throws BuildStageError when the release download fails', async () => {
    const paths = createBuilderPaths(tempRoot);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('error', { status: 404 }));

    await expect(runResolveJsonDbSource(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runResolveJsonDbSource(paths)).rejects.toThrow(
      'Failed to download JsonDbApp release archive',
    );
  });
});
