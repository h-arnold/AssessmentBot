/**
 * BaseUpdateAndInit Class
 * 
 * Serves as the superclass for both UpdateManager and FirstRunManager.
 * Contains shared attributes and common functionality such as:
 * - Initialising the active sheet and UI manager.
 * - Storing configuration values (e.g. destination folder, version number, template IDs).
 * - Fetching version details from a remote JSON.
 * - Cloning sheets based on a template.
 * - Copying the Assessment Record template and returning its URL.
 * - Saving and loading state between updates.
 * - Validating and setting the template file IDs.
 */
class BaseUpdateAndInit {
    constructor() {
      // Set up common properties
      this.sheet = SpreadsheetApp.getActiveSpreadsheet();
      this.uiManager = new UIManager(this.sheet);
      this.destinationFolderId = ""; // to be set later from configuration or during the process
      this.versionNo = '0.4.2'; // default version; update as needed
      this.assessmentRecordTemplateId = configurationManager.getAssessmentRecordTemplateId();
      this.adminSheetTemplateId = null; // will be set from version details
      this.versionDetails = this.fetchVersionDetails();
      this.progressTracker = null; // May be used during long-running tasks
    }
  
    /**
     * Fetches the version details JSON from the URL specified in configuration.
     * @returns {Object|null} The parsed version details, or null on failure.
     */
    fetchVersionDetails() {
      const updateDetailsUrl = configurationManager.getUpdateDetailsUrl();
      if (!updateDetailsUrl) {
        console.error("Update_Details_Url not found in configuration.");
        return null;
      }
      
      const request = {
        url: updateDetailsUrl,
        method: "GET",
        muteHttpExceptions: true
      };
      
      const requestManager = new BaseRequestManager();
      const response = requestManager.sendRequestWithRetries(request);
      
      if (!response) {
        console.error("Failed to fetch assessmentBotVersions.json.");
        return null;
      }
      
      if (response.getResponseCode() !== 200) {
        console.error(`Failed to fetch assessmentBotVersions.json. Status Code: ${response.getResponseCode()} Returned Message: ${response.getContentText()}.`);
        return null;
      }
      
      try {
        return JSON.parse(response.getContentText());
      } catch (error) {
        console.error(`Error parsing assessmentBotVersions.json: ${error}`);
        return null;
      }
    }
    
    /**
     * Clones sheets provided in the sheetsObject using the specified template.
     * @param {Object} sheetsObject - An object where keys are names and values have at least an "originalSheetId".
     * @param {string} [destinationFolderId=this.destinationFolderId] - The destination folder ID.
     * @param {string} [templateSheetId=this.assessmentRecordTemplateId] - The template sheet ID.
     * @returns {Object} The updated sheetsObject with new sheet IDs.
     * @description For each class name in the sheetsObject, creates a new sheet
     * based on the template and copies all properties from the source sheet.
     */
    cloneSheets(sheetsObject, destinationFolderId = this.destinationFolderId, templateSheetId = this.assessmentRecordTemplateId) {
      const step = this.progressTracker ? this.progressTracker.getStepAsNumber() : 0;
      Object.keys(sheetsObject).forEach(className => {
        if (this.progressTracker) {
          this.progressTracker.updateProgress(step, `Cloning the assessment record for ${className}`);
        }
        
        const newSheet = SheetCloner.cloneEverything({
          "templateSheetId": templateSheetId,
          "newSpreadsheetName": className,
          "sourceSpreadsheetId": sheetsObject[className].originalSheetId,
          "copyDocProps": true,
          "copyScriptProps": true,
          "destinationFolderId": destinationFolderId
        });
        
        sheetsObject[className].newSheetId = newSheet.fileId;
      });
      
      return sheetsObject;
    }
    
    /**
     * Returns the URL for the given assessment record template.
     * @param {string} assessmentRecordTemplateId - The template ID.
     * @returns {string} The URL of the template.
     */
    getAssessmentRecordTemplateUrl(assessmentRecordTemplateId) {
      const template = SpreadsheetApp.openById(assessmentRecordTemplateId);
      return template.getUrl();
    }
    
    /**
     * Copies the latest Assessment Record template into the destination folder.
     * @returns {string} The new template's file ID.
     */
    copyAssessmentRecordTemplate() {
      const templateId = this.getLatestAssessmentRecordTemplateId(this.versionNo);
      const copiedTemplate = DriveManager.copyTemplateSheet(
        templateId,
        this.destinationFolderId,
        `Assessment Record Template v${this.versionNo}`
      );
      return this.assessmentRecordTemplateId = copiedTemplate.fileId;
    }
    
    /**
     * Retrieves the latest Assessment Record template ID from the version details.
     * @param {string} [versionNo=this.versionNo]
     * @returns {string} The template file ID.
     * @throws {Error} if the template is not found.
     */
    getLatestAssessmentRecordTemplateId(versionNo = this.versionNo) {
      if (!this.versionDetails || !this.versionDetails[versionNo] || !this.versionDetails[versionNo].assessmentRecordTemplateFileId) {
        throw new Error(`Assessment Record template for v${versionNo} not found.`);
      }
      return this.versionDetails[versionNo].assessmentRecordTemplateFileId;
    }
    
    /**
     * Retrieves the latest Admin Sheet template ID from the version details.
     * @param {string} [versionNo=this.versionNo]
     * @returns {string} The admin sheet template file ID.
     * @throws {Error} if the template is not found.
     */
    getLatestAdminSheetTemplateId(versionNo = this.versionNo) {
      if (!this.versionDetails || !this.versionDetails[versionNo] || !this.versionDetails[versionNo].adminSheetFileId) {
        throw new Error(`Admin Sheet template for v${versionNo} not found.`);
      }
      return this.versionDetails[versionNo].adminSheetFileId;
    }
    
    /**
     * Retrieves and validates the template file IDs for the current version.
     * Validates the retrieved file IDs using DriveManager.isValidGoogleDriveFileId().
     * Sets the class properties directly.
     */
    getTemplateFileIds() {
      const versionNumber = this.versionNo;
      const versionData = this.fetchVersionDetails();
  
      if (!versionData) {
        console.error("Failed to retrieve version details.");
        return;
      }
  
      // Validate and extract the specific version details
      const versionInfo = versionData[versionNumber];
      if (!versionInfo) {
        console.error(`Version ${versionNumber} not found in assessmentBotVersions.json`);
        return;
      }
  
      // Extract file IDs
      const assessmentRecordTemplateId = versionInfo.assessmentRecordTemplateFileId;
      const adminSheetTemplateId = versionInfo.adminSheetFileId;
  
      // Validate file Ids using DriveManager.isValidGoogleDriveFileId()
      if (!DriveManager.isValidGoogleDriveFileId(assessmentRecordTemplateId)) {
        console.error(`Invalid assessmentRecordTemplate ID: ${assessmentRecordTemplateId}`);
        return;
      }
  
      if (!DriveManager.isValidGoogleDriveFileId(adminSheetTemplateId)) {
        console.error(`Invalid adminSheetTemplate ID: ${adminSheetTemplateId}`);
        return;
      }
  
      // Store IDs in class properties
      this.assessmentRecordTemplateId = assessmentRecordTemplateId;
      this.adminSheetTemplateId = adminSheetTemplateId;
      this.versionNo = versionNumber;
  
      console.log(`Successfully set the file IDs for version ${versionNumber}.`);
    }
    
    /**
     * Saves selected state properties to the Script Properties so that they can be restored
     * on subsequent calls.
     */
    saveState() {
      const state = {
        versionNo: this.versionNo,
        destinationFolderId: this.destinationFolderId,
        assessmentRecordTemplateId: this.assessmentRecordTemplateId,
        adminSheetTemplateId: this.adminSheetTemplateId
      };
      PropertiesService.getScriptProperties().setProperty('baseAdminManagerState', JSON.stringify(state));
      console.log("BaseAdminManager state saved: " + JSON.stringify(state));
    }
    
    /**
     * Loads state properties from the Script Properties into the current instance.
     */
    loadState() {
      const stateStr = PropertiesService.getScriptProperties().getProperty('baseAdminManagerState');
      if (stateStr) {
        const state = JSON.parse(stateStr);
        this.versionNo = state.versionNo;
        this.destinationFolderId = state.destinationFolderId;
        this.assessmentRecordTemplateId = state.assessmentRecordTemplateId;
        this.adminSheetTemplateId = state.adminSheetTemplateId;
        console.log("BaseAdminManager state loaded: " + JSON.stringify(state));
        // Removes state from Script Properties after loading.
        PropertiesService.getScriptProperties().deleteProperty('baseAdminManagerState');
      } else {
        console.warn("No saved state found for BaseAdminManager.");
      }
    }
  }
  

