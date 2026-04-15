import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { BuildStageError } from '../lib/errors.js';
import {
  createBuilderPaths,
  createReleaseArchive,
  createTempDir,
} from '../test/builder-fixture-test-helpers.js';
import { runResolveJsonDbSource } from './resolve-jsondb-source.js';

const CONFIGURED_VENDORED_SOURCE_FILES = [
  'src/01_utils/Validation.js',
  'src/04_core/Database.js',
  'src/04_core/99_PublicAPI.js',
];
const REAL_VENDORED_MANIFEST = {
  timeZone: 'Europe/London',
  exceptionLogging: 'STACKDRIVER',
  runtimeVersion: 'V8',
  oauthScopes: [
    'https://www.googleapis.com/auth/script.storage',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.scriptapp',
  ],
  dependencies: {
    enabledAdvancedServices: [{ userSymbol: 'Drive', serviceId: 'drive', version: 'v3' }],
  },
};
const REAL_VENDORED_SOURCE_CONTENT = {
  'src/01_utils/Validation.js': 'function Validation() { return true; }\n',
  'src/04_core/Database.js': [
    'function Database(config) {',
    '  this.config = config;',
    '}',
    'Database.prototype.initialise = function () {};',
    'Database.prototype.createDatabase = function () {};',
    '',
  ].join('\n'),
  'src/04_core/99_PublicAPI.js': [
    'function loadDatabase(config) {',
    '  const db = new Database(config);',
    '  db.initialise();',
    '  return db;',
    '}',
    '',
    'function createAndInitialiseDatabase(config) {',
    '  const db = new Database(config);',
    '  db.createDatabase();',
    '  db.initialise();',
    '  return db;',
    '}',
    '',
  ].join('\n'),
} satisfies Record<string, string>;

type VendoredSnapshotOptions = {
  files?: Record<string, string>;
  manifest?: Record<string, unknown>;
};

/**
 * Writes a vendored JsonDbApp snapshot fixture to disk.
 *
 * @param {string} snapshotRoot - Absolute vendored snapshot root path.
 * @param {VendoredSnapshotOptions} options - Optional fixture overrides.
 * @returns {Promise<void>} Resolves once the fixture files exist.
 */
async function writeVendoredSnapshot(
  snapshotRoot: string,
  options: VendoredSnapshotOptions = {},
): Promise<void> {
  const files = options.files ?? REAL_VENDORED_SOURCE_CONTENT;
  const manifest = options.manifest ?? REAL_VENDORED_MANIFEST;

  await fs.mkdir(snapshotRoot, { recursive: true });
  await fs.writeFile(path.join(snapshotRoot, 'appsscript.json'), JSON.stringify(manifest), 'utf-8');

  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const absolutePath = path.join(snapshotRoot, relativePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf-8');
    }),
  );
}

/**
 * Creates a legacy release archive from the vendored snapshot fixture.
 *
 * @param {string} tempRoot - Temporary test root directory.
 * @param {VendoredSnapshotOptions} options - Optional fixture overrides.
 * @returns {Promise<Uint8Array>} Archive bytes for the legacy download path.
 */
async function createLegacyReleaseArchiveFromSnapshot(
  tempRoot: string,
  options: VendoredSnapshotOptions = {},
): Promise<Uint8Array> {
  return createReleaseArchive(tempRoot, async (releaseFixtureRoot) => {
    await writeVendoredSnapshot(releaseFixtureRoot, options);
  });
}

/**
 * Creates builder paths rooted at a vendored JsonDbApp snapshot fixture.
 *
 * @param {string} tempRoot - Temporary test root directory.
 * @returns {ReturnType<typeof createBuilderPaths>} Resolved fixture paths.
 */
function createVendoredSnapshotPaths(tempRoot: string): ReturnType<typeof createBuilderPaths> {
  const snapshotRoot = path.join(tempRoot, 'scripts', 'builder', 'vendor', 'jsondbapp');

  return createBuilderPaths(tempRoot, {
    builderRoot: path.join(tempRoot, 'scripts', 'builder'),
    jsonDbAppPinnedSnapshotDir: snapshotRoot,
    jsonDbAppManifestPath: path.join(snapshotRoot, 'appsscript.json'),
    jsonDbAppSourceFiles: [...CONFIGURED_VENDORED_SOURCE_FILES],
    jsonDbAppPublicExports: ['loadDatabase', 'createAndInitialiseDatabase'],
  });
}

/**
 * Mocks the legacy release download transport for the current Stage 6 implementation.
 *
 * @param {Uint8Array} archiveBytes - Archive payload returned by the mocked fetch call.
 * @returns {ReturnType<typeof vi.spyOn>} Fetch spy used by assertions.
 */
function mockLegacyReleaseDownload(archiveBytes: Uint8Array) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(archiveBytes, { status: 200, statusText: 'OK' }));
}

describe('runResolveJsonDbSource', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await createTempDir('resolve-jsondb-source-');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('validates the configured vendored snapshot locally and keeps configured source paths', async () => {
    const paths = createVendoredSnapshotPaths(tempRoot);
    const snapshotRoot = paths.jsonDbAppPinnedSnapshotDir;
    await writeVendoredSnapshot(snapshotRoot, {
      files: {
        ...REAL_VENDORED_SOURCE_CONTENT,
        'src/99_unused.js': 'function notConfigured() {}\n',
      },
    });
    const fetchSpy = mockLegacyReleaseDownload(
      await createLegacyReleaseArchiveFromSnapshot(tempRoot, {
        files: {
          ...REAL_VENDORED_SOURCE_CONTENT,
          'src/99_unused.js': 'function notConfigured() {}\n',
        },
      }),
    );

    const result = await runResolveJsonDbSource(paths);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      stage: 'resolve-jsondb-source',
      sourceFiles: CONFIGURED_VENDORED_SOURCE_FILES,
    });
    expect(paths.jsonDbAppPinnedSnapshotDir).toBe(snapshotRoot);
    expect(paths.jsonDbAppManifestPath).toBe(path.join(snapshotRoot, 'appsscript.json'));
    expect(paths.jsonDbAppSourceFiles).toEqual(CONFIGURED_VENDORED_SOURCE_FILES);
    expect(paths.jsonDbAppPinnedSnapshotDir.startsWith(paths.buildWorkDir)).toBe(false);
  });

  it('fails when a configured vendored source file is missing instead of auto-discovering a replacement', async () => {
    const paths = createVendoredSnapshotPaths(tempRoot);
    const replacementFiles = {
      'src/01_utils/Validation.js': REAL_VENDORED_SOURCE_CONTENT['src/01_utils/Validation.js'],
      'src/04_core/Database.js': REAL_VENDORED_SOURCE_CONTENT['src/04_core/Database.js'],
      'src/04_core/Replacement.js': 'function replacementFile() {}\n',
    };
    await writeVendoredSnapshot(paths.jsonDbAppPinnedSnapshotDir, {
      files: replacementFiles,
    });
    mockLegacyReleaseDownload(
      await createLegacyReleaseArchiveFromSnapshot(tempRoot, {
        files: replacementFiles,
      }),
    );

    const resolvePromise = runResolveJsonDbSource(paths);

    await expect(resolvePromise).rejects.toBeInstanceOf(BuildStageError);
    await expect(resolvePromise).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: 'resolve-jsondb-source',
    });
    await expect(resolvePromise).rejects.toThrow('src/04_core/99_PublicAPI.js');
  });

  it('does not repoint BuilderPaths into build/work when vendored snapshot validation succeeds', async () => {
    const paths = createVendoredSnapshotPaths(tempRoot);
    const snapshotRoot = paths.jsonDbAppPinnedSnapshotDir;
    const manifestPath = paths.jsonDbAppManifestPath;
    mockLegacyReleaseDownload(await createLegacyReleaseArchiveFromSnapshot(tempRoot));
    await writeVendoredSnapshot(snapshotRoot);

    await runResolveJsonDbSource(paths);

    expect(paths.jsonDbAppPinnedSnapshotDir).toBe(snapshotRoot);
    expect(paths.jsonDbAppManifestPath).toBe(manifestPath);
    expect(paths.jsonDbAppPinnedSnapshotDir.startsWith(paths.buildWorkDir)).toBe(false);
  });

  it('rejects placeholder vendored content before Stage 7 inlining', async () => {
    const paths = createVendoredSnapshotPaths(tempRoot);
    const placeholderFiles = {
      ...REAL_VENDORED_SOURCE_CONTENT,
      'src/04_core/99_PublicAPI.js': [
        "function loadDatabase() { throw new Error('JsonDbApp snapshot placeholder'); }",
        '',
        'function createAndInitialiseDatabase() {',
        '  return loadDatabase();',
        '}',
        '',
      ].join('\n'),
    };
    await writeVendoredSnapshot(paths.jsonDbAppPinnedSnapshotDir, {
      files: placeholderFiles,
    });
    mockLegacyReleaseDownload(
      await createLegacyReleaseArchiveFromSnapshot(tempRoot, {
        files: placeholderFiles,
      }),
    );

    const resolvePromise = runResolveJsonDbSource(paths);

    await expect(resolvePromise).rejects.toBeInstanceOf(BuildStageError);
    await expect(resolvePromise).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: 'resolve-jsondb-source',
    });
    await expect(resolvePromise).rejects.toThrow('placeholder');
  });
});
