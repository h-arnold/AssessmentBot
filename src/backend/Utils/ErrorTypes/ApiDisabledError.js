/**
 * ApiDisabledError
 *
 * Error thrown when a backend API method is called but the method is
 * disabled or not available in the current configuration.
 */
class ApiDisabledError extends Error {
  /**
   * Creates an ApiDisabledError.
   *
   * @param {string} message - Human-readable message describing the failure
   * @param {Object} [opts] - Optional metadata
   * @param {string} [opts.requestId] - Unique identifier for the triggering request
   * @param {string} [opts.method] - API method name that raised the error
   * @param {Error} [opts.cause] - Original error that triggered this failure
   */
  constructor(message, { requestId, method, cause = null } = {}) {
    super(message);
    this.name = 'ApiDisabledError';
    this.requestId = requestId;
    this.method = method;
    this.cause = cause;
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiDisabledError;
}
