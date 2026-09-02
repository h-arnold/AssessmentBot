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

/**
 * Returns an `Error` instance for an unknown thrown value.
 *
 * Already-normalised errors are returned unchanged; everything else is wrapped in a
 * fresh `Error` carrying its string representation. Complements `normaliseUnknownError`
 * (which returns a plain payload) when a caller needs a concrete `Error` object.
 *
 * @param {unknown} error The thrown value to coerce.
 * @returns {Error} A guaranteed `Error` instance.
 */
export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
