import type { BuildStageId } from '../types.js';

/**
 * Represents a build failure tied to a specific pipeline stage.
 */
export class BuildStageError extends Error {
  readonly stage: BuildStageId;
  readonly cause: unknown;

  /**
   * Creates a stage-specific build error.
   *
   * @param {BuildStageId} stage - Pipeline stage where the failure occurred.
   * @param {string} message - Human-readable failure description.
   * @param {unknown} cause - Optional underlying error or failure payload.
   */
  constructor(stage: BuildStageId, message: string, cause?: unknown) {
    super(message);
    this.name = 'BuildStageError';
    this.stage = stage;
    this.cause = cause;
  }
}

/**
 * Checks whether a value is a `BuildStageError`.
 *
 * @param {unknown} err - Value to evaluate.
 * @return {err is BuildStageError} `true` when the value is a stage error.
 */
export function isBuildStageError(err: unknown): err is BuildStageError {
  return err instanceof BuildStageError;
}

/**
 * Normalises unknown thrown values to `Error`.
 *
 * @param {unknown} err - Value thrown by runtime code.
 * @return {Error} Existing error instance or a wrapped error.
 */
export function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}
