import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';

const { loadApiHandlerModule } = require('../helpers/apiHandlerTestUtils.js');

const CONFIGURATION_MANAGER_DEFAULTS = Object.freeze({
  BACKEND_ASSESSOR_BATCH_SIZE: 120,
  SLIDES_FETCH_BATCH_SIZE: 30,
  DAYS_UNTIL_AUTH_REVOKE: 60,
  JSON_DB_MASTER_INDEX_KEY: 'MASTER_INDEX',
  JSON_DB_LOCK_TIMEOUT_MS: 15000,
  JSON_DB_LOG_LEVEL: 'INFO',
  JSON_DB_BACKUP_ON_INITIALISE: false,
  JSON_DB_ROOT_FOLDER_ID: null,
});

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

function installConfigurationManagerMock(
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

const legacyConfigurationGlobalsPath = new URL(
  '../../src/backend/ConfigurationManager/99_globals.js',
  import.meta.url
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backend configuration API transport', () => {
  it('returns masked backend configuration data through apiHandler', () => {
    const configurationManagerMock = installConfigurationManagerMock(
      {
        apiKey: 'live-secret-7890',
      },
      {},
      { allConfigurations: { apiKey: 'live-secret-7890' } }
    );

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getBackendConfig',
      });

      expect(configurationManagerMock.configurationManager.getInstance).toHaveBeenCalledTimes(1);
      expect(configurationManagerMock.manager.ensureDefaultConfiguration).toHaveBeenCalledTimes(1);
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: buildBackendConfigResponse(),
      });
      expect(response.requestId).toEqual(expect.any(String));
      expect(response.data.apiKey).toBe('****7890');
      expect(response.data.apiKey).not.toContain('live-secret-7890');
      expect(response.data.hasApiKey).toBe(true);
      expect(response.data).not.toHaveProperty('loadError');
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('seeds and returns default backend configuration when nothing has been saved yet', () => {
    const configurationManagerMock = installConfigurationManagerMock(
      {},
      {},
      { allConfigurations: {} }
    );

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getBackendConfig',
      });

      expect(configurationManagerMock.configurationManager.getInstance).toHaveBeenCalledTimes(1);
      expect(configurationManagerMock.manager.ensureDefaultConfiguration).toHaveBeenCalledTimes(1);
      expect(configurationManagerMock.manager.setBackendAssessorBatchSize).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setSlidesFetchBatchSize).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setRevokeAuthTriggerSet).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setDaysUntilAuthRevoke).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setJsonDbMasterIndexKey).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setJsonDbLockTimeoutMs).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setJsonDbLogLevel).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setJsonDbBackupOnInitialise).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setApiKey).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setBackendUrl).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setJsonDbRootFolderId).not.toHaveBeenCalled();
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: buildBackendConfigResponse({
          backendAssessorBatchSize: CONFIGURATION_MANAGER_DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE,
          apiKey: '',
          hasApiKey: false,
          backendUrl: '',
          revokeAuthTriggerSet: false,
          daysUntilAuthRevoke: CONFIGURATION_MANAGER_DEFAULTS.DAYS_UNTIL_AUTH_REVOKE,
          slidesFetchBatchSize: CONFIGURATION_MANAGER_DEFAULTS.SLIDES_FETCH_BATCH_SIZE,
          jsonDbMasterIndexKey: CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_MASTER_INDEX_KEY,
          jsonDbLockTimeoutMs: CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_LOCK_TIMEOUT_MS,
          jsonDbLogLevel: CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_LOG_LEVEL,
          jsonDbBackupOnInitialise: CONFIGURATION_MANAGER_DEFAULTS.JSON_DB_BACKUP_ON_INITIALISE,
          jsonDbRootFolderId: '',
        }),
      });
      expect(response.requestId).toEqual(expect.any(String));
      expect(response.data).not.toHaveProperty('loadError');
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('does not seed defaults when backend configuration already exists', () => {
    const configurationManagerMock = installConfigurationManagerMock(
      {
        apiKey: 'live-secret-7890',
        backendUrl: 'https://backend.example.test',
        revokeAuthTriggerSet: true,
        daysUntilAuthRevoke: 45,
        slidesFetchBatchSize: 20,
        jsonDbMasterIndexKey: 'MASTER_INDEX',
        jsonDbLockTimeoutMs: 5000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: false,
        jsonDbRootFolderId: '',
      },
      {},
      { allConfigurations: { backendUrl: 'https://backend.example.test' } }
    );

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getBackendConfig',
      });

      expect(configurationManagerMock.configurationManager.getInstance).toHaveBeenCalledTimes(1);
      expect(configurationManagerMock.manager.ensureDefaultConfiguration).toHaveBeenCalledTimes(1);
      expect(configurationManagerMock.manager.setBackendAssessorBatchSize).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setSlidesFetchBatchSize).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setRevokeAuthTriggerSet).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setDaysUntilAuthRevoke).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setJsonDbMasterIndexKey).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setJsonDbLockTimeoutMs).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setJsonDbLogLevel).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setJsonDbBackupOnInitialise).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setApiKey).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setBackendUrl).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setJsonDbRootFolderId).not.toHaveBeenCalled();
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: buildBackendConfigResponse({
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
          jsonDbRootFolderId: '',
        }),
      });
      expect(response.requestId).toEqual(expect.any(String));
      expect(response.data).not.toHaveProperty('loadError');
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('applies only defined backend configuration updates through apiHandler', () => {
    const configurationManagerMock = installConfigurationManagerMock();

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();
      const params = {
        backendAssessorBatchSize: 42,
        backendUrl: 'https://updated-backend.example.test',
        daysUntilAuthRevoke: 21,
      };

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params,
      });

      expect(configurationManagerMock.configurationManager.getInstance).toHaveBeenCalled();
      expect(configurationManagerMock.manager.setBackendAssessorBatchSize).toHaveBeenCalledWith(42);
      expect(configurationManagerMock.manager.setBackendUrl).toHaveBeenCalledWith(
        'https://updated-backend.example.test'
      );
      expect(configurationManagerMock.manager.setDaysUntilAuthRevoke).toHaveBeenCalledWith(21);
      expect(configurationManagerMock.manager.setApiKey).not.toHaveBeenCalled();
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: { success: true },
      });
      expect(response.requestId).toEqual(expect.any(String));
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('does not call setters for undefined setBackendConfig fields', () => {
    const configurationManagerMock = installConfigurationManagerMock();

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: {
          backendAssessorBatchSize: 18,
          apiKey: undefined,
          backendUrl: undefined,
          jsonDbRootFolderId: undefined,
        },
      });

      expect(configurationManagerMock.manager.setBackendAssessorBatchSize).toHaveBeenCalledWith(18);
      expect(configurationManagerMock.manager.setApiKey).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setBackendUrl).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setJsonDbRootFolderId).not.toHaveBeenCalled();
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: { success: true },
      });
      expect(response.requestId).toEqual(expect.any(String));
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('reports failed backend configuration writes through apiHandler', () => {
    const configurationManagerMock = installConfigurationManagerMock(
      {},
      {
        setApiKey: () => {
          throw new Error('persist failed');
        },
      }
    );

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: {
          apiKey: 'new-secret',
          backendUrl: 'https://updated-backend.example.test',
        },
      });

      expect(configurationManagerMock.manager.setApiKey).toHaveBeenCalledWith('new-secret');
      expect(configurationManagerMock.manager.setBackendUrl).toHaveBeenCalledWith(
        'https://updated-backend.example.test'
      );
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: {
          success: false,
          error: expect.stringContaining('Failed to save some configuration values:'),
        },
      });
      expect(response.requestId).toEqual(expect.any(String));
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('calls setApiKey with an empty string when setBackendConfig explicitly clears the API key', () => {
    const configurationManagerMock = installConfigurationManagerMock();

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: {
          apiKey: '',
        },
      });

      expect(configurationManagerMock.manager.setApiKey).toHaveBeenCalledWith('');
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: { success: true },
      });
      expect(response.requestId).toEqual(expect.any(String));
    } finally {
      configurationManagerMock.restore();
    }
  });

  it.each([
    ['null params', null],
    ['array params', []],
    ['string params', 'invalid'],
  ])(
    'returns an invalid request envelope for malformed setBackendConfig params: %s',
    (_caseName, params) => {
      const configurationManagerMock = installConfigurationManagerMock();

      try {
        const { ApiDispatcher } = loadApiHandlerModule();
        const dispatcher = ApiDispatcher.getInstance();

        const response = dispatcher.handle({
          method: 'setBackendConfig',
          params,
        });

        expect(configurationManagerMock.configurationManager.getInstance).not.toHaveBeenCalled();
        expect(response).toEqual({
          ok: false,
          requestId: response.requestId,
          error: {
            code: 'INVALID_REQUEST',
            message: 'params must be an object.',
            retriable: false,
          },
        });
        expect(response.requestId).toEqual(expect.any(String));
      } finally {
        configurationManagerMock.restore();
      }
    }
  );

  it('keeps configuration transport errors envelope-based through apiHandler', () => {
    const originalConfigurationManager = globalThis.ConfigurationManager;
    globalThis.ConfigurationManager = {
      DEFAULTS: CONFIGURATION_MANAGER_DEFAULTS,
      getInstance: vi.fn(() => {
        throw new Error('configuration exploded');
      }),
    };

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getBackendConfig',
      });

      expect(globalThis.ConfigurationManager.getInstance).toHaveBeenCalledTimes(1);
      expect(response).toEqual({
        ok: false,
        requestId: response.requestId,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
      expect(response.requestId).toEqual(expect.any(String));
    } finally {
      if (originalConfigurationManager === undefined) {
        delete globalThis.ConfigurationManager;
      } else {
        globalThis.ConfigurationManager = originalConfigurationManager;
      }
    }
  });

  it('keeps configuration write transport errors envelope-based through apiHandler', () => {
    const originalConfigurationManager = globalThis.ConfigurationManager;
    globalThis.ConfigurationManager = {
      DEFAULTS: CONFIGURATION_MANAGER_DEFAULTS,
      getInstance: vi.fn(() => {
        throw new Error('configuration save exploded');
      }),
    };

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: {
          backendUrl: 'https://updated-backend.example.test',
        },
      });

      expect(globalThis.ConfigurationManager.getInstance).toHaveBeenCalledTimes(1);
      expect(response).toEqual({
        ok: false,
        requestId: response.requestId,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
      expect(response.requestId).toEqual(expect.any(String));
    } finally {
      if (originalConfigurationManager === undefined) {
        delete globalThis.ConfigurationManager;
      } else {
        globalThis.ConfigurationManager = originalConfigurationManager;
      }
    }
  });

  it('does not retain the legacy configuration globals transport file', () => {
    expect(existsSync(legacyConfigurationGlobalsPath)).toBe(false);
  });
});
