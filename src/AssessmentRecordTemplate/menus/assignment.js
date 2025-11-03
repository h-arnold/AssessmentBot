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
function openReferenceSlideModal(assignmentId) {
  return AssessmentBot.openReferenceSlideModal(assignmentId);
}

// Helper function to generate and display html for the reference slide modal
function createReferenceSlideModalHtml(assignmentId, referenceSlideId) {
  return AssessmentBot.createReferenceSlideModalHtml(assignmentId, referenceSlideId);
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
 * @param {Object} slideIds - An object containing referenceSlideId and templateSlideId.
 * @param {string} assignmentId - The ID of the assignment.
 * @param {string} referenceSlideId - The ID of the reference slide.
 * @param {string} templateSlideId - The ID of the template slide.
 */
function saveStartAndShowProgress(
  assignmentTitle,
  slideIds,
  assignmentId,
  referenceSlideId,
  templateSlideId
) {
  AssessmentBot.saveStartAndShowProgress(
    assignmentTitle,
    slideIds,
    assignmentId,
    referenceSlideId,
    templateSlideId
  );
}

/**
 * Initiates the processing of an assignment asynchronously by setting up a trigger. (Called by saveStartAndShowProgress)
 *
 * @param {string} assignmentId - The ID of the assignment.
 * @param {string} referenceSlideId - The ID of the reference slide.
 * @param {string} templateSlideId - The ID of the template slide.
 * @returns {string} The unique process ID.
 */
function startProcessing(assignmentId, referenceSlideId, templateSlideId) {
  return AssessmentBot.startProcessing(assignmentId, referenceSlideId, templateSlideId);
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
function processSelectedAssignment(assignmentId, referenceSlideId, templateSlideId) {
  return AssessmentBot.processSelectedAssignment(assignmentId, referenceSlideId, templateSlideId);
}
