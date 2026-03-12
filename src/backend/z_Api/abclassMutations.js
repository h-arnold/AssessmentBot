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
function validateParamsObject(params, methodName) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
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
function requireParams(params, methodName) {
  try {
    Validate.requireParams(params, methodName);
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
function validateUpsertABClassParams(params) {
  const methodName = 'upsertABClass';

  validateParamsObject(params, methodName);
  requireParams(
    {
      classId: params.classId,
      cohort: params.cohort,
      yearGroup: params.yearGroup,
      courseLength: params.courseLength,
    },
    methodName
  );
  validateClassId(params.classId, methodName);
  validateCourseLength(params.courseLength, methodName);
}

/**
 * @param {object} params
 */
function validateUpdateABClassParams(params) {
  const methodName = 'updateABClass';
  const forbiddenFields = ['classOwner', 'teachers', 'students', 'assignments'];

  validateParamsObject(params, methodName);
  requireParams({ classId: params.classId }, methodName);
  validateClassId(params.classId, methodName);

  if (Object.hasOwn(params, 'courseLength')) {
    validateCourseLength(params.courseLength, methodName);
  }

  if (
    Object.hasOwn(params, 'active') &&
    params.active !== null &&
    !Validate.isBoolean(params.active)
  ) {
    throw new ApiValidationError('active must be a boolean or null.', {
      method: methodName,
      fieldName: 'active',
    });
  }

  forbiddenFields.forEach((fieldName) => {
    if (Object.hasOwn(params, fieldName) && params[fieldName] !== undefined) {
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
function validateDeleteABClassParams(params) {
  const methodName = 'deleteABClass';

  validateParamsObject(params, methodName);
  requireParams({ classId: params.classId }, methodName);
  validateDeleteClassId(params.classId, methodName);
}

/**
 * Thin transport handler for ABClass create or refresh operations.
 *
 * @param {object} params - Request payload with classId, cohort, yearGroup, and courseLength.
 * @returns {object} Partial ABClass summary returned by ABClassController.upsertABClass().
 */
function upsertABClass(params) {
  validateUpsertABClassParams(params);
  return getController().upsertABClass(params);
}

/**
 * Thin transport handler for editable ABClass field updates.
 *
 * @param {object} params - Request payload with classId and optional editable patch fields.
 * @returns {object} Partial ABClass summary returned by ABClassController.updateABClass().
 */
function updateABClass(params) {
  validateUpdateABClassParams(params);
  return getController().updateABClass(params);
}

/**
 * Thin transport handler for ABClass deletion.
 *
 * @param {object} params - Request payload containing classId.
 * @returns {object} Deletion result returned by ABClassController.deleteABClass().
 */
function deleteABClass(params) {
  validateDeleteABClassParams(params);
  return getController().deleteABClass(params);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    upsertABClass,
    updateABClass,
    deleteABClass,
  };
}
