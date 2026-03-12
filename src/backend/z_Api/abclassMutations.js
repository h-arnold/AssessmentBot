/**
 * @returns {ABClassController}
 */
function getController() {
  return new ABClassController();
}

/**
 * @param {object} params
 * @param {string} methodName
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
 * @param {object} params
 * @param {string} methodName
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
 * @param {*} classId
 * @param {string} methodName
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
 * @param {*} classId
 * @param {string} methodName
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
 * @param {*} courseLength
 * @param {string} methodName
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
 * @param {object} params
 */
function validateUpsertABClassParameters(parameters) {
  const methodName = 'upsertABClass';

  validateParametersObject(parameters, methodName);
  requireParameters(
    {
      classId: parameters.classId,
      cohort: parameters.cohort,
      yearGroup: parameters.yearGroup,
      courseLength: parameters.courseLength,
    },
    methodName
  );
  validateClassId(parameters.classId, methodName);
  validateCourseLength(parameters.courseLength, methodName);
}

/**
 * @param {object} params
 */
function validateUpdateABClassParameters(parameters) {
  const methodName = 'updateABClass';
  const forbiddenFields = ['classOwner', 'teachers', 'students', 'assignments'];

  validateParametersObject(parameters, methodName);
  requireParameters({ classId: parameters.classId }, methodName);
  validateClassId(parameters.classId, methodName);

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
 * @param {object} params
 */
function validateDeleteABClassParameters(parameters) {
  const methodName = 'deleteABClass';

  validateParametersObject(parameters, methodName);
  requireParameters({ classId: parameters.classId }, methodName);
  validateDeleteClassId(parameters.classId, methodName);
}

/**
 * Thin transport handler for ABClass create or refresh operations.
 *
 * @param {object} params - Request payload with classId, cohort, yearGroup, and courseLength.
 * @returns {object} Partial ABClass summary returned by ABClassController.upsertABClass().
 */
function upsertABClass(parameters) {
  validateUpsertABClassParameters(parameters);
  return getController().upsertABClass(parameters);
}

/**
 * Thin transport handler for editable ABClass field updates.
 *
 * @param {object} params - Request payload with classId and optional editable patch fields.
 * @returns {object} Partial ABClass summary returned by ABClassController.updateABClass().
 */
function updateABClass(parameters) {
  validateUpdateABClassParameters(parameters);
  return getController().updateABClass(parameters);
}

/**
 * Thin transport handler for ABClass deletion.
 *
 * @param {object} params - Request payload containing classId.
 * @returns {object} Deletion result returned by ABClassController.deleteABClass().
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
