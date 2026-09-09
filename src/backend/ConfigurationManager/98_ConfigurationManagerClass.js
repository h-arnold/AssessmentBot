/* global ABLogger, BaseSingleton, ConfigurationManagerStorage, ConfigurationManagerDefaults,
   ConfigurationManagerLockedWrite, DriveApp, GASPropertiesUtils, LockService, MAX_CONFIG_BLOB_BYTES,
   PropertiesService, safeParseConfigObject_, Validate */

/**
 * @class ConfigurationManager
 * @description Facade for application configuration. Preserves the full public surface and delegates storage,
 *   default seeding, and the locked write path to numbered sub-classes (96_ConfigurationManagerStorage.js,
 *   97_ConfigurationManagerDefaults.js, 97_ConfigurationManagerLockedWrite.js). Every write serialises through
 *   writeConfigurationLocked, which acquires the script-wide LockService.getScriptLock() (the same lock the vendored
 *   JsonDbApp DbLockService uses), re-reads the RAW blob under the lock, runs the mutator, enforces the 8KB cap, and
 *   commits once. The lock is not reentrant; callers must never write config while a DB operation already holds it.
 */
class ConfigurationManager extends BaseSingleton {
  /**
   * Constructs the ConfigurationManager facade, wiring the delegated sub-classes.
   * @param {boolean} [isSingletonCreator=false] - Whether this instance is the singleton creator.
   * @param {Object} [options={}] - Dependency-injection overrides for testing (storage/defaults/lock sub-classes).
   * @returns {void} No return value.
   */
  constructor(isSingletonCreator = false, options = {}) {
    super(isSingletonCreator);
    this._initialized = false;
    this.configCache = null;
    this._storage = options.storage ?? new ConfigurationManagerStorage(this);
    this._defaults = options.defaults ?? new ConfigurationManagerDefaults(this);
    this._lockedWrite = options.lock ?? new ConfigurationManagerLockedWrite(this);
  }
  /** Initialises handles on first access; safe to call multiple times.
   * @returns {void} No return value. */
  ensureInitialized() {
    if (this._initialized) return;
    this.scriptProperties = this.scriptProperties || GASPropertiesUtils.getScriptProperties();
    if (globalThis.__TRACE_SINGLETON__)
      ABLogger.getInstance().debug('[TRACE][HeavyInit] ConfigurationManager.ensureInitialized');
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
  /** Gets the configuration keys constant.
   * @returns {Object} The config keys. */
  static get CONFIG_KEYS() {
    return ConfigurationManager._CONFIG_KEYS || CONFIG_KEYS;
  }
  /** Gets the configuration schema constant.
   * @returns {Object} The config schema. */
  static get CONFIG_SCHEMA() {
    return ConfigurationManager._CONFIG_SCHEMA || CONFIG_SCHEMA;
  }
  /** Gets the API key validation pattern.
   * @returns {RegExp} The API key pattern. */
  static get API_KEY_PATTERN() {
    return ConfigurationManager._API_KEY_PATTERN || API_KEY_PATTERN;
  }
  /** Gets the Google Drive folder ID validation pattern.
   * @returns {RegExp} The folder ID pattern. */
  static get DRIVE_ID_PATTERN() {
    return ConfigurationManager._DRIVE_ID_PATTERN || DRIVE_ID_PATTERN;
  }
  /** Gets the JSON DB log levels constant.
   * @returns {Object} The log levels. */
  static get JSON_DB_LOG_LEVELS() {
    return ConfigurationManager._JSON_DB_LOG_LEVELS || JSON_DB_LOG_LEVELS;
  }
  /** Gets the Script Properties key for the config blob.
   * @returns {string} The store key. */
  static get CONFIG_STORE_KEY() {
    return ConfigurationManager._CONFIG_STORE_KEY || '__CONFIG_STORE_KEY__';
  }
  /** Returns the cached config, deserialising from storage on first access.
   * @returns {Object} The config object. */
  getAllConfigurations() {
    this.ensureInitialized();
    if (!this.configCache) {
      this.configCache = safeParseConfigObject_(
        this.scriptProperties.getProperty(ConfigurationManager.CONFIG_STORE_KEY)
      );
    }
    return this.configCache;
  }
  /** Seeds default backend configuration once, then returns the cache.
   * @returns {Object} The config cache. */
  ensureDefaultConfiguration() {
    return this._defaults.ensureDefaultConfiguration();
  }
  /** The single serialisation point for all configuration writes.
   * @param {function(Object):Object} mutator - Produces next config from current.
   * @returns {void} No return value. */
  writeConfigurationLocked(mutator) {
    this._lockedWrite.writeConfigurationLocked(mutator);
  }
  /** Freshness probe; reads RAW storage, never the cache.
   * @returns {boolean} True when the key is absent. */
  isFreshInstall() {
    return this._lockedWrite.isFreshInstall();
  }
  /** Checks whether a property exists.
   * @param {string} key - The configuration property key to check.
   * @returns {boolean} True if present. */
  hasProperty(key) {
    this.getAllConfigurations();
    return Object.hasOwn(this.configCache, key);
  }
  /** Retrieves a property value as a string.
   * @param {string} key - The configuration property key to retrieve.
   * @returns {string} The value, or empty string. */
  getProperty(key) {
    this.ensureInitialized();
    this.getAllConfigurations();
    return this.configCache[key] || '';
  }
  /**
   * Validates and normalises a property value through CONFIG_SCHEMA, returning the
   * exact serialised value that `setProperty` persists.
   *
   * @remarks
   * Manager-owned seam exposed so transport callers (e.g. `setBackendConfig_` in
   * apiConfig.js) can validate/normalise every staged field up front and then commit
   * the whole patch through a single `writeConfigurationLocked` call. This keeps
   * domain validation inside ConfigurationManager rather than duplicating the
   * CONFIG_SCHEMA rules at the API layer.
   * @param {string} key - The configuration property key.
   * @param {*} value - The value to validate and normalise.
   * @returns {string} The serialised value to persist.
   * @throws {Error} When the value fails CONFIG_SCHEMA validation. */
  preparePropertyValue(key, value) {
    this.ensureInitialized();
    this.getAllConfigurations();
    const spec = ConfigurationManager.CONFIG_SCHEMA[key];
    const canonical = spec?.validate ? spec.validate(value, this) : value;
    const normalisedValue = spec?.normalise ? spec.normalise(canonical) : canonical;
    return String(normalisedValue);
  }
  /**
   * Sets a property via schema validation then the locked write path.
   * @param {string} key - The configuration property key.
   * @param {*} value - The value to set.
   * @returns {void} No return value.
   * @throws {Error} If persistence to script properties fails. */
  setProperty(key, value) {
    const serialisedValue = this.preparePropertyValue(key, value);
    // The locked write path re-reads the RAW blob under the lock; use that fresh
    // snapshot as the merge base so a concurrent writer's changes are never clobbered.
    this.writeConfigurationLocked((current) => ({ ...current, [key]: serialisedValue }));
  }
  /** Validates an API key against the configured pattern.
   * @param {string} apiKey - The API key to validate.
   * @returns {boolean} True if valid. */
  isValidApiKey(apiKey) {
    const pattern = ConfigurationManager.API_KEY_PATTERN;
    return Validate.isString(apiKey) && pattern.test(apiKey.trim());
  }
  /** Validates a Google Drive folder ID by format and DriveApp access.
   * @param {string} folderId - The Google Drive folder ID to validate.
   * @returns {boolean} True if valid and accessible. */
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
  /** Gets the backend assessor batch size.
   * @returns {number} Backend assessor batch size (1–500). */
  getBackendAssessorBatchSize() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
      ConfigurationManager.DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE,
      { min: 1, max: 500 }
    );
  }
  /** Gets the default configuration values.
   * @returns {Object} The default values. */
  static get DEFAULTS() {
    return ConfigurationManager._DEFAULTS || DEFAULTS;
  }
  /** Gets the Slides fetch batch size.
   * @returns {number} Slides fetch batch size (1–100). */
  getSlidesFetchBatchSize() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE,
      ConfigurationManager.DEFAULTS.SLIDES_FETCH_BATCH_SIZE,
      { min: 1, max: 100 }
    );
  }
  /** Gets the configured API key.
   * @returns {string} The API key. */
  getApiKey() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);
  }
  /** Gets the auth group email (empty when unset).
   * @returns {string} The auth group email. */
  getAuthGroupEmail() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL);
  }
  /** Stores the Google Group email.
   * @param {string} value - The Google Group email to store.
   * @returns {void} No return value. */
  setAuthGroupEmail(value) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL, value);
  }
  /**
   * Forgiving transport getter; never throws. Returns a valid stored mode (`googleGroups`/`scriptProperties`),
   * or applies the single leniency (absent/blank mode paired with a non-blank group email reads as `googleGroups`);
   * otherwise `null`.
   * @returns {'googleGroups'|'scriptProperties'|null} The active auth mode, or null when unresolved. */
  getAuthMode() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.AUTH_MODE);
    if (value === 'googleGroups' || value === 'scriptProperties') return value;
    if (value !== '') return null;
    const group = this.getProperty(ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL);
    if (String(group).trim() !== '') return 'googleGroups';
    return null;
  }
  /** Stores the authentication mode.
   * @param {'googleGroups'|'scriptProperties'} value - The auth mode to store.
   * @returns {void} No return value.
   * @throws {Error} If invalid. */
  setAuthMode(value) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.AUTH_MODE, value);
  }
  /** Gets the backend URL.
   * @returns {string} The backend URL. */
  getBackendUrl() {
    return this.getProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL);
  }
  /** Tells whether the revoke-auth trigger is set.
   * @returns {boolean} True if set. */
  getRevokeAuthTriggerSet() {
    return ConfigurationManager.toBoolean(
      this.getProperty(ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET)
    );
  }
  /** Gets days until auth revoke.
   * @returns {number} Days until auth revoke (1–365). */
  getDaysUntilAuthRevoke() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE,
      ConfigurationManager.DEFAULTS.DAYS_UNTIL_AUTH_REVOKE,
      { min: 1, max: 365 }
    );
  }
  /** Gets the JSON DB master index key (or default).
   * @returns {string} The master index key. */
  getJsonDbMasterIndexKey() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY);
    return value || ConfigurationManager.DEFAULTS.JSON_DB_MASTER_INDEX_KEY;
  }
  /** Gets the JSON DB lock timeout in ms.
   * @returns {number} Timeout in ms (1000–600000). */
  getJsonDbLockTimeoutMs() {
    return this.getIntConfig(
      ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS,
      ConfigurationManager.DEFAULTS.JSON_DB_LOCK_TIMEOUT_MS,
      { min: 1000, max: 600000 }
    );
  }
  /** Gets the JSON DB log level in uppercase (or default).
   * @returns {string} The log level. */
  getJsonDbLogLevel() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL);
    if (!value) return ConfigurationManager.DEFAULTS.JSON_DB_LOG_LEVEL;
    return String(value).trim().toUpperCase();
  }
  /** Tells whether JSON DB backups on initialise.
   * @returns {boolean} True if enabled. */
  getJsonDbBackupOnInitialise() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE);
    if (value == null || value === '')
      return ConfigurationManager.DEFAULTS.JSON_DB_BACKUP_ON_INITIALISE;
    return ConfigurationManager.toBoolean(value);
  }
  /** Gets the JSON DB root folder ID (or default).
   * @returns {string} The folder ID. */
  getJsonDbRootFolderId() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID);
    if (value == null || String(value).trim() === '')
      return ConfigurationManager.DEFAULTS.JSON_DB_ROOT_FOLDER_ID;
    return String(value).trim();
  }
  /** Stores the backend assessor batch size.
   * @param {number} batchSize - Backend assessor batch size.
   * @returns {void} No return value. */
  setBackendAssessorBatchSize(batchSize) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE, batchSize);
  }
  /** Stores the Slides fetch batch size.
   * @param {number} batchSize - Slides fetch batch size.
   * @returns {void} No return value. */
  setSlidesFetchBatchSize(batchSize) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE, batchSize);
  }
  /** Stores the API key.
   * @param {string} apiKey - The API key to store.
   * @returns {void} No return value. */
  setApiKey(apiKey) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, apiKey);
  }
  /** Stores the backend URL.
   * @param {string} url - The backend URL to store.
   * @returns {void} No return value. */
  setBackendUrl(url) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL, url);
  }
  /** Stores the JSON DB master index key.
   * @param {string} masterIndexKey - The master index key.
   * @returns {void} No return value. */
  setJsonDbMasterIndexKey(masterIndexKey) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY, masterIndexKey);
  }
  /** Stores the JSON DB lock timeout in ms.
   * @param {number} timeoutMs - JSON DB lock timeout in ms.
   * @returns {void} No return value. */
  setJsonDbLockTimeoutMs(timeoutMs) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS, timeoutMs);
  }
  /** Stores the JSON DB log level.
   * @param {string} logLevel - JSON DB log level (INFO/DEBUG/WARN/ERROR).
   * @returns {void} No return value. */
  setJsonDbLogLevel(logLevel) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL, logLevel);
  }
  /** Enables or disables JSON DB backup on initialise.
   * @param {boolean} flag - Enable backup on initialise.
   * @returns {void} No return value. */
  setJsonDbBackupOnInitialise(flag) {
    this.setProperty(
      ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE,
      ConfigurationManager.toBoolean(flag)
    );
  }
  /** Stores the JSON DB root folder ID.
   * @param {string} folderId - The JSON DB root folder ID.
   * @returns {void} No return value. */
  setJsonDbRootFolderId(folderId) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID, folderId);
  }
  /** Activates or deactivates the revoke-auth trigger.
   * @param {boolean} flag - Activate the revoke-auth trigger.
   * @returns {void} No return value. */
  setRevokeAuthTriggerSet(flag) {
    this.setProperty(
      ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET,
      ConfigurationManager.toBoolean(flag)
    );
  }
  /** Stores days until auth revoke.
   * @param {number} days - Days until auth revoke.
   * @returns {void} No return value. */
  setDaysUntilAuthRevoke(days) {
    this.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, days);
  }
  /** Converts a value to a strict boolean.
   * @param {*} value - The value to convert.
   * @returns {boolean} The boolean representation. */
  static toBoolean(value) {
    const toBooleanFunction = ConfigurationManager._toBoolean || toBoolean_;
    return toBooleanFunction(value);
  }
  /** Converts a value to its boolean string form.
   * @param {*} value - The value to convert.
   * @returns {string} The string representation ('true'/'false'). */
  static toBooleanString(value) {
    const toBooleanStringFunction = ConfigurationManager._toBooleanString || toBooleanString_;
    return toBooleanStringFunction(value);
  }
  /**
   * Retrieves an integer config with range validation and default fallback.
   * @param {string} key - The config key.
   * @param {number} fallback - The default when parsing fails or value is out of range.
   * @param {Object} [options={}] - Range validation options.
   * @param {number} [options.min=Number.MIN_SAFE_INTEGER] - Minimum allowed value (inclusive).
   * @param {number} [options.max=Number.MAX_SAFE_INTEGER] - Maximum allowed value (inclusive).
   * @returns {number} The parsed integer, or the fallback. */
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

// Node/Vitest wiring: constants, helpers and sub-classes come from the global scope via numeric-prefix load
// order in GAS; this block only runs under Node and attaches them to globalThis.
if (typeof module !== 'undefined' && module.exports) {
  const schema = require('./01_configKeysAndSchema');
  const { DEFAULTS: _DEF } = require('./02_defaults');
  const validators = require('./03_validators');
  const storage = require('./96_ConfigurationManagerStorage');
  const defaultsConcern = require('./97_ConfigurationManagerDefaults');
  const lockedWrite = require('./97_ConfigurationManagerLockedWrite');
  Object.assign(ConfigurationManager, {
    _CONFIG_KEYS: schema.CONFIG_KEYS,
    _CONFIG_SCHEMA: schema.CONFIG_SCHEMA,
    _DEFAULTS: _DEF,
    _API_KEY_PATTERN: validators.API_KEY_PATTERN,
    _DRIVE_ID_PATTERN: validators.DRIVE_ID_PATTERN,
    _JSON_DB_LOG_LEVELS: validators.JSON_DB_LOG_LEVELS,
    _CONFIG_STORE_KEY: '__CONFIG_STORE_KEY__',
    _toBoolean: validators.toBoolean_,
    _toBooleanString: validators.toBooleanString_,
  });
  Object.assign(globalThis, {
    ConfigurationManagerStorage: storage.ConfigurationManagerStorage,
    ConfigurationManagerDefaults: defaultsConcern.ConfigurationManagerDefaults,
    ConfigurationManagerLockedWrite: lockedWrite.ConfigurationManagerLockedWrite,
    safeParseConfigObject_: storage.safeParseConfigObject_,
    MAX_CONFIG_BLOB_BYTES: schema.MAX_CONFIG_BLOB_BYTES,
  });
  module.exports = ConfigurationManagerProxy;
}

if (!globalThis.__CONFIG_MANAGER_STATICS_INITIALISED__) {
  globalThis.__CONFIG_MANAGER_STATICS_INITIALISED__ = true;
}

if (typeof globalThis !== 'undefined') {
  globalThis.ConfigurationManager = ConfigurationManagerProxy;
}
