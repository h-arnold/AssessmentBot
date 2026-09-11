const {
  DEFAULTS: CONFIGURATION_MANAGER_DEFAULTS,
} = require('../../src/backend/ConfigurationManager/02_defaults.js');

function buildBackendConfigResponse(overrides = {}) {
  // Settled 12 non-auth field read contract (SPEC Section 6): auth fields are
  // read exclusively through the dedicated auth endpoints.
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
    authGroupEmail: '',
    authMode: 'googleGroups',
    ...getterValues,
  };

  const manager = {
    // The stored auth configuration is exposed to the AuthService gate. These
    // transport tests are not auth-focused, so unless a test supplies auth
    // fields explicitly, the stored state models a valid configured googleGroups
    // install (the default group email) and the fail-closed gate allows the
    // default teacher member.
    getAllConfigurations: vi.fn(() => {
      const supplied = options.allConfigurations ?? {};
      const hasAuthFields =
        Object.hasOwn(supplied, 'authMode') || Object.hasOwn(supplied, 'authGroupEmail');
      return {
        ...supplied,
        ...(hasAuthFields
          ? {}
          : { authMode: 'googleGroups', authGroupEmail: 'teachers@school.edu' }),
      };
    }),
    isFreshInstall: vi.fn(() => false),
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
    getAuthGroupEmail: vi.fn(() => (hasPersistedConfiguration ? values.authGroupEmail : '')),
    getAuthMode: vi.fn(() => (hasPersistedConfiguration ? values.authMode : 'googleGroups')),
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
    setAuthGroupEmail: vi.fn(setterImplementations.setAuthGroupEmail || (() => {})),
    setAuthMode: vi.fn(setterImplementations.setAuthMode || (() => {})),
    // Section 6 locked-write seam: setBackendConfig_ collapses every ordinary
    // multi-field save into ONE atomic writeConfigurationLocked(mutator) call,
    // so write-path tests assert against this mock instead of per-field setters.
    // Override via setterImplementations.writeConfigurationLocked to inject
    // persistence/validation failures at the seam.
    writeConfigurationLocked: vi.fn(setterImplementations.writeConfigurationLocked || (() => {})),
    // Section 6 validation seam: setBackendConfig_ stages each supplied field
    // through the manager-owned preparePropertyValue(key, value) seam before the
    // single locked write. This mock passes values through unchanged (mirroring
    // the mock manager's role as a transport-level contract stub); CONFIG_SCHEMA
    // validation/normalisation is exercised by the real ConfigurationManager
    // suites, not duplicated here.
    preparePropertyValue: vi.fn((_configKey, value) => value),
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

/**
 * Backs the mocked Script Properties with an in-memory store so the serialised
 * config blob is visible to the locked-write re-read (GAS persistence
 * semantics).
 * @param {Object} scriptPropertiesMocks - Mocked scriptProperties get/set spies.
 * @param {Object} options - Fixture configuration.
 * @param {string} options.configStoreKey - The single blob key (`CONFIG_STORE_KEY`).
 * @param {Object} [options.initialConfig] - Optional seed config; omit for a fresh install.
 * @returns {Object} The mutable store keyed by `configStoreKey`.
 */
function installInMemoryScriptProperties(
  scriptPropertiesMocks,
  { configStoreKey, initialConfig } = {}
) {
  const store = {};
  if (initialConfig !== undefined) {
    store[configStoreKey] = JSON.stringify(initialConfig);
  }
  scriptPropertiesMocks.getProperty.mockImplementation((key) =>
    Object.hasOwn(store, key) ? store[key] : null
  );
  scriptPropertiesMocks.setProperty.mockImplementation((key, value) => {
    store[key] = value;
  });
  return store;
}

/**
 * Seeds mocked Script Properties with a complete serialised configuration blob,
 * overridable per test.
 * @param {Object} scriptPropertiesMocks - Mocked scriptProperties get/set spies.
 * @param {Object} ConfigurationManager - The ConfigurationManager class (for CONFIG_KEYS).
 * @param {Object} [overrides] - Stored value overrides.
 * @returns {Object} The stored config object.
 */
function installStoredConfig(scriptPropertiesMocks, ConfigurationManager, overrides = {}) {
  const storedConfig = {
    [ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: '42',
    [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: '24',
    [ConfigurationManager.CONFIG_KEYS.API_KEY]: 'live-secret-7890',
    [ConfigurationManager.CONFIG_KEYS.BACKEND_URL]: 'https://backend.example.test',
    [ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'true',
    [ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: '15',
    [ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY]: 'MASTER_INDEX_X',
    [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS]: '30000',
    [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL]: 'warn',
    [ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE]: 'true',
    [ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID]: ' folder-123 ',
    ...overrides,
  };
  scriptPropertiesMocks.getProperty.mockReturnValue(JSON.stringify(storedConfig));
  return storedConfig;
}

/**
 * Installs a script-wide lock mock whose default `waitLock` succeeds. Individual
 * tests may make `waitLock` throw to simulate contention.
 * @param {typeof import('vitest')} vi - Vitest instance.
 * @returns {Object} `{ lockMock, scriptLockFactory, restore }`.
 */
function installScriptLockMock(vi) {
  const lockMock = {
    waitLock: vi.fn(() => {}),
    releaseLock: vi.fn(() => {}),
  };
  const scriptLockFactory = vi.fn(() => lockMock);
  const originalLockService = globalThis.LockService;
  globalThis.LockService = { ...originalLockService, getScriptLock: scriptLockFactory };
  return {
    lockMock,
    scriptLockFactory,
    restore() {
      globalThis.LockService = originalLockService;
    },
  };
}

module.exports = {
  CONFIGURATION_MANAGER_DEFAULTS,
  buildBackendConfigResponse,
  buildDefaultBackendConfigStore,
  createConfigurationManagerMock,
  createConfiguredConfigurationManager,
  installInMemoryScriptProperties,
  installScriptLockMock,
  installStoredConfig,
};
