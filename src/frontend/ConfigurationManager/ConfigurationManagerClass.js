class ConfigurationManager {
  static get CONFIG_KEYS() {
    return {
      BATCH_SIZE: 'batchSize',
      LANGFLOW_API_KEY: 'langflowApiKey',
      LANGFLOW_URL: 'langflowUrl',
      TEXT_ASSESSMENT_TWEAK_ID: 'textAssessmentTweakId',
      TABLE_ASSESSMENT_TWEAK_ID: 'tableAssessmentTweakId',
      IMAGE_ASSESSMENT_TWEAK_ID: 'imageAssessmentTweakId',
      IMAGE_FLOW_UID: 'imageFlowUid',
      ASSESSMENT_RECORD_TEMPLATE_ID: 'assessmentRecordTemplateId',
      ASSESSMENT_RECORD_DESTINATION_FOLDER: 'assessmentRecordDestinationFolder',
      UPDATE_DETAILS_URL: 'updateDetailsUrl',
      UPDATE_STAGE: 'updateStage',
      IS_ADMIN_SHEET: 'isAdminSheet',
      REVOKE_AUTH_TRIGGER_SET: 'revokeAuthTriggerSet',
      DAYS_UNTIL_AUTH_REVOKE: 'daysUntilAuthRevoke',
      SCRIPT_AUTHORISED: 'scriptAuthorised'
    };
  }

  constructor() {
    if (ConfigurationManager.instance) {
      return ConfigurationManager.instance;
    }

    this.scriptProperties = PropertiesService.getScriptProperties();
    this.documentProperties = PropertiesService.getDocumentProperties();

    this.maybeDeserializeProperties();
    
    this.configCache = null; // Initialize cache

    ConfigurationManager.instance = this;
    return this;
  }

  /**
   * Attempts to deserialize properties from a propertiesStore sheet if no script or document properties are found.
   * This method checks if there are existing script or document properties. If neither is found, it attempts to
   * initialize properties from a 'propertiesStore' sheet using the PropertiesCloner. If the sheet exists and the
   * deserialization is successful, it logs a success message. If the 'propertiesStore' sheet is not found, it
   * logs an appropriate message. Any errors during the process are caught and logged.
   */
  maybeDeserializeProperties(){
    let hasScriptProperties = null;

    if (this.getIsAdminSheet()) {
      hasScriptProperties = this.scriptProperties.getKeys().length > 0;
    }

    const hasDocumentProperties = this.documentProperties.getKeys().length > 0;

    if (!hasScriptProperties && !hasDocumentProperties) {
      try {
        const propertiesCloner = new PropertiesCloner();
        if (propertiesCloner.sheet) {
          propertiesCloner.deserialiseProperties();
          console.log('Successfully copied properties from propertiesStore');
        } else {
          console.log('No propertiesStore sheet found');
        }
      } catch (error) {
        console.error('Error initializing properties:', error);
      }
    }
  }

  getAllConfigurations() {
    if (!this.configCache) {
      this.configCache = this.scriptProperties.getProperties();
    }
    return this.configCache;
  }

  hasProperty(key) {
    this.getAllConfigurations();
    return this.configCache.hasOwnProperty(key);
  }

  getProperty(key) {
    if (!this.configCache) {
      this.getAllConfigurations();
    }

    // All other config params are stored in the Script Properties but as the Admin Sheet IS a specific document, this particular one needs to be stored as a document property to avoid issues with the assessment records mistakenly being picked up as admin sheets.
    if (key === ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET) {
      return this.documentProperties.getProperty(key) || false;
    }
    return this.configCache[key] || '';
  }

  setProperty(key, value) {
    switch (key) {
      case ConfigurationManager.CONFIG_KEYS.BATCH_SIZE:
        if (!Number.isInteger(value) || value <= 0) {
          throw new Error("Batch Size must be a positive integer.");
        }
        break;
      case ConfigurationManager.CONFIG_KEYS.LANGFLOW_API_KEY:
        if (typeof value !== 'string') {
          throw new Error("LangFlow API Key must be a valid string starting with 'sk-' followed by alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.");
        }
        break;
      case ConfigurationManager.CONFIG_KEYS.LANGFLOW_URL:
      case ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL:
        if (typeof value !== 'string' || !Utils.isValidUrl(value)) {
          throw new Error(`${this.toReadableKey(key)} must be a valid URL string.`);
        }
        break;
      case ConfigurationManager.CONFIG_KEYS.IMAGE_FLOW_UID:
        if (typeof value !== 'string' || value.trim() === '') {
          throw new Error("Image Flow UID must be a non-empty string.");
        }
        break;
      case ConfigurationManager.CONFIG_KEYS.TEXT_ASSESSMENT_TWEAK_ID:
      case ConfigurationManager.CONFIG_KEYS.TABLE_ASSESSMENT_TWEAK_ID:
      case ConfigurationManager.CONFIG_KEYS.IMAGE_ASSESSMENT_TWEAK_ID:
      case ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID:
        if (typeof value !== 'string' || value.trim() === '') {
          throw new Error(`${this.toReadableKey(key)} must be a non-empty string.`);
        }
        if (key === ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID && !this.isValidGoogleSheetId(value)) {
          throw new Error("Assessment Record Template ID must be a valid Google Sheet ID.");
        }
        break;
      case ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER:
        if (typeof value !== 'string' || value.trim() === '') {
          throw new Error(`${this.toReadableKey(key)} must be a non-empty string.`);
        }
        if (key === ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER && !this.isValidGoogleDriveFolderId(value)) {
          throw new Error("Assessment Record Destination Folder must be a valid Google Drive Folder ID.");
        }
        break;
      case ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE:
        const stage = parseInt(value);
        if (!Number.isInteger(stage) || stage < 0 || stage > 2) {
          throw new Error("Update Stage must be 0, 1, or 2");
        }
        break;
      case ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET:
        this.documentProperties.setProperty(key, Boolean(value));
        return;
      case ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED:
      case ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET:
        if (!this.isBoolean(value)) {
          throw new Error(`${key} must be a boolean.`);
        }
        break;
      case ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE:
        if (!Number.isInteger(value) || value <= 0) {
          throw new Error("Days Until Auth Revoke must be a positive integer.");
        }
        break;
      default:
        // No specific validation
        break;
    }

    this.scriptProperties.setProperty(key, value.toString());
    this.configCache = null; // Invalidate cache
  }

  isBoolean(value) {
    //See if this can be converted to a boolean
    value = Boolean(value)
    console.log(typeof value === 'boolean')
    return typeof value === 'boolean';
  }


  isValidApiKey(apiKey) {
    const apiKeyPattern = /^sk-(?!-)([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)$/;
    return apiKeyPattern.test(apiKey.trim());
  }

  isValidGoogleSheetId(sheetId) {
    try {
      const file = DriveApp.getFileById(sheetId);
      if (file && file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Invalid Google Sheet ID: ${error.message}`);
      return false;
    }
  }

  isValidGoogleDriveFolderId(folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      return folder !== null;
    } catch (error) {
      console.error(`Invalid Google Drive Folder ID: ${error.message}`);
      return false;
    }
  }

  toReadableKey(key) {
    return key.replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }

  getBatchSize() {
    const value = parseInt(this.getProperty(ConfigurationManager.CONFIG_KEYS.BATCH_SIZE), 10);
    return isNaN(value) ? 20 : value;
  }

  getLangflowApiKey() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.LANGFLOW_API_KEY);
  }

  getLangflowUrl() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.LANGFLOW_URL);
  }

  getImageFlowUid() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.IMAGE_FLOW_UID);
  }

  getTextAssessmentTweakId() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.TEXT_ASSESSMENT_TWEAK_ID);
  }

  getTableAssessmentTweakId() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.TABLE_ASSESSMENT_TWEAK_ID);
  }

  getImageAssessmentTweakId() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.IMAGE_ASSESSMENT_TWEAK_ID);
  }

  getRevokeAuthTriggerSet() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET);
    return value.toString().toLowerCase() === 'true';
  }

  getDaysUntilAuthRevoke() {
    const value = parseInt(this.getProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE), 10);
    return isNaN(value) ? 60 : value;
  }

  getImageAssessmentUrl() {
    const baseUrl = this.getLangflowUrl();
    return `${baseUrl}/api/v1/run/imageAssessment?stream=false`;
  }

  getTextAssessmentUrl() {
    const baseUrl = this.getLangflowUrl();
    return `${baseUrl}/api/v1/run/textAssessment?stream=false`;
  }

  getUpdateDetailsUrl() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL)
    if (!value) {
      return 'https://raw.githubusercontent.com/h-arnold/AssessmentBot/refs/heads/main/src/frontend/UpdateAndInitManager/assessmentBotVersions.json';
    } else {
      return value;
    }
  }

  getUpdateStage() {
    const value = parseInt(this.getProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE), 10);
    if (isNaN(value)) {
      return 0;
    } else {
      return value;
    }
  }

  getTableAssessmentUrl() {
    const baseUrl = this.getLangflowUrl();
    return `${baseUrl}/api/v1/run/tableAssessment?stream=false`;
  }

  getImageUploadUrl() {
    const baseUrl = this.getLangflowUrl();
    const imageFlowUid = this.getImageFlowUid();
    return `${baseUrl}/api/v1/upload/${imageFlowUid}`;
  }

  getAssessmentRecordTemplateId() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID);
  }

  getAssessmentRecordDestinationFolder() {
    if (Utils.validateIsAdminSheet(false)) {
      let destinationFolder = this.getProperty(ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER);
      if (!destinationFolder) {
        const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
        const parentFolderId = DriveManager.getParentFolderId(spreadsheetId);
        const newFolder = DriveManager.createFolder(parentFolderId, 'Assessment Records')
        destinationFolder = newFolder.newFolderId;
      }
      return destinationFolder;
    }
  }

  getIsAdminSheet() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET) || false;
  }

  // New getter for scriptAuthorised
  getScriptAuthorised() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED) || false;
  }

  setBatchSize(batchSize) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.BATCH_SIZE, batchSize);
  }

  setLangflowApiKey(apiKey) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.LANGFLOW_API_KEY, apiKey);
  }

  setLangflowUrl(url) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.LANGFLOW_URL, url);
  }

  setImageFlowUid(uid) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.IMAGE_FLOW_UID, uid);
  }

  setTextAssessmentTweakId(tweakId) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.TEXT_ASSESSMENT_TWEAK_ID, tweakId);
  }

  setTableAssessmentTweakId(tweakId) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.TABLE_ASSESSMENT_TWEAK_ID, tweakId);
  }

  setImageAssessmentTweakId(tweakId) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.IMAGE_ASSESSMENT_TWEAK_ID, tweakId);
  }

  setAssessmentRecordTemplateId(templateId) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID, templateId);
  }

  setAssessmentRecordDestinationFolder(folderId) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER, folderId);
  }

  setUpdateDetailsUrl(url) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL, url);
  }

  setUpdateStage(stage) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE, stage);
  }

  setIsAdminSheet(isAdmin) {
    const boolValue = Boolean(isAdmin);
    this.setProperty(ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET, boolValue);
  }

  setRevokeAuthTriggerSet(flag) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET, flag);
  }

  setDaysUntilAuthRevoke(days) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, days);
  }

  // New setter for scriptAuthorised
  setScriptAuthorised(flag) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED, flag);
  }
}
