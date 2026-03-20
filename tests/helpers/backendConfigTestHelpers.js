const {
  DEFAULTS: CONFIGURATION_MANAGER_DEFAULTS,
} = require('../../src/backend/ConfigurationManager/02_defaults.js');

function buildBackendConfigResponse(overrides = {}) {
  return {
    backendAssessorBatchSize: 30,
    apiKey: '****7890',
    hasApiKey: true,
    backendUrl: 'https://backend.example.test',
    revokeAuthTriggerSet: true,
    daysUntilAuthRevoke: 45,
    slidesFetchBatchSize: 20,
    jsonDbMasterIndexKey: 'MASTER_INDEX',
    jsonDbLockTimeoutMs: 5000,
    jsonDbLogLevel: 'INFO',
    jsonDbBackupOnInitialise: false,
    jsonDbRootFolderId: 'folder-123',
    ...overrides,
  };
}

function buildDefaultBackendConfigStore(ConfigurationManager) {
  return {
    [ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: String(
      CONFIGURATION_MANAGER_DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE
    ),
    [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: String(
      CONFIGURATION_MANAGER_DEFAULTS.SLIDES_FETCH_BATCH_SIZE
    ),
    [ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'false',
    [ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: String(
      CONFIGURATION_MANAGER_DEFAULTS.DAYS_UNTIL_AUTH_REVOKE
    ),
    [ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY]:
      CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_MASTER_INDEX_KEY,
    [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS]: String(
      CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_LOCK_TIMEOUT_MS
    ),
    [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL]:
      CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_LOG_LEVEL,
    [ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE]: String(
      CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_BACKUP_ON_INITIALISE
    ),
  };
}

function createConfigurationManagerMock(
  vi,
  getterValues = {},
  setterImplementations = {},
  options = {}
) {
  const originalConfigurationManager = globalThis.ConfigurationManager;
  const hasPersistedConfiguration =
    options.allConfigurations === undefined
      ? true
      : Object.keys(options.allConfigurations).length > 0;
  const values = {
    apiKey: 'live-secret-7890',
    backendAssessorBatchSize: 30,
    backendUrl: 'https://backend.example.test',
    revokeAuthTriggerSet: true,
    daysUntilAuthRevoke: 45,
    slidesFetchBatchSize: 20,
    jsonDbMasterIndexKey: 'MASTER_INDEX',
    jsonDbLockTimeoutMs: 5000,
    jsonDbLogLevel: 'INFO',
    jsonDbBackupOnInitialise: false,
    jsonDbRootFolderId: 'folder-123',
    ...getterValues,
  };

  const manager = {
    getAllConfigurations: vi.fn(() => options.allConfigurations ?? {}),
    ensureDefaultConfiguration: vi.fn(
      setterImplementations.ensureDefaultConfiguration || (() => {})
    ),
    getApiKey: vi.fn(() => (hasPersistedConfiguration ? values.apiKey : '')),
    getBackendAssessorBatchSize: vi.fn(() =>
      hasPersistedConfiguration
        ? values.backendAssessorBatchSize
        : CONFIGURATION_MANAGER_DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE
    ),
    getBackendUrl: vi.fn(() => (hasPersistedConfiguration ? values.backendUrl : '')),
    getRevokeAuthTriggerSet: vi.fn(() =>
      hasPersistedConfiguration ? values.revokeAuthTriggerSet : false
    ),
    getDaysUntilAuthRevoke: vi.fn(() =>
      hasPersistedConfiguration
        ? values.daysUntilAuthRevoke
        : CONFIGURATION_MANAGER_DEFAULTS.DAYS_UNTIL_AUTH_REVOKE
    ),
    getSlidesFetchBatchSize: vi.fn(() =>
      hasPersistedConfiguration
        ? values.slidesFetchBatchSize
        : CONFIGURATION_MANAGER_DEFAULTS.SLIDES_FETCH_BATCH_SIZE
    ),
    getJsonDbMasterIndexKey: vi.fn(() =>
      hasPersistedConfiguration
        ? values.jsonDbMasterIndexKey
        : CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_MASTER_INDEX_KEY
    ),
    getJsonDbLockTimeoutMs: vi.fn(() =>
      hasPersistedConfiguration
        ? values.jsonDbLockTimeoutMs
        : CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_LOCK_TIMEOUT_MS
    ),
    getJsonDbLogLevel: vi.fn(() =>
      hasPersistedConfiguration
        ? values.jsonDbLogLevel
        : CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_LOG_LEVEL
    ),
    getJsonDbBackupOnInitialise: vi.fn(() =>
      hasPersistedConfiguration
        ? values.jsonDbBackupOnInitialise
        : CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_BACKUP_ON_INITIALISE
    ),
    getJsonDbRootFolderId: vi.fn(() =>
      hasPersistedConfiguration
        ? values.jsonDbRootFolderId
        : CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_ROOT_FOLDER_ID
    ),
    setBackendAssessorBatchSize: vi.fn(
      setterImplementations.setBackendAssessorBatchSize || (() => {})
    ),
    setSlidesFetchBatchSize: vi.fn(setterImplementations.setSlidesFetchBatchSize || (() => {})),
    setApiKey: vi.fn(setterImplementations.setApiKey || (() => {})),
    setBackendUrl: vi.fn(setterImplementations.setBackendUrl || (() => {})),
    setRevokeAuthTriggerSet: vi.fn(setterImplementations.setRevokeAuthTriggerSet || (() => {})),
    setDaysUntilAuthRevoke: vi.fn(setterImplementations.setDaysUntilAuthRevoke || (() => {})),
    setJsonDbMasterIndexKey: vi.fn(setterImplementations.setJsonDbMasterIndexKey || (() => {})),
    setJsonDbLockTimeoutMs: vi.fn(setterImplementations.setJsonDbLockTimeoutMs || (() => {})),
    setJsonDbLogLevel: vi.fn(setterImplementations.setJsonDbLogLevel || (() => {})),
    setJsonDbBackupOnInitialise: vi.fn(
      setterImplementations.setJsonDbBackupOnInitialise || (() => {})
    ),
    setJsonDbRootFolderId: vi.fn(setterImplementations.setJsonDbRootFolderId || (() => {})),
  };

  globalThis.ConfigurationManager = {
    DEFAULTS: CONFIGURATION_MANAGER_DEFAULTS,
    getInstance: vi.fn(() => manager),
  };

  return {
    manager,
    configurationManager: globalThis.ConfigurationManager,
    restore() {
      if (originalConfigurationManager === undefined) {
        delete globalThis.ConfigurationManager;
        return;
      }

      globalThis.ConfigurationManager = originalConfigurationManager;
    },
  };
}

function createConfiguredConfigurationManager(vi, ConfigurationManager, options = {}) {
  const {
    mockConsole = true,
    scriptPropertyValue = null,
    documentPropertyValue = false,
    isValidUrlReturnValue = true,
    configCache = null,
  } = options;

  const { setupGlobalGASMocks } = require('./mockFactories.js');
  const mocks = setupGlobalGASMocks(vi, { mockConsole });

  vi.clearAllMocks();
  ConfigurationManager.resetForTests();

  mocks.PropertiesService.documentProperties.getProperty.mockReturnValue(documentPropertyValue);
  mocks.PropertiesService.scriptProperties.getProperty.mockReturnValue(scriptPropertyValue);
  mocks.Utils.isValidUrl.mockReturnValue(isValidUrlReturnValue);

  const configManager = new ConfigurationManager(true);
  configManager.scriptProperties = mocks.PropertiesService.scriptProperties;
  configManager.documentProperties = mocks.PropertiesService.documentProperties;
  configManager._initialized = true;
  configManager.configCache = configCache;

  return { mocks, configManager };
}

module.exports = {
  CONFIGURATION_MANAGER_DEFAULTS,
  buildBackendConfigResponse,
  buildDefaultBackendConfigStore,
  createConfigurationManagerMock,
  createConfiguredConfigurationManager,
};
