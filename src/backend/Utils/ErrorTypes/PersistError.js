/**
 * PersistError
 *
 * Error thrown when a persistence operation (e.g. saving a configuration property)
 * fails in a way that should surface to callers.
 *
 * It captures the original cause and some contextual information for diagnostics.
 */
class PersistError extends Error {
  /**
   * @param {string} message - Human readable message describing the failure
   * @param {Object} [opts] - Optional metadata
   * @param {Error} [opts.cause] - Original error that triggered this persist failure
   * @param {string} [opts.key] - Optional configuration key attempted to persist
   */
  constructor(message, { cause = null, key = null } = {}) {
    super(message);
    this.name = 'PersistError';
    this.cause = cause;
    this.key = key;

    // Maintain proper stack trace (V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PersistError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      key: this.key,
      cause: this.cause ? { name: this.cause.name, message: this.cause.message } : null,
      stack: this.stack,
    };
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PersistError;
}
