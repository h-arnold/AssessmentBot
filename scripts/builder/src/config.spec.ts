import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBuilderConfig, resolveBuildDir, resolveBuilderPaths } from './config.js';
import { BuildStageError } from './lib/errors.js';

const TEMP_ROOT = path.join(os.tmpdir(), 'builder-config-spec');
const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SPEC_DIR, '..', '..', '..');
const ROOT_PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const ROOT_PACKAGE_LOCK_PATH = path.join(REPO_ROOT, 'package-lock.json');

type PackageDependencyGroups = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type PackageLockMetadata = PackageDependencyGroups & {
  packages?: Record<string, PackageDependencyGroups>;
  dependencies?: Record<string, unknown>;
};

/**
 * Return zod's direct dependency version from a package metadata section.
 *
 * @param {PackageDependencyGroups} metadata - Package metadata section to inspect.
 * @returns {string|undefined} Direct zod dependency version, when present.
 */
function getDirectZodVersion(metadata?: PackageDependencyGroups): string | undefined {
  if (!metadata) return undefined;
  return metadata.dependencies?.zod ?? metadata.devDependencies?.zod;
}

/**
 * Return zod's direct dependency value from the root lockfile package entry.
 *
 * @param {PackageLockMetadata} packageLock - Parsed package lock metadata.
 * @returns {unknown} Direct zod dependency value, when present.
 */
function getRootLockZodDependency(packageLock: PackageLockMetadata): unknown {
  const rootPackage = packageLock.packages?.[''];
  return getDirectZodVersion(rootPackage) ?? packageLock.dependencies?.zod;
}

/**
 * Resets a temporary directory for isolated test runs.
 *
 * @param {string} targetPath - Absolute directory path to reset.
 * @returns {Promise<void>} Resolves when the directory is ready.
 */
async function resetDir(targetPath: string): Promise<void> {
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.mkdir(targetPath, { recursive: true });
}

/**
 * Writes a builder config fixture to a temporary directory.
 *
 * @param {string} dirName - Temporary subdirectory name.
 * @param {string} content - Raw config file content.
 * @returns {Promise<string>} Absolute path to the written config file.
 */
async function writeConfig(dirName: string, content: string): Promise<string> {
  const targetDir = path.join(TEMP_ROOT, dirName);
  await fs.mkdir(targetDir, { recursive: true });
  const configPath = path.join(targetDir, 'builder.config.json');
  await fs.writeFile(configPath, content);
  return configPath;
}

/**
 * Creates a valid builder config fixture.
 *
 * @returns {{frontendDir: string; backendDir: string; buildDir: string; jsonDbApp: {pinnedSnapshotDir: string; sourceFiles: string[]; publicExports: string[]}}} Valid config object.
 */
function createValidConfig(): {
  frontendDir: string;
  backendDir: string;
  buildDir: string;
  jsonDbApp: { pinnedSnapshotDir: string; sourceFiles: string[]; publicExports: string[] };
} {
  return {
    frontendDir: 'src/frontend',
    backendDir: 'src/backend',
    buildDir: 'build',
    jsonDbApp: {
      pinnedSnapshotDir: 'scripts/builder/vendor/jsondbapp',
      sourceFiles: ['src/04_core/99_PublicAPI.js'],
      publicExports: ['loadDatabase', 'createAndInitialiseDatabase'],
    },
  };
}

/**
 * Runs a callback and asserts it throws a preflight BuildStageError.
 *
 * @param {() => unknown | Promise<unknown>} run - Callback expected to throw.
 * @returns {Promise<BuildStageError>} The caught BuildStageError.
 */
async function assertBuildStageError(
  run: () => unknown | Promise<unknown>
): Promise<BuildStageError> {
  let thrownError: BuildStageError | undefined;

  try {
    await run();
  } catch (err) {
    thrownError = err as BuildStageError;
  }

  expect(thrownError).toBeInstanceOf(BuildStageError);
  expect(thrownError).toMatchObject({
    name: 'BuildStageError',
    stage: 'preflight-clean',
  });

  return thrownError as BuildStageError;
}

describe('loadBuilderConfig', () => {
  beforeEach(async () => {
    await resetDir(TEMP_ROOT);
  });

  afterEach(async () => {
    await fs.rm(TEMP_ROOT, { recursive: true, force: true });
  });

  it('throws BuildStageError with stage "preflight-clean" when config JSON is invalid', async () => {
    const configPath = await writeConfig('invalid-json', '{ not-json }');

    await expect(loadBuilderConfig(configPath)).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: 'preflight-clean',
    });
    await expect(loadBuilderConfig(configPath)).rejects.toBeInstanceOf(BuildStageError);
    await expect(loadBuilderConfig(configPath)).rejects.toThrow(configPath);
  });

  it('throws BuildStageError with stage "preflight-clean" when required fields are missing', async () => {
    const configPath = await writeConfig(
      'missing-fields',
      JSON.stringify({ frontendDir: 'src/frontend', jsonDbApp: {} })
    );

    await expect(loadBuilderConfig(configPath)).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: 'preflight-clean',
    });
    await expect(loadBuilderConfig(configPath)).rejects.toBeInstanceOf(BuildStageError);
  });

  it('throws BuildStageError with stage "preflight-clean" when jsonDbApp config shape is malformed', async () => {
    const configPath = await writeConfig(
      'malformed-jsondbapp',
      JSON.stringify({
        ...createValidConfig(),
        jsonDbApp: {
          pinnedSnapshotDir: 'scripts/builder/vendor/jsondbapp',
          sourceFiles: 'src/04_core/99_PublicAPI.js',
          publicExports: ['loadDatabase'],
        },
      })
    );

    await expect(loadBuilderConfig(configPath)).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: 'preflight-clean',
    });
    await expect(loadBuilderConfig(configPath)).rejects.toBeInstanceOf(BuildStageError);
  });

  it('throws BuildStageError with stage "preflight-clean" when config file is missing', async () => {
    const configPath = path.join(TEMP_ROOT, 'missing', 'builder.config.json');

    await expect(loadBuilderConfig(configPath)).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: 'preflight-clean',
    });
    await expect(loadBuilderConfig(configPath)).rejects.toBeInstanceOf(BuildStageError);
  });

  it('declares a direct zod dependency in package metadata for builder config schema validation', async () => {
    const packageJson = JSON.parse(
      await fs.readFile(ROOT_PACKAGE_JSON_PATH, 'utf-8')
    ) as PackageDependencyGroups;
    const packageLock = JSON.parse(
      await fs.readFile(ROOT_PACKAGE_LOCK_PATH, 'utf-8')
    ) as PackageLockMetadata;

    const packageJsonDirectZodVersion = getDirectZodVersion(packageJson);
    const packageLockRootDirectZod = getRootLockZodDependency(packageLock);

    expect(packageJsonDirectZodVersion).toBeDefined();
    expect(packageLockRootDirectZod).toBeDefined();
  });
});

describe('resolveBuildDir', () => {
  const repoRoot = path.join(TEMP_ROOT, 'repo');

  beforeEach(async () => {
    await resetDir(repoRoot);
  });

  afterEach(async () => {
    await fs.rm(TEMP_ROOT, { recursive: true, force: true });
  });

  it('throws BuildStageError with stage "preflight-clean" when buildDir is empty or whitespace', async () => {
    await assertBuildStageError(() => resolveBuildDir(repoRoot, ''));
    await assertBuildStageError(() => resolveBuildDir(repoRoot, '   '));
  });

  it('throws BuildStageError with stage "preflight-clean" when buildDir resolves to repo root', async () => {
    await assertBuildStageError(() => resolveBuildDir(repoRoot, '.'));
  });

  it('throws BuildStageError with stage "preflight-clean" when buildDir resolves outside repo root', async () => {
    await assertBuildStageError(() => resolveBuildDir(repoRoot, '..'));
  });

  it('returns the resolved build directory for a valid relative path', () => {
    const resolved = resolveBuildDir(repoRoot, path.join('build', 'output'));

    expect(resolved).toBe(path.join(repoRoot, 'build', 'output'));
  });
});

describe('resolveBuilderPaths', () => {
  type BuilderConfig = ReturnType<typeof createValidConfig>;
  type JsonDbAppConfig = BuilderConfig['jsonDbApp'];

  let tempRoot: string;
  let builderRoot: string;
  let repoRoot: string;
  let configPath: string;

  /**
   * Writes a builder config fixture for path resolution tests.
   *
   * @param {Record<string, unknown>} config - Config object to serialise.
   * @returns {Promise<void>} Resolves when the fixture is written.
   */
  async function writeBuilderConfig(config: Record<string, unknown>): Promise<void> {
    await fs.writeFile(configPath, JSON.stringify(config));
  }

  /**
   * Asserts path resolution fails for the given config overrides.
   *
   * @param {Partial<BuilderConfig>} configOverrides - Config overrides to test.
   * @returns {Promise<void>} Resolves when the failure assertion completes.
   */
  async function expectResolveBuilderPathsToFail(
    configOverrides: Partial<BuilderConfig>
  ): Promise<void> {
    await writeBuilderConfig({
      ...createValidConfig(),
      ...configOverrides,
    });

    await assertBuildStageError(() => resolveBuilderPaths({ builderRoot, repoRoot, configPath }));
  }

  /**
   * Asserts path resolution fails for the given JsonDbApp overrides.
   *
   * @param {Partial<JsonDbAppConfig>} jsonDbAppOverrides - JsonDbApp overrides to test.
   * @returns {Promise<void>} Resolves when the failure assertion completes.
   */
  async function expectResolveBuilderPathsToFailForJsonDbApp(
    jsonDbAppOverrides: Partial<JsonDbAppConfig>
  ): Promise<void> {
    await expectResolveBuilderPathsToFail({
      jsonDbApp: {
        ...createValidConfig().jsonDbApp,
        ...jsonDbAppOverrides,
      },
    });
  }

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'builder-config-spec-'));
    builderRoot = path.join(tempRoot, 'builder');
    repoRoot = path.join(tempRoot, 'repo');
    configPath = path.join(builderRoot, 'builder.config.json');

    await fs.mkdir(builderRoot, { recursive: true });
    await fs.mkdir(repoRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it.each([
    ['frontendDir', ''],
    ['frontendDir', '   '],
    ['backendDir', ''],
    ['backendDir', '   '],
  ] as const)(
    'throws BuildStageError with stage "preflight-clean" when %s is empty or whitespace',
    async (dirKey, dirValue) => {
      await expectResolveBuilderPathsToFail({
        [dirKey]: dirValue,
      } as Partial<BuilderConfig>);
    }
  );

  it.each([
    ['frontendDir', '.'],
    ['backendDir', '.'],
  ] as const)(
    'throws BuildStageError with stage "preflight-clean" when %s resolves to repo root',
    async (dirKey, dirValue) => {
      await expectResolveBuilderPathsToFail({
        [dirKey]: dirValue,
      } as Partial<BuilderConfig>);
    }
  );

  it.each([
    ['frontendDir', '..'],
    ['backendDir', '..'],
  ] as const)(
    'throws BuildStageError with stage "preflight-clean" when %s resolves outside repo root',
    async (dirKey, dirValue) => {
      await expectResolveBuilderPathsToFail({
        [dirKey]: dirValue,
      } as Partial<BuilderConfig>);
    }
  );

  it('rejects empty JsonDbApp source-file arrays', async () => {
    await expectResolveBuilderPathsToFailForJsonDbApp({
      sourceFiles: [],
      publicExports: ['loadDatabase'],
    });
  });

  it('rejects empty JsonDbApp public-export arrays', async () => {
    await expectResolveBuilderPathsToFailForJsonDbApp({
      sourceFiles: ['src/04_core/99_PublicAPI.js'],
      publicExports: [],
    });
  });

  it('rejects duplicate JsonDbApp configured source files', async () => {
    await expectResolveBuilderPathsToFailForJsonDbApp({
      sourceFiles: ['src/04_core/99_PublicAPI.js', 'src/04_core/99_PublicAPI.js'],
      publicExports: ['loadDatabase'],
    });
  });

  it('rejects duplicate JsonDbApp public exports', async () => {
    await expectResolveBuilderPathsToFailForJsonDbApp({
      sourceFiles: ['src/04_core/99_PublicAPI.js'],
      publicExports: ['loadDatabase', 'loadDatabase'],
    });
  });

  it('rejects JsonDbApp source files that escape the vendored snapshot root', async () => {
    await expectResolveBuilderPathsToFailForJsonDbApp({
      sourceFiles: ['../outside.js'],
      publicExports: ['loadDatabase'],
    });
  });

  it('rejects JsonDbApp source files that use absolute paths', async () => {
    await expectResolveBuilderPathsToFailForJsonDbApp({
      sourceFiles: ['/absolute/path.js'],
      publicExports: ['loadDatabase'],
    });
  });

  it('normalises Windows-style JsonDbApp configured source-file separators', async () => {
    await writeBuilderConfig({
      ...createValidConfig(),
      jsonDbApp: {
        pinnedSnapshotDir: 'scripts/builder/vendor/jsondbapp',
        sourceFiles: [String.raw`src\04_core\99_PublicAPI.js`],
        publicExports: ['loadDatabase', 'createAndInitialiseDatabase'],
      },
    });

    const resolvedPaths = await resolveBuilderPaths({ builderRoot, repoRoot, configPath });

    expect(resolvedPaths.jsonDbAppSourceFiles).toEqual(['src/04_core/99_PublicAPI.js']);
  });
});
