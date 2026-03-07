export type NormalisedError = {
  errorMessage: string;
  stack?: string;
};

/**
 * Returns a consistent error shape for unknown thrown values.
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
 * Returns user-facing error text from unknown thrown values.
 */
export function toUserFacingErrorMessage(error: unknown): string {
  return normaliseUnknownError(error).errorMessage;
}
