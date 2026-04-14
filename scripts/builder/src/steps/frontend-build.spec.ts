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
import { createBuilderPaths } from '../test/builder-fixture-test-helpers.js';
import { runCommand } from '../lib/process.js';
import { runFrontendBuildWithMode } from './frontend-build.js';

const runCommandMock = vi.mocked(runCommand);
const pathExistsMock = vi.mocked(pathExists);
const BUILD_STDOUT = 'build/frontend/index.html\nbuild/frontend/assets/index-abc123.js';
const FRONTEND_BUILD_STAGE = 'frontend-build';

describe('runFrontendBuildWithMode', () => {
  let paths: BuilderPaths;

  beforeEach(() => {
    vi.clearAllMocks();
    paths = createBuilderPaths('/repo', {
      jsonDbAppSourceFiles: ['src/01-core.js'],
      jsonDbAppPublicExports: ['loadDatabase'],
    });
  });

  it('invokes frontend build command with expected working directory and options', async () => {
    runCommandMock.mockResolvedValue({
      stdout: BUILD_STDOUT,
      stderr: '',
    });
    pathExistsMock.mockResolvedValue(true);

    await runFrontendBuildWithMode(paths, 'production');

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
      ],
      expect.objectContaining({
        cwd: paths.repoRoot,
        env: process.env,
      })
    );
  });

  it('passes development build flags when mode is dev', async () => {
    runCommandMock.mockResolvedValue({
      stdout: BUILD_STDOUT,
      stderr: '',
    });
    pathExistsMock.mockResolvedValue(true);

    await runFrontendBuildWithMode(paths, 'dev');

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
        '--mode=development',
        '--minify=false',
      ],
      expect.objectContaining({
        cwd: paths.repoRoot,
        env: expect.objectContaining({
          NODE_ENV: 'development',
        }),
      })
    );
  });

  it('returns build metadata including entry HTML path and generated chunks', async () => {
    runCommandMock.mockResolvedValue({
      stdout: BUILD_STDOUT,
      stderr: 'warning: size exceeds recommendation',
    });
    pathExistsMock.mockResolvedValue(true);

    const result = await runFrontendBuildWithMode(paths, 'production');

    expect(result.stage).toBe(FRONTEND_BUILD_STAGE);
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
      })
    );

    const result = runFrontendBuildWithMode(paths, 'production');
    await expect(result).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: FRONTEND_BUILD_STAGE,
    });
    await expect(result).rejects.toBeInstanceOf(BuildStageError);
    await expect(result).rejects.toThrow('Diagnostics:');
    await expect(result).rejects.toThrow('vite stderr');
  });

  it('wraps unexpected build command failures with stage context', async () => {
    runCommandMock.mockRejectedValue(new Error('unexpected failure'));

    await expect(runFrontendBuildWithMode(paths, 'production')).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: FRONTEND_BUILD_STAGE,
      message: 'Frontend build failed while running Vite build command.',
    });
  });

  it('throws BuildStageError when index.html is not generated', async () => {
    runCommandMock.mockResolvedValue({ stdout: 'chunk info', stderr: 'warning: test warning' });
    pathExistsMock.mockResolvedValue(false);

    await expect(runFrontendBuildWithMode(paths, 'production')).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: FRONTEND_BUILD_STAGE,
    });
    await expect(runFrontendBuildWithMode(paths, 'production')).rejects.toThrow('chunk info');
    await expect(runFrontendBuildWithMode(paths, 'production')).rejects.toThrow('warning: test warning');
  });
});
