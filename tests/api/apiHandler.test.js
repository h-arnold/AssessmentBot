import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const apiHandlerPath = '../../src/backend/z_Api/apiHandler.js';
const apiConstantsPath = '../../src/backend/z_Api/apiConstants.js';
const googleClassroomsHandlerPath = '../../src/backend/z_Api/googleClassrooms.js';
const originalClassroomApiClient = globalThis.ClassroomApiClient;

const {
  callAuthorisationStatus,
  getApiDispatcherInstance,
  loadApiHandlerModule,
  REFERENCE_DATA_API_METHOD_NAMES,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
} = require('../helpers/apiHandlerTestUtils.js');

const SECTION_1_API_METHOD_NAMES = Object.freeze([
  'getGoogleClassrooms',
  'upsertABClass',
  'updateABClass',
  'deleteABClass',
]);

const SECTION_1_API_METHOD_ENTRIES = Object.freeze(
  Object.fromEntries(SECTION_1_API_METHOD_NAMES.map((methodName) => [methodName, methodName]))
);

const BACKEND_CONFIG_API_METHOD_NAMES = Object.freeze(['getBackendConfig', 'setBackendConfig']);

const BACKEND_CONFIG_API_METHOD_ENTRIES = Object.freeze(
  Object.fromEntries(BACKEND_CONFIG_API_METHOD_NAMES.map((methodName) => [methodName, methodName]))
);

const CONFIGURATION_MANAGER_DEFAULTS = Object.freeze({
  JSON_DB_MASTER_INDEX_KEY: 'MASTER_INDEX',
  JSON_DB_LOCK_TIMEOUT_MS: 5000,
  JSON_DB_LOG_LEVEL: 'INFO',
  JSON_DB_BACKUP_ON_INITIALISE: false,
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
  vi,
  { getterValues = {}, setterImplementations = {} } = {}
) {
  const originalConfigurationManager = globalThis.ConfigurationManager;
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
    getApiKey: vi.fn(() => values.apiKey),
    getBackendAssessorBatchSize: vi.fn(() => values.backendAssessorBatchSize),
    getBackendUrl: vi.fn(() => values.backendUrl),
    getRevokeAuthTriggerSet: vi.fn(() => values.revokeAuthTriggerSet),
    getDaysUntilAuthRevoke: vi.fn(() => values.daysUntilAuthRevoke),
    getSlidesFetchBatchSize: vi.fn(() => values.slidesFetchBatchSize),
    getJsonDbMasterIndexKey: vi.fn(() => values.jsonDbMasterIndexKey),
    getJsonDbLockTimeoutMs: vi.fn(() => values.jsonDbLockTimeoutMs),
    getJsonDbLogLevel: vi.fn(() => values.jsonDbLogLevel),
    getJsonDbBackupOnInitialise: vi.fn(() => values.jsonDbBackupOnInitialise),
    getJsonDbRootFolderId: vi.fn(() => values.jsonDbRootFolderId),
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

  const configurationManager = {
    DEFAULTS: CONFIGURATION_MANAGER_DEFAULTS,
    getInstance: vi.fn(() => manager),
  };

  globalThis.ConfigurationManager = configurationManager;

  return {
    manager,
    configurationManager,
    restore() {
      if (originalConfigurationManager === undefined) {
        delete globalThis.ConfigurationManager;
        return;
      }
      globalThis.ConfigurationManager = originalConfigurationManager;
    },
  };
}

function buildSection1Params(methodName) {
  switch (methodName) {
    case 'getGoogleClassrooms': {
      return {};
    }
    case 'upsertABClass': {
      return {
        classId: 'class-upsert-001',
        cohort: '2026',
        yearGroup: 10,
        courseLength: 2,
      };
    }
    case 'updateABClass': {
      return {
        classId: 'class-update-001',
        cohort: '2027',
        yearGroup: 11,
        courseLength: 2,
        active: true,
      };
    }
    case 'deleteABClass': {
      return {
        classId: 'class-delete-001',
      };
    }
    default: {
      return { traceId: `${methodName}-params` };
    }
  }
}

function buildSection1Result(methodName) {
  switch (methodName) {
    case 'getGoogleClassrooms': {
      return [{ classId: 'course-001', className: '10A Computer Science' }];
    }
    case 'upsertABClass': {
      return { classId: 'class-upsert-001', saved: true };
    }
    case 'updateABClass': {
      return { classId: 'class-update-001', updated: true };
    }
    case 'deleteABClass': {
      return { classId: 'class-delete-001', deleted: true };
    }
    default: {
      return { handledBy: methodName };
    }
  }
}

function buildSection1Handlers() {
  return Object.fromEntries(
    SECTION_1_API_METHOD_NAMES.map((methodName) => [
      methodName,
      () => buildSection1Result(methodName),
    ])
  );
}

function buildReferenceDataParams(methodName) {
  switch (methodName) {
    case 'createCohort': {
      return { record: { name: 'Cohort 2026', active: true } };
    }
    case 'updateCohort': {
      return {
        originalName: 'Cohort 2025',
        record: { name: 'Cohort 2026', active: false },
      };
    }
    case 'deleteCohort': {
      return { name: 'Cohort 2026' };
    }
    case 'createYearGroup': {
      return { record: { name: 'Year 10' } };
    }
    case 'updateYearGroup': {
      return {
        originalName: 'Year 9',
        record: { name: 'Year 10' },
      };
    }
    case 'deleteYearGroup': {
      return { name: 'Year 10' };
    }
    default: {
      return { traceId: `${methodName}-params` };
    }
  }
}

function buildReferenceDataResult(methodName) {
  switch (methodName) {
    case 'getCohorts': {
      return [{ name: 'Cohort 2026', active: true }];
    }
    case 'createCohort': {
      return { name: 'Cohort 2026', active: true };
    }
    case 'updateCohort': {
      return { name: 'Cohort 2026', active: false };
    }
    case 'getYearGroups': {
      return [{ name: 'Year 10' }];
    }
    case 'createYearGroup': {
      return { name: 'Year 10' };
    }
    case 'updateYearGroup': {
      return { name: 'Year 10' };
    }
    default: {
      return { handledBy: methodName };
    }
  }
}

function buildReferenceDataHandlers() {
  return Object.fromEntries(
    REFERENCE_DATA_API_METHOD_NAMES.map((methodName) => [
      methodName,
      () => buildReferenceDataResult(methodName),
    ])
  );
}

function loadApiConstantsModule() {
  delete require.cache[require.resolve(apiConstantsPath)];
  return require(apiConstantsPath);
}

function clearGoogleClassroomsHandlerModuleCache() {
  delete require.cache[require.resolve(googleClassroomsHandlerPath)];
}

function loadRealGoogleClassroomsHandlerWithGlobals({ classroomApiClient } = {}) {
  clearGoogleClassroomsHandlerModuleCache();
  globalThis.ClassroomApiClient = classroomApiClient;
  return require(googleClassroomsHandlerPath).getGoogleClassrooms;
}

function loadApiHandlerInVmContext({ globals = {} } = {}) {
  const source = fs.readFileSync(require.resolve(apiHandlerPath), 'utf8');
  const sandbox = { ...globals };

  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.__exports = { apiHandler, ApiDispatcher };`, sandbox, {
    filename: 'apiHandler.js',
  });

  return {
    ...sandbox.__exports,
    context: sandbox,
  };
}

function makeVmGlobals(overrides = {}) {
  const store = {};
  return {
    BaseSingleton: require('../../src/backend/00_BaseSingleton.js'),
    LOCK_TIMEOUT_MS: 1000,
    LOCK_WAIT_WARN_THRESHOLD_MS: 300,
    ACTIVE_LIMIT: 25,
    LockService: {
      getUserLock() {
        return { tryLock: () => true, releaseLock: () => {} };
      },
    },
    PropertiesService: {
      getUserProperties() {
        return {
          getProperty: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
          setProperty: (k, v) => {
            store[k] = v;
          },
        };
      },
    },
    ABLogger: { getInstance: () => ({ warn: () => {}, info: () => {} }) },
    Utilities: { getUuid: () => 'uuid-vm-default' },
    Validate:
      require('../../src/backend/Utils/Validate.js').Validate ||
      require('../../src/backend/Utils/Validate.js'),
    loadStore: () => ({}),
    saveStore: () => {},
    createStartedRecord: (id, method) => ({
      requestId: id,
      method,
      status: 'started',
      startedAtMs: Date.now(),
    }),
    markSuccess: (s, id) => {
      if (s[id]) s[id].status = 'success';
      return s;
    },
    markError: (s, id, msg) => {
      if (s[id]) {
        s[id].status = 'error';
        s[id].errorMessage = msg;
      }
      return s;
    },
    compactStore: (s) => s,
    STALE_REQUEST_AGE_MS: 15 * 60 * 1000,
    pruneStaleEntries: (s) => s,
    ApiRateLimitError: function ApiRateLimitError() {},
    ApiValidationError: function ApiValidationError() {},
    ApiDisabledError: function ApiDisabledError() {},
    ...overrides,
  };
}

describe('Api/apiConstants', () => {
  it('defines getAuthorisationStatus in the API allowlist', () => {
    const { API_METHODS } = loadApiConstantsModule();

    expect(API_METHODS).toBeTypeOf('object');
    expect(API_METHODS.getAuthorisationStatus).toBe('getAuthorisationStatus');
  });

  it('contains all Section 3 reference-data methods in API_METHODS', () => {
    const { API_METHODS } = loadApiConstantsModule();

    expect(API_METHODS).toEqual(
      expect.objectContaining(
        Object.fromEntries(
          REFERENCE_DATA_API_METHOD_NAMES.map((methodName) => [methodName, methodName])
        )
      )
    );
  });

  it('contains all Section 3 reference-data methods in API_ALLOWLIST', () => {
    const { API_ALLOWLIST } = loadApiConstantsModule();

    expect(API_ALLOWLIST).toEqual(
      expect.objectContaining(
        Object.fromEntries(
          REFERENCE_DATA_API_METHOD_NAMES.map((methodName) => [methodName, methodName])
        )
      )
    );
  });

  it('contains all Section 1 transport methods in API_METHODS', () => {
    const { API_METHODS } = loadApiConstantsModule();

    expect(API_METHODS).toEqual(expect.objectContaining(SECTION_1_API_METHOD_ENTRIES));
  });

  it('contains all Section 1 transport methods in API_ALLOWLIST', () => {
    const { API_ALLOWLIST } = loadApiConstantsModule();

    expect(API_ALLOWLIST).toEqual(expect.objectContaining(SECTION_1_API_METHOD_ENTRIES));
  });

  it('contains the backend configuration methods in API_METHODS', () => {
    const { API_METHODS } = loadApiConstantsModule();

    expect(API_METHODS).toEqual(expect.objectContaining(BACKEND_CONFIG_API_METHOD_ENTRIES));
  });

  it('contains the backend configuration methods in API_ALLOWLIST', () => {
    const { API_ALLOWLIST } = loadApiConstantsModule();

    expect(API_ALLOWLIST).toEqual(expect.objectContaining(BACKEND_CONFIG_API_METHOD_ENTRIES));
  });
});

describe('Api/apiHandler dispatcher', () => {
  let context;

  beforeEach(() => {
    context = setupApiHandlerTestContext(vi, {
      additionalHandlers: {
        ...buildReferenceDataHandlers(),
        ...buildSection1Handlers(),
      },
    });
  });

  afterEach(() => {
    teardownApiHandlerTestContext(vi, context);
    clearGoogleClassroomsHandlerModuleCache();
    if (originalClassroomApiClient === undefined) {
      delete globalThis.ClassroomApiClient;
    } else {
      globalThis.ClassroomApiClient = originalClassroomApiClient;
    }
  });

  it('accepts a valid request and returns a success envelope for an allowlisted method', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getAuthorisationStatus',
      params: {},
    });

    expect(response).toMatchObject({
      ok: true,
      data: { authorised: true },
    });
  });

  it.each([
    ['null request', null],
    ['number request', 42],
    ['string request', 'not-an-object'],
    ['boolean request', false],
    ['array request', []],
    ['function request', () => ({})],
    ['empty object request', {}],
  ])('rejects invalid request: %s', (_caseName, request) => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle(request);

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: 'INVALID_REQUEST',
    });
  });

  it.each([
    ['missing method', { params: {} }],
    ['blank method', { method: '   ', params: {} }],
  ])('rejects request with %s', (_caseName, request) => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle(request);

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: 'INVALID_REQUEST',
    });
  });

  it('returns UNKNOWN_METHOD for a non-allowlisted method', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'deleteEverything',
    });

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'UNKNOWN_METHOD',
      },
    });
  });

  it('rejects a real global handler when the method is not allowlisted', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();
    const syntheticHandlerName = 'section1SyntheticNonAllowlistedHandler';
    const originalHandler = globalThis[syntheticHandlerName];
    globalThis[syntheticHandlerName] = vi.fn(() => ({ accepted: false }));

    try {
      const response = dispatcher.handle({
        method: syntheticHandlerName,
        params: { traceId: 'synthetic-non-allowlisted' },
      });

      expect(globalThis[syntheticHandlerName]).toEqual(expect.any(Function));
      expect(globalThis[syntheticHandlerName]).not.toHaveBeenCalled();
      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'UNKNOWN_METHOD',
        },
      });
    } finally {
      if (originalHandler === undefined) {
        delete globalThis[syntheticHandlerName];
      } else {
        globalThis[syntheticHandlerName] = originalHandler;
      }
    }
  });

  it('always generates backend-owned requestIds even when caller sends one', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getAuthorisationStatus',
      requestId: 'req-client-supplied',
    });

    expect(response.requestId).toEqual(expect.any(String));
    expect(response.requestId).not.toBe('req-client-supplied');
  });

  it('generates a new requestId when omitted', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getAuthorisationStatus',
    });

    expect(response.ok).toBe(true);
    expect(response.requestId).toEqual(expect.any(String));
    expect(response.requestId.length).toBeGreaterThan(0);
  });

  it('calls Utilities.getUuid to generate requestId when none is provided', () => {
    const originalUtilities = globalThis.Utilities;
    globalThis.Utilities = {
      getUuid: vi.fn(() => 'uuid-fixed-001'),
    };

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getAuthorisationStatus',
      });

      expect(globalThis.Utilities.getUuid).toHaveBeenCalledTimes(1);
      expect(response.requestId).toBe('uuid-fixed-001');
      expect(response.ok).toBe(true);
    } finally {
      if (originalUtilities === undefined) {
        delete globalThis.Utilities;
      } else {
        globalThis.Utilities = originalUtilities;
      }
    }
  });

  it('returns INTERNAL_ERROR when an allowlisted handler throws an unexpected error', () => {
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw new Error('dispatch exploded');
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getAuthorisationStatus',
    });

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal API error.',
        retriable: false,
      },
    });
  });

  it.each(REFERENCE_DATA_API_METHOD_NAMES)(
    'routes %s to the matching allowlisted handler',
    (methodName) => {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();
      const params = buildReferenceDataParams(methodName);
      const expectedData =
        methodName === 'deleteCohort' || methodName === 'deleteYearGroup'
          ? { transport: 'plain-data', methodName }
          : buildReferenceDataResult(methodName);

      globalThis[methodName].mockImplementation(() => expectedData);

      const response = dispatcher.handle({
        method: methodName,
        params,
      });

      expect(globalThis[methodName]).toHaveBeenCalledTimes(1);
      expect(globalThis[methodName]).toHaveBeenCalledWith(params);
      expect(response.ok).toBe(true);
      expect(response.data).toEqual(expectedData);
      expect(response.data?.ok).toBeUndefined();
      expect(response.data?.error).toBeUndefined();
    }
  );

  it.each(SECTION_1_API_METHOD_NAMES)(
    'routes %s to the matching allowlisted handler',
    (methodName) => {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();
      const params = buildSection1Params(methodName);
      const expectedData = buildSection1Result(methodName);

      globalThis[methodName].mockImplementation(() => expectedData);

      const response = dispatcher.handle({
        method: methodName,
        params,
      });

      expect(globalThis[methodName]).toHaveBeenCalledTimes(1);
      expect(globalThis[methodName]).toHaveBeenCalledWith(params);
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: expectedData,
      });
      expect(response.requestId).toEqual(expect.any(String));
    }
  );

  it('dispatches getBackendConfig and returns masked configuration data', () => {
    const configurationManagerMock = installConfigurationManagerMock(vi, {
      getterValues: {
        apiKey: 'live-secret-7890',
      },
    });

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getBackendConfig',
      });

      expect(configurationManagerMock.configurationManager.getInstance).toHaveBeenCalledTimes(1);
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: buildBackendConfigResponse(),
      });
      expect(response.requestId).toEqual(expect.any(String));
      expect(response.data.apiKey).toBe('****7890');
      expect(response.data.apiKey).not.toContain('live-secret-7890');
      expect(response.data.hasApiKey).toBe(true);
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('dispatches setBackendConfig and applies only the defined configuration updates', () => {
    const configurationManagerMock = installConfigurationManagerMock(vi);

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
    const configurationManagerMock = installConfigurationManagerMock(vi);

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
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('calls setApiKey with an empty string when setBackendConfig explicitly clears the API key', () => {
    const configurationManagerMock = installConfigurationManagerMock(vi);

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
    } finally {
      configurationManagerMock.restore();
    }
  });

  it.each([
    ['null params', null],
    ['array params', []],
    ['string params', 'invalid'],
  ])(
    'returns an INVALID_REQUEST envelope for malformed setBackendConfig payloads: %s',
    (_caseName, params) => {
      const configurationManagerMock = installConfigurationManagerMock(vi);

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

  it('keeps the success envelope unchanged for getGoogleClassrooms when using the real handler', () => {
    globalThis.getGoogleClassrooms = loadRealGoogleClassroomsHandlerWithGlobals({
      classroomApiClient: {
        fetchAllActiveClassrooms: vi.fn(() => [
          {
            id: 'course-001',
            name: '10A Computer Science',
            enrollmentCode: 'ABC123',
          },
        ]),
      },
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getGoogleClassrooms',
      params: { includeArchived: true },
    });

    expect(response).toEqual({
      ok: true,
      requestId: response.requestId,
      data: [{ classId: 'course-001', className: '10A Computer Science' }],
    });
    expect(response.requestId).toEqual(expect.any(String));
  });

  it('maps getGoogleClassrooms validation failures from the real handler to INVALID_REQUEST', () => {
    globalThis.getGoogleClassrooms = loadRealGoogleClassroomsHandlerWithGlobals({
      classroomApiClient: {
        fetchAllActiveClassrooms: vi.fn(() => [{ name: '10A Computer Science' }]),
      },
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getGoogleClassrooms',
      params: {},
    });

    expect(response).toEqual({
      ok: false,
      requestId: expect.any(String),
      error: {
        code: 'INVALID_REQUEST',
        message: expect.any(String),
        retriable: false,
      },
    });
  });

  it('maps malformed getGoogleClassrooms records from the real handler to INVALID_REQUEST and preserves requestId', () => {
    const originalUtilities = globalThis.Utilities;
    globalThis.Utilities = {
      getUuid: vi.fn(() => 'req-google-classrooms-null-record'),
    };

    try {
      globalThis.getGoogleClassrooms = loadRealGoogleClassroomsHandlerWithGlobals({
        classroomApiClient: {
          fetchAllActiveClassrooms: vi.fn(() => [null]),
        },
      });

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getGoogleClassrooms',
        params: {},
      });

      expect(response).toEqual({
        ok: false,
        requestId: 'req-google-classrooms-null-record',
        error: {
          code: 'INVALID_REQUEST',
          message: expect.any(String),
          retriable: false,
        },
      });
    } finally {
      if (originalUtilities === undefined) {
        delete globalThis.Utilities;
      } else {
        globalThis.Utilities = originalUtilities;
      }
    }
  });

  it('maps unexpected getGoogleClassrooms failures through the existing internal-error envelope path', () => {
    globalThis.getGoogleClassrooms = loadRealGoogleClassroomsHandlerWithGlobals({
      classroomApiClient: {
        fetchAllActiveClassrooms: vi.fn(() => {
          throw new Error('Classroom client exploded');
        }),
      },
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getGoogleClassrooms',
      params: {},
    });

    expect(response).toEqual({
      ok: false,
      requestId: expect.any(String),
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal API error.',
        retriable: false,
      },
    });
  });

  it('keeps existing getABClassPartials dispatch behaviour unchanged', () => {
    const expectedData = [{ classId: 'ab-class-001', className: 'Existing transport method' }];
    globalThis.getABClassPartials = vi.fn(() => expectedData);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getABClassPartials',
      params: { pageSize: 10 },
    });

    expect(globalThis.getABClassPartials).toHaveBeenCalledTimes(1);
    expect(globalThis.getABClassPartials).toHaveBeenCalledWith({ pageSize: 10 });
    expect(response).toEqual({
      ok: true,
      requestId: response.requestId,
      data: expectedData,
    });
    expect(response.requestId).toEqual(expect.any(String));
  });

  it('returns plain handler data for successful reference-data requests without re-enveloping it', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();
    const expectedData = [{ name: 'Cohort 2026', active: true }];

    globalThis.getCohorts.mockImplementation(() => expectedData);

    const response = dispatcher.handle({
      method: 'getCohorts',
    });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual(expectedData);
    expect(response.data.ok).toBeUndefined();
    expect(response.data.error).toBeUndefined();
  });

  it('maps controller validation failures for reference-data handlers to the existing API failure envelope', () => {
    const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');
    globalThis.createCohort.mockImplementation(() => {
      throw new ApiValidationError('Invalid cohort payload', { requestId: 'req-create-cohort' });
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'createCohort',
      params: buildReferenceDataParams('createCohort'),
    });

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid cohort payload',
        retriable: false,
      },
    });
  });

  it('maps ApiValidationError from a new Section 1 handler to INVALID_REQUEST and preserves the failure envelope shape', () => {
    const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');
    globalThis.upsertABClass.mockImplementation(() => {
      throw new ApiValidationError('Invalid ABClass payload', { requestId: 'req-upsert-abclass' });
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'upsertABClass',
      params: buildSection1Params('upsertABClass'),
    });

    expect(response).toEqual({
      ok: false,
      requestId: response.requestId,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid ABClass payload',
        retriable: false,
      },
    });
    expect(response.requestId).toEqual(expect.any(String));
  });

  it('maps ApiValidationError from updateABClass to INVALID_REQUEST and preserves the failure envelope shape', () => {
    const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');
    globalThis.updateABClass.mockImplementation(() => {
      throw new ApiValidationError('Invalid ABClass update payload', {
        requestId: 'req-update-abclass',
      });
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'updateABClass',
      params: buildSection1Params('updateABClass'),
    });

    expect(response).toEqual({
      ok: false,
      requestId: response.requestId,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid ABClass update payload',
        retriable: false,
      },
    });
    expect(response.requestId).toEqual(expect.any(String));
  });

  it('maps unexpected controller failures for reference-data handlers to the existing API failure envelope', () => {
    globalThis.updateYearGroup.mockImplementation(() => {
      throw new Error('year-group update exploded');
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'updateYearGroup',
      params: buildReferenceDataParams('updateYearGroup'),
    });

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal API error.',
        retriable: false,
      },
    });
  });

  it('maps unexpected failures from a new Section 1 handler to INTERNAL_ERROR and preserves the failure envelope shape', () => {
    globalThis.deleteABClass.mockImplementation(() => {
      throw new Error('delete exploded');
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'deleteABClass',
      params: buildSection1Params('deleteABClass'),
    });

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
  });

  it('throws when an unrecognised handler name is passed to _invokeAllowlistedMethod', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    expect(() => dispatcher._invokeAllowlistedMethod('unknownHandler', {})).toThrow(
      'Allowlisted handler is not implemented.'
    );
  });

  it('operates correctly via BaseSingleton in a GAS-like VM context', () => {
    const { ApiDispatcher } = loadApiHandlerInVmContext({
      globals: makeVmGlobals({
        API_ALLOWLIST: {
          getAuthorisationStatus: 'getAuthorisationStatus',
        },
        getAuthorisationStatus: () => ({ authorised: true }),
        Utilities: {
          getUuid: () => 'uuid-vm-singleton',
        },
      }),
    });

    const first = ApiDispatcher.getInstance();
    const second = ApiDispatcher.getInstance();

    expect(first).toBe(second);
    expect(
      first.handle({
        method: 'getAuthorisationStatus',
      })
    ).toMatchObject({ ok: true, requestId: 'uuid-vm-singleton' });
  });

  it('uses global API_ALLOWLIST in vm context and returns INTERNAL_ERROR for unknown mapped handler', () => {
    const { ApiDispatcher } = loadApiHandlerInVmContext({
      globals: makeVmGlobals({
        API_ALLOWLIST: {
          getAuthorisationStatus: 'notImplementedHandler',
        },
        Utilities: {
          getUuid: () => 'uuid-vm-dispatch-error',
        },
      }),
    });
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getAuthorisationStatus',
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: 'uuid-vm-dispatch-error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal API error.',
        retriable: false,
      },
    });
  });

  it('maps ApiRateLimitError to RATE_LIMITED with retriable true', () => {
    const ApiRateLimitError = require('../../src/backend/Utils/ErrorTypes/ApiRateLimitError.js');
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw new ApiRateLimitError('Rate limit exceeded', { requestId: 'req-map-rl' });
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getAuthorisationStatus',
    });

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded',
        retriable: true,
      },
    });
  });

  it('maps ApiValidationError to INVALID_REQUEST with retriable false', () => {
    const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw new ApiValidationError('Validation failed', { requestId: 'req-map-val' });
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getAuthorisationStatus',
    });

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Validation failed',
        retriable: false,
      },
    });
  });

  it('maps ApiDisabledError to UNKNOWN_METHOD with retriable false', () => {
    const ApiDisabledError = require('../../src/backend/Utils/ErrorTypes/ApiDisabledError.js');
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw new ApiDisabledError('Method is disabled', { requestId: 'req-map-dis' });
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getAuthorisationStatus',
    });

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'UNKNOWN_METHOD',
        message: 'Method is disabled',
        retriable: false,
      },
    });
  });

  it('maps known custom error names with missing message to INTERNAL_ERROR', () => {
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw {
        name: 'ApiValidationError',
      };
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getAuthorisationStatus',
    });

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal API error.',
        retriable: false,
      },
    });
  });

  it.each([
    ['ApiRateLimitError', '../../src/backend/Utils/ErrorTypes/ApiRateLimitError.js'],
    ['ApiValidationError', '../../src/backend/Utils/ErrorTypes/ApiValidationError.js'],
    ['ApiDisabledError', '../../src/backend/Utils/ErrorTypes/ApiDisabledError.js'],
  ])('maps %s with a blank message to INTERNAL_ERROR', (_errorName, errorModulePath) => {
    const ApiErrorType = require(errorModulePath);
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw new ApiErrorType('   ', { requestId: 'req-blank-message' });
    });

    const dispatcher = getApiDispatcherInstance();

    const response = callAuthorisationStatus(dispatcher);

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal API error.',
        retriable: false,
      },
    });
  });

  it('maps null thrown values to INTERNAL_ERROR', () => {
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw null;
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getAuthorisationStatus',
    });

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal API error.',
        retriable: false,
      },
    });
  });

  it('GAS-global apiHandler delegates to ApiDispatcher.getInstance().handle(request)', () => {
    const { apiHandler, ApiDispatcher } = loadApiHandlerModule();

    const request = {
      method: 'getAuthorisationStatus',
    };
    const handle = vi.fn(() => ({
      ok: true,
      requestId: 'req-wrapper-generated',
      data: { delegated: true },
    }));
    const getInstance = vi.spyOn(ApiDispatcher, 'getInstance').mockReturnValue({ handle });

    const response = apiHandler(request);

    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith(request);
    expect(response).toEqual({
      ok: true,
      requestId: 'req-wrapper-generated',
      data: { delegated: true },
    });
  });
});
