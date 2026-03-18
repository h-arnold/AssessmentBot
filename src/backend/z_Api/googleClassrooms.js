/**
 * Thin transport handler for Google Classroom listing.
 * Fetches all active classrooms from Google Classroom API and normalises to transport format.
 *
 * @param {*} parameters - Optional reserved parameters; currently unused.
 * @returns {Array<{classId: string, className: string}>} List of available classrooms.
 * @throws {ApiValidationError} If classroom data is missing required fields.
 */
function getGoogleClassrooms(parameters) {
  const classrooms = ClassroomApiClient.fetchAllActiveClassrooms();

  return classrooms.map((classroom) => {
    if (!classroom || typeof classroom !== 'object' || Array.isArray(classroom)) {
      throw new ApiValidationError('Google Classroom record must be an object.', {
        method: 'getGoogleClassrooms',
        fieldName: 'classroom',
      });
    }

    if (!classroom.id) {
      throw new ApiValidationError('Google Classroom record is missing id.', {
        method: 'getGoogleClassrooms',
        fieldName: 'id',
      });
    }

    if (!classroom.name) {
      throw new ApiValidationError('Google Classroom record is missing name.', {
        method: 'getGoogleClassrooms',
        fieldName: 'name',
      });
    }

    return {
      classId: classroom.id,
      className: classroom.name,
    };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getGoogleClassrooms,
  };
}
