/**
 * @class ConfigurationManager
 * @description A singleton class that manages configuration properties for the Google Slides Assessor application.
 * It provides methods to get and set various configuration properties that control the behavior of the application.
 * The class handles property validation, storage (using both script and document properties), and provides convenient
 * accessor methods for all configuration values.
 * 
 * @property {Object} scriptProperties - Reference to PropertiesService.getScriptProperties()
 * @property {Object} documentProperties - Reference to PropertiesService.getDocumentProperties()
 * @property {Object|null} configCache - Cache of configuration properties
 * 
 * @example
 * const config = new ConfigurationManager();
 * const batchSize = config.getBatchSize();
 * config.setLangflowApiKey('sk-abc123');
 */
class ConfigurationManager {
  // ...existing code...

  getApiKey() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);
  }

  setApiKey(apiKey) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, apiKey);
  }

  getBackendUrl() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL);
  }

  setBackendUrl(url) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL, url);
  }
  static get CONFIG_KEYS() {
    return {
      BATCH_SIZE: 'batchSize',
      API_KEY: 'apiKey',
      BACKEND_URL: 'backendUrl',
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

    // Properties that should be stored as document properties
    if (key === ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET ||
        key === ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET ||
        key === ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED) {
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
      case ConfigurationManager.CONFIG_KEYS.API_KEY:
        if (typeof value !== 'string') {
          throw new Error("API Key must be a valid string starting with 'sk-' followed by alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.");
        }
        break;
      case ConfigurationManager.CONFIG_KEYS.BACKEND_URL:
      case ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL:
        if (typeof value !== 'string' || !Utils.isValidUrl(value)) {
          throw new Error(`${this.toReadableKey(key)} must be a valid URL string.`);
        }
        break;
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
      case ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED:
      case ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET:
        if (!this.isBoolean(value)) {
          throw new Error(`${this.toReadableKey(key)} must be a boolean.`);
        }
        this.documentProperties.setProperty(key, value.toString());
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
    if (typeof value === 'boolean') {
      return true;
    }
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      return lowerValue === 'true' || lowerValue === 'false';
    }
    return false;
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

  getApiKey() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);
  }

  getBackendUrl() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL);
  }


  getRevokeAuthTriggerSet() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET);
    return value.toString().toLowerCase() === 'true';
  }

  getDaysUntilAuthRevoke() {
    const value = parseInt(this.getProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE), 10);
    return isNaN(value) ? 60 : value;
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


  // getImageUploadUrl removed (IMAGE_FLOW_UID no longer used)

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

  getScriptAuthorised() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED);
    // Explicitly convert string to boolean
    return value.toString().toLowerCase() === 'true';
  }

  setBatchSize(batchSize) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.BATCH_SIZE, batchSize);
  }

  setApiKey(apiKey) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, apiKey);
  }

  setBackendUrl(url) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL, url);
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
