export type NormalisedError = {
  errorMessage: string;
  stack?: string;
};

/**
 * Returns a consistent error shape for unknown thrown values.
 *
 * @param {unknown} error The thrown value to normalise.
 * @returns {NormalisedError} A normalised error payload.
 */
export function normaliseUnknownError(error: unknown): NormalisedError {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      stack: error.stack,
    };
  }

  return {
    errorMessage: String(error),
  };
}

