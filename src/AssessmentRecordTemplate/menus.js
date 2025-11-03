//////////////////////////////////////////////////////////////////////////////////////////////
// menus.js (shim)
// The original large `menus.js` has been split into smaller files under
// `src/AssessmentRecordTemplate/menus/` for readability and maintainability.
//
// Files now contain grouped functions (and are concatenated by Apps Script / build):
//  - menus/init.js           (initialisation + menu creation + auth)
//  - menus/assignment.js     (assignment UI helpers and triggers)
//  - menus/classroom.js      (classroom selection helpers)
//  - menus/configuration.js  (configuration dialog helpers)
//
// No runtime change: functions are still global (defined in the files above).
// Keep this shim file as a pointer for developers and for compatibility.
//////////////////////////////////////////////////////////////////////////////////////////////

// Initialisation functions

//

/**
 * Checks if the current user has authorised this assessment record.
 * @return {boolean} True if the user has previously authorised this document, false otherwise.
 */
function hasUserAuthorisedThisDocument() {
  const userProps = PropertiesService.getUserProperties();
  return userProps.getProperty('authorised') === 'true';
}

/**
 * Marks the current user as authorised for this assessment record.
 */
function markUserAsAuthorised() {
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty('authorised', 'true');
}

/**
 * Creates the unauthorised menu with an Authorise button.
 * This menu is displayed when the user has not yet authorised the assessment record.
 */
function createUnauthorisedMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Assessment Bot').addItem('Authorise App', 'handleScriptInit').addToUi();
}

/**
 * Creates the assessment record menu with all available options.
 * This menu is displayed after the user has authorised the assessment record.
 */
function createAssessmentRecordMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Assessment Bot')
    .addItem('Assess Assignment', 'assessAssignment')
    .addItem('Check Progress', 'showProgressModal')
    .addItem('Change Class', 'showClassroomDropdown')
    .addToUi();
}

function onOpen() {
  // Check if the current user has authorised this assessment record
  const userAuthorisedThisDoc = hasUserAuthorisedThisDocument();

  // Create appropriate menu based on authorisation state
  if (userAuthorisedThisDoc) {
    createAssessmentRecordMenu();
  } else {
    createUnauthorisedMenu();
  }
}

function handleScriptInit() {
  try {
    // Call the library to handle the authorisation process
    // This will create triggers and set up the auth revoke timer
    AssessmentBot.handleAssessmentRecordAuth();

    // Mark the user as authorised after successful initialisation
    markUserAsAuthorised();

    // Create the assessment record menu now that auth is complete
    createAssessmentRecordMenu();
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error during authorisation: ' + error.message);
    throw error;
  }
}

// Placeholder functions for the 'Assess Assignment Menu Option

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
 * Sets the trigger and stores the revelant parameters to process the selected assignment.
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
// Place holder code for classroom changing menu option
function showClassroomDropdown() {
  AI.Assess.showClassroomDropdown();
}

function saveClassroom(courseName, courseId) {
  AssessmentBot.saveClassroom(courseName, courseId);
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

/**
 * Revokes the current user's authorisation for this assessment record.
 * Calls the library function and clears the user's authorisation flag from User Properties.
 * @return {Object} Status object indicating success or failure
 */
function revokeAuthorisation() {
  const result = AssessmentBot.revokeAuthorisation();

  // Clear the user's authorisation flag for this document
  if (result.success) {
    const userProps = PropertiesService.getUserProperties();
    userProps.deleteProperty('authorised');

    // Recreate the unauthorised menu
    createUnauthorisedMenu();
  }

  return result;
}
