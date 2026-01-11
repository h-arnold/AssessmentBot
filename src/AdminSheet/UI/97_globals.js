// This file contains the global data related to the UIManager Class.
// All functions use lazy instantiation so that we're not loading the UI if it's not needed.

/**
 * Includes an HTML file in an HtmlService template.
 *
 * @param {string} filename - File path relative to script root (e.g. 'UI/partials/Head').
 * @return {string} The HTML content of the file.
 */
function include(filename) {
  // Evaluate the file as a template so any nested scriptlets (e.g. other
  // `<?!= include('...') ?>` tags) are processed before returning the HTML.
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

/**
 * Get or create a singleton instance of UIManager (BeerCSS version)
 * @returns {BeerCSSUIHandler} The singleton UIManager instance
 */
function getUIManager() {
  return BeerCSSUIHandler.getInstance();
}

/**
 * Opens the reference slide modal with assignment data.
 *
 * @param {string} assignmentData - The JSON string containing assignment data.
 */
function openReferenceSlideModal(assignmentData) {
  const uiManager = getUIManager();
  return uiManager.openReferenceSlideModal(assignmentData);
}

/**
 * Opens the progress modal dialog.
 */
function showProgressModal() {
  const uiManager = getUIManager();
  uiManager.showProgressModal();
}

/**
 * Shows the configuration dialog modal.
 */
function showConfigurationDialog() {
  const uiManager = getUIManager();
  return uiManager.showConfigurationDialog();
}

/**
 * Shows the assignment dropdown modal.
 */
function showAssignmentDropdown() {
  const uiManager = getUIManager();
  return uiManager.showAssignmentDropdown();
}

/**
 * Displays the new assessment wizard workflow.
 */
function showAssessmentWizard() {
  const uiHandler = getUIManager();
  return uiHandler.showAssessmentWizard();
}

/**
 * Shows the classroom dropdown modal.
 */
function showClassroomDropdown() {
  const uiManager = getUIManager();
  return uiManager.showClassroomDropdown();
}

/**
 * Saves document IDs for a specific assignment by calling the UIManager's method.
 * @param {string} assignmentId The ID of the assignment.
 * @param {Object} documentIds An object containing reference and template document IDs.
 * @return {string} definitionKey persisted for this assignment.
 */
function saveDocumentIdsForAssignment(assignmentId, documentIds) {
  const uiManager = getUIManager();
  return uiManager.saveDocumentIdsForAssignment(assignmentId, documentIds);
}

/**
 * Displays the version selector interface by delegating to UIManager.
 * @returns {void}
 * @public
 */
function showVersionSelector() {
  const uiManager = getUIManager();
  return uiManager.showVersionSelector();
}

/**
 * NOTE: Classroom Editor Modal Functions
 * --------------------------------------
 * While the implementation exists, these functions are currently inactive.
 * The current workflow uses direct editing in the 'Classrooms' sheet
 * as it proved more efficient than the GUI implementation.
 *
 * This code is preserved for future UI improvements.
 */

function getClassroomData() {
  const uiManager = getUIManager();
  return uiManager.getClassroomData();
}

function saveClassroomData(rows) {
  const uiManager = getUIManager();
  uiManager.saveClassroomData(rows);
}

function showClassroomEditorModal() {
  const uiManager = getUIManager();
  uiManager.showClassroomEditorModal();
}
