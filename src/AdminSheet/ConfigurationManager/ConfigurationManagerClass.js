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

class ConfigurationManager extends BaseSingleton {
  /**
   * NOTE: Do NOT perform any heavy work (PropertiesService access, deserialisation)
   * in the constructor. Use ConfigurationManager.getInstance() to obtain the singleton and all
   * getters/setters will transparently call ensureInitialized() before touching persisted state.
   * The constructor is intentionally lightweight so tests can assert no side‑effects before first real use.
   */
  constructor(isSingletonCreator = false) {
    super();
    /**
     * JSDoc Singleton Banner
     * Use ConfigurationManager.getInstance(); do not call constructor directly.
     */
    if (!isSingletonCreator && ConfigurationManager._instance) {
      // Guard: discourage direct construction after first instance; maintain original object identity
      return ConfigurationManager._instance; // returning existing is acceptable for singleton semantics
    }
    // Defer PropertiesService access & deserialisation
    this.scriptProperties = null;
    this.documentProperties = null;
    this.configCache = null;
    this._initialized = false;
    if (!ConfigurationManager._instance) {
      ConfigurationManager._instance = this;
    }
  }

  /** Shared patterns (extracted for DRY). */
  static get API_KEY_PATTERN() {
    // Alphanumeric segments separated by single hyphens; no leading/trailing/consecutive hyphens
    return /^(?!-)([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)$/;
  }
  static get DRIVE_ID_PATTERN() {
    // Basic Google drive file/folder id heuristic
    return /^[A-Za-z0-9-_]{10,}$/;
  }

  static get JSON_DB_LOG_LEVELS() {
    return ['DEBUG', 'INFO', 'WARN', 'ERROR'];
  }

  /**
   * Canonical accessor – always use this instead of `new`.
   */

  /**
   * Internal one‑time initialisation boundary. Safe to call multiple times.
   * Performs first access to Apps Script services and property deserialisation.
   */
  ensureInitialized() {
    if (this._initialized) return;
    // Acquire handles lazily
    this.scriptProperties = this.scriptProperties || PropertiesService.getScriptProperties();
    this.documentProperties = this.documentProperties || PropertiesService.getDocumentProperties();
    // Perform potential deserialisation only once
    if (globalThis.__TRACE_SINGLETON__)
      ABLogger.getInstance().debug('[TRACE][HeavyInit] ConfigurationManager.ensureInitialized');
    this.maybeDeserializeProperties();
    this._initialized = true;
    if (globalThis.FREEZE_SINGLETONS) {
      try {
        Object.freeze(this);
      } catch (freezeErr) {
        if (globalThis.__TRACE_SINGLETON__) {
          console.debug('Freeze failed ConfigurationManager:', freezeErr?.message || freezeErr);
        }
      }
    }
  }

  /** Test helper */
  static resetForTests() {}

  static get CONFIG_KEYS() {
    return ConfigurationManager._CONFIG_KEYS;
  }
  static get CONFIG_SCHEMA() {
    return ConfigurationManager._CONFIG_SCHEMA;
  }

  /**
   * Attempts to deserialize properties from a propertiesStore sheet if no script or document properties are found.
   * This method checks if there are existing script or document properties. If neither is found, it attempts to
   * initialize properties from a 'propertiesStore' sheet using the PropertiesCloner. If the sheet exists and the
   * deserialization is successful, it logs a success message. If the 'propertiesStore' sheet is not found, it
   * logs an appropriate message. Any errors during the process are caught and logged.
   */
  maybeDeserializeProperties() {
    const safeGetKeys = (store) => {
      if (!store) return [];
      try {
        return store.getKeys ? store.getKeys() : [];
      } catch (e) {
        if (globalThis.__TRACE_SINGLETON__)
          ABLogger.getInstance().debug(
            '[TRACE_SINGLETON][ConfigurationManager.safeGetKeys] safeGetKeys error:',
            e?.message ?? e
          );
        return [];
      }
    };

    try {
      const hasScript = safeGetKeys(this.scriptProperties).length > 0;
      const hasDoc = safeGetKeys(this.documentProperties).length > 0;
      if (hasScript || hasDoc) return; // early return – nothing to do

      const propertiesCloner = new PropertiesCloner();
      if (propertiesCloner.sheet) {
        propertiesCloner.deserialiseProperties();
        ABLogger.getInstance().log('Successfully copied properties from propertiesStore');
      } else {
        ABLogger.getInstance().log('No propertiesStore sheet found');
      }
    } catch (err) {
      // Use ProgressTracker as the single logging contract per project guidance.
      ProgressTracker.getInstance().logError('ConfigurationManager.maybeDeserializeProperties', {
        err,
      });
    }
  }

  getAllConfigurations() {
    this.ensureInitialized();
    if (!this.configCache) {
      this.configCache = this.scriptProperties.getProperties();
    }
    return this.configCache;
  }

  hasProperty(key) {
    this.getAllConfigurations();
    return Object.hasOwn(this.configCache, key);
  }

  getProperty(key) {
    this.ensureInitialized();
    this.getAllConfigurations();
    switch (key) {
      case ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET:
      case ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET:
      case ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED: {
        const v = this.documentProperties.getProperty(key);
        return v == null ? false : v;
      }
      default:
        return this.configCache[key] || '';
    }
  }

  setProperty(key, value) {
    this.ensureInitialized();
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
    const hasValidator = globalThis.Utils && typeof globalThis.Utils.isValidUrl === 'function';
    const isValid =
      typeof value === 'string' &&
      (hasValidator ? globalThis.Utils.isValidUrl(value) : /^https?:\/\//.test(value));
    if (!isValid) {
      throw new Error(`${label} must be a valid URL string.`);
    }
    return value;
  }

  static validateBoolean(label, value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
    }
    throw new Error(`${label} must be a boolean (true/false).`);
  }

  static validateLogLevel(label, value) {
    if (typeof value !== 'string') {
      throw new Error(`${label} must be a string.`);
    }
    const upper = value.trim().toUpperCase();
    if (!ConfigurationManager.JSON_DB_LOG_LEVELS.includes(upper)) {
      throw new Error(
        `${label} must be one of: ${ConfigurationManager.JSON_DB_LOG_LEVELS.join(', ')}`
      );
    }
    return upper;
  }

  static validateApiKey(value) {
    const pattern = ConfigurationManager.API_KEY_PATTERN;
    if (typeof value !== 'string' || !pattern.test(value.trim())) {
      throw new Error(
        'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.'
      );
    }
    return value;
  }

  /**
   * Ensures a folder exists alongside the Admin sheet, optionally persisting the resulting ID.
   * @param {string} folderName - The folder name to create or reuse.
   * @param {string|null} persistConfigKey - Optional configuration key to persist the folder ID against.
   * @return {string|null} The folder ID when created/resolved, else null on failure or when not an admin sheet.
   */
  _ensureAdminSheetFolder(folderName, persistConfigKey = null) {
    if (!Utils.validateIsAdminSheet(false)) return null;
    const logger = ABLogger.getInstance();

    try {
      if (typeof SpreadsheetApp === 'undefined' || typeof DriveManager === 'undefined') {
        return null;
      }
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      if (!spreadsheet || typeof spreadsheet.getId !== 'function') {
        return null;
      }
      const spreadsheetId = spreadsheet.getId();
      const parentFolderId = DriveManager.getParentFolderId(spreadsheetId);
      if (!parentFolderId) {
        return null;
      }
      const folderResult = DriveManager.createFolder(parentFolderId, folderName);
      const folderId = folderResult?.newFolderId;

      if (folderId && persistConfigKey) {
        try {
          this.setProperty(persistConfigKey, folderId);
        } catch (persistError) {
          logger.warn(
            `ConfigurationManager: Failed to persist folder id for "${folderName}".`,
            persistError
          );
        }
      }

      if (folderId) {
        logger.info(
          `ConfigurationManager: Ensured folder "${folderName}" (${folderId}) exists for Admin sheet.`
        );
      }

      return folderId || null;
    } catch (err) {
      logger.warn(`ConfigurationManager: Failed to ensure folder "${folderName}".`, err);
      return null;
    }
  }

  isValidApiKey(apiKey) {
    const pattern = ConfigurationManager.API_KEY_PATTERN;
    return typeof apiKey === 'string' && pattern.test(apiKey.trim());
  }

  isValidGoogleSheetId(sheetId) {
    // Guard: Only touch Drive when explicitly validating. Accept cheap format heuristic first.
    if (!sheetId || typeof sheetId !== 'string') return false;
    const trimmed = sheetId.trim();
    if (!ConfigurationManager.DRIVE_ID_PATTERN.test(trimmed)) return false;
    try {
      if (globalThis.__TRACE_SINGLETON__)
        ABLogger.getInstance().debug(
          '[TRACE][HeavyInit] ConfigurationManager.isValidGoogleSheetId'
        );
      const file = DriveApp.getFileById(trimmed);
      const mime = file && typeof file.getMimeType === 'function' ? file.getMimeType() : '';
      return mime === MimeType.GOOGLE_SHEETS; // explicit equality
    } catch (error) {
      // Keep log concise
      console.error(`Invalid Google Sheet ID: ${error?.message ?? error}`);
      return false;
    }
  }

  isValidGoogleDriveFolderId(folderId) {
    if (!folderId || typeof folderId !== 'string') return false;
    const trimmed = folderId.trim();
    if (!ConfigurationManager.DRIVE_ID_PATTERN.test(trimmed)) return false;
    try {
      if (globalThis.__TRACE_SINGLETON__)
        ABLogger.getInstance().debug(
          '[TRACE][HeavyInit] ConfigurationManager.isValidGoogleDriveFolderId'
        );
      const folder = DriveApp.getFolderById(trimmed);
      return !!folder;
    } catch (error) {
      console.error(`Invalid Google Drive Folder ID: ${error?.message ?? error}`);
      return false;
    }
  }

  toReadableKey(key) {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  }

  getBackendAssessorBatchSize() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
      ConfigurationManager.DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE,
      { min: 1, max: 500 }
    );
  }

  static get DEFAULTS() {
    return {
      BACKEND_ASSESSOR_BATCH_SIZE: 200, //This seems to be the limit before you hit UrlFetchApp rate limits.
      SLIDES_FETCH_BATCH_SIZE: 30,
      DAYS_UNTIL_AUTH_REVOKE: 60,
      UPDATE_DETAILS_URL:
        'https://raw.githubusercontent.com/h-arnold/AssessmentBot/refs/heads/main/src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json',
      UPDATE_STAGE: 0,
      JSON_DB_MASTER_INDEX_KEY: 'ASSESSMENT_BOT_DB_MASTER_INDEX',
      JSON_DB_AUTO_CREATE_COLLECTIONS: true,
      JSON_DB_LOCK_TIMEOUT_MS: 10000,
      JSON_DB_LOG_LEVEL: 'INFO',
      JSON_DB_BACKUP_ON_INITIALISE: false,
      JSON_DB_ROOT_FOLDER_ID: null,
    };
  }

  getSlidesFetchBatchSize() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE,
      ConfigurationManager.DEFAULTS.SLIDES_FETCH_BATCH_SIZE,
      { min: 1, max: 100 }
    );
  }

  getApiKey() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);
  }

  getBackendUrl() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL);
  }

  getRevokeAuthTriggerSet() {
    return ConfigurationManager.toBoolean(
      this.getProperty(ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET)
    );
  }

  getDaysUntilAuthRevoke() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE,
      ConfigurationManager.DEFAULTS.DAYS_UNTIL_AUTH_REVOKE,
      { min: 1, max: 365 }
    );
  }

  getUpdateDetailsUrl() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL);
    return value || ConfigurationManager.DEFAULTS.UPDATE_DETAILS_URL;
  }

  getUpdateStage() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE,
      ConfigurationManager.DEFAULTS.UPDATE_STAGE,
      { min: 0, max: 2 }
    );
  }

  getJsonDbMasterIndexKey() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY);
    return value || ConfigurationManager.DEFAULTS.JSON_DB_MASTER_INDEX_KEY;
  }

  getJsonDbAutoCreateCollections() {
    const value = this.getProperty(
      ConfigurationManager.CONFIG_KEYS.JSON_DB_AUTO_CREATE_COLLECTIONS
    );
    if (value == null || value === '') {
      return ConfigurationManager.DEFAULTS.JSON_DB_AUTO_CREATE_COLLECTIONS;
    }
    return ConfigurationManager.toBoolean(value);
  }

  getJsonDbLockTimeoutMs() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS,
      ConfigurationManager.DEFAULTS.JSON_DB_LOCK_TIMEOUT_MS,
      { min: 1000, max: 600000 }
    );
  }

  getJsonDbLogLevel() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL);
    if (!value) {
      return ConfigurationManager.DEFAULTS.JSON_DB_LOG_LEVEL;
    }
    return String(value).trim().toUpperCase();
  }

  getJsonDbBackupOnInitialise() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE);
    if (value == null || value === '') {
      return ConfigurationManager.DEFAULTS.JSON_DB_BACKUP_ON_INITIALISE;
    }
    return ConfigurationManager.toBoolean(value);
  }

  getJsonDbRootFolderId() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID);
    if (value == null || String(value).trim() === '') {
      const folderId = this._ensureAdminSheetFolder(
        'Assessment Bot Database Files',
        ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID
      );
      return folderId || ConfigurationManager.DEFAULTS.JSON_DB_ROOT_FOLDER_ID;
    }
    return String(value).trim();
  }

  getAssessmentRecordTemplateId() {
    // Simply return the stored property (empty string if unset). Fallback logic is now handled
    // by BaseUpdateAndInit to avoid recursive instantiation between the two classes.
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID);
  }

  /**
   * Returns the configured Assessment Record course ID.
   * Priority: Document Properties -> legacy GoogleClassroomManager.getCourseId() -> null
   * Returns null when no value can be determined (useful for admin sheet behaviour).
   * @returns {string|null}
   */
  getAssessmentRecordCourseId() {
    this.ensureInitialized();

    // 1) Document property (preferred)
    try {
      const docVal = this.documentProperties.getProperty(
        ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_COURSE_ID
      );
      if (docVal != null && String(docVal).trim() !== '') {
        return String(docVal);
      }
    } catch (e) {
      // Swallow and fallback to legacy behaviour
      if (globalThis.__TRACE_SINGLETON__) console.debug('Error reading document property:', e);
    }

    // 2) Legacy: ask GoogleClassroomManager (may throw if sheet is missing) — handle safely
    try {
      if (typeof GoogleClassroomManager === 'function') {
        const gcm = new GoogleClassroomManager();
        if (gcm && typeof gcm.getCourseId === 'function') {
          const legacy = gcm.getCourseId();
          return legacy ? String(legacy) : null;
        }
      }
    } catch (e) {
      // Legacy lookup failed; return null as expected for admin sheet
      if (globalThis.__TRACE_SINGLETON__) console.debug('Legacy getCourseId failed:', e);
    }

    return null;
  }

  /**
   * Stores the Assessment Record course ID as a document property.
   * @param {string|null} courseId
   */
  setAssessmentRecordCourseId(courseId) {
    // Use setProperty which respects CONFIG_SCHEMA (we defined storage=document for this key)
    this.setProperty(ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_COURSE_ID, courseId);
  }

  getAssessmentRecordDestinationFolder() {
    if (Utils.validateIsAdminSheet(false)) {
      let destinationFolder = this.getProperty(
        ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER
      );
      if (!destinationFolder) {
        destinationFolder = this._ensureAdminSheetFolder(
          'Assessment Records',
          ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER
        );
      }
      return destinationFolder;
    }
  }

  getIsAdminSheet() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET) || false;
  }

  getScriptAuthorised() {
    return ConfigurationManager.toBoolean(
      this.getProperty(ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED)
    );
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

  setJsonDbMasterIndexKey(masterIndexKey) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY, masterIndexKey);
  }

  setJsonDbAutoCreateCollections(flag) {
    this.setProperty(
      ConfigurationManager.CONFIG_KEYS.JSON_DB_AUTO_CREATE_COLLECTIONS,
      ConfigurationManager.toBoolean(flag)
    );
  }

  setJsonDbLockTimeoutMs(timeoutMs) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS, timeoutMs);
  }

  setJsonDbLogLevel(logLevel) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL, logLevel);
  }

  setJsonDbBackupOnInitialise(flag) {
    this.setProperty(
      ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE,
      ConfigurationManager.toBoolean(flag)
    );
  }

  setJsonDbRootFolderId(folderId) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID, folderId);
  }

  setIsAdminSheet(isAdmin) {
    this.setProperty(
      ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET,
      ConfigurationManager.toBoolean(isAdmin)
    );
  }

  setRevokeAuthTriggerSet(flag) {
    this.setProperty(
      ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET,
      ConfigurationManager.toBoolean(flag)
    );
  }

  setDaysUntilAuthRevoke(days) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, days);
  }

  // New setter for scriptAuthorised
  setScriptAuthorised(flag) {
    this.setProperty(
      ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED,
      ConfigurationManager.toBoolean(flag)
    );
  }

  /**
   * Helper: normalize truthy/falsey to strict boolean.
   */
  static toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (value == null) return false;
    if (typeof value === 'number') return value !== 0;
    const s = String(value).trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    return Boolean(s);
  }
  static toBooleanString(value) {
    return ConfigurationManager.toBoolean(value) ? 'true' : 'false';
  }

  /** Generic integer accessor with validation and fallback */
  getIntConfig(
    key,
    fallback,
    { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}
  ) {
    const raw = this.getProperty(key);
    const parsed = parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed >= min && parsed <= max) return parsed;
    return fallback;
  }
}

// For module exports (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigurationManager;
}

// Static one-time initialization of CONFIG_KEYS & CONFIG_SCHEMA (frozen)
if (!globalThis.__CONFIG_MANAGER_STATICS_INITIALISED__) {
  ConfigurationManager._CONFIG_KEYS = Object.freeze({
    BACKEND_ASSESSOR_BATCH_SIZE: 'backendAssessorBatchSize',
    SLIDES_FETCH_BATCH_SIZE: 'slidesFetchBatchSize',
    API_KEY: 'apiKey',
    BACKEND_URL: 'backendUrl',
    ASSESSMENT_RECORD_TEMPLATE_ID: 'assessmentRecordTemplateId',
    ASSESSMENT_RECORD_DESTINATION_FOLDER: 'assessmentRecordDestinationFolder',
    ASSESSMENT_RECORD_COURSE_ID: 'assessmentRecordCourseId',
    UPDATE_DETAILS_URL: 'updateDetailsUrl',
    UPDATE_STAGE: 'updateStage',
    IS_ADMIN_SHEET: 'isAdminSheet',
    REVOKE_AUTH_TRIGGER_SET: 'revokeAuthTriggerSet',
    DAYS_UNTIL_AUTH_REVOKE: 'daysUntilAuthRevoke',
    SCRIPT_AUTHORISED: 'scriptAuthorised',
    JSON_DB_MASTER_INDEX_KEY: 'jsonDbMasterIndexKey',
    JSON_DB_AUTO_CREATE_COLLECTIONS: 'jsonDbAutoCreateCollections',
    JSON_DB_LOCK_TIMEOUT_MS: 'jsonDbLockTimeoutMs',
    JSON_DB_LOG_LEVEL: 'jsonDbLogLevel',
    JSON_DB_BACKUP_ON_INITIALISE: 'jsonDbBackupOnInitialise',
    JSON_DB_ROOT_FOLDER_ID: 'jsonDbRootFolderId',
  });
  ConfigurationManager._CONFIG_SCHEMA = Object.freeze({
    [ConfigurationManager._CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: {
      storage: 'script',
      validate: (v) =>
        ConfigurationManager.validateIntegerInRange('Backend Assessor Batch Size', v, 1, 500),
    },
    [ConfigurationManager._CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: {
      storage: 'script',
      validate: (v) =>
        ConfigurationManager.validateIntegerInRange('Slides Fetch Batch Size', v, 1, 100),
    },
    [ConfigurationManager._CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: {
      storage: 'script',
      validate: (v) =>
        ConfigurationManager.validateIntegerInRange('Days Until Auth Revoke', v, 1, 365),
    },
    [ConfigurationManager._CONFIG_KEYS.API_KEY]: {
      storage: 'script',
      validate: ConfigurationManager.validateApiKey,
    },
    [ConfigurationManager._CONFIG_KEYS.BACKEND_URL]: {
      storage: 'script',
      validate: (v) => ConfigurationManager.validateUrl('Backend Url', v),
    },
    [ConfigurationManager._CONFIG_KEYS.UPDATE_DETAILS_URL]: {
      storage: 'script',
      validate: (v) => ConfigurationManager.validateUrl('Update Details Url', v),
    },
    [ConfigurationManager._CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID]: {
      storage: 'script',
      validate: (v, instance) => {
        ConfigurationManager.validateNonEmptyString('Assessment Record Template Id', v);
        if (!instance.isValidGoogleSheetId(v)) {
          throw new Error('Assessment Record Template ID must be a valid Google Sheet ID.');
        }
        return v;
      },
    },
    [ConfigurationManager._CONFIG_KEYS.ASSESSMENT_RECORD_COURSE_ID]: {
      storage: 'document',
      validate: (v) => {
        // Allow empty/null to clear the value; otherwise accept any non-empty string.
        if (v == null || (typeof v === 'string' && v.trim() === '')) return v;
        if (typeof v !== 'string') throw new Error('Assessment Record Course ID must be a string.');
        return v;
      },
    },
    [ConfigurationManager._CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER]: {
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
    [ConfigurationManager._CONFIG_KEYS.UPDATE_STAGE]: {
      storage: 'script',
      validate: (v) => {
        const stage = parseInt(v, 10);
        if (!Number.isInteger(stage) || stage < 0 || stage > 2) {
          throw new Error('Update Stage must be 0, 1, or 2');
        }
        return stage;
      },
    },
    [ConfigurationManager._CONFIG_KEYS.IS_ADMIN_SHEET]: {
      storage: 'document',
      validate: (v) => ConfigurationManager.validateBoolean('Is Admin Sheet', v),
      normalize: ConfigurationManager.toBooleanString,
    },
    [ConfigurationManager._CONFIG_KEYS.SCRIPT_AUTHORISED]: {
      storage: 'document',
      validate: (v) => ConfigurationManager.validateBoolean('Script Authorised', v),
      normalize: ConfigurationManager.toBooleanString,
    },
    [ConfigurationManager._CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: {
      storage: 'document',
      validate: (v) => ConfigurationManager.validateBoolean('Revoke Auth Trigger Set', v),
      normalize: ConfigurationManager.toBooleanString,
    },
    [ConfigurationManager._CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY]: {
      storage: 'script',
      validate: (v) => ConfigurationManager.validateNonEmptyString('JSON DB Master Index Key', v),
    },
    [ConfigurationManager._CONFIG_KEYS.JSON_DB_AUTO_CREATE_COLLECTIONS]: {
      storage: 'script',
      validate: (v) => ConfigurationManager.validateBoolean('JSON DB Auto Create Collections', v),
      normalize: ConfigurationManager.toBooleanString,
    },
    [ConfigurationManager._CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS]: {
      storage: 'script',
      validate: (v) =>
        ConfigurationManager.validateIntegerInRange('JSON DB Lock Timeout (ms)', v, 1000, 600000),
    },
    [ConfigurationManager._CONFIG_KEYS.JSON_DB_LOG_LEVEL]: {
      storage: 'script',
      validate: (v) => ConfigurationManager.validateLogLevel('JSON DB Log Level', v),
      normalize: (v) => ConfigurationManager.validateLogLevel('JSON DB Log Level', v),
    },
    [ConfigurationManager._CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE]: {
      storage: 'script',
      validate: (v) => ConfigurationManager.validateBoolean('JSON DB Backup On Initialise', v),
      normalize: ConfigurationManager.toBooleanString,
    },
    [ConfigurationManager._CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID]: {
      storage: 'script',
      validate: (v, instance) => {
        if (v == null || String(v).trim() === '') {
          return '';
        }
        const trimmed = String(v).trim();
        if (!instance.isValidGoogleDriveFolderId(trimmed)) {
          throw new Error('JSON DB Root Folder ID must be a valid Google Drive Folder ID.');
        }
        return trimmed;
      },
    },
  });
  globalThis.__CONFIG_MANAGER_STATICS_INITIALISED__ = true;
}
