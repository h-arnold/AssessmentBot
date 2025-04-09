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
 * Fetches Google Classrooms and populates them as needed.
 */
function handleFetchGoogleClassrooms() {
  const googleClassroomController = new GoogleClassroomController();
  try {
    googleClassroomController.fetchGoogleClassrooms();
  } catch (error) {
    console.error("Error fetching Google Classrooms:", error);
    Utils.toastMessage("Failed to fetch classrooms: " + error.message, "Error", 5);
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
    console.error("Error creating Google Classrooms:", error);
    Utils.toastMessage("Failed to create classrooms: " + error.message, "Error", 5);
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
    console.error("Error setting up assessment documents:", error);
    Utils.toastMessage("Failed to set up assessment documents: " + error.message, "Error", 5);
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
    console.error('Error saving classroom:', error);
    throw new Error('Failed to save classroom. Please try again.');
  }
}

function getClassrooms() {
  const googleClassroomController = new GoogleClassroomController() 
  try {  
    return googleClassroomController.getClassrooms();
  } catch (error) {
    console.error('Error getting classrooms:', error);
    throw new Error('Failed to get classrooms. Please try again.');
  }
  
}