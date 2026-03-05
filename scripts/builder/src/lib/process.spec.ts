import { afterEach, describe, expect, it, vi } from 'vitest';

import { BuildStageError } from './errors.js';
import {
  CommandExecutionError,
  logBuildFailure,
  logError,
  logInfo,
  runCommand,
} from './process.js';

describe('runCommand', () => {
  it('captures stdout and stderr for successful commands', async () => {
    const result = await runCommand(
      process.execPath,
      ['-e', "process.stdout.write('hello');process.stderr.write('warn');"],
      {
        cwd: process.cwd(),
      },
    );

    expect(result.stdout).toBe('hello');
    expect(result.stderr).toBe('warn');
  });

  it('throws CommandExecutionError with diagnostics for non-zero exit codes', async () => {
    await expect(
      runCommand(
        process.execPath,
        ['-e', "process.stderr.write('boom');process.exit(2);"],
        {
          cwd: process.cwd(),
        },
      ),
    ).rejects.toBeInstanceOf(CommandExecutionError);

    await expect(
      runCommand(
        process.execPath,
        ['-e', "process.stderr.write('boom');process.exit(2);"],
        {
          cwd: process.cwd(),
        },
      ),
    ).rejects.toMatchObject({
      diagnostics: {
        exitCode: 2,
        command: process.execPath,
      },
    });
  });

  it('throws CommandExecutionError when command cannot be started', async () => {
    await expect(
      runCommand('definitely-not-a-real-command', [], {
        cwd: process.cwd(),
      }),
    ).rejects.toMatchObject({
      diagnostics: {
        command: 'definitely-not-a-real-command',
        exitCode: null,
      },
    });
  });
});

describe('logging helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes logInfo output to stdout and logError output to stderr', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    logInfo('Builder started');
    logError('Builder failed');

    expect(stdoutSpy).toHaveBeenCalledWith('Builder started\n');
    expect(stderrSpy).toHaveBeenCalledWith('Builder failed\n');
  });

  it('logs stage and cause details for BuildStageError failures', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    logBuildFailure(new BuildStageError('frontend-build', 'Transform failed', new Error('Boom')));

    expect(stderrSpy).toHaveBeenCalledWith('Build failed during frontend-build: Transform failed\n');
    expect(stderrSpy).toHaveBeenCalledWith('Cause: Boom\n');
  });

  it('logs fallback error details for non-stage failures', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    logBuildFailure('unexpected failure');

    expect(stderrSpy).toHaveBeenCalledWith('Build failed: unexpected failure\n');
  });
});
