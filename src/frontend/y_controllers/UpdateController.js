
/**
 * Controller methods for the UpdateManager class.
 */
class UpdateController {
  constructor() {
    this.updateManager = new UpdateManager();
    this.uiManager = new UIManager();
    this.scriptAppManager = new ScriptAppManager();
  }
  /**
* Handles the version update request from the UI
* @param {Object} versionData - Contains version number and file IDs
*/
  updateAdminSheet(versionData) {
    let adminSheetUrl;
    console.log(JSON.stringify(versionData));

    try {
      this.updateManager.versionNo = versionData.version;
      this.updateManager.assessmentRecordTemplateId = versionData.assessmentRecordTemplateFileId;
      this.updateManager.adminSheetTemplateId = versionData.adminSheetFileId;
      console.log(JSON.stringify(versionData))

      adminSheetUrl = this.updateManager.updateAdminSheet();
    } catch (error) {
      console.error('Error in handleVersionUpdate:', error);
      throw new Error(`Update failed: ${error.message}`);
    }
    const ui = this.uiManager.ui
    ui.alert(`Update Successful`, `Your new Admin Sheet has opened and you can access it at: ${adminSheetUrl}. Please close this window.`, ui.ButtonSet.OK)
    this.scriptAppManager.revokeAuthorisation();
  }
}
