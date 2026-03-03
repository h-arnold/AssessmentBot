import type { BuildStageId } from '../types.js';

export class BuildStageError extends Error {
  readonly stage: BuildStageId;
  readonly cause: unknown;

  constructor(stage: BuildStageId, message: string, cause?: unknown) {
    super(message);
    this.name = 'BuildStageError';
    this.stage = stage;
    this.cause = cause;
  }
}

export const isBuildStageError = (err: unknown): err is BuildStageError =>
  err instanceof BuildStageError;

export const asError = (err: unknown): Error =>
  err instanceof Error ? err : new Error(String(err));
