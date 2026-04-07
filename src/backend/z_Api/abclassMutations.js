/**
 * Factory function that returns a new ABClassController instance.
 *
 * @returns {ABClassController} A new controller instance.
 */
function getController() {
  return new ABClassController();
}

/**
 * Validates that parameters is a plain object (not an array).
 * Throws ApiValidationError if validation fails.
 *
 * @param {*} parameters - The parameters object to validate.
 * @param {string} methodName - Name of the calling method (for error messages).
 * @throws {ApiValidationError} If parameters is not a plain object.
 */
function validateParametersObject(parameters, methodName) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new ApiValidationError('params must be an object.', {
      method: methodName,
      fieldName: 'params',
    });
  }
}

/**
 * Validates that required parameters are present.
 * Wraps validation errors as ApiValidationError.
 *
 * @param {*} parameters - Parameters object to validate; should not be empty.
 * @param {string} methodName - Name of the calling method (for error messages).
 * @throws {ApiValidationError} If any required parameter is missing.
 */
function requireParameters(parameters, methodName) {
  try {
    Validate.requireParams(parameters, methodName);
  } catch (error) {
    throw new ApiValidationError(error.message, {
      method: methodName,
      cause: error,
    });
  }
}

/**
 * Validates that classId is a non-empty string.
 *
 * @param {*} classId - The class ID to validate.
 * @param {string} methodName - Name of the calling method (for error messages).
 * @throws {ApiValidationError} If classId is not a non-empty string.
 */
function validateClassId(classId, methodName) {
  if (!Validate.isNonEmptyString(classId)) {
    throw new ApiValidationError('classId must be a non-empty string.', {
      method: methodName,
      fieldName: 'classId',
    });
  }
}

/**
 * Validates a mutation classId, disallowing unsafe path characters.
 *
 * @param {*} classId - The class ID to validate.
 * @param {string} methodName - Name of the calling method (for error messages).
 * @throws {ApiValidationError} If classId is invalid or contains unsafe characters.
 */
function validateDeleteClassId(classId, methodName) {
  validateClassId(classId, methodName);

  if (classId.includes('..') || classId.includes('/') || classId.includes('\\')) {
    throw new ApiValidationError('classId must not contain unsafe path characters.', {
      method: methodName,
      fieldName: 'classId',
    });
  }
}

/**
 * Validates that courseLength is a positive integer.
 *
 * @param {*} courseLength - The course length to validate.
 * @param {string} methodName - Name of the calling method (for error messages).
 * @throws {ApiValidationError} If courseLength is not a positive integer.
 */
function validateCourseLength(courseLength, methodName) {
  if (!Number.isInteger(courseLength) || courseLength < 1) {
    throw new ApiValidationError('courseLength must be an integer greater than or equal to 1.', {
      method: methodName,
      fieldName: 'courseLength',
    });
  }
}

/**
 * Validates all required parameters for upsertABClass operation.
 *
 * @param {*} parameters - Request parameters to validate.
 * @throws {ApiValidationError} If any required parameter is invalid.
 */
function validateUpsertABClassParameters(parameters) {
  const methodName = 'upsertABClass';

  validateParametersObject(parameters, methodName);
  requireParameters(
    {
      classId: parameters.classId,
      cohortKey: parameters.cohortKey,
      yearGroupKey: parameters.yearGroupKey,
      courseLength: parameters.courseLength,
    },
    methodName
  );
  validateDeleteClassId(parameters.classId, methodName);
  validateCourseLength(parameters.courseLength, methodName);
}

/**
 * Validates all parameters for updateABClass operation.
 * Prevents mutation of protected fields (classOwner, teachers, students, assignments).
 *
 * @param {*} parameters - Request parameters to validate.
 * @throws {ApiValidationError} If any parameter is invalid or protected fields are supplied.
 */
function validateUpdateABClassParameters(parameters) {
  const methodName = 'updateABClass';
  const forbiddenFields = ['classOwner', 'teachers', 'students', 'assignments'];

  validateParametersObject(parameters, methodName);
  requireParameters({ classId: parameters.classId }, methodName);
  validateDeleteClassId(parameters.classId, methodName);

  if (Object.hasOwn(parameters, 'courseLength')) {
    validateCourseLength(parameters.courseLength, methodName);
  }

  if (
    Object.hasOwn(parameters, 'active') &&
    parameters.active !== null &&
    !Validate.isBoolean(parameters.active)
  ) {
    throw new ApiValidationError('active must be a boolean or null.', {
      method: methodName,
      fieldName: 'active',
    });
  }

  forbiddenFields.forEach((fieldName) => {
    if (Object.hasOwn(parameters, fieldName) && parameters[fieldName] !== undefined) {
      throw new ApiValidationError(`${fieldName} cannot be updated via updateABClass.`, {
        method: methodName,
        fieldName,
      });
    }
  });
}

/**
 * Validates all required parameters for deleteABClass operation.
 *
 * @param {*} parameters - Request parameters to validate.
 * @throws {ApiValidationError} If any required parameter is invalid.
 */
function validateDeleteABClassParameters(parameters) {
  const methodName = 'deleteABClass';

  validateParametersObject(parameters, methodName);
  requireParameters({ classId: parameters.classId }, methodName);
  validateDeleteClassId(parameters.classId, methodName);
}

/**
 * Thin transport handler for ABClass create or refresh operations.
 * Delegates to controller after validating request parameters.
 *
 * @param {Object} parameters - Request payload with classId, cohortKey, yearGroupKey, and courseLength.
 * @returns {Object} Partial ABClass summary from the controller.
 * @throws {ApiValidationError} If parameters fail validation.
 */
function upsertABClass(parameters) {
  validateUpsertABClassParameters(parameters);
  return getController().upsertABClass(parameters);
}

/**
 * Thin transport handler for editable ABClass field updates.
 * Delegates to controller after validating request parameters.
 *
 * @param {Object} parameters - Request payload with classId and optional editable patch fields (`cohortKey`, `yearGroupKey`, `courseLength`, `active`).
 * @returns {Object} Partial ABClass summary from the controller.
 * @throws {ApiValidationError} If parameters fail validation.
 */
function updateABClass(parameters) {
  validateUpdateABClassParameters(parameters);
  return getController().updateABClass(parameters);
}

/**
 * Thin transport handler for ABClass deletion.
 * Delegates to controller after validating request parameters.
 *
 * @param {Object} parameters - Request payload containing classId.
 * @returns {Object} Deletion result with classId and deletion status flags.
 * @throws {ApiValidationError} If parameters fail validation.
 */
function deleteABClass(parameters) {
  validateDeleteABClassParameters(parameters);
  return getController().deleteABClass(parameters);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    upsertABClass,
    updateABClass,
    deleteABClass,
  };
}
