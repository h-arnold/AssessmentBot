import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadBuilderConfig, resolveBuildDir, resolveBuilderPaths } from './config.js';
import { BuildStageError } from './lib/errors.js';

const TEMP_ROOT = path.join(os.tmpdir(), 'builder-config-spec');
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
  jsonDbApp: { pinnedSnapshotDir: string; sourceFiles: string[] };
} {
  return {
    frontendDir: 'src/frontend',
    backendDir: 'src/backend',
    buildDir: 'build',
    jsonDbApp: {
      pinnedSnapshotDir: 'vendor/jsondbapp',
      sourceFiles: ['src/a.js'],
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

  it('throws BuildStageError with stage "preflight-clean" when config file is missing', async () => {
    const configPath = path.join(TEMP_ROOT, 'missing', 'builder.config.json');

    await expect(loadBuilderConfig(configPath)).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: 'preflight-clean',
    });
    await expect(loadBuilderConfig(configPath)).rejects.toBeInstanceOf(BuildStageError);
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
  let tempRoot: string;
  let builderRoot: string;
  let repoRoot: string;
  let configPath: string;

  async function writeBuilderConfig(config: Record<string, unknown>): Promise<void> {
    await fs.writeFile(configPath, JSON.stringify(config));
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

  it('throws BuildStageError with stage "preflight-clean" when frontendDir is empty or whitespace', async () => {
    await writeBuilderConfig({
      ...createValidConfig(),
      frontendDir: '',
    });

    await assertBuildStageError(() =>
      resolveBuilderPaths({ builderRoot, repoRoot, configPath }),
    );

    await writeBuilderConfig({
      ...createValidConfig(),
      frontendDir: '   ',
    });

    await assertBuildStageError(() =>
      resolveBuilderPaths({ builderRoot, repoRoot, configPath }),
    );
  });

  it('throws BuildStageError with stage "preflight-clean" when backendDir is empty or whitespace', async () => {
    await writeBuilderConfig({
      ...createValidConfig(),
      backendDir: '',
    });

    await assertBuildStageError(() =>
      resolveBuilderPaths({ builderRoot, repoRoot, configPath }),
    );

    await writeBuilderConfig({
      ...createValidConfig(),
      backendDir: '   ',
    });

    await assertBuildStageError(() =>
      resolveBuilderPaths({ builderRoot, repoRoot, configPath }),
    );
  });

  it('throws BuildStageError with stage "preflight-clean" when frontendDir resolves to repo root', async () => {
    await writeBuilderConfig({
      ...createValidConfig(),
      frontendDir: '.',
    });

    await assertBuildStageError(() =>
      resolveBuilderPaths({ builderRoot, repoRoot, configPath }),
    );
  });

  it('throws BuildStageError with stage "preflight-clean" when backendDir resolves to repo root', async () => {
    await writeBuilderConfig({
      ...createValidConfig(),
      backendDir: '.',
    });

    await assertBuildStageError(() =>
      resolveBuilderPaths({ builderRoot, repoRoot, configPath }),
    );
  });

  it('throws BuildStageError with stage "preflight-clean" when frontendDir resolves outside repo root', async () => {
    await writeBuilderConfig({
      ...createValidConfig(),
      frontendDir: '..',
    });

    await assertBuildStageError(() =>
      resolveBuilderPaths({ builderRoot, repoRoot, configPath }),
    );
  });

  it('throws BuildStageError with stage "preflight-clean" when backendDir resolves outside repo root', async () => {
    await writeBuilderConfig({
      ...createValidConfig(),
      backendDir: '..',
    });

    await assertBuildStageError(() =>
      resolveBuilderPaths({ builderRoot, repoRoot, configPath }),
    );
  });
});
