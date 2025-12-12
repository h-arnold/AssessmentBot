//////////////////////////////////////////////////////////////////////////////////////////////
// assignment.js
// Assignment-related UI helpers and trigger helpers.
//////////////////////////////////////////////////////////////////////////////////////////////

// Calls the function to generate the Assignment Chooser modal.
function assessAssignment() {
  return AssessmentBot.showAssignmentDropdown();
}

// Gets a list of all assignments set in the Google Classroom associated with the Google Sheet.
function getAssignments(courseId) {
  return AssessmentBot.getAssignments(courseId);
}

// Helper function for the above
function createAssignmentDropdownHtml(assignments) {
  return AssessmentBot.createAssignmentDropdownHtml(assignments);
}

// Opens the reference slide modal which comes after the assignment selection
function openReferenceSlideModal(assignmentDataJson) {
  return AssessmentBot.openReferenceSlideModal(assignmentDataJson);
}

// Helper function to generate and display html for the reference slide modal
function createReferenceSlideModalHtml(assignmentDataJson) {
  return AssessmentBot.createReferenceSlideModalHtml(assignmentDataJson);
}

/**
 * Saves slide IDs for a specific assignment by calling the main script's function.
 * @param {string} assignmentId The ID of the assignment.
 * @param {Object} documentIds An object containing reference and template document IDs.
 * @return {void}
 */
function saveSlideIdsForAssignment(assignmentId, documentIds) {
  return AssessmentBot.saveDocumentIdsForAssignment(assignmentId, documentIds);
}

/**
 * Sets the trigger and stores the relevant parameters to process the selected assignment.
 * @param {string} assignmentTitle - The title of the assignment.
 * @param {Object} documentIds - An object containing referenceDocumentId and templateDocumentId.
 * @param {string} assignmentId - The ID of the assignment.
 */
function saveStartAndShowProgress(assignmentTitle, documentIds, assignmentId) {
  AssessmentBot.saveStartAndShowProgress(assignmentTitle, documentIds, assignmentId);
}

/**
 * Initiates the processing of an assignment asynchronously by setting up a trigger. (Called by saveStartAndShowProgress)
 *
 * @param {string} assignmentId - The ID of the assignment.
 * @param {string} definitionKey - The definition key persisted in Document Properties.
 * @returns {string} The unique process ID.
 */
function startProcessing(assignmentId, definitionKey) {
  return AssessmentBot.startProcessing(assignmentId, definitionKey);
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

function removeTrigger(functionName) {
  AssessmentBot.removeTrigger(functionName);
}

// Is the function without parameters to call processSelectedAssignment. Retrieves assignment details from document properties.
function triggerProcessSelectedAssignment() {
  AssessmentBot.triggerProcessSelectedAssignment();
}

// Called by the above with the retrieved parameters.
function processSelectedAssignment() {
  return AssessmentBot.processSelectedAssignment();
}
