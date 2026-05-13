import { asError, isBuildStageError } from './errors.js';
import { spawn } from 'node:child_process';

export type CommandRunOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  streamOutput?: boolean;
};

export type CommandRunResult = {
  stdout: string;
  stderr: string;
};

export type CommandFailureDiagnostics = {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  timeoutMs: number | null;
};

/**
 * Error raised when a spawned process exits unsuccessfully.
 */
export class CommandExecutionError extends Error {
  diagnostics: CommandFailureDiagnostics;

  /**
   * Constructs a command execution error with process diagnostics.
   *
   * @param {string} message - User-readable failure summary.
   * @param {CommandFailureDiagnostics} diagnostics - Process execution diagnostics.
   */
  constructor(message: string, diagnostics: CommandFailureDiagnostics) {
    super(message);
    this.name = 'CommandExecutionError';
    this.diagnostics = diagnostics;
  }
}

/**
 * Writes a single line to a stream.
 *
 * @param {NodeJS.WriteStream} stream - Output stream to write to.
 * @param {string} message - Message text to write.
 * @returns {void} No return value.
 */
function writeLine(stream: NodeJS.WriteStream, message: string): void {
  stream.write(`${message}\n`);
}

/**
 * Writes an informational build message.
 *
 * @param {string} message - Message text to write.
 * @returns {void} No return value.
 */
export function logInfo(message: string): void {
  writeLine(process.stdout, message);
}

/**
 * Writes an error build message.
 *
 * @param {string} message - Message text to write.
 * @returns {void} No return value.
 */
export function logError(message: string): void {
  writeLine(process.stderr, message);
}

/**
 * Logs a build failure with stage-aware context when available.
 *
 * @param {unknown} err - Error value thrown by the build pipeline.
 * @returns {void} No return value.
 */
export function logBuildFailure(err: unknown): void {
  if (isBuildStageError(err)) {
    logError(`Build failed during ${err.stage}: ${err.message}`);
    if (err.cause) {
      const cause = asError(err.cause);
      logError(`Cause: ${cause.message}`);
    }
    return;
  }

  const fallback = asError(err);
  logError(`Build failed: ${fallback.message}`);
}

/**
 * Runs a command and captures stdout/stderr.
 *
 * @param {string} command - Executable command name.
 * @param {string[]} args - Command arguments.
 * @param {CommandRunOptions} options - Command execution options.
 * @returns {Promise<CommandRunResult>} Captured command output.
 */
export async function runCommand(
  command: string,
  args: string[],
  options: CommandRunOptions
): Promise<CommandRunResult> {
  return new Promise((resolve, reject) => {
    if (
      options.timeoutMs !== undefined &&
      (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1)
    ) {
      reject(new Error('timeoutMs must be an integer greater than or equal to 1 when provided.'));
      return;
    }

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let timeoutHandle: NodeJS.Timeout | null = null;

    if (options.timeoutMs !== undefined) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, options.timeoutMs);
    }

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (options.streamOutput) {
        process.stdout.write(chunk);
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (options.streamOutput) {
        process.stderr.write(chunk);
      }
    });

    child.on('error', (err) => {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
      reject(
        new CommandExecutionError(err.message || 'Command failed before process exit.', {
          command,
          args,
          cwd: options.cwd,
          exitCode: null,
          signal: null,
          stdout,
          stderr,
          timedOut,
          timeoutMs: options.timeoutMs ?? null,
        })
      );
    });

    child.on('close', (code, signal) => {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const message = timedOut
        ? `Command timed out after ${String(options.timeoutMs)}ms`
        : stderr.trim() || stdout.trim() || `Command failed with exit code ${code}`;
      reject(
        new CommandExecutionError(message, {
          command,
          args,
          cwd: options.cwd,
          exitCode: code,
          signal,
          stdout,
          stderr,
          timedOut,
          timeoutMs: options.timeoutMs ?? null,
        })
      );
    });
  });
}
