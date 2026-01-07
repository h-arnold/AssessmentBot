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
    return API_KEY_PATTERN;
  }
  static get DRIVE_ID_PATTERN() {
    // Basic Google drive file/folder id heuristic
    return DRIVE_ID_PATTERN;
  }

  static get JSON_DB_LOG_LEVELS() {
    return JSON_DB_LOG_LEVELS;
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
      } catch (error_) {
        if (globalThis.__TRACE_SINGLETON__) {
          console.debug('Freeze failed ConfigurationManager:', error_?.message || error_);
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
      // Log error via ABLogger
      ABLogger.getInstance().error('ConfigurationManager.maybeDeserializeProperties failed.', err);
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
      try {
        this.scriptProperties.setProperty(key, String(value));
      } catch (persistError) {
        ABLogger.getInstance().error(
          `ConfigurationManager: Failed to persist configuration key "${key}".`,
          { key, cause: persistError }
        );
        throw persistError;
      }
      this.configCache = null;
      return;
    }

    const canonical = spec.validate ? spec.validate(value, this) : value;
    const normalizedValue = spec.normalize ? spec.normalize(canonical) : canonical;

    const store = spec.storage === 'document' ? this.documentProperties : this.scriptProperties;
    try {
      store.setProperty(key, String(normalizedValue));
    } catch (persistError) {
      ABLogger.getInstance().error(
        `ConfigurationManager: Failed to persist configuration key "${key}".`,
        { key, cause: persistError }
      );
      throw persistError;
    }

    if (spec.storage === 'document') {
      return;
    }

    this.configCache = null;
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
      // Per project contract: assume Apps Script and internal singletons exist and let
      // any failures surface. Retrieve the active spreadsheet and its parent folder,
      // then create or reuse the named folder.
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const spreadsheetId = spreadsheet.getId();
      const parentFolderId = DriveManager.getParentFolderId(spreadsheetId);
      if (!parentFolderId) return null;
      const folderResult = DriveManager.createFolder(parentFolderId, folderName);
      const folderId = folderResult?.newFolderId;

      // If we successfully resolved/created a folder, always log that fact.
      // Persist the id only when a persistence key is provided. The previous
      // inner `if (folderId)` was redundant because we're already inside a
      // branch where folderId is truthy.
      if (folderId) {
        if (persistConfigKey) {
          try {
            this.setProperty(persistConfigKey, folderId);
          } catch (persistError) {
            // Log persistence error
            ABLogger.getInstance().error(
              `ConfigurationManager: Failed to persist folder id for "${folderName}".`,
              { key: persistConfigKey, cause: persistError }
            );
          }
        }

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

  getBackendAssessorBatchSize() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
      ConfigurationManager.DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE,
      { min: 1, max: 500 }
    );
  }

  static get DEFAULTS() {
    return DEFAULTS;
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
   * Returns the Class Info object { ClassName, CourseId, YearGroup }.
   * Lazy migration: If not in properties, tries to read from legacy ClassInfo sheet,
   * populates properties, and deletes the sheet.
   * @returns {Object|null} Class info object with ClassName, CourseId, and YearGroup properties, or null if unavailable.
   */
  getClassInfo() {
    this.ensureInitialized();

    // 1. Check Document Properties
    const jsonString = this.documentProperties.getProperty(
      ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_CLASS_INFO
    );

    if (jsonString) {
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        ABLogger.getInstance().error('Failed to parse Assessment Record Class Info', e);
        return null;
      }
    }

    // 2. Migration Logic
    const gcm = new GoogleClassroomManager();
    // Check if we can get course ID from legacy method (which reads sheet)
    // We use try-catch because getCourseId might throw if sheet is missing/invalid,
    // in which case we just return null (no migration possible).
    let courseId;
    try {
      courseId = gcm.getCourseId();
    } catch (error_) {
      // The AdminSheet isn't assigned a class by default.
      if (!isAdminSheet) {
        ABLogger.getInstance().error(
          `No Class Information in Document Properties or 'ClassInfo' sheet.`,
          e
        );
        throw error_;
      }

      ABLogger.getInstance().warn(
        `No Document Properties or 'ClassInfo' sheet to pull class information from.`
      );
      // Sheet missing or invalid, cannot migrate.
      return null;
    }

    if (courseId) {
      // Fetch additional details
      let className = 'Unknown Class';
      try {
        const course = ClassroomApiClient.fetchCourse(courseId);
        if (course?.name) {
          className = course.name;
        }
      } catch (e) {
        ABLogger.getInstance().warn('Could not fetch course details during migration', e);
      }

      const classInfo = {
        ClassName: className,
        CourseId: String(courseId),
        YearGroup: null, // Default as per requirements
      };

      this.setClassInfo(classInfo);

      // Delete legacy sheet
      gcm.deleteClassInfoSheet();

      ABLogger.getInstance().info(
        'Migrated Class Info from Sheet to DocumentProperties',
        classInfo
      );
      return classInfo;
    }

    return null;
  }

  /**
   * Sets the Class Info object to document properties.
   * @param {Object} classInfo - Class information object.
   * @param {string} classInfo.ClassName - The name of the class.
   * @param {string} classInfo.CourseId - The Google Classroom course ID.
   * @param {number|null} classInfo.YearGroup - The year group of the class (optional).
   */
  setClassInfo(classInfo) {
    Validate.requireParams({ classInfo }, 'setClassInfo');

    // Validate structure
    if (typeof classInfo !== 'object' || classInfo === null || Array.isArray(classInfo)) {
      throw new TypeError('classInfo must be an object');
    }

    Validate.requireParams(
      { ClassName: classInfo.ClassName, CourseId: classInfo.CourseId },
      'setClassInfo'
    );

    const jsonString = JSON.stringify(classInfo);
    this.setProperty(ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_CLASS_INFO, jsonString);
  }

  /**
   * Returns the configured Assessment Record course ID.
   * Priority: Document Properties -> legacy GoogleClassroomManager.getCourseId() -> null
   * Returns null when no value can be determined (useful for admin sheet behaviour).
   * @returns {string|null}
   */
  getAssessmentRecordCourseId() {
    const info = this.getClassInfo();
    return info ? info.CourseId : null;
  }

  /**
   * Stores the Assessment Record course ID as a document property.
   * @deprecated Use setClassInfo() instead to set the complete class information object.
   *             This method will be removed in a future version once all callers are migrated.
   * @param {string|null} courseId
   */
  setAssessmentRecordCourseId(courseId) {
    const currentInfo = this.getClassInfo() || {
      ClassName: 'Unknown',
      CourseId: null,
      YearGroup: null,
    };
    // Create a new object to avoid mutating cached data
    const updatedInfo = {
      ClassName: currentInfo.ClassName,
      CourseId: courseId,
      YearGroup: currentInfo.YearGroup,
    };
    this.setClassInfo(updatedInfo);
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

  /**
   * Helper: normalize truthy/falsey to strict boolean.
   */
  static toBoolean(value) {
    return toBoolean(value);
  }
  static toBooleanString(value) {
    return toBooleanString(value);
  }

  /** Generic integer accessor with validation and fallback */
  getIntConfig(
    key,
    fallback,
    { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}
  ) {
    const raw = this.getProperty(key);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed >= min && parsed <= max) return parsed;
    return fallback;
  }
}

// When running under Node (tests) bring in the supporting constants and helpers
// from sibling modules. In Apps Script these are expected to be available on
// the global scope so we only require them for the test environment to avoid
// changing runtime behaviour.
if (typeof module !== 'undefined' && module.exports) {
  const { CONFIG_KEYS: _CK, CONFIG_SCHEMA: _CS } = require('./configKeysAndSchema');
  const { DEFAULTS: _DEF } = require('./defaults');
  const validators = require('./validators');

  CONFIG_KEYS = _CK;
  CONFIG_SCHEMA = _CS;
  DEFAULTS = _DEF;
  API_KEY_PATTERN = validators.API_KEY_PATTERN;
  DRIVE_ID_PATTERN = validators.DRIVE_ID_PATTERN;
  JSON_DB_LOG_LEVELS = validators.JSON_DB_LOG_LEVELS;
  toBoolean = validators.toBoolean;
  toBooleanString = validators.toBooleanString;
}

ConfigurationManager._CONFIG_KEYS = CONFIG_KEYS;
ConfigurationManager._CONFIG_SCHEMA = CONFIG_SCHEMA;

if (!globalThis.__CONFIG_MANAGER_STATICS_INITIALISED__) {
  globalThis.__CONFIG_MANAGER_STATICS_INITIALISED__ = true;
}

// For module exports (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigurationManager;
}
