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

/**
 *
 */
function safeGetPropertyKeys(store) {
  if (!store) return [];
  try {
    return store.getKeys ? store.getKeys() : [];
  } catch (error) {
    if (globalThis.__TRACE_SINGLETON__)
      ABLogger.getInstance().debug(
        '[TRACE_SINGLETON][ConfigurationManager.safeGetPropertyKeys] safeGetPropertyKeys error:',
        error?.message ?? error
      );
    return [];
  }
}

/**
 *
 */
function safeParseConfigObject(serializedConfig) {
  if (serializedConfig == null || serializedConfig === '') {
    return {};
  }

  try {
    const parsed = JSON.parse(serializedConfig);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

/**
 *
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
    return ConfigurationManager._API_KEY_PATTERN || API_KEY_PATTERN;
  }
  /**
   *
   */
  static get DRIVE_ID_PATTERN() {
    // Basic Google drive file/folder id heuristic
    return ConfigurationManager._DRIVE_ID_PATTERN || DRIVE_ID_PATTERN;
  }

  /**
   *
   */
  static get JSON_DB_LOG_LEVELS() {
    return ConfigurationManager._JSON_DB_LOG_LEVELS || JSON_DB_LOG_LEVELS;
  }

  /**
   *
   */
  static get CONFIG_STORE_KEY() {
    return ConfigurationManager._CONFIG_STORE_KEY || '__CONFIG_STORE_KEY__';
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

  /**
   *
   */
  static get CONFIG_KEYS() {
    return ConfigurationManager._CONFIG_KEYS || CONFIG_KEYS;
  }
  /**
   *
   */
  static get CONFIG_SCHEMA() {
    return ConfigurationManager._CONFIG_SCHEMA || CONFIG_SCHEMA;
  }

  /**
   * Attempts to deserialize properties from a propertiesStore sheet if no script or document properties are found.
   * This method checks if there are existing script or document properties. If neither is found, it attempts to
   * initialize properties from a 'propertiesStore' sheet using the PropertiesCloner. If the sheet exists and the
   * deserialization is successful, it logs a success message. If the 'propertiesStore' sheet is not found, it
   * logs an appropriate message. Any errors during the process are caught and logged.
   */
  maybeDeserializeProperties() {
    try {
      const hasScript = safeGetPropertyKeys(this.scriptProperties).length > 0;
      const hasDocument = safeGetPropertyKeys(this.documentProperties).length > 0;
      if (hasScript || hasDocument) return; // early return – nothing to do

      const propertiesCloner = new PropertiesCloner();
      if (propertiesCloner.sheet) {
        propertiesCloner.deserialiseProperties();
        ABLogger.getInstance().log('Successfully copied properties from propertiesStore');
      } else {
        ABLogger.getInstance().log('No propertiesStore sheet found');
      }
    } catch (error) {
      // Log error via ABLogger
      ABLogger.getInstance().error(
        'ConfigurationManager.maybeDeserializeProperties failed.',
        error
      );
    }
  }

  /**
   *
   */
  getAllConfigurations() {
    this.ensureInitialized();
    if (!this.configCache) {
      this.configCache = safeParseConfigObject(
        this.scriptProperties.getProperty(ConfigurationManager.CONFIG_STORE_KEY)
      );
    }
    return this.configCache;
  }

  /**
   *
   */
  hasProperty(key) {
    this.getAllConfigurations();
    return Object.hasOwn(this.configCache, key);
  }

  /**
   *
   */
  getProperty(key) {
    this.ensureInitialized();
    this.getAllConfigurations();
    return this.configCache[key] || '';
  }

  /**
   *
   */
  setProperty(key, value) {
    this.ensureInitialized();
    this.getAllConfigurations();
    const spec = ConfigurationManager.CONFIG_SCHEMA[key];
    const canonical = spec && spec.validate ? spec.validate(value, this) : value;
    const normalizedValue = spec && spec.normalize ? spec.normalize(canonical) : canonical;

    this.configCache[key] = String(normalizedValue);

    try {
      this.scriptProperties.setProperty(
        ConfigurationManager.CONFIG_STORE_KEY,
        JSON.stringify(this.configCache)
      );
    } catch (persistError) {
      ABLogger.getInstance().error(
        `ConfigurationManager: Failed to persist configuration key "${key}".`,
        { key, cause: persistError }
      );
      throw persistError;
    }
  }

  /**
   *
   */
  isValidApiKey(apiKey) {
    const pattern = ConfigurationManager.API_KEY_PATTERN;
    return Validate.isString(apiKey) && pattern.test(apiKey.trim());
  }

  /**
   *
   */
  isValidGoogleDriveFolderId(folderId) {
    if (!folderId || !Validate.isString(folderId)) return false;
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

  /**
   *
   */
  getBackendAssessorBatchSize() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
      ConfigurationManager.DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE,
      { min: 1, max: 500 }
    );
  }

  /**
   *
   */
  static get DEFAULTS() {
    return ConfigurationManager._DEFAULTS || DEFAULTS;
  }

  /**
   *
   */
  getSlidesFetchBatchSize() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE,
      ConfigurationManager.DEFAULTS.SLIDES_FETCH_BATCH_SIZE,
      { min: 1, max: 100 }
    );
  }

  /**
   *
   */
  getApiKey() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);
  }

  /**
   *
   */
  getBackendUrl() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL);
  }

  /**
   *
   */
  getRevokeAuthTriggerSet() {
    return ConfigurationManager.toBoolean(
      this.getProperty(ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET)
    );
  }

  /**
   *
   */
  getDaysUntilAuthRevoke() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE,
      ConfigurationManager.DEFAULTS.DAYS_UNTIL_AUTH_REVOKE,
      { min: 1, max: 365 }
    );
  }

  /**
   *
   */
  getJsonDbMasterIndexKey() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY);
    return value || ConfigurationManager.DEFAULTS.JSON_DB_MASTER_INDEX_KEY;
  }

  /**
   *
   */
  getJsonDbLockTimeoutMs() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS,
      ConfigurationManager.DEFAULTS.JSON_DB_LOCK_TIMEOUT_MS,
      { min: 1000, max: 600000 }
    );
  }

  /**
   *
   */
  getJsonDbLogLevel() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL);
    if (!value) {
      return ConfigurationManager.DEFAULTS.JSON_DB_LOG_LEVEL;
    }
    return String(value).trim().toUpperCase();
  }

  /**
   *
   */
  getJsonDbBackupOnInitialise() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE);
    if (value == null || value === '') {
      return ConfigurationManager.DEFAULTS.JSON_DB_BACKUP_ON_INITIALISE;
    }
    return ConfigurationManager.toBoolean(value);
  }

  /**
   *
   */
  getJsonDbRootFolderId() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID);
    if (value == null || String(value).trim() === '') {
      return ConfigurationManager.DEFAULTS.JSON_DB_ROOT_FOLDER_ID;
    }
    return String(value).trim();
  }

  /**
   *
   */
  getIsAdminSheet() {
    return false;
  }

  /**
   *
   */
  setBackendAssessorBatchSize(batchSize) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE, batchSize);
  }

  /**
   *
   */
  setSlidesFetchBatchSize(batchSize) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE, batchSize);
  }

  /**
   *
   */
  setApiKey(apiKey) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, apiKey);
  }

  /**
   *
   */
  setBackendUrl(url) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL, url);
  }

  /**
   *
   */
  setJsonDbMasterIndexKey(masterIndexKey) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY, masterIndexKey);
  }

  /**
   *
   */
  setJsonDbLockTimeoutMs(timeoutMs) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS, timeoutMs);
  }

  /**
   *
   */
  setJsonDbLogLevel(logLevel) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL, logLevel);
  }

  /**
   *
   */
  setJsonDbBackupOnInitialise(flag) {
    this.setProperty(
      ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE,
      ConfigurationManager.toBoolean(flag)
    );
  }

  /**
   *
   */
  setJsonDbRootFolderId(folderId) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID, folderId);
  }

  /**
   *
   */
  setIsAdminSheet(isAdmin) {
    return ConfigurationManager.toBoolean(isAdmin);
  }

  /**
   *
   */
  setRevokeAuthTriggerSet(flag) {
    this.setProperty(
      ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET,
      ConfigurationManager.toBoolean(flag)
    );
  }

  /**
   *
   */
  setDaysUntilAuthRevoke(days) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, days);
  }

  /**
   * Helper: normalize truthy/falsey to strict boolean.
   */
  static toBoolean(value) {
    const toBooleanFunction = ConfigurationManager._toBoolean || toBoolean;
    return toBooleanFunction(value);
  }
  /**
   *
   */
  static toBooleanString(value) {
    const toBooleanStringFunction = ConfigurationManager._toBooleanString || toBooleanString;
    return toBooleanStringFunction(value);
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
  const { CONFIG_KEYS: _CK, CONFIG_SCHEMA: _CS } = require('./01_configKeysAndSchema');
  const { DEFAULTS: _DEF } = require('./02_defaults');
  const validators = require('./03_validators');

  ConfigurationManager._CONFIG_KEYS = _CK;
  ConfigurationManager._CONFIG_SCHEMA = _CS;
  ConfigurationManager._DEFAULTS = _DEF;
  ConfigurationManager._API_KEY_PATTERN = validators.API_KEY_PATTERN;
  ConfigurationManager._DRIVE_ID_PATTERN = validators.DRIVE_ID_PATTERN;
  ConfigurationManager._JSON_DB_LOG_LEVELS = validators.JSON_DB_LOG_LEVELS;
  ConfigurationManager._CONFIG_STORE_KEY = '__CONFIG_STORE_KEY__';
  ConfigurationManager._toBoolean = validators.toBoolean;
  ConfigurationManager._toBooleanString = validators.toBooleanString;
}

if (!globalThis.__CONFIG_MANAGER_STATICS_INITIALISED__) {
  globalThis.__CONFIG_MANAGER_STATICS_INITIALISED__ = true;
}

// For module exports (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigurationManager;
}
