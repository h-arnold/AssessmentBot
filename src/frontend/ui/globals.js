// This file contains the global data related to the UIManager Class.
// All functions use lazy instantiation so that we're not loading the UI if it's not needed.

/**
 * Opens the reference slide modal with assignment data.
 *
 * @param {string} assignmentData - The JSON string containing assignment data.
 */
function openReferenceSlideModal(assignmentData) {
    const uiManagerController = new UIManagerController();
  return uiManagerController.openReferenceSlideModal(assignmentData);
}

/**
 * Opens the progress modal dialog.
 */
function showProgressModal() {
    const uiManagerController = new UIManagerController();
  uiManagerController.showProgressModal();
}

/**
 * Shows the configuration dialog modal.
 */
function showConfigurationDialog() {
        const uiManagerController = new UIManagerController();
  return uiManagerController.showConfigurationDialog();
}

/**
 * Shows the assignment dropdown modal.
 */
function showAssignmentDropdown() {
        const uiManagerController = new UIManagerController();
  return uiManagerController.showAssignmentDropdown();
}

/**
 * Shows the classroom dropdown modal.
 */
function showClassroomDropdown() {
        const uiManagerController = new UIManagerController();
  return uiManagerController.showClassroomDropdown();
}

/**
 * Displays the version selector interface by delegating to the main controller.
 * @returns {void}
 * @public
 */
function showVersionSelector() {
        const uiManagerController = new UIManagerController();
  return uiManagerController.showVersionSelector();
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
    const uiManagerController = new UIManagerController();
    return uiManagerController.getClassroomData(); // Assuming this remains in MainController
  }

function saveClassroomData(rows) {
    const uiManagerController = new UIManagerController();
    uiManagerController.saveClassroomData(rows); // Assuming this remains in MainController
  }

function showClassroomEditorModal() {
    const uiManagerController = new UIManagerController();
    uiManagerController.showClassroomEditorModal(); // Assuming this remains in MainController
  }
