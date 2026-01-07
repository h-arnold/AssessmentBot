// This file contains the global functions that call the needed methods in `GoogleClassroomManager`

/**
 * Retrieves assignments for a given course ID.
 *
 * @param {string} courseId - The ID of the course.
 * @returns {Array<Object>} - An array of assignment objects.
 * @throws {Error} - If there is an error retrieving assignments.
 */
function getAssignments(courseId) {
  const googleClassroomManager = new GoogleClassroomManager();
  return googleClassroomManager.getAssignments(courseId);
}

/**
 * Retrieves assignments for the currently selected classroom.
 * Used by the assessment wizard Step 1.
 *
 * @returns {Array<{id:string,title:string}>} Assignments with minimal fields.
 */
function fetchAssignmentsForWizard() {
  const googleClassroomManager = new GoogleClassroomManager();
  const courseId = ConfigurationManager.getInstance().getAssessmentRecordCourseId();
  if (!courseId) {
    throw new Error('Course ID not configured. Please migrate or set up class info.');
  }
  const assignments = googleClassroomManager.getAssignments(courseId);
  return assignments.map((assignment) => ({
    id: assignment.id,
    title: assignment.title,
  }));
}

/**
 * Fetches Google Classrooms and populates them as needed.
 */
function handleFetchGoogleClassrooms() {
  const googleClassroomController = new GoogleClassroomController();
  try {
    googleClassroomController.fetchGoogleClassrooms();
  } catch (error) {
    const progressTracker = ProgressTracker.getInstance();
    progressTracker.captureError(error, 'Error fetching Google Classrooms');
  }
}

/**
 * Creates Google Classrooms based on provided data.
 */
function handleCreateGoogleClassrooms() {
  const googleClassroomController = new GoogleClassroomController();
  try {
    googleClassroomController.createGoogleClassrooms();
  } catch (error) {
    const progressTracker = ProgressTracker.getInstance();
    progressTracker.captureError(error, 'Error creating Google Classrooms');
    Utils.toastMessage('Failed to create classrooms: ' + error.message, 'Error', 5);
  }
}

/**
 * Sets up assessment documents in Google Classrooms.
 */
function createAssessmentRecords() {
  const googleClassroomController = new GoogleClassroomController();
  try {
    googleClassroomController.createAssessmentRecords();
  } catch (error) {
    const progressTracker = ProgressTracker.getInstance();
    progressTracker.captureError(error, 'Error setting up assessment documents');
    Utils.toastMessage('Failed to set up assessment documents: ' + error.message, 'Error', 5);
  }
}

/**
 * Saves the selected classroom's name and ID to the 'ClassInfo' sheet.
 *
 * @param {string} courseName - The name of the selected classroom.
 * @param {string} courseId - The ID of the selected classroom.
 */
function saveClassroom(courseName, courseId) {
  const googleClassroomController = new GoogleClassroomController();
  try {
    googleClassroomController.saveClassroom(courseName, courseId);
  } catch (error) {
    const progressTracker = ProgressTracker.getInstance();
    progressTracker.logAndThrowError('Failed to save classroom. Please try again.', error);
  }
}

function getClassrooms() {
  const googleClassroomController = new GoogleClassroomController();
  try {
    return googleClassroomController.getClassrooms();
  } catch (error) {
    const progressTracker = ProgressTracker.getInstance();
    progressTracker.logAndThrowError('Failed to get classrooms. Please try again.', error);
  }
}
