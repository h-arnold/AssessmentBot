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

async function resetDir(targetPath: string): Promise<void> {
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.mkdir(targetPath, { recursive: true });
}

async function writeConfig(dirName: string, content: string): Promise<string> {
  const targetDir = path.join(TEMP_ROOT, dirName);
  await fs.mkdir(targetDir, { recursive: true });
  const configPath = path.join(targetDir, 'builder.config.json');
  await fs.writeFile(configPath, content);
  return configPath;
}

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

async function assertBuildStageError(
  run: () => unknown | Promise<unknown>,
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
      JSON.stringify({ frontendDir: 'src/frontend', jsonDbApp: {} }),
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
      }),
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
    const packageJson = JSON.parse(await fs.readFile(ROOT_PACKAGE_JSON_PATH, 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const packageLock = JSON.parse(await fs.readFile(ROOT_PACKAGE_LOCK_PATH, 'utf-8')) as {
      packages?: Record<
        string,
        { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
      >;
      dependencies?: Record<string, unknown>;
    };

    const packageJsonDirectZodVersion =
      packageJson.dependencies?.zod ?? packageJson.devDependencies?.zod;
    const packageLockRootDirectZod =
      packageLock.packages?.['']?.dependencies?.zod ??
      packageLock.packages?.['']?.devDependencies?.zod ??
      packageLock.dependencies?.zod;

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

  async function writeBuilderConfig(config: Record<string, unknown>): Promise<void> {
    await fs.writeFile(configPath, JSON.stringify(config));
  }

  async function expectResolveBuilderPathsToFail(
    configOverrides: Partial<BuilderConfig>,
  ): Promise<void> {
    await writeBuilderConfig({
      ...createValidConfig(),
      ...configOverrides,
    });

    await assertBuildStageError(() =>
      resolveBuilderPaths({ builderRoot, repoRoot, configPath }),
    );
  }

  async function expectResolveBuilderPathsToFailForJsonDbApp(
    jsonDbAppOverrides: Partial<JsonDbAppConfig>,
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
    },
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
    },
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
    },
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
