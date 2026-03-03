import { asError, isBuildStageError } from './errors.js';
const writeLine = (stream, message) => {
    stream.write(`${message}\n`);
};
export const logInfo = (message) => {
    writeLine(process.stdout, message);
};
export const logError = (message) => {
    writeLine(process.stderr, message);
};
export const logBuildFailure = (err) => {
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
};
