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
 * const backendAssessorBatchSize = config.getBackendAssessorBatchSize();
 * config.setLangflowApiKey('sk-abc123');
 */
class ConfigurationManager {
  constructor() {
    if (ConfigurationManager.instance) {
      return ConfigurationManager.instance;
    }

    this.scriptProperties = PropertiesService.getScriptProperties();
    this.documentProperties = PropertiesService.getDocumentProperties();

    this.configCache = null; // Initialize cache early

    this.maybeDeserializeProperties();

    ConfigurationManager.instance = this;
    return this;
  }

  static get CONFIG_KEYS() {
    return {
      BACKEND_ASSESSOR_BATCH_SIZE: 'backendAssessorBatchSize',
      SLIDES_FETCH_BATCH_SIZE: 'slidesFetchBatchSize',
      API_KEY: 'apiKey',
      BACKEND_URL: 'backendUrl',
      ASSESSMENT_RECORD_TEMPLATE_ID: 'assessmentRecordTemplateId',
      ASSESSMENT_RECORD_DESTINATION_FOLDER: 'assessmentRecordDestinationFolder',
      UPDATE_DETAILS_URL: 'updateDetailsUrl',
      UPDATE_STAGE: 'updateStage',
      IS_ADMIN_SHEET: 'isAdminSheet',
      REVOKE_AUTH_TRIGGER_SET: 'revokeAuthTriggerSet',
      DAYS_UNTIL_AUTH_REVOKE: 'daysUntilAuthRevoke',
      SCRIPT_AUTHORISED: 'scriptAuthorised',
    };
  }

  static get CONFIG_SCHEMA() {
    return {
      [ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: {
        storage: 'script',
        validate: (v) =>
          ConfigurationManager.validateIntegerInRange('Backend Assessor Batch Size', v, 1, 500),
      },
      [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: {
        storage: 'script',
        validate: (v) =>
          ConfigurationManager.validateIntegerInRange('Slides Fetch Batch Size', v, 1, 100),
      },
      [ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: {
        storage: 'script',
        validate: (v) =>
          ConfigurationManager.validateIntegerInRange('Days Until Auth Revoke', v, 1, 365),
      },
      [ConfigurationManager.CONFIG_KEYS.API_KEY]: {
        storage: 'script',
        validate: ConfigurationManager.validateApiKey,
      },
      [ConfigurationManager.CONFIG_KEYS.BACKEND_URL]: {
        storage: 'script',
        validate: (v) => ConfigurationManager.validateUrl('Backend Url', v),
      },
      [ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL]: {
        storage: 'script',
        validate: (v) => ConfigurationManager.validateUrl('Update Details Url', v),
      },
      [ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID]: {
        storage: 'script',
        validate: (v, instance) => {
          ConfigurationManager.validateNonEmptyString('Assessment Record Template Id', v);
          if (!instance.isValidGoogleSheetId(v)) {
            throw new Error('Assessment Record Template ID must be a valid Google Sheet ID.');
          }
          return v;
        },
      },
      [ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER]: {
        storage: 'script',
        validate: (v, instance) => {
          ConfigurationManager.validateNonEmptyString('Assessment Record Destination Folder', v);
          if (!instance.isValidGoogleDriveFolderId(v)) {
            throw new Error(
              'Assessment Record Destination Folder must be a valid Google Drive Folder ID.'
            );
          }
          return v;
        },
      },
      [ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE]: {
        storage: 'script',
        validate: (v) => {
          const stage = parseInt(v, 10);
          if (!Number.isInteger(stage) || stage < 0 || stage > 2) {
            throw new Error('Update Stage must be 0, 1, or 2');
          }
          return stage;
        },
      },
      [ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET]: {
        storage: 'document',
        validate: ConfigurationManager.validateBoolean,
        normalize: ConfigurationManager.toBooleanString,
      },
      [ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED]: {
        storage: 'document',
        validate: ConfigurationManager.validateBoolean,
        normalize: ConfigurationManager.toBooleanString,
      },
      [ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: {
        storage: 'document',
        validate: ConfigurationManager.validateBoolean,
        normalize: ConfigurationManager.toBooleanString,
      },
    };
  }

  /**
   * Attempts to deserialize properties from a propertiesStore sheet if no script or document properties are found.
   * This method checks if there are existing script or document properties. If neither is found, it attempts to
   * initialize properties from a 'propertiesStore' sheet using the PropertiesCloner. If the sheet exists and the
   * deserialization is successful, it logs a success message. If the 'propertiesStore' sheet is not found, it
   * logs an appropriate message. Any errors during the process are caught and logged.
   */
  maybeDeserializeProperties() {
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
    if (
      key === ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET ||
      key === ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET ||
      key === ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED
    ) {
      return this.documentProperties.getProperty(key) || false;
    }
    return this.configCache[key] || '';
  }

  setProperty(key, value) {
    const spec = ConfigurationManager.CONFIG_SCHEMA[key];

    if (!spec) {
      // Default behavior for unknown properties - no validation
      this.scriptProperties.setProperty(key, String(value));
      this.configCache = null;
      return;
    }

    // Validate the value
    const canonical = spec.validate ? spec.validate(value, this) : value;

    // Normalize if a normalizer is provided
    const normalizedValue = spec.normalize ? spec.normalize(canonical) : canonical;

    // Store in the appropriate properties service
    const store = spec.storage === 'document' ? this.documentProperties : this.scriptProperties;
    store.setProperty(key, String(normalizedValue));

    // For document properties, we return early and don't invalidate the script cache
    // since document properties are not cached
    if (spec.storage === 'document') {
      return;
    }

    // Invalidate cache for script properties
    this.configCache = null;
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

  /**
   * Validate that a value is an integer within the provided inclusive range.
   * Parses the value to an integer and throws an Error when invalid.
   * Returns the parsed integer on success.
   */
  _validateIntegerRange(value, key, min, max) {
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new Error(`${this.toReadableKey(key)} must be an integer between ${min} and ${max}.`);
    }
    return parsed;
  }

  // Reusable validator functions for the CONFIG_SCHEMA
  static validateIntegerInRange(label, value, min, max) {
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new Error(`${label} must be an integer between ${min} and ${max}.`);
    }
    return parsed;
  }

  static validateNonEmptyString(label, value) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`${label} must be a non-empty string.`);
    }
    return value;
  }

  static validateUrl(label, value) {
    if (typeof value !== 'string' || !Utils.isValidUrl(value)) {
      throw new Error(`${label} must be a valid URL string.`);
    }
    return value;
  }

  static validateBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
    }
    throw new Error('Value must be boolean (true/false).');
  }

  static toBooleanString(value) {
    return ConfigurationManager.validateBoolean(value) ? 'true' : 'false';
  }

  static validateApiKey(value) {
    // Accept API keys that are alphanumeric with optional single hyphens between segments.
    // Do not require an 'sk-' prefix; disallow leading/trailing hyphens and consecutive hyphens.
    const apiKeyPattern = /^(?!-)([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)$/;
    if (typeof value !== 'string' || !apiKeyPattern.test(value.trim())) {
      throw new Error(
        'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.'
      );
    }
    return value;
  }

  isValidApiKey(apiKey) {
    // Accept API keys that are alphanumeric with optional single hyphens between segments.
    // Do not require an 'sk-' prefix; disallow leading/trailing hyphens and consecutive hyphens.
    const apiKeyPattern = /^(?!-)([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)$/;
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
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  }

  getBackendAssessorBatchSize() {
    const value = parseInt(
      this.getProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE),
      10
    );
    return isNaN(value) ? ConfigurationManager.DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE : value;
  }

  static get DEFAULTS() {
    return {
      BACKEND_ASSESSOR_BATCH_SIZE: 120,
      SLIDES_FETCH_BATCH_SIZE: 30,
      DAYS_UNTIL_AUTH_REVOKE: 60,
      UPDATE_DETAILS_URL:
        'https://raw.githubusercontent.com/h-arnold/AssessmentBot/refs/heads/main/src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json',
      UPDATE_STAGE: 0,
    };
  }

  getSlidesFetchBatchSize() {
    const raw = this.getProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE);
    const parsed = parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 100) {
      return parsed;
    }
    return ConfigurationManager.DEFAULTS.SLIDES_FETCH_BATCH_SIZE;
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
    const value = parseInt(
      this.getProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE),
      10
    );
    return isNaN(value) ? ConfigurationManager.DEFAULTS.DAYS_UNTIL_AUTH_REVOKE : value;
  }

  getUpdateDetailsUrl() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL);
    return value || ConfigurationManager.DEFAULTS.UPDATE_DETAILS_URL;
  }

  getUpdateStage() {
    const value = parseInt(this.getProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE), 10);
    return isNaN(value) ? ConfigurationManager.DEFAULTS.UPDATE_STAGE : value;
  }

  getAssessmentRecordTemplateId() {
    // Simply return the stored property (empty string if unset). Fallback logic is now handled
    // by BaseUpdateAndInit to avoid recursive instantiation between the two classes.
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID);
  }

  getAssessmentRecordDestinationFolder() {
    if (Utils.validateIsAdminSheet(false)) {
      let destinationFolder = this.getProperty(
        ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER
      );
      if (!destinationFolder) {
        const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
        const parentFolderId = DriveManager.getParentFolderId(spreadsheetId);
        const newFolder = DriveManager.createFolder(parentFolderId, 'Assessment Records');
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

  setBackendAssessorBatchSize(batchSize) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE, batchSize);
  }

  setSlidesFetchBatchSize(batchSize) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE, batchSize);
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
    this.setProperty(
      ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER,
      folderId
    );
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

// For module exports (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigurationManager;
}
