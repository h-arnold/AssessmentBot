/**
 * ClassNotFoundError
 *
 * Error thrown when ABClassController.loadClass cannot find a stored class
 * document for the given classId. This indicates that no persisted ABClass
 * record exists for the course.
 *
 * This error maps to INTERNAL_ERROR at the transport boundary (via the
 * dispatcher's fallback path) since loadClass is not directly callable
 * from the frontend. The structured metadata (courseId) is available for
 * developer diagnostics in execution logs.
 */
class ClassNotFoundError extends Error {
  /**
   * Construct a ClassNotFoundError with structured metadata about which
   * class record could not be located.
   *
   * @param {string} message - Human-readable message describing the failure
   * @param {Object} options - Structured metadata
   * @param {string} options.courseId - The course ID that was searched for
   */
  constructor(message, options) {
    super(message);
    this.name = 'ClassNotFoundError';
    this.courseId = options.courseId;

    // Maintain proper stack trace (V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClassNotFoundError);
    }
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClassNotFoundError;
}
