/**
 * Update Manager Class
 * Extends BaseAdminManager to handle updating the Admin Sheet and associated Assessment Record sheets.
 */
class UpdateManager extends BaseUpdateAndInit {
  constructor() {
    // Call the superclass constructor.
    super();
    
    // Ensure this is being run from an Admin Sheet.
    Utils.validateIsAdminSheet(true);
    
    // Additional initialization specific to UpdateManager.
    this.classroomSheet = new ClassroomSheetManager('Classrooms', this.sheet.getId());
    this.progressTracker = new ProgressTracker();
    
    // Set the admin sheet template from version details.
    this.adminSheetTemplateId = this.getLatestAdminSheetTemplateId();
    
    // Objects to store details.
    this.assessmentRecordSheets = {};
    this.adminSheetsDetails = {};
  }
  
  /**
   * Retrieves the admin sheet details for cloning.
   * @returns {Object} An object with the admin sheet details.
   */
  getAdminSheetDetails() {
    let adminSheet = {};
    const adminSheetName = `Assessment Bot v${this.versionNo}`;
    adminSheet[adminSheetName] = {
      "originalSheetId": this.sheet.getId(),
      "newSheetId": this.adminSheetTemplateId
    };
    this.adminSheetsDetails = adminSheet;
    return adminSheet;
  }
  
  /**
   * Updates the 'Classrooms' sheet in the new Admin Spreadsheet with new Assessment Record file IDs.
   */
  updateClassroomSheetWithNewAssessmentRecords() {
    const newAdminSheetName = Object.keys(this.adminSheetsDetails)[0];
    const newClassroomSheet = new ClassroomSheetManager('Classrooms', this.adminSheetsDetails[newAdminSheetName].newSheetId);
    const currentValues = newClassroomSheet.getData();
    let updatedValues = currentValues;
    let arFileIdColumnIndex = newClassroomSheet.getColumnIndicesFromHeader('AR File ID');
    arFileIdColumnIndex = arFileIdColumnIndex.arfileid;
  
    // Update Classroom Sheet Array with new Sheet Values
    Object.keys(this.assessmentRecordSheets).forEach(className => {
      const sheetDetails = this.assessmentRecordSheets[className];
      for (const row of updatedValues) {
        if (row.includes(sheetDetails.originalSheetId)) {
          row[arFileIdColumnIndex] = sheetDetails.newSheetId;
          break;  // Stop iterating once updated
        }
      }
    });
    this.classroomSheet.setData(updatedValues);
  }
  
  /**
   * Moves the old versions of the Assessment Records and Admin Sheet to an Archive folder.
   * @param {Array} assessmentRecordFileIds - An array of file IDs to archive.
   */
  archiveOldVersions(assessmentRecordFileIds) {
    const parentFolder = DriveManager.getParentFolderId(this.sheet.getId());
    const date = Utils.getDate();
    const archiveFolder = DriveManager.createFolder(parentFolder, `Archive ${date}`);
    
    // If no array is passed, default to the assessmentRecordSheets details.
    if (!assessmentRecordFileIds) {
      assessmentRecordFileIds = Object.values(this.assessmentRecordSheets).map(item => item.originalSheetId);
    }
    
    // Move all the files to the archive folder
    DriveManager.moveFiles(archiveFolder.newFolderId, assessmentRecordFileIds, ` - ARCHIVED - ${date}`);
  }
  
  /**
   * Updates the admin sheet by creating a new version and archiving the old one.
   * This process includes:
   * 1. Serialising existing configuration.
   * 2. Cloning the admin sheet to a new location.
   * 3. Archiving the old version.
   * 4. Opening the new sheet in a browser window.
   * @returns {string} The URL of the newly created admin sheet.
   */
  updateAdminSheet() {
    // Update configuration values prior to cloning.
    configurationManager.setUpdateStage(1);
    configurationManager.setIsAdminSheet(true);
    
    // Serialise existing config
    const propsCloner = new PropertiesCloner();
    propsCloner.serialiseProperties();
    
    const adminSheetDetails = this.getAdminSheetDetails();
    const adminSheetName = Object.keys(this.adminSheetsDetails)[0];
    const currentAdminSheetFileId = this.adminSheetsDetails[adminSheetName].originalSheetId;
    
    // Assumes that we want the admin sheet to be in the same folder as the last one.
    const parentFolderId = DriveManager.getParentFolderId(currentAdminSheetFileId);
    this.destinationFolderId = parentFolderId;
    
    // Clone the admin sheet.
    this.cloneSheets(adminSheetDetails, this.destinationFolderId, this.adminSheetTemplateId);
    
    // The newSheetId property should be populated now.
    const newSheetId = this.adminSheetsDetails[adminSheetName].newSheetId;
    
    // Archive the old admin sheet.
    this.archiveOldVersions([currentAdminSheetFileId]);
    
    // Open the new admin sheet in a new window.
    const newSheetUrl = SpreadsheetApp.openById(newSheetId).getUrl();
    this.uiManager.openUrlInNewWindow(newSheetUrl);
    
    // Returns the URL so that it can be fed to the GuiManager.ui.
    return newSheetUrl;
  }
  
  /**
   * Gets the class name and file ID of all assessment records listed in the 'Classrooms' sheet.
   */
  getAssessmentRecordDetails() {
    const headerIndices = this.classroomSheet.getColumnIndicesFromHeader(['Name', 'AR File ID']);
    const sheetsData = this.classroomSheet.getData();
    // Remove header row.
    sheetsData.shift();
    
    let assessmentRecordSheets = {};
    sheetsData.forEach(row => {
      // Adds an element to the assessmentRecordSheets object if there's a file ID in the row.
      if (row[headerIndices.arfileid]) {
        assessmentRecordSheets[row[headerIndices.name]] = {
          "originalSheetId": row[headerIndices.arfileid],
          "newSheetId": "" // leave this attribute blank for now
        };
      }
    });
    this.assessmentRecordSheets = assessmentRecordSheets;
    return assessmentRecordSheets;
  }
  
  /**
   * Updates all assessment records by cloning them into the latest template and archiving old versions.
   * This method performs the following steps:
   * 1. Retrieves the assessment record template ID.
   * 2. Fetches assessment record details.
   * 3. Clones assessment record sheets into the latest template.
   * 4. Archives old assessment record sheets.
   * 5. Updates the Classroom sheet with new assessment record file IDs.
   * @throws {Error} If any step in the process fails.
   */
  updateAssessmentRecords() {
    this.progressTracker = new ProgressTracker();
    const uiManager = new UIManager();
    uiManager.showProgressModal();
    
    let step = 0;
    this.progressTracker.startTracking('Updating all Assessment Records. This may take a while...');
    
    // Gets the assessment record template file Id - should have been set when the admin sheet was updated.
    this.assessmentRecordTemplateId = configurationManager.getAssessmentRecordTemplateId();
    
    this.progressTracker.updateProgress(++step, 'Fetching Assessment Record Details');
    // Get the assessment record details.
    this.getAssessmentRecordDetails();
    
    // Clone the assessment record sheets.
    this.progressTracker.updateProgress(++step, 'Cloning Assessment Record sheets into latest template');
    this.cloneSheets(this.assessmentRecordSheets);
    
    // Archive old assessment record sheets.
    this.progressTracker.updateProgress(++step, 'Archiving old Assessment Record sheets');
    const assessmentRecordFileIds = Object.values(this.assessmentRecordSheets).map(item => item.originalSheetId);
    this.archiveOldVersions(assessmentRecordFileIds);
    
    // Update the Classroom Sheet with the new Assessment Record file IDs.
    this.progressTracker.updateProgress(++step, 'Updating Classroom Sheet with new Assessment Record File IDs');
    this.updateClassroomSheetWithNewAssessmentRecords();
    
    // Marks the task as complete.
    this.progressTracker.complete();
    configurationManager.setUpdateStage(2);
  }
  
  /**
   * Modified runAssessmentRecordUpdateWizard method that launches the HTML-powered wizard.
   * Prepares the necessary parameters, saves state, and then displays the wizard.
   */
  runAssessmentRecordUpdateWizard() {
    // Deserialise Script and User Properties transferred from previous sheet.
    const propertiesCloner = new PropertiesCloner();
    propertiesCloner.deserialiseProperties(true);
    
    // Retrieve the destination folder ID from configuration.
    this.destinationFolderId = configurationManager.getAssessmentRecordDestinationFolder();
    
    // Make a local copy of the Assessment Record Template.
    this.assessmentRecordTemplateId = this.copyAssessmentRecordTemplate();
    
    // Store the fileId of the 'local' copy of the assessment record in the config files.
    configurationManager.setAssessmentRecordTemplateId(this.assessmentRecordTemplateId);
    const assessmentRecordTemplateUrl = this.getAssessmentRecordTemplateUrl(this.assessmentRecordTemplateId);
    
    // Retrieve the Script ID.
    const sa = new ScriptAppManager();
    const adminScriptId = sa.getScriptId();
    
    // Save the current state so that it can be retrieved later in updateAssessmentRecords.
    this.saveState();
    
    // Create the HTML template for the wizard and pass in the template URL and script ID.
    const template = HtmlService.createTemplateFromFile('UpdateAndInitManager/UpdateWizard');
    template.assessmentRecordTemplateUrl = assessmentRecordTemplateUrl;
    template.adminScriptId = adminScriptId;
    
    const htmlOutput = template.evaluate().setWidth(600).setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Update Assessment Records Wizard');
  }
}
