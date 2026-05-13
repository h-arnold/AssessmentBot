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
      ['-e', "require('node:fs').writeSync(1,'hello');require('node:fs').writeSync(2,'warn');"],
      {
        cwd: process.cwd(),
      }
    );

    expect(result.stdout).toBe('hello');
    expect(result.stderr).toBe('warn');
  });

  it('throws CommandExecutionError with diagnostics for non-zero exit codes', async () => {
    await expect(
      runCommand(process.execPath, ['-e', "process.stderr.write('boom');process.exit(2);"], {
        cwd: process.cwd(),
      })
    ).rejects.toBeInstanceOf(CommandExecutionError);

    await expect(
      runCommand(process.execPath, ['-e', "process.stderr.write('boom');process.exit(2);"], {
        cwd: process.cwd(),
      })
    ).rejects.toMatchObject({
      diagnostics: {
        exitCode: 2,
        command: process.execPath,
      },
    });
  });

  it('uses the default exit-code message when command exits non-zero without output', async () => {
    await expect(
      runCommand(process.execPath, ['-e', 'process.exit(3);'], {
        cwd: process.cwd(),
      })
    ).rejects.toMatchObject({
      message: 'Command failed with exit code 3',
      diagnostics: {
        exitCode: 3,
      },
    });
  });

  it('throws CommandExecutionError when command cannot be started', async () => {
    await expect(
      runCommand('definitely-not-a-real-command', [], {
        cwd: process.cwd(),
      })
    ).rejects.toMatchObject({
      diagnostics: {
        command: 'definitely-not-a-real-command',
        exitCode: null,
      },
    });
  });

  it('mirrors stdout and stderr live when streamOutput is enabled', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await runCommand(
      process.execPath,
      [
        '-e',
        "require('node:fs').writeSync(1,'live-out');require('node:fs').writeSync(2,'live-err');",
      ],
      {
        cwd: process.cwd(),
        streamOutput: true,
      }
    );

    expect(stdoutSpy).toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalled();
  });

  it('terminates commands that exceed timeoutMs and reports timeout diagnostics', async () => {
    await expect(
      runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 10_000);'], {
        cwd: process.cwd(),
        timeoutMs: 50,
      })
    ).rejects.toMatchObject({
      message: 'Command timed out after 50ms',
      diagnostics: {
        timedOut: true,
        timeoutMs: 50,
      },
    });
  });

  it('rejects invalid timeoutMs option values', async () => {
    await expect(
      runCommand(process.execPath, ['-e', "process.stdout.write('ok');"], {
        cwd: process.cwd(),
        timeoutMs: 0,
      })
    ).rejects.toThrow('timeoutMs must be an integer greater than or equal to 1 when provided.');
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

    expect(stderrSpy).toHaveBeenCalledWith(
      'Build failed during frontend-build: Transform failed\n'
    );
    expect(stderrSpy).toHaveBeenCalledWith('Cause: Boom\n');
  });

  it('logs fallback error details for non-stage failures', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    logBuildFailure('unexpected failure');

    expect(stderrSpy).toHaveBeenCalledWith('Build failed: unexpected failure\n');
  });

  it('logs stage failure without cause details when no cause is provided', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    logBuildFailure(new BuildStageError('frontend-build', 'Transform failed'));

    expect(stderrSpy).toHaveBeenCalledWith(
      'Build failed during frontend-build: Transform failed\n'
    );
    expect(stderrSpy).toHaveBeenCalledTimes(1);
  });
});
