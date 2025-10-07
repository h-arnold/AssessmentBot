/**
 * AbortRequestError
 *
 * Custom error class for HTTP requests that should abort processing.
 * Used for authentication failures (401) and permission issues (403)
 * where retrying would not resolve the issue.
 *
 * Usage:
 *   throw new AbortRequestError(statusCode, url, responseText);
 */
class AbortRequestError extends Error {
  /**
   * Creates an AbortRequestError.
   * @param {number} statusCode - The HTTP status code that triggered the abort.
   * @param {string} url - The URL of the failed request.
   * @param {string} responseText - The response body text.
   */
  constructor(statusCode, url, responseText) {
    const message = `Request to ${url} failed with status ${statusCode}. Error message: ${responseText}`;
    super(message);
    this.name = 'AbortRequestError';
    this.statusCode = statusCode;
    this.url = url;
    this.responseText = responseText;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AbortRequestError);
    }
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AbortRequestError;
}
