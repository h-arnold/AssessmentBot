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
 * Thin transport handler for ABClass create or update.
 *
 * @param {object} params
 * @returns {object}
 */
function upsertABClass(params) {
  validateUpsertABClassParams(params);
  return getController().upsertABClass(params);
}

/**
 * Thin transport handler for ABClass field updates.
 *
 * @param {object} params
 * @returns {object}
 */
function updateABClass(params) {
  validateUpdateABClassParams(params);
  return getController().updateABClass(params);
}

/**
 * Thin transport handler for ABClass deletion.
 *
 * Section 1 defines the API contract only. Behaviour is added later.
 *
 * @param {object} params
 * @returns {void}
 */
function deleteABClass(params) {
  throw new Error('deleteABClass is a Section 1 contract-only handler and is not implemented yet.');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    upsertABClass,
    updateABClass,
    deleteABClass,
  };
}
