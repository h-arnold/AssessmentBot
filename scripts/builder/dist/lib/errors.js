export class BuildStageError extends Error {
    stage;
    cause;
    constructor(stage, message, cause) {
        super(message);
        this.name = 'BuildStageError';
        this.stage = stage;
        this.cause = cause;
    }
}
export const isBuildStageError = (err) => err instanceof BuildStageError;
export const asError = (err) => err instanceof Error ? err : new Error(String(err));
