// This file contains the global functions related to initialisation and updates.

/**
 * Global function to handle version updates.
 * @param {Object} versionData Object containing version and file IDs
 * @return {Object} Result of the update operation
 */
function handleVersionUpdate(versionData) {
    const updateController = new UpdateController();
    return updateController.updateAdminSheet(versionData);
}

/**
 * Global function to launch the Update Assessment Records Wizard.
 * Google Apps Script cannot call class methods directly so this function creates an instance
 * of UpdateManager and then calls the runAssessmentRecordUpdateWizard method.
 */
function showUpdateAssessmentRecordWizard() {
    const updateManager = new UpdateManager();
    updateManager.runAssessmentRecordUpdateWizard();
  }
  
  /**
   * Global function called from the wizard when the user clicks "Finish".
   * This creates a new UpdateManager instance, loads the saved state, and then calls its updateAssessmentRecords method.
   */
  function updateAssessmentRecordsFromWizard() {
    const updateManager = new UpdateManager();
    updateManager.loadState();
    updateManager.updateAssessmentRecords();
  }