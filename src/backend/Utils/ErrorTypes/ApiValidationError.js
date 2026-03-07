/**
 * ApiValidationError
 *
 * Error thrown when a backend API method receives a request that fails
 * input validation.
 */
class ApiValidationError extends Error {
  /**
   * @param {string} message - Human-readable message describing the failure
   * @param {Object} [opts] - Optional metadata
   * @param {string} [opts.requestId] - Unique identifier for the triggering request
   * @param {string} [opts.method] - API method name that raised the error
   * @param {string|null} [opts.fieldName] - Name of the field that failed validation
   * @param {string|null} [opts.details] - Additional validation detail
   * @param {Error} [opts.cause] - Original error that triggered this failure
   */
  constructor(message, { requestId, method, fieldName = null, details = null, cause = null } = {}) {
    super(message);
    this.name = 'ApiValidationError';
    this.requestId = requestId;
    this.method = method;
    this.fieldName = fieldName;
    this.details = details;
    this.cause = cause;

    // Maintain proper stack trace (V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiValidationError);
    }
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiValidationError;
}
