/**
 * DefinitionStaleError
 *
 * Error thrown when an AssignmentDefinition's reference or template document
 * has been modified since the definition was created, making the definition
 * stale and unsuitable for use in a new assessment run.
 *
 * This error is thrown at two points:
 *   - The API boundary in `startAssessmentRun`, where it is caught by
 *     `_mapErrorToFailureEnvelope` and returned as a structured error
 *     response with a `DEFINITION_STALE` error code.
 *   - Trigger-execution time within `runAssignmentPipeline`, where it is
 *     caught by `processSelectedAssignment`'s try/catch and surfaced via
 *     `ProgressTracker.logAndThrowError`.
 */
class DefinitionStaleError extends Error {
  /**
   * Construct a DefinitionStaleError with structured metadata about which documents are stale.
   *
   * @param {string} message - Human-readable message describing the failure
   * @param {Object} options - Structured metadata
   * @param {string} options.definitionKey - The definition key that is stale
   * @param {boolean} options.referenceStale - Whether the reference document has changed
   * @param {boolean} options.templateStale - Whether the template document has changed
   * @param {string|null} options.referenceLastModified - Current ISO timestamp from Drive for the reference document
   * @param {string|null} options.templateLastModified - Current ISO timestamp from Drive for the template document
   */
  constructor(message, options) {
    super(message);
    this.name = 'DefinitionStaleError';
    this.definitionKey = options.definitionKey;
    this.referenceStale = options.referenceStale;
    this.templateStale = options.templateStale;
    this.referenceLastModified = options.referenceLastModified;
    this.templateLastModified = options.templateLastModified;
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DefinitionStaleError;
}
