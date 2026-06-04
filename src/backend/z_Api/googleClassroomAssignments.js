/* global ClassroomApiClient, ApiValidationError, hasControlCharacters_ */

/**
 * Thin transport handler for Google Classroom assignment listing.
 * Fetches coursework/assignments for a given classroom and normalises to transport format.
 *
 * @param {Object} parameters - Request parameters with classId.
 * @param {string} parameters.classId - Google Classroom course ID.
 * @returns {Array<{assignmentId: string, title: string}>} List of assignments.
 * @throws {ApiValidationError} If parameters are invalid or Classroom rows are malformed.
 */
function getGoogleClassroomAssignments_(parameters) {
  // Validate params is a plain object.
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new ApiValidationError('params must be an object.', {
      method: 'getGoogleClassroomAssignments',
      fieldName: 'params',
    });
  }

  const { classId } = parameters;

  // Validate classId is a non-empty, already-trimmed string without path characters or control chars.
  if (typeof classId !== 'string') {
    throw new ApiValidationError('classId must be a string.', {
      method: 'getGoogleClassroomAssignments',
      fieldName: 'classId',
    });
  }

  const trimmedClassId = classId.trim();
  if (trimmedClassId.length === 0) {
    throw new ApiValidationError('classId must be a non-empty string.', {
      method: 'getGoogleClassroomAssignments',
      fieldName: 'classId',
    });
  }

  if (trimmedClassId !== classId) {
    throw new ApiValidationError('classId must already be trimmed.', {
      method: 'getGoogleClassroomAssignments',
      fieldName: 'classId',
    });
  }

  if (classId.includes('/') || classId.includes('\\') || classId.includes('..')) {
    throw new ApiValidationError('classId contains unsafe characters.', {
      method: 'getGoogleClassroomAssignments',
      fieldName: 'classId',
    });
  }

  // Defence-in-depth: reject ASCII control characters (code points 0-31 and 127/DEL).
  // Uses the shared `hasControlCharacters_()` helper from assignmentDefinitionPartials.js,
  // which is available as a global in the GAS concatenated runtime.
  if (hasControlCharacters_(classId)) {
    throw new ApiValidationError('classId contains unsafe characters.', {
      method: 'getGoogleClassroomAssignments',
      fieldName: 'classId',
    });
  }

  // Fetch coursework from the Google Classroom API.
  const courseWorkList = ClassroomApiClient.fetchCourseWork(classId);

  // Map and validate each row, excluding updateTime from the transport response.
  return courseWorkList.map(function (cw) {
    if (!cw || typeof cw !== 'object' || !cw.id || !cw.title) {
      throw new ApiValidationError('Google Classroom assignment record is malformed.', {
        method: 'getGoogleClassroomAssignments',
        fieldName: 'courseWork',
      });
    }

    return {
      assignmentId: cw.id,
      title: cw.title,
    };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getGoogleClassroomAssignments_,
  };
}
