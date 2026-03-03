import { asError, isBuildStageError } from './errors.js';

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
