//////////////////////////////////////////////////////////////////////////////////////////////
// Below are placeholder functions which call the respective global function from the library. 
// Where you see a `return` it is because a value needs to be passed to the frontend HTML 
// code.
//////////////////////////////////////////////////////////////////////////////////////////////

// Initialisation functions

// 

function onOpen() {
  AssessmentBot.onOpen();
}

function handleScriptInit() {
  AssessmentBot.handleScriptInit();
}

// Placeholder functions for the 'Assess Assignment Menu Option

// Calls the function to generate the Assignment Chooser modal.

function assessAssignment() {
  return AssessmentBot.showAssignmentDropdown();
}

// Gets a list of all assignments set in the Google Classroom associated with the Google Sheet.
function getAssignments(courseId) {
  return AssessmentBot.getAssignments(courseId)
}

// Helper function for the above
function createAssignmentDropdownHtml(assignments) {
  return AssessmentBot.createAssignmentDropdownHtml(assignments);
}


// Opens the reference slide modal which comes after the assignment selection
function openReferenceSlideModal(assignmentId) {
  return AssessmentBot.openReferenceSlideModal(assignmentId)
}

// Helper function to generate and display html for the reference slide modal
function createReferenceSlideModalHtml(assignmentId, referenceSlideId) {
  return AssessmentBot.createReferenceSlideModalHtml(assignmentId, referenceSlideId)
}

// Saves the reference and empty slide Ids to avoid having to do it each assessment run.
function saveSlideIdsForAssignment(assignmentId, slideIds) {
  return AssessmentBot.saveSlideIdsForAssignment(assignmentId, slideIds)
}

/**
 * Sets the trigger and stores the revelant parameters to process the selected assignment.
 * @param {string} assignmentTitle - The title of the assignment.
 * @param {Object} slideIds - An object containing referenceSlideId and emptySlideId.
 * @param {string} assignmentId - The ID of the assignment.
 * @param {string} referenceSlideId - The ID of the reference slide.
 * @param {string} emptySlideId - The ID of the empty slide.
 */
function saveStartAndShowProgress(assignmentTitle, slideIds, assignmentId, referenceSlideId, emptySlideId) {
  AssessmentBot.saveStartAndShowProgress(assignmentTitle, slideIds, assignmentId, referenceSlideId, emptySlideId);
}

/**
 * Initiates the processing of an assignment asynchronously by setting up a trigger. (Called by saveStartAndShowProgress)
 *
 * @param {string} assignmentId - The ID of the assignment.
 * @param {string} referenceSlideId - The ID of the reference slide.
 * @param {string} emptySlideId - The ID of the empty slide.
 * @returns {string} The unique process ID.
 */
function startProcessing(assignmentId, referenceSlideId, emptySlideId) {
  return AssessmentBot.startProcessing(assignmentId, referenceSlideId, emptySlideId);
}

/**
 * Opens the progress modal dialog.
 */
function showProgressModal() {
  AssessmentBot.showProgressModal();
}

// Needed to get the progress data for the progress modal.
function requestStatus() {
  return AssessmentBot.requestStatus();
}
// Place holder code for classroom changing menu option
function showClassroomDropdown() {
  AI.Assess.showClassroomDropdown();
}

function saveClassroom(courseName, courseId) {
  AssessmentBot.saveClassroom(courseName, courseId)
}


function removeTrigger(functionName) {
  AssessmentBot.removeTrigger(functionName);

}

// Is the function without parameters to call processSelectedAssignment. Retrieves assignment details from document properties.
function triggerProcessSelectedAssignment() {
  AssessmentBot.triggerProcessSelectedAssignment();
}

// Called by the above with the retrieved parameters.
function processSelectedAssignment(assignmentId, referenceSlideId, emptySlideId) {
  return AssessmentBot.processSelectedAssignment(assignmentId, referenceSlideId, emptySlideId)
}

//
// Backend configuration calling functions. I may remove these in a future release.
//

function openConfigurationDialog() {
  AssessmentBot.showConfigurationDialog();
}


function saveConfiguration(formData) {
  return AssessmentBot.saveConfiguration(formData);
}

function getConfiguration() {
  return AssessmentBot.getConfiguration();
}

