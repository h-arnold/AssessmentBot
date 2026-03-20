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
 * const config = ConfigurationManager.getInstance();
 * const backendAssessorBatchSize = config.getBackendAssessorBatchSize();
 * config.setLangflowApiKey('sk-abc123');
 */

/**
 * Safely retrieves property keys from a given property store.
 * Returns an empty array if the store is invalid or retrieval fails.
 * @param {Object} store - The property store object (or null).
 * @returns {Array<string>} Array of property keys, or empty array on failure.
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
 * Safely parses a serialised configuration object from JSON.
 * Returns an empty object if parsing fails or input is invalid.
 * @param {string} serialisedConfig - Serialised JSON configuration string.
 * @returns {Object} Parsed configuration object, or empty object on failure.
 */
function safeParseConfigObject(serialisedConfig) {
  if (serialisedConfig == null || serialisedConfig === '') {
    return {};
  }

  try {
    const parsed = JSON.parse(serialisedConfig);
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
   * Initialises the ConfigurationManager singleton.
   * NOTE: Do NOT perform any heavy work (PropertiesService access, deserialisation)
   * in the constructor. Use ConfigurationManager.getInstance() to obtain the singleton.
   * All getters/setters will transparently call ensureInitialized() before touching persisted state.
   * The constructor is intentionally lightweight so tests can assert no side-effects before first real use.
   * @param {boolean} isSingletonCreator - Indicates if this is the initial singleton creation.
   */
  constructor(isSingletonCreator = false) {
    super();
    /**
     * JSDoc Singleton Banner
     * Use ConfigurationManager.getInstance(); do not call constructor directly.
     */
    // Defer PropertiesService access & deserialisation
    this.scriptProperties = null;
    this.documentProperties = null;
    this.configCache = null;
    this._initialized = false;
    if (!ConfigurationManager._instance) {
      ConfigurationManager._instance = this;
    }
  }

  /**
   * Resets the singleton cache for tests.
   * @returns {void}
   */
  static resetForTests() {
    super.resetForTests();
    ConfigurationManager._instance = null;
  }

  /**
   * Gets the API key pattern regex.
   * Alphanumeric segments separated by single hyphens; no leading/trailing/consecutive hyphens.
   * @returns {RegExp} Pattern for validating API keys.
   */
  static get API_KEY_PATTERN() {
    // Alphanumeric segments separated by single hyphens; no leading/trailing/consecutive hyphens
    return ConfigurationManager._API_KEY_PATTERN || API_KEY_PATTERN;
  }
  /**
   * Gets the Google Drive folder/file ID pattern regex.
   * @returns {RegExp} Pattern for validating Google Drive folder/file IDs.
   */
  static get DRIVE_ID_PATTERN() {
    // Basic Google drive file/folder id heuristic
    return ConfigurationManager._DRIVE_ID_PATTERN || DRIVE_ID_PATTERN;
  }

  /**
   * Gets the supported JSON database log levels.
   * @returns {Array<string>} Array of valid log level strings.
   */
  static get JSON_DB_LOG_LEVELS() {
    return ConfigurationManager._JSON_DB_LOG_LEVELS || JSON_DB_LOG_LEVELS;
  }

  /**
   * Gets the configuration store key used for persisting all settings.
   * @returns {string} The key for retrieving stored configuration data.
   */
  static get CONFIG_STORE_KEY() {
    return ConfigurationManager._CONFIG_STORE_KEY || '__CONFIG_STORE_KEY__';
  }

  /**
   * Canonical accessor – always use this instead of `new`.
   */

  /**
   * Initialises the ConfigurationManager on first access to Apps Script services.
   * Safe to call multiple times; performs lazy initialisation of PropertiesService handles and property deserialisation only once.
   * @returns {void}
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
          ABLogger.getInstance().debug(
            'Freeze failed ConfigurationManager:',
            error_?.message || error_
          );
        }
      }
    }
  }

  /**
   * Gets the configuration keys constant.
   * @returns {Object} Object mapping configuration key names to their identifiers.
   */
  static get CONFIG_KEYS() {
    return ConfigurationManager._CONFIG_KEYS || CONFIG_KEYS;
  }
  /**
   * Gets the configuration schema constant.
   * @returns {Object} Object defining validation and normalisation rules for each configuration key.
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
   * Retrieves all cached configuration properties, deserialising from storage if necessary.
   * Lazy-loads the configuration cache on first access.
   * @returns {Object} The complete configuration object mapping all configuration keys to their current values.
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
   * Persists the default backend configuration the first time it is needed.
   * Returns immediately when any configuration has already been stored.
   * @returns {Object} The current configuration cache.
   */
  ensureDefaultConfiguration() {
    const config = this.getAllConfigurations();
    if (Object.keys(config).length > 0) {
      return config;
    }

    this.setBackendAssessorBatchSize(this.getBackendAssessorBatchSize());
    this.setSlidesFetchBatchSize(this.getSlidesFetchBatchSize());
    this.setRevokeAuthTriggerSet(this.getRevokeAuthTriggerSet());
    this.setDaysUntilAuthRevoke(this.getDaysUntilAuthRevoke());
    this.setJsonDbMasterIndexKey(this.getJsonDbMasterIndexKey());
    this.setJsonDbLockTimeoutMs(this.getJsonDbLockTimeoutMs());
    this.setJsonDbLogLevel(this.getJsonDbLogLevel());
    this.setJsonDbBackupOnInitialise(this.getJsonDbBackupOnInitialise());

    return this.configCache;
  }

  /**
   * Checks whether a configuration property exists in the cache.
   * @param {string} key - The configuration property key to check.
   * @returns {boolean} True if the property exists; false otherwise.
   */
  hasProperty(key) {
    this.getAllConfigurations();
    return Object.hasOwn(this.configCache, key);
  }

  /**
   * Retrieves a configuration property value as a string.
   * Returns an empty string if the property does not exist.
   * @param {string} key - The configuration property key to retrieve.
   * @returns {string} The property value, or empty string if not found.
   */
  getProperty(key) {
    this.ensureInitialized();
    this.getAllConfigurations();
    return this.configCache[key] || '';
  }

  /**
   * Sets a configuration property value, with validation and normalisation according to the configuration schema.
   * Persists the updated configuration to script properties and updates the local cache.
   * @param {string} key - The configuration property key to set.
   * @param {*} value - The value to set. Will be validated and normalised according to the schema definition.
   * @returns {void}
   * @throws {Error} If persistence to script properties fails.
   */
  setProperty(key, value) {
    this.ensureInitialized();
    this.getAllConfigurations();
    const spec = ConfigurationManager.CONFIG_SCHEMA[key];
    const canonical = spec?.validate ? spec.validate(value, this) : value;
    const normalizedValue = spec?.normalize ? spec.normalize(canonical) : canonical;
    const serialisedValue = String(normalizedValue);
    const updatedConfig = {
      ...this.configCache,
      [key]: serialisedValue,
    };

    try {
      this.scriptProperties.setProperty(
        ConfigurationManager.CONFIG_STORE_KEY,
        JSON.stringify(updatedConfig)
      );
      this.configCache[key] = serialisedValue;
    } catch (persistError) {
      ABLogger.getInstance().error(
        `ConfigurationManager: Failed to persist configuration key "${key}".`,
        { key, cause: persistError }
      );
      throw persistError;
    }
  }

  /**
   * Validates an API key against the configured API key pattern.
   * @param {string} apiKey - The API key string to validate.
   * @returns {boolean} True if the API key matches the validation pattern; false otherwise.
   */
  isValidApiKey(apiKey) {
    const pattern = ConfigurationManager.API_KEY_PATTERN;
    return Validate.isString(apiKey) && pattern.test(apiKey.trim());
  }

  /**
   * Validates a Google Drive folder ID by checking its format and verifying it exists via DriveApp.
   * @param {string} folderId - The Google Drive folder ID to validate.
   * @returns {boolean} True if the folder ID is valid and accessible; false otherwise.
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
      ABLogger.getInstance().warn('Invalid Google Drive Folder ID.', {
        folderId: trimmed,
        err: error,
      });
      return false;
    }
  }

  /**
   * Retrieves the configured batch size for backend assessor operations.
   * @returns {number} The batch size, constrained between 1 and 500.
   */
  getBackendAssessorBatchSize() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
      ConfigurationManager.DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE,
      { min: 1, max: 500 }
    );
  }

  /**
   * Gets the default configuration values across all configuration keys.
   * @returns {Object} Object containing default values for all configuration keys.
   */
  static get DEFAULTS() {
    return ConfigurationManager._DEFAULTS || DEFAULTS;
  }

  /**
   * Retrieves the configured batch size for Slides fetch operations.
   * @returns {number} The batch size, constrained between 1 and 100.
   */
  getSlidesFetchBatchSize() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE,
      ConfigurationManager.DEFAULTS.SLIDES_FETCH_BATCH_SIZE,
      { min: 1, max: 100 }
    );
  }

  /**
   * Retrieves the configured API key for external service authentication.
   * @returns {string} The API key, or empty string if not configured.
   */
  getApiKey() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);
  }

  /**
   * Retrieves the configured URL for the backend service endpoint.
   * @returns {string} The backend URL, or empty string if not configured.
   */
  getBackendUrl() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL);
  }

  /**
   * Retrieves whether the authentication revocation trigger is currently active.
   * @returns {boolean} True if the revoke auth trigger is set; false otherwise.
   */
  getRevokeAuthTriggerSet() {
    return ConfigurationManager.toBoolean(
      this.getProperty(ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET)
    );
  }

  /**
   * Retrieves the number of days until authentication credentials are automatically revoked.
   * @returns {number} The number of days, constrained between 1 and 365.
   */
  getDaysUntilAuthRevoke() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE,
      ConfigurationManager.DEFAULTS.DAYS_UNTIL_AUTH_REVOKE,
      { min: 1, max: 365 }
    );
  }

  /**
   * Retrieves the master index key for the JSON database.
   * @returns {string} The master index key, or the default if not configured.
   */
  getJsonDbMasterIndexKey() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY);
    return value || ConfigurationManager.DEFAULTS.JSON_DB_MASTER_INDEX_KEY;
  }

  /**
   * Retrieves the lock acquisition timeout for JSON database operations in milliseconds.
   * @returns {number} The timeout in milliseconds, constrained between 1000 and 600000.
   */
  getJsonDbLockTimeoutMs() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS,
      ConfigurationManager.DEFAULTS.JSON_DB_LOCK_TIMEOUT_MS,
      { min: 1000, max: 600000 }
    );
  }

  /**
   * Retrieves the log level for JSON database operations.
   * @returns {string} The log level in uppercase (INFO, DEBUG, WARN, ERROR), or the default if not configured.
   */
  getJsonDbLogLevel() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL);
    if (!value) {
      return ConfigurationManager.DEFAULTS.JSON_DB_LOG_LEVEL;
    }
    return String(value).trim().toUpperCase();
  }

  /**
   * Retrieves whether the JSON database performs automatic backup on initialisation.
   * @returns {boolean} True if backup on initialisation is enabled; false otherwise.
   */
  getJsonDbBackupOnInitialise() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE);
    if (value == null || value === '') {
      return ConfigurationManager.DEFAULTS.JSON_DB_BACKUP_ON_INITIALISE;
    }
    return ConfigurationManager.toBoolean(value);
  }

  /**
   * Retrieves the Google Drive folder ID where JSON database files are stored.
   * @returns {string} The folder ID, or the default if not configured.
   */
  getJsonDbRootFolderId() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID);
    if (value == null || String(value).trim() === '') {
      return ConfigurationManager.DEFAULTS.JSON_DB_ROOT_FOLDER_ID;
    }
    return String(value).trim();
  }

  /**
   * Sets the batch size for backend assessor operations.
   * @param {number} batchSize - The batch size to configure, typically between 1 and 500.
   * @returns {void}
   */
  setBackendAssessorBatchSize(batchSize) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE, batchSize);
  }

  /**
   * Sets the batch size for Slides fetch operations.
   * @param {number} batchSize - The batch size to configure, typically between 1 and 100.
   * @returns {void}
   */
  setSlidesFetchBatchSize(batchSize) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE, batchSize);
  }

  /**
   * Sets the API key for external service authentication.
   * @param {string} apiKey - The API key to store.
   * @returns {void}
   */
  setApiKey(apiKey) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, apiKey);
  }

  /**
   * Sets the URL for the backend service endpoint.
   * @param {string} url - The backend URL to store.
   * @returns {void}
   */
  setBackendUrl(url) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL, url);
  }

  /**
   * Sets the master index key for the JSON database.
   * @param {string} masterIndexKey - The master index key to store.
   * @returns {void}
   */
  setJsonDbMasterIndexKey(masterIndexKey) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY, masterIndexKey);
  }

  /**
   * Sets the lock acquisition timeout for JSON database operations in milliseconds.
   * @param {number} timeoutMs - The timeout duration in milliseconds.
   * @returns {void}
   */
  setJsonDbLockTimeoutMs(timeoutMs) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS, timeoutMs);
  }

  /**
   * Sets the log level for JSON database operations.
   * @param {string} logLevel - The log level to configure (INFO, DEBUG, WARN, ERROR).
   * @returns {void}
   */
  setJsonDbLogLevel(logLevel) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL, logLevel);
  }

  /**
   * Configures whether the JSON database performs automatic backup on initialisation.
   * @param {boolean} flag - True to enable backup on initialisation; false to disable.
   * @returns {void}
   */
  setJsonDbBackupOnInitialise(flag) {
    this.setProperty(
      ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE,
      ConfigurationManager.toBoolean(flag)
    );
  }

  /**
   * Sets the Google Drive folder ID where JSON database files are stored.
   * @param {string} folderId - The folder ID to store.
   * @returns {void}
   */
  setJsonDbRootFolderId(folderId) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID, folderId);
  }

  /**
   * Configures whether the authentication revocation trigger is active.
   * @param {boolean} flag - True to activate the revoke auth trigger; false to deactivate.
   * @returns {void}
   */
  setRevokeAuthTriggerSet(flag) {
    this.setProperty(
      ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET,
      ConfigurationManager.toBoolean(flag)
    );
  }

  /**
   * Sets the number of days until authentication credentials are automatically revoked.
   * @param {number} days - The number of days until revocation, typically between 1 and 365.
   * @returns {void}
   */
  setDaysUntilAuthRevoke(days) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, days);
  }

  /**
   * Converts a value to a strict boolean, treating truthy/falsy values according to conversion rules.
   * @param {*} value - The value to convert to a boolean.
   * @returns {boolean} The boolean representation of the input value.
   */
  static toBoolean(value) {
    const toBooleanFunction = ConfigurationManager._toBoolean || toBoolean;
    return toBooleanFunction(value);
  }
  /**
   * Converts a value to a string representation of a boolean.
   * @param {*} value - The value to convert.
   * @returns {string} The string representation of the boolean value (e.g., 'true' or 'false').
   */
  static toBooleanString(value) {
    const toBooleanStringFunction = ConfigurationManager._toBooleanString || toBooleanString;
    return toBooleanStringFunction(value);
  }

  /**
   * Retrieves an integer configuration value with validation and fallback to a default.
   * Parses the property value as an integer and validates it falls within the specified range.
   * @param {string} key - The configuration property key to retrieve.
   * @param {number} fallback - The default value to return if parsing fails or value is out of range.
   * @param {Object} options - Range validation options.
   * @param {number} [options.min=Number.MIN_SAFE_INTEGER] - Minimum allowed value (inclusive).
   * @param {number} [options.max=Number.MAX_SAFE_INTEGER] - Maximum allowed value (inclusive).
   * @returns {number} The parsed integer value if valid; otherwise the fallback value.
   */
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

const ConfigurationManagerProxy = new Proxy(ConfigurationManager, {
  construct(target, arguments_, newTarget) {
    if (target._instance) {
      return target._instance;
    }

    const instance = Reflect.construct(target, arguments_, newTarget);
    target._instance = instance;
    return instance;
  },
});

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
  module.exports = ConfigurationManagerProxy;
}

if (typeof globalThis !== 'undefined') {
  globalThis.ConfigurationManager = ConfigurationManagerProxy;
}
