/**
 * ApiRateLimitError
 *
 * Error thrown when a backend API method rejects a request because the
 * concurrent-request limit has been reached.
 */
class ApiRateLimitError extends Error {
  /**
   * @param {string} message - Human-readable message describing the failure
   * @param {Object} [opts] - Optional metadata
   * @param {string} [opts.requestId] - Unique identifier for the triggering request
   * @param {string} [opts.method] - API method name that raised the error
   * @param {number} [opts.activeCount] - Number of currently active requests
   * @param {number} [opts.limit] - Configured concurrent-request limit
   * @param {Error} [opts.cause] - Original error that triggered this failure
   */
  constructor(message, { requestId, method, activeCount, limit, cause = null } = {}) {
    super(message);
    this.name = 'ApiRateLimitError';
    this.requestId = requestId;
    this.method = method;
    this.activeCount = activeCount;
    this.limit = limit;
    this.cause = cause;

    // Maintain proper stack trace (V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiRateLimitError);
    }
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiRateLimitError;
}
