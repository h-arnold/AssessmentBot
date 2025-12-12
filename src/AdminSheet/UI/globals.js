// This file contains the global data related to the UIManager Class.
// All functions use lazy instantiation so that we're not loading the UI if it's not needed.

/**
 * Get or create a singleton instance of UIManager
 * @returns {UIManager} The singleton UIManager instance
 */
function getUIManager() {
  return UIManager.getInstance();
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
  const uiManager = UIManager.getInstance();
  uiManager.showProgressModal();
}

/**
 * Shows the configuration dialog modal.
 */
function showConfigurationDialog() {
  const uiManager = UIManager.getInstance();
  return uiManager.showConfigurationDialog();
}

/**
 * Shows the assignment dropdown modal.
 */
function showAssignmentDropdown() {
  const uiManager = UIManager.getInstance();
  return uiManager.showAssignmentDropdown();
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
  const uiManager = UIManager.getInstance();
  return uiManager.getClassroomData();
}

function saveClassroomData(rows) {
  const uiManager = UIManager.getInstance();
  uiManager.saveClassroomData(rows);
}

function showClassroomEditorModal() {
  const uiManager = UIManager.getInstance();
  uiManager.showClassroomEditorModal();
}
