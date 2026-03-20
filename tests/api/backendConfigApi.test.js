import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';

const { loadApiHandlerModule } = require('../helpers/apiHandlerTestUtils.js');
const {
  CONFIGURATION_MANAGER_DEFAULTS,
  buildBackendConfigResponse,
  createConfigurationManagerMock,
} = require('../helpers/backendConfigTestHelpers.js');

const legacyConfigurationGlobalsPath = new URL(
  '../../src/backend/ConfigurationManager/99_globals.js',
  import.meta.url
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backend configuration API transport', () => {
  it('returns masked backend configuration data through apiHandler', () => {
    const configurationManagerMock = createConfigurationManagerMock(
      vi,
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

  it('masks short API keys without exposing the raw value', () => {
    const configurationManagerMock = createConfigurationManagerMock(
      vi,
      {
        apiKey: '1234',
      },
      {},
      { allConfigurations: { apiKey: '1234' } }
    );

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getBackendConfig',
      });

      expect(response.data.apiKey).toBe('****');
      expect(response.data.hasApiKey).toBe(true);
      expect(response.data.apiKey).not.toContain('1234');
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('seeds and returns default backend configuration when nothing has been saved yet', () => {
    const configurationManagerMock = createConfigurationManagerMock(
      vi,
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
    const configurationManagerMock = createConfigurationManagerMock(
      vi,
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
    const configurationManagerMock = createConfigurationManagerMock(vi);

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
    const configurationManagerMock = createConfigurationManagerMock(vi);

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
    const configurationManagerMock = createConfigurationManagerMock(
      vi,
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

  it('calls every backend configuration setter when all fields are provided', () => {
    const configurationManagerMock = createConfigurationManagerMock(vi);

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: {
          backendAssessorBatchSize: 42,
          slidesFetchBatchSize: 24,
          apiKey: 'new-secret',
          backendUrl: 'https://updated-backend.example.test',
          revokeAuthTriggerSet: true,
          daysUntilAuthRevoke: 90,
          jsonDbMasterIndexKey: 'UPDATED_MASTER_INDEX',
          jsonDbLockTimeoutMs: 20000,
          jsonDbLogLevel: 'DEBUG',
          jsonDbBackupOnInitialise: true,
          jsonDbRootFolderId: 'folder-123',
        },
      });

      expect(configurationManagerMock.manager.setBackendAssessorBatchSize).toHaveBeenCalledWith(42);
      expect(configurationManagerMock.manager.setSlidesFetchBatchSize).toHaveBeenCalledWith(24);
      expect(configurationManagerMock.manager.setApiKey).toHaveBeenCalledWith('new-secret');
      expect(configurationManagerMock.manager.setBackendUrl).toHaveBeenCalledWith(
        'https://updated-backend.example.test'
      );
      expect(configurationManagerMock.manager.setRevokeAuthTriggerSet).toHaveBeenCalledWith(true);
      expect(configurationManagerMock.manager.setDaysUntilAuthRevoke).toHaveBeenCalledWith(90);
      expect(configurationManagerMock.manager.setJsonDbMasterIndexKey).toHaveBeenCalledWith(
        'UPDATED_MASTER_INDEX'
      );
      expect(configurationManagerMock.manager.setJsonDbLockTimeoutMs).toHaveBeenCalledWith(20000);
      expect(configurationManagerMock.manager.setJsonDbLogLevel).toHaveBeenCalledWith('DEBUG');
      expect(configurationManagerMock.manager.setJsonDbBackupOnInitialise).toHaveBeenCalledWith(
        true
      );
      expect(configurationManagerMock.manager.setJsonDbRootFolderId).toHaveBeenCalledWith(
        'folder-123'
      );
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

  it('calls setApiKey with an empty string when setBackendConfig explicitly clears the API key', () => {
    const configurationManagerMock = createConfigurationManagerMock(vi);

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
      const configurationManagerMock = createConfigurationManagerMock(vi);

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
