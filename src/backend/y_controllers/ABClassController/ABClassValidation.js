/* global TypeError */

/**
 * ABClassValidation
 *
 * Domain validation helpers for classId, courseLength, patch-building,
 * and error classification. No DB or service dependencies — pure validation.
 */
class ABClassValidation {
  /**
   * Validates that a classId is a non-empty string.
   * @param {*} classId - The class ID to validate.
   * @param {string} methodName - The calling method name for error reporting.
   * @returns {string} The validated classId.
   * @throws {TypeError} If classId is not a non-empty string.
   */
  _validateClassId(classId, methodName) {
    if (typeof classId !== 'string' || classId.trim().length === 0) {
      throw new TypeError(`${methodName}: classId must be a non-empty string`);
    }

    return classId;
  }

  /**
   * Validates that a classId is safe for deletion operations (no path traversal characters).
   * @param {*} classId - The class ID to validate.
   * @param {string} methodName - The calling method name for error reporting.
   * @returns {string} The validated classId.
   * @throws {TypeError} If classId is invalid or contains path traversal characters.
   */
  _validateDeleteClassId(classId, methodName) {
    const validatedClassId = this._validateClassId(classId, methodName);

    if (validatedClassId.includes('..') || validatedClassId.includes('/')) {
      throw new TypeError(`${methodName}: invalid classId format`);
    }

    return validatedClassId;
  }

  /**
   * Checks if an error is a collection not found error from JsonDb.
   * @param {Error} error - The error to check.
   * @returns {boolean} True if the error is a COLLECTION_NOT_FOUND error.
   */
  _isMissingCollectionError(error) {
    return error?.code === 'COLLECTION_NOT_FOUND';
  }

  /**
   * Validates that courseLength is a positive integer.
   * @param {*} courseLength - The course length to validate.
   * @param {string} methodName - The calling method name for error reporting.
   * @returns {number} The validated courseLength.
   * @throws {TypeError} If courseLength is not an integer >= 1.
   */
  _validateCourseLength(courseLength, methodName) {
    if (!Number.isInteger(courseLength) || courseLength < 1) {
      throw new TypeError(
        `${methodName}: courseLength must be an integer greater than or equal to 1`
      );
    }

    return courseLength;
  }

  /**
   * Builds a patch object from update parameters for selective field updates.
   *
   * @remarks `active` is intentionally patched only when explicitly supplied.
   * This preserves existing values and avoids accidental defaulting drift.
   *
   * @param {Object} parameters - The update parameters object.
   * @param {*} [parameters.cohortKey] - Optional cohort key value.
   * @param {*} [parameters.yearGroupKey] - Optional year group key value.
   * @param {*} [parameters.courseLength] - Optional course length (validated).
   * @param {boolean} [parameters.active] - Optional active flag.
   * @returns {Object} Patch object containing only provided fields.
   */
  _buildUpdatePatch(parameters) {
    const patch = {};

    if (Object.hasOwn(parameters, 'cohortKey')) {
      patch.cohortKey = parameters.cohortKey === null ? null : String(parameters.cohortKey);
    }

    if (Object.hasOwn(parameters, 'yearGroupKey')) {
      patch.yearGroupKey =
        parameters.yearGroupKey === null ? null : String(parameters.yearGroupKey);
    }

    if (Object.hasOwn(parameters, 'courseLength')) {
      patch.courseLength = this._validateCourseLength(parameters.courseLength, 'updateABClass');
    }

    if (Object.hasOwn(parameters, 'active')) {
      patch.active = parameters.active;
    }

    return patch;
  }

  /**
   * Applies a patch object to an ABClass instance, updating specified fields.
   * @param {ABClass} abClass - The class instance to update.
   * @param {Object} patch - The patch object containing fields to update.
   * @returns {ABClass} The updated class instance.
   */
  _applyPatchToClass(abClass, patch) {
    if (Object.hasOwn(patch, 'cohortKey')) {
      abClass.cohortKey = patch.cohortKey;
    }

    if (Object.hasOwn(patch, 'yearGroupKey')) {
      abClass.yearGroupKey = patch.yearGroupKey;
    }

    if (Object.hasOwn(patch, 'courseLength')) {
      abClass.courseLength = patch.courseLength;
    }

    if (Object.hasOwn(patch, 'active')) {
      abClass.active = patch.active;
    }

    return abClass;
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABClassValidation;
}
