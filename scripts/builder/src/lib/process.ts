import { asError, isBuildStageError } from './errors.js';
import { spawn } from 'node:child_process';

export type CommandRunOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
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
 * @return {void} No return value.
 */
function writeLine(stream: NodeJS.WriteStream, message: string): void {
  stream.write(`${message}\n`);
}

/**
 * Writes an informational build message.
 *
 * @param {string} message - Message text to write.
 * @return {void} No return value.
 */
export function logInfo(message: string): void {
  writeLine(process.stdout, message);
}

/**
 * Writes an error build message.
 *
 * @param {string} message - Message text to write.
 * @return {void} No return value.
 */
export function logError(message: string): void {
  writeLine(process.stderr, message);
}

/**
 * Logs a build failure with stage-aware context when available.
 *
 * @param {unknown} err - Error value thrown by the build pipeline.
 * @return {void} No return value.
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
 * @return {Promise<CommandRunResult>} Captured command output.
 */
export async function runCommand(
  command: string,
  args: string[],
  options: CommandRunOptions,
): Promise<CommandRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(
        new CommandExecutionError(err.message || 'Command failed before process exit.', {
          command,
          args,
          cwd: options.cwd,
          exitCode: null,
          signal: null,
          stdout,
          stderr,
        }),
      );
    });

    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const message = stderr.trim() || stdout.trim() || `Command failed with exit code ${code}`;
      reject(
        new CommandExecutionError(message, {
          command,
          args,
          cwd: options.cwd,
          exitCode: code,
          signal,
          stdout,
          stderr,
        }),
      );
    });
  });
}
