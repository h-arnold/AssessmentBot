/* global ABClassController, ABLogger, ApiValidationError, AssignmentNotFoundError, DateUtils, Validate, validateSafeTrimmedIdentifier_ */

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

/**
 * Throws an ApiValidationError for assignment validation failures.
 *
 * @param {string} message - Validation failure message.
 * @param {string} fieldName - Related field name.
 * @throws {ApiValidationError} Always throws.
 */
function throwAssignmentValidationError_(message, fieldName) {
  throw new ApiValidationError(message, {
    method: 'getAssignment',
    fieldName,
  });
}

/**
 * Validates a non-empty, already-trimmed string identifier for transport safety.
 * Delegates to validateSafeTrimmedIdentifier_ for the actual validation checks.
 *
 * @param {string} value - Identifier candidate.
 * @param {string} fieldName - Field name for diagnostics in thrown errors.
 * @throws {ApiValidationError} If value is not a valid identifier.
 */
function validateIdentifier_(value, fieldName) {
  validateSafeTrimmedIdentifier_(value, {
    throwValidationError: throwAssignmentValidationError_,
    typeErrorMessage: `${fieldName} must be a string.`,
    nonEmptyErrorMessage: `${fieldName} must be a non-empty string.`,
    trimmedErrorMessage: `${fieldName} must already be trimmed.`,
    unsafeErrorMessage: `${fieldName} contains unsafe characters.`,
    fieldNames: {
      type: fieldName,
      nonEmpty: fieldName,
      trimmed: fieldName,
      unsafe: fieldName,
    },
  });
}

/**
 * Transport-boundary handler for getAssignment.
 * Loads the full, hydrated assignment for a given course and assignment id and
 * returns the canonical `Assignment.toJSON()` shape with date fields normalised
 * to ISO strings and transient fields stripped.
 *
 * @remarks
 * - Not-found detection uses an `instanceof AssignmentNotFoundError` check,
 *   which is robust to message changes and is structurally testable. The typed
 *   error is thrown by `ABClassController._loadFullAssignmentDocument` when the
 *   full assignment document cannot be located in its dedicated collection.
 * - `DateUtils.normaliseDateFields` is applied to root-level `dueDate` and
 *   `lastUpdated` fields as defence-in-depth: `Assignment.toJSON()` already
 *   converts known Date fields to ISO strings, but `Date` objects are strictly
 *   prohibited in `google.script.run` return values, and a regression test
 *   proves the root-level call is wired by mocking `toJSON()` to return live
 *   `Date` objects. Note: this is shallow defence-in-depth for root-level
 *   fields only; nested date conversion (e.g. `createdAt`/`updatedAt` on
 *   `submissions`, dates inside `assignmentDefinition`) relies on the
 *   corresponding `toJSON()` implementations being correct.
 * - `progressTracker` is stripped at the boundary as defence-in-depth:
 *   `Assignment.toJSON()` already omits it per its JSDoc, but a future model
 *   change could regress, and the explicit strip is the canonical boundary
 *   defence pattern.
 * - The same `abClass` instance returned by `loadClass` is threaded through to
 *   `rehydrateAssignment` (identity, not structural equality) because the
 *   controller mutates that instance via `_replaceAssignmentInClass` to keep
 *   the assignment cache state coherent. Passing a fresh instance would
 *   silently break that cache mutation.
 *
 * @param {*} parameters - Request payload containing courseId and assignmentId.
 * @param {string} parameters.courseId - The Classroom course ID.
 * @param {string} parameters.assignmentId - The assignment ID to fetch.
 * @returns {Object|null} Serialised assignment payload, or `null` when no
 *   persisted assignment document exists for the given course/assignment pair.
 * @throws {ApiValidationError} If parameters shape is invalid or identifiers
 *   are missing, not non-empty strings, not trimmed, or contain unsafe
 *   characters.
 * @throws {Error} If `loadClass` fails (class not found), if the assignment
 *   document is corrupt, or if any other `rehydrateAssignment` error occurs.
 */
function getAssignment_(parameters) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new ApiValidationError('getAssignment requires a parameters object', {
      method: 'getAssignment',
    });
  }

  const { courseId, assignmentId } = parameters;

  validateIdentifier_(courseId, 'courseId');
  validateIdentifier_(assignmentId, 'assignmentId');

  const logger = ABLogger.getInstance();
  logger.info('getAssignment: loading full assignment', { courseId, assignmentId });

  try {
    const abClassController = new ABClassController();
    const abClass = abClassController.loadClass(courseId);
    const assignment = abClassController.rehydrateAssignment(abClass, assignmentId);
    const response = assignment.toJSON();

    // Defence-in-depth: strip transient, non-`toJSON` fields at the boundary.
    // Assignment.toJSON() already omits progressTracker per its JSDoc, but
    // a future model change could regress; the explicit strip is the
    // canonical boundary defence pattern.
    delete response.progressTracker;

    // Defence-in-depth: convert any live Date objects to ISO strings at the
    // transport boundary. Date objects are prohibited in google.script.run
    // return values. Nested date conversion on submissions and
    // assignmentDefinition still relies on the corresponding toJSON()
    // implementations being correct.
    DateUtils.normaliseDateFields(response, ['dueDate', 'lastUpdated', 'createdAt']);

    logger.info('getAssignment: rehydrated assignment', { courseId, assignmentId });
    return response;
  } catch (error) {
    if (error instanceof AssignmentNotFoundError) {
      logger.warn('getAssignment: assignment not found', { courseId, assignmentId });
      return null;
    }
    logger.error('getAssignment failed', { courseId, assignmentId, err: error });
    throw error;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startAssessmentRun_, getAssignment_ };
}
