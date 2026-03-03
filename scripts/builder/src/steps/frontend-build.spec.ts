import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';

import type { BuilderPaths } from '../types.js';

vi.mock('../lib/process.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    runCommand: vi.fn(),
  };
});

vi.mock('../lib/fs.js', () => ({
  pathExists: vi.fn(),
}));

import { BuildStageError } from '../lib/errors.js';
import { pathExists } from '../lib/fs.js';
import { CommandExecutionError } from '../lib/process.js';
import { runCommand } from '../lib/process.js';
import { runFrontendBuild } from './frontend-build.js';

const runCommandMock = vi.mocked(runCommand);
const pathExistsMock = vi.mocked(pathExists);

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
    jsonDbAppSourceFiles: ['src/01-core.js'],
    jsonDbAppPublicExports: ['loadDatabase'],
  };
}

describe('runFrontendBuild', () => {
  let paths: BuilderPaths;

  beforeEach(() => {
    vi.clearAllMocks();
    paths = createBuilderPaths();
  });

  it('invokes frontend build command with expected working directory and options', async () => {
    runCommandMock.mockResolvedValue({
      stdout: 'build/frontend/index.html\nbuild/frontend/assets/index-abc123.js',
      stderr: '',
    });
    pathExistsMock.mockResolvedValue(true);

    await runFrontendBuild(paths);

    expect(runCommandMock).toHaveBeenCalledWith(
      'npm',
      [
        '--prefix',
        paths.frontendDir,
        'run',
        'build',
        '--',
        '--base=./',
        '--outDir',
        paths.buildFrontendDir,
        '--emptyOutDir',
        '--cssCodeSplit=false',
        '--modulePreload=false',
      ],
      expect.objectContaining({
        cwd: paths.repoRoot,
      }),
    );
  });

  it('returns build metadata including entry HTML path and generated chunks', async () => {
    runCommandMock.mockResolvedValue({
      stdout: 'build/frontend/index.html\nbuild/frontend/assets/index-abc123.js',
      stderr: 'warning: size exceeds recommendation',
    });
    pathExistsMock.mockResolvedValue(true);

    const result = await runFrontendBuild(paths);

    expect(result.stage).toBe('frontend-build');
    expect(result.entryHtmlPath).toBe(path.join(paths.buildFrontendDir, 'index.html'));
    expect(result.generatedChunks).toEqual([
      'build/frontend/index.html',
      'build/frontend/assets/index-abc123.js',
    ]);
    expect(result.warnings).toEqual(['warning: size exceeds recommendation']);
  });

  it('throws BuildStageError when build command fails and halts pipeline', async () => {
    runCommandMock.mockRejectedValue(
      new CommandExecutionError('vite build failed', {
        command: 'npm',
        args: ['run', 'build'],
        cwd: paths.repoRoot,
        exitCode: 1,
        signal: null,
        stdout: 'vite stdout',
        stderr: 'vite stderr',
      }),
    );

    const result = runFrontendBuild(paths);
    await expect(result).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: 'frontend-build',
    });
    await expect(result).rejects.toBeInstanceOf(BuildStageError);
    await expect(result).rejects.toThrow('Diagnostics:');
    await expect(result).rejects.toThrow('vite stderr');
  });

  it('throws BuildStageError when index.html is not generated', async () => {
    runCommandMock.mockResolvedValue({ stdout: 'chunk info', stderr: 'warning: test warning' });
    pathExistsMock.mockResolvedValue(false);

    await expect(runFrontendBuild(paths)).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: 'frontend-build',
    });
    await expect(runFrontendBuild(paths)).rejects.toThrow('chunk info');
    await expect(runFrontendBuild(paths)).rejects.toThrow('warning: test warning');
  });
});
