import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BuildStageError } from '../lib/errors.js';
import {
  createBuilderPaths,
  createReleaseArchive,
  writeReleaseFile,
  writeReleaseManifest,
} from '../test/jsondb-source-test-helpers.js';
import { runResolveJsonDbSource } from './resolve-jsondb-source.js';

/**
 * Mocks a successful release download for resolve-jsondb-source tests.
 *
 * @param {Uint8Array} archiveBytes - Tar archive payload returned by mocked fetch.
 * @return {void} No return value.
 */
function mockSuccessfulReleaseDownload(archiveBytes: Uint8Array): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(archiveBytes, { status: 200, statusText: 'OK' }),
  );
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
      await writeReleaseManifest(releaseFixtureRoot);
      await writeReleaseFile(releaseFixtureRoot, 'src/z-last.js', 'function z(){}');
      await writeReleaseFile(releaseFixtureRoot, 'src/a-first.js', 'function a(){}');
      await writeReleaseFile(releaseFixtureRoot, 'src/nested/b-middle.js', 'function b(){}');
    });
    mockSuccessfulReleaseDownload(archiveBytes);

    const result = await runResolveJsonDbSource(paths);

    expect(result.sourceFiles).toEqual(['src/a-first.js', 'src/nested/b-middle.js', 'src/z-last.js']);
    expect(paths.jsonDbAppPinnedSnapshotDir).toBe(path.join(paths.buildWorkDir, 'jsondbapp-v0.1.1'));
    expect(paths.jsonDbAppManifestPath).toBe(
      path.join(paths.buildWorkDir, 'jsondbapp-v0.1.1', 'appsscript.json'),
    );
    expect(paths.jsonDbAppSourceFiles).toEqual(result.sourceFiles);
  });

  it('throws BuildStageError when the release is missing a source directory', async () => {
    const paths = createBuilderPaths(tempRoot);
    const archiveBytes = await createReleaseArchive(tempRoot, async (releaseFixtureRoot) => {
      await writeReleaseManifest(releaseFixtureRoot);
    });
    mockSuccessfulReleaseDownload(archiveBytes);

    await expect(runResolveJsonDbSource(paths)).rejects.toThrow('missing source directory');
  });

  it('throws BuildStageError when the release is missing a manifest', async () => {
    const paths = createBuilderPaths(tempRoot);
    const archiveBytes = await createReleaseArchive(tempRoot, async (releaseFixtureRoot) => {
      await writeReleaseFile(releaseFixtureRoot, 'src/entry.js', 'const x = 1;');
    });
    mockSuccessfulReleaseDownload(archiveBytes);

    await expect(runResolveJsonDbSource(paths)).rejects.toThrow('missing manifest');
  });

  it('throws BuildStageError when src has no JavaScript files', async () => {
    const paths = createBuilderPaths(tempRoot);
    const archiveBytes = await createReleaseArchive(tempRoot, async (releaseFixtureRoot) => {
      await writeReleaseManifest(releaseFixtureRoot);
      await writeReleaseFile(releaseFixtureRoot, 'src/README.md', '# not js');
    });
    mockSuccessfulReleaseDownload(archiveBytes);

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
