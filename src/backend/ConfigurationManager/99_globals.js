// This file contains all the global functions needed to make use of the ConfigurationManager class.
// Note that the Configuration Manager is instantiated as a singleton in the `singletons.js` file in the `frontend` folder.

const API_KEY_MASK_VISIBLE_SUFFIX_LENGTH = 4;
const API_KEY_MASK_PREFIX = '****';
const DEFAULT_BACKEND_ASSESSOR_BATCH_SIZE = 30;
const DEFAULT_DAYS_UNTIL_AUTH_REVOKE = 60;
const DEFAULT_SLIDES_FETCH_BATCH_SIZE = 20;

/**
 *
 */
function maskApiKey(key) {
  if (!key) return '';
  const asString = String(key);
  if (asString.length <= API_KEY_MASK_VISIBLE_SUFFIX_LENGTH) return API_KEY_MASK_PREFIX;
  return API_KEY_MASK_PREFIX + asString.slice(-API_KEY_MASK_VISIBLE_SUFFIX_LENGTH);
}

/**
 * Retrieves the current configuration settings from the ConfigurationManager.
 * @returns {object} An object containing the current configuration values.
 */
function getConfiguration() {
  const errors = [];

  /**
   *
   */
  function safeGet(getter, name, fallback = '') {
    try {
      return getter();
    } catch (error) {
      ABLogger.getInstance().error('Error retrieving configuration value.', {
        configKey: name,
        errorName: error?.name ?? 'Error',
      });
      errors.push(`${name}: ${error?.message ?? 'REDACTED'}`);
      return fallback;
    }
  }

  const cfg = ConfigurationManager.getInstance();
  const rawApiKey = safeGet(() => cfg.getApiKey(), 'apiKey', '');

  const config = {
    backendAssessorBatchSize: safeGet(
      () => cfg.getBackendAssessorBatchSize(),
      'backendAssessorBatchSize',
      DEFAULT_BACKEND_ASSESSOR_BATCH_SIZE
    ),
    // Return a redacted API key to prevent accidental clear-text logging.
    apiKey: maskApiKey(rawApiKey),
    // Provide a boolean so callers can know whether a key is present without exposing it.
    hasApiKey: !!rawApiKey,
    backendUrl: safeGet(() => cfg.getBackendUrl(), 'backendUrl', ''),
    revokeAuthTriggerSet: safeGet(
      () => cfg.getRevokeAuthTriggerSet(),
      'revokeAuthTriggerSet',
      false
    ),
    daysUntilAuthRevoke: safeGet(
      () => cfg.getDaysUntilAuthRevoke(),
      'daysUntilAuthRevoke',
      DEFAULT_DAYS_UNTIL_AUTH_REVOKE
    ),
    slidesFetchBatchSize: safeGet(
      () => cfg.getSlidesFetchBatchSize(),
      'slidesFetchBatchSize',
      DEFAULT_SLIDES_FETCH_BATCH_SIZE
    ),
    jsonDbMasterIndexKey: safeGet(
      () => cfg.getJsonDbMasterIndexKey(),
      'jsonDbMasterIndexKey',
      ConfigurationManager.DEFAULTS.JSON_DB_MASTER_INDEX_KEY
    ),
    jsonDbLockTimeoutMs: safeGet(
      () => cfg.getJsonDbLockTimeoutMs(),
      'jsonDbLockTimeoutMs',
      ConfigurationManager.DEFAULTS.JSON_DB_LOCK_TIMEOUT_MS
    ),
    jsonDbLogLevel: safeGet(
      () => cfg.getJsonDbLogLevel(),
      'jsonDbLogLevel',
      ConfigurationManager.DEFAULTS.JSON_DB_LOG_LEVEL
    ),
    jsonDbBackupOnInitialise: safeGet(
      () => cfg.getJsonDbBackupOnInitialise(),
      'jsonDbBackupOnInitialise',
      ConfigurationManager.DEFAULTS.JSON_DB_BACKUP_ON_INITIALISE
    ),
    jsonDbRootFolderId: safeGet(() => cfg.getJsonDbRootFolderId(), 'jsonDbRootFolderId', ''),
  };

  if (errors.length > 0) {
    config.loadError = errors.join('; ');
  }

  return config;
}

/**
 * Saves the provided configuration settings using the ConfigurationManager.
 * @param {object} config - The configuration object to be saved.
 * @throws {Error} Throws an error if the configuration fails to save.
 */
function saveConfiguration(config) {
  const errors = [];

  /**
   *
   */
  function safeSet(action, name) {
    try {
      action();
      return true;
    } catch (error) {
      ABLogger.getInstance().error('Error saving configuration value.', {
        configKey: name,
        errorName: error?.name ?? 'Error',
      });
      errors.push(`${name}: REDACTED`);
      return false;
    }
  }

  const setters = [
    [
      'backendAssessorBatchSize',
      (value) => ConfigurationManager.getInstance().setBackendAssessorBatchSize(value),
    ],
    [
      'slidesFetchBatchSize',
      (value) => ConfigurationManager.getInstance().setSlidesFetchBatchSize(value),
    ],
    ['apiKey', (value) => ConfigurationManager.getInstance().setApiKey(value)],
    ['backendUrl', (value) => ConfigurationManager.getInstance().setBackendUrl(value)],
    [
      'revokeAuthTriggerSet',
      (value) => ConfigurationManager.getInstance().setRevokeAuthTriggerSet(value),
    ],
    [
      'daysUntilAuthRevoke',
      (value) => ConfigurationManager.getInstance().setDaysUntilAuthRevoke(value),
    ],
    [
      'jsonDbMasterIndexKey',
      (value) => ConfigurationManager.getInstance().setJsonDbMasterIndexKey(value),
    ],
    [
      'jsonDbLockTimeoutMs',
      (value) => ConfigurationManager.getInstance().setJsonDbLockTimeoutMs(value),
    ],
    ['jsonDbLogLevel', (value) => ConfigurationManager.getInstance().setJsonDbLogLevel(value)],
    [
      'jsonDbBackupOnInitialise',
      (value) => ConfigurationManager.getInstance().setJsonDbBackupOnInitialise(value),
    ],
    [
      'jsonDbRootFolderId',
      (value) => ConfigurationManager.getInstance().setJsonDbRootFolderId(value),
    ],
  ];

  for (const [name, applySetting] of setters) {
    if (config[name] === undefined) {
      continue;
    }
    safeSet(() => applySetting(config[name]), name);
  }

  if (errors.length > 0) {
    const message = `Failed to save some configuration values: ${errors.join('; ')}`;
    ABLogger.getInstance().error(message, { failedSettings: [...errors] });
    return { success: false, error: message };
  }

  ABLogger.getInstance().info('Configuration saved successfully.');
  return { success: true };
}

// Export functions for Node test environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getConfiguration, saveConfiguration };
}
