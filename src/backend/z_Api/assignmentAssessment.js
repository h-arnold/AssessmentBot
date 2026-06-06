/* global AssignmentController, ApiValidationError, Validate */

/**
 * Transport-boundary handler for startAssessmentRun.
 * Validates the parameters object shape and required string fields, then
 * delegates to AssignmentController.startAssessmentRun.
 *
 * @param {*} parameters - Request payload containing definitionKey, assignmentId, courseId.
 * @returns {null} Null on success (no payload).
 * @throws {ApiValidationError} If parameters is not a plain object.
 * @throws {Error} If required fields are missing or not non-empty strings.
 */
function startAssessmentRun_(parameters) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new ApiValidationError('startAssessmentRun requires a parameters object', {
      method: 'startAssessmentRun',
    });
  }

  const { definitionKey, assignmentId, courseId } = parameters;

  Validate.requireParams({ definitionKey, assignmentId, courseId }, 'startAssessmentRun');
  Validate.validateNonEmptyString('definitionKey', definitionKey);
  Validate.validateNonEmptyString('assignmentId', assignmentId);
  Validate.validateNonEmptyString('courseId', courseId);

  return new AssignmentController().startAssessmentRun(parameters);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startAssessmentRun_ };
}
