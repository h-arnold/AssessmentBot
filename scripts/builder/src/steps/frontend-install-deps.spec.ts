import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BuilderPaths } from '../types.js';
import { createBuilderPaths } from '../test/builder-fixture-test-helpers.js';

vi.mock('../lib/process.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    runCommand: vi.fn(),
  };
});

import { BuildStageError } from '../lib/errors.js';
import { CommandExecutionError, runCommand } from '../lib/process.js';
import { runFrontendInstallDeps } from './frontend-install-deps.js';

const runCommandMock = vi.mocked(runCommand);
const STAGE_ID = 'frontend-install-deps';
const FIRST_CALL_INDEX = 1;
const SECOND_CALL_INDEX = 2;

describe('runFrontendInstallDeps', () => {
  let paths: BuilderPaths;

  beforeEach(() => {
    vi.clearAllMocks();
    paths = createBuilderPaths('/repo', {
      jsonDbAppSourceFiles: ['src/01-core.js'],
      jsonDbAppPublicExports: ['loadDatabase'],
    });
  });

  it('passes when frontend dependencies are already present', async () => {
    runCommandMock.mockResolvedValueOnce({ stdout: '', stderr: '' });

    const result = await runFrontendInstallDeps(paths);

    expect(runCommandMock).toHaveBeenCalledTimes(1);
    expect(runCommandMock).toHaveBeenCalledWith(
      'npm',
      ['--prefix', paths.frontendDir, 'ls', '--depth=0'],
      { cwd: paths.repoRoot }
    );
    expect(result).toEqual({
      stage: STAGE_ID,
      installed: false,
    });
  });

  it('runs npm ci when dependency verification fails', async () => {
    runCommandMock
      .mockRejectedValueOnce(
        new CommandExecutionError('missing dependency', {
          command: 'npm',
          args: ['--prefix', paths.frontendDir, 'ls', '--depth=0'],
          cwd: paths.repoRoot,
          exitCode: 1,
          signal: null,
          stdout: '',
          stderr: 'missing: @tanstack/react-query',
        })
      )
      .mockResolvedValueOnce({ stdout: 'installed', stderr: '' });

    const result = await runFrontendInstallDeps(paths);

    expect(runCommandMock).toHaveBeenNthCalledWith(
      FIRST_CALL_INDEX,
      'npm',
      ['--prefix', paths.frontendDir, 'ls', '--depth=0'],
      { cwd: paths.repoRoot }
    );
    expect(runCommandMock).toHaveBeenNthCalledWith(
      SECOND_CALL_INDEX,
      'npm',
      ['--prefix', paths.frontendDir, 'ci', '--no-audit', '--no-fund'],
      { cwd: paths.repoRoot }
    );
    expect(result).toEqual({
      stage: STAGE_ID,
      installed: true,
    });
  });

  it('throws BuildStageError when npm ci fails', async () => {
    runCommandMock
      .mockRejectedValueOnce(
        new CommandExecutionError('missing dependency', {
          command: 'npm',
          args: ['--prefix', paths.frontendDir, 'ls', '--depth=0'],
          cwd: paths.repoRoot,
          exitCode: 1,
          signal: null,
          stdout: '',
          stderr: 'missing dependencies',
        })
      )
      .mockRejectedValueOnce(
        new CommandExecutionError('npm ci failed', {
          command: 'npm',
          args: ['--prefix', paths.frontendDir, 'ci', '--no-audit', '--no-fund'],
          cwd: paths.repoRoot,
          exitCode: 1,
          signal: null,
          stdout: '',
          stderr: 'lockfile mismatch',
        })
      );

    const result = runFrontendInstallDeps(paths);
    await expect(result).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: STAGE_ID,
    });
    await expect(result).rejects.toBeInstanceOf(BuildStageError);
    await expect(result).rejects.toThrow('Diagnostics:');
    await expect(result).rejects.toThrow('lockfile mismatch');
  });
});
