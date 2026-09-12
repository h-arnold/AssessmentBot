import { afterEach, describe, expect, it, vi } from 'vitest';

const { loadApiHandlerModule } = require('../helpers/apiHandlerTestUtils.js');
const {
  CONFIGURATION_MANAGER_DEFAULTS,
  buildBackendConfigResponse,
  createConfigurationManagerMock,
} = require('../helpers/backendConfigTestHelpers.js');

const AuthService = require('../../src/backend/Utils/AuthService.js');

/**
 * Asserts that no per-field configuration setter was invoked (the whole save is
 * staged into one locked write).
 * @param {Object} manager - The ConfigurationManager mock.
 * @returns {void}
 */
function expectNoPerFieldSetters(manager) {
  expect(manager.setBackendAssessorBatchSize).not.toHaveBeenCalled();
  expect(manager.setSlidesFetchBatchSize).not.toHaveBeenCalled();
  expect(manager.setRevokeAuthTriggerSet).not.toHaveBeenCalled();
  expect(manager.setDaysUntilAuthRevoke).not.toHaveBeenCalled();
  expect(manager.setJsonDbMasterIndexKey).not.toHaveBeenCalled();
  expect(manager.setJsonDbLockTimeoutMs).not.toHaveBeenCalled();
  expect(manager.setJsonDbLogLevel).not.toHaveBeenCalled();
  expect(manager.setJsonDbBackupOnInitialise).not.toHaveBeenCalled();
  expect(manager.setApiKey).not.toHaveBeenCalled();
  expect(manager.setBackendUrl).not.toHaveBeenCalled();
  expect(manager.setJsonDbRootFolderId).not.toHaveBeenCalled();
}

/**
 * Asserts the standard successful backend-config write envelope.
 * @param {Object} response - The dispatcher response envelope.
 * @returns {void}
 */
function expectWriteSuccessEnvelope(response) {
  expect(response).toEqual({
    ok: true,
    requestId: response.requestId,
    data: { success: true },
  });
  expect(response.requestId).toEqual(expect.any(String));
}

afterEach(() => {
  vi.restoreAllMocks();
  AuthService.resetForTests();
  globalThis.CacheService._resetScriptCache();
  globalThis.Session._resetActiveUserEmail();
  globalThis.GroupsApp._resetGroups();
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

      // Called once by the ApiDispatcher auth gate's group email lookup and once by
      // the getBackendConfig handler.
      expect(configurationManagerMock.configurationManager.getInstance).toHaveBeenCalledTimes(2);
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

      // Called once by the ApiDispatcher auth gate (AuthService group-email lookup)
      // and once by the getBackendConfig handler.
      expect(configurationManagerMock.configurationManager.getInstance).toHaveBeenCalledTimes(2);
      expect(configurationManagerMock.manager.ensureDefaultConfiguration).toHaveBeenCalledTimes(1);
      expectNoPerFieldSetters(configurationManagerMock.manager);
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

      // Called once by the ApiDispatcher auth gate (AuthService group-email lookup)
      // and once by the getBackendConfig handler.
      expect(configurationManagerMock.configurationManager.getInstance).toHaveBeenCalledTimes(2);
      expect(configurationManagerMock.manager.ensureDefaultConfiguration).toHaveBeenCalledTimes(1);
      expectNoPerFieldSetters(configurationManagerMock.manager);
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

  it('applies only supplied ordinary fields through a single locked write', () => {
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
      // Section 6 contract: one atomic locked mutation for the whole save, not
      // one setter call (and lock acquisition) per supplied field.
      expect(configurationManagerMock.manager.writeConfigurationLocked).toHaveBeenCalledTimes(1);
      // The staged mutation merges exactly the supplied fields into the current
      // snapshot; omitted fields (e.g. apiKey) are left untouched.
      const mutator = configurationManagerMock.manager.writeConfigurationLocked.mock.calls[0][0];
      const merged = mutator({ apiKey: 'live-secret-7890' });
      expect(merged.backendAssessorBatchSize).toBe(42);
      expect(merged.backendUrl).toBe('https://updated-backend.example.test');
      expect(merged.daysUntilAuthRevoke).toBe(21);
      expect(merged.apiKey).toBe('live-secret-7890');
      expectWriteSuccessEnvelope(response);
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('does not stage undefined setBackendConfig fields into the locked write', () => {
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

      // The single locked mutation carries only defined fields; explicitly
      // undefined fields are never staged or read.
      expect(configurationManagerMock.manager.writeConfigurationLocked).toHaveBeenCalledTimes(1);
      const mutator = configurationManagerMock.manager.writeConfigurationLocked.mock.calls[0][0];
      const merged = mutator({
        apiKey: 'stored-key',
        backendUrl: 'https://stored.example.test',
        jsonDbRootFolderId: 'folder-stored',
      });
      expect(merged.backendAssessorBatchSize).toBe(18);
      expect(merged.apiKey).toBe('stored-key');
      expect(merged.backendUrl).toBe('https://stored.example.test');
      expect(merged.jsonDbRootFolderId).toBe('folder-stored');
      expectWriteSuccessEnvelope(response);
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('applies all supported ordinary fields in a single locked write', () => {
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

      // Every supported ordinary field can be supplied in one payload and is
      // staged into the single locked mutation.
      expect(configurationManagerMock.manager.writeConfigurationLocked).toHaveBeenCalledTimes(1);
      const mutator = configurationManagerMock.manager.writeConfigurationLocked.mock.calls[0][0];
      const merged = mutator({});
      expect(merged).toEqual({
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
      });
      expectWriteSuccessEnvelope(response);
    } finally {
      configurationManagerMock.restore();
    }
  });
});

describe('backend configuration API transport — canonical read shape', () => {
  it('returns exactly the 12 non-auth fields, including derived hasApiKey', () => {
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
        jsonDbRootFolderId: 'folder-123',
      },
      {},
      {
        allConfigurations: {
          apiKey: 'live-secret-7890',
          backendUrl: 'https://backend.example.test',
        },
      }
    );

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getBackendConfig',
      });

      const keys = Object.keys(response.data).sort();
      expect(keys).toEqual(
        [
          'apiKey',
          'backendAssessorBatchSize',
          'backendUrl',
          'daysUntilAuthRevoke',
          'hasApiKey',
          'jsonDbBackupOnInitialise',
          'jsonDbLogLevel',
          'jsonDbLockTimeoutMs',
          'jsonDbMasterIndexKey',
          'jsonDbRootFolderId',
          'revokeAuthTriggerSet',
          'slidesFetchBatchSize',
        ].sort()
      );
      expect(response.data.hasApiKey).toBe(true);
      expect(response.data).not.toHaveProperty('authMode');
      expect(response.data).not.toHaveProperty('authGroupEmail');
    } finally {
      configurationManagerMock.restore();
    }
  });
});

describe('backend configuration API transport — ordinary multi-field locked write', () => {
  it('saves a multi-field payload through a single locked write (no clobber)', () => {
    // Store-backed ConfigurationManager whose locked write path mirrors the
    // production ConfigurationManager wiring (raw re-read, merge, single
    // commit). A multi-field save must collapse into ONE locked mutation so a
    // concurrent writer can never interleave between per-field commits.
    const store = {
      authMode: 'googleGroups',
      authGroupEmail: 'teachers@school.edu',
      jsonDbLogLevel: 'DEBUG',
    };
    const writeConfigurationLocked = vi.fn((mutator) => {
      const next = mutator({ ...store });
      Object.assign(store, next);
    });
    const manager = {
      getAllConfigurations: vi.fn(() => ({ ...store })),
      getAuthMode: vi.fn(() => 'googleGroups'),
      getAuthGroupEmail: vi.fn(() => 'teachers@school.edu'),
      getAuthUsers: vi.fn(() => ''),
      getAuthRevision: vi.fn(() => ''),
      isFreshInstall: vi.fn(() => false),
      ensureDefaultConfiguration: vi.fn(() => ({})),
      writeConfigurationLocked,
      // Section 6 validation seam: ordinary fields are staged through the
      // manager-owned preparePropertyValue seam before the single locked write.
      preparePropertyValue: vi.fn((_configKey, value) => value),
      setApiKey: vi.fn((value) => writeConfigurationLocked((c) => ({ ...c, apiKey: value }))),
      setBackendUrl: vi.fn((value) =>
        writeConfigurationLocked((c) => ({ ...c, backendUrl: value }))
      ),
      setDaysUntilAuthRevoke: vi.fn((value) =>
        writeConfigurationLocked((c) => ({ ...c, daysUntilAuthRevoke: value }))
      ),
    };
    const originalConfigurationManager = globalThis.ConfigurationManager;
    globalThis.ConfigurationManager = {
      DEFAULTS: CONFIGURATION_MANAGER_DEFAULTS,
      getInstance: vi.fn(() => manager),
    };

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: {
          apiKey: 'new-secret',
          backendUrl: 'https://updated-backend.example.test',
          daysUntilAuthRevoke: 21,
        },
      });

      expect(response).toMatchObject({ ok: true, data: { success: true } });
      // One atomic locked write for the whole multi-field save, not one per field.
      expect(writeConfigurationLocked).toHaveBeenCalledTimes(1);
      // The single merge commits the supplied string fields...
      expect(store.apiKey).toBe('new-secret');
      expect(store.backendUrl).toBe('https://updated-backend.example.test');
      // ...and preserves an out-of-band stored value written by another writer.
      expect(store.jsonDbLogLevel).toBe('DEBUG');
    } finally {
      if (originalConfigurationManager === undefined) {
        delete globalThis.ConfigurationManager;
      } else {
        globalThis.ConfigurationManager = originalConfigurationManager;
      }
    }
  });
});
