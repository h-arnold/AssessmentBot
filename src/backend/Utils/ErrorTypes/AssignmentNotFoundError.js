/**
 * AssignmentNotFoundError
 *
 * Error thrown when the full assignment document cannot be found in its
 * dedicated collection during rehydration. The full assignment lives in
 * `assign_full_<courseId>_<assignmentId>`; when no document is present for
 * the given course/assignment pair, this typed error is raised so the API
 * boundary can detect the not-found case structurally (via `instanceof`)
 * rather than via message-substring matching.
 *
 * This error is caught at the API boundary in `getAssignment_` and
 * translated into a `null` response. Other errors from
 * `ABClassController.rehydrateAssignment` (corrupt document, partial
 * definition rejection, assignment not in class) are unaffected and must
 * still propagate.
 */
class AssignmentNotFoundError extends Error {
  /**
   * Construct an AssignmentNotFoundError with structured metadata about
   * which assignment document could not be located.
   *
   * @param {string} message - Human-readable message describing the failure
   * @param {Object} options - Structured metadata
   * @param {string} options.courseId - The course ID whose assignment was searched for
   * @param {string} options.assignmentId - The assignment ID that was searched for
   * @param {string} options.collectionName - The dedicated collection name that was queried
   */
  constructor(message, options) {
    super(message);
    this.name = 'AssignmentNotFoundError';
    this.courseId = options.courseId;
    this.assignmentId = options.assignmentId;
    this.collectionName = options.collectionName;

    // Maintain proper stack trace (V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AssignmentNotFoundError);
    }
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentNotFoundError;
}
