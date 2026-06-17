/* global ABClassController, ABLogger, ApiValidationError, ClassNotFoundError, validateParametersObject_, validateSafeTrimmedIdentifier_ */

/**
 * Throws an ApiValidationError for abclass validation failures.
 *
 * @param {string} message - Validation failure message.
 * @param {string} fieldName - Related field name.
 * @throws {ApiValidationError} Always throws.
 */
function throwAbclassValidationError_(message, fieldName) {
  throw new ApiValidationError(message, {
    method: 'getABClass',
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
    throwValidationError: throwAbclassValidationError_,
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
 * Transport-boundary handler for getABClass.
 * Reads a stored class document and returns a transport-ready plain object
 * with partial assignments. No Classroom API calls, no storage mutation.
 *
 * @remarks
 * - Not-found detection uses an `instanceof ClassNotFoundError` check.
 *   The typed error is thrown by `ABClassController.readClass` when the
 *   class document cannot be located.
 * - The handler does NOT call `DateUtils.normaliseDateFields` because the
 *   response root has no Date fields (matching the `getAssignment_` precedent
 *   where date normalisation is only applied when the response carries Date
 *   objects).
 * - The handler does NOT strip `progressTracker` or `_hydrationLevel` from
 *   the response because `ABClassController._toReadView` already handles
 *   those defence-in-depth strips.
 *
 * @param {*} parameters - Request payload containing classId.
 * @param {string} parameters.classId - The class ID to read.
 * @returns {Object|null} Transport-shaped class response, or `null` when
 *   no persisted class document exists for the given class ID.
 * @throws {ApiValidationError} If parameters shape is invalid or classId
 *   is missing, not a non-empty string, not trimmed, or contains unsafe
 *   characters.
 * @throws {Error} If `readClass` fails for any reason other than
 *   ClassNotFoundError.
 */
function getABClass_(parameters) {
  validateParametersObject_(parameters, 'getABClass');

  const { classId } = parameters;

  validateIdentifier_(classId, 'classId');

  const logger = ABLogger.getInstance();
  logger.info('getABClass: reading class', { classId });

  try {
    const response = new ABClassController().readClass(classId);

    logger.info('getABClass: class read successfully', { classId });
    return response;
  } catch (error) {
    if (error instanceof ClassNotFoundError) {
      logger.warn('getABClass: class not found', { classId });
      return null;
    }
    logger.error('getABClass failed', { classId, err: error });
    throw error;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getABClass_ };
}
