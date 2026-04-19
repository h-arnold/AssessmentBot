import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const apiHandlerPath = '../../src/backend/z_Api/z_apiHandler.js';
const apiConstantsPath = '../../src/backend/z_Api/apiConstants.js';
const googleClassroomsHandlerPath = '../../src/backend/z_Api/googleClassrooms.js';
const originalClassroomApiClient = globalThis.ClassroomApiClient;

const {
  callAuthorisationStatus,
  getApiDispatcherInstance,
  loadApiHandlerModule,
  readPersistedUserRequestStore,
  REFERENCE_DATA_API_METHOD_NAMES,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
} = require('../helpers/apiHandlerTestUtils.js');
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

const ABCLASS_TRANSPORT_API_METHOD_NAMES = Object.freeze([
  'getGoogleClassrooms',
  'upsertABClass',
  'updateABClass',
  'deleteABClass',
]);

const ABCLASS_TRANSPORT_API_METHOD_ENTRIES = Object.freeze(
  Object.fromEntries(
    ABCLASS_TRANSPORT_API_METHOD_NAMES.map((methodName) => [methodName, methodName])
  )
);

const BACKEND_CONFIG_API_METHOD_NAMES = Object.freeze(['getBackendConfig', 'setBackendConfig']);

const BACKEND_CONFIG_API_METHOD_ENTRIES = Object.freeze(
  Object.fromEntries(BACKEND_CONFIG_API_METHOD_NAMES.map((methodName) => [methodName, methodName]))
);

const ASSIGNMENT_DEFINITION_API_METHOD_NAMES = Object.freeze([
  'getAssignmentDefinitionPartials',
  'deleteAssignmentDefinition',
]);

const ASSIGNMENT_DEFINITION_API_METHOD_ENTRIES = Object.freeze(
  Object.fromEntries(
    ASSIGNMENT_DEFINITION_API_METHOD_NAMES.map((methodName) => [methodName, methodName])
  )
);

const ABCLASS_TRANSPORT_PARAMS = Object.freeze({
  getGoogleClassrooms: {},
  upsertABClass: {
    classId: 'class-upsert-001',
    cohortKey: 'coh-2026',
    yearGroupKey: 'yg-10',
    courseLength: 2,
  },
  updateABClass: {
    classId: 'class-update-001',
    cohortKey: 'coh-2027',
    yearGroupKey: 'yg-11',
    courseLength: 2,
    active: true,
  },
  deleteABClass: {
    classId: 'class-delete-001',
  },
});

const ABCLASS_TRANSPORT_RESULTS = Object.freeze({
  getGoogleClassrooms: [{ classId: 'course-001', className: '10A Computer Science' }],
  upsertABClass: { classId: 'class-upsert-001', saved: true },
  updateABClass: { classId: 'class-update-001', updated: true },
  deleteABClass: { classId: 'class-delete-001', deleted: true },
});

const REFERENCE_DATA_RESULTS = Object.freeze({
  getCohorts: [
    { key: 'coh-2026', name: 'Cohort 2026', active: true, startYear: 2025, startMonth: 9 },
  ],
  createCohort: {
    key: 'coh-2026',
    name: 'Cohort 2026',
    active: true,
    startYear: 2025,
    startMonth: 9,
  },
  updateCohort: {
    key: 'coh-2025',
    name: 'Cohort 2026',
    active: false,
    startYear: 2025,
    startMonth: 9,
  },
  getYearGroups: [{ key: 'yg-10', name: 'Year 10' }],
  createYearGroup: { key: 'yg-10', name: 'Year 10' },
  updateYearGroup: { key: 'yg-9', name: 'Year 10' },
  // Delete handlers are intentionally transport-void; keep explicit nulls to avoid implicit undefined stubs.
  deleteCohort: null,
  deleteYearGroup: null,
});

const ASSIGNMENT_DEFINITION_RESULTS = Object.freeze({
  getAssignmentDefinitionPartials: [
    {
      primaryTitle: 'Algebra Baseline',
      primaryTopic: 'Algebra',
      courseId: 'course-001',
      yearGroup: 10,
      alternateTitles: ['Algebra Starter'],
      alternateTopics: ['Linear Equations'],
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-doc-001',
      templateDocumentId: 'tpl-doc-001',
      assignmentWeighting: null,
      definitionKey: 'algebra-baseline',
      tasks: null,
      createdAt: '2026-01-05T10:00:00.000Z',
      updatedAt: '2026-01-06T12:30:00.000Z',
    },
  ],
  deleteAssignmentDefinition: undefined,
});

const ASSIGNMENT_DEFINITION_PARAMS = Object.freeze({
  deleteAssignmentDefinition: {
    definitionKey: 'algebra-baseline',
  },
});

function buildAbClassTransportHandlers() {
  return Object.fromEntries(
    ABCLASS_TRANSPORT_API_METHOD_NAMES.map((methodName) => [
      methodName,
      () => ABCLASS_TRANSPORT_RESULTS[methodName],
    ])
  );
}

function buildApiHandlerTestHandlers() {
  return {
    ...buildReferenceDataHandlers(),
    ...buildAbClassTransportHandlers(),
    ...buildAssignmentDefinitionHandlers(),
  };
}

const REFERENCE_DATA_PARAMS = Object.freeze({
  createCohort: { record: { name: 'Cohort 2026', active: true } },
  updateCohort: {
    key: 'coh-2025',
    record: { key: 'coh-2025', name: 'Cohort 2026', active: false },
  },
  deleteCohort: { key: 'coh-2026' },
  createYearGroup: { record: { name: 'Year 10' } },
  updateYearGroup: {
    key: 'yg-9',
    record: { key: 'yg-9', name: 'Year 10' },
  },
  deleteYearGroup: { key: 'yg-10' },
});

function buildReferenceDataHandlers() {
  return Object.fromEntries(
    REFERENCE_DATA_API_METHOD_NAMES.map((methodName) => [
      methodName,
      () => REFERENCE_DATA_RESULTS[methodName],
    ])
  );
}

function buildAssignmentDefinitionHandlers() {
  return Object.fromEntries(
    ASSIGNMENT_DEFINITION_API_METHOD_NAMES.map((methodName) => [
      methodName,
      () => ASSIGNMENT_DEFINITION_RESULTS[methodName],
    ])
  );
}

function handleApiRequest(method, params) {
  const { ApiDispatcher } = loadApiHandlerModule();
  return ApiDispatcher.getInstance().handle({
    method,
    ...(params === undefined ? {} : { params }),
  });
}

function expectFailureEnvelope(response, { code, message, withRequestId = false }) {
  if (withRequestId) {
    expect(response).toEqual({
      ok: false,
      requestId: response.requestId,
      error: {
        code,
        message,
        retriable: false,
      },
    });
    expect(response.requestId).toEqual(expect.any(String));
    return;
  }

  expect(response).toMatchObject({
    ok: false,
    error: {
      code,
      message,
      retriable: false,
    },
  });
}

function expectBoundaryFailureLog(errorSpy, { response, methodName, thrownValue }) {
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith(
    'API request failed.',
    expect.objectContaining({
      requestId: response.requestId,
      method: methodName,
    }),
    thrownValue
  );
}

function expectBoundaryFailureConsoleErrorLog(
  consoleErrorSpy,
  { response, methodName, thrownError }
) {
  const boundaryCall = consoleErrorSpy.mock.calls.find(
    (args) =>
      args[0] === 'API request failed.' &&
      args[1]?.requestId === response.requestId &&
      args[1]?.method === methodName
  );

  expect(boundaryCall).toBeDefined();
  expect(boundaryCall[2]).toEqual(
    expect.objectContaining({
      name: thrownError.name,
      message: thrownError.message,
      stack: thrownError.stack,
    })
  );

  return boundaryCall;
}

const INVALID_REQUEST_FAILURE_CASES = Object.freeze([
  {
    description:
      'maps controller validation failures for reference-data handlers to the existing API failure envelope',
    methodName: 'createCohort',
    params: REFERENCE_DATA_PARAMS.createCohort,
    handlerName: 'createCohort',
    errorMessage: 'Invalid cohort payload',
    requestId: 'req-create-cohort',
    withRequestId: false,
  },
  {
    description:
      'maps ApiValidationError from upsertABClass to INVALID_REQUEST and preserves the failure envelope shape',
    methodName: 'upsertABClass',
    params: ABCLASS_TRANSPORT_PARAMS.upsertABClass,
    handlerName: 'upsertABClass',
    errorMessage: 'Invalid ABClass payload',
    requestId: 'req-upsert-abclass',
    withRequestId: true,
  },
  {
    description:
      'maps ApiValidationError from updateABClass to INVALID_REQUEST and preserves the failure envelope shape',
    methodName: 'updateABClass',
    params: ABCLASS_TRANSPORT_PARAMS.updateABClass,
    handlerName: 'updateABClass',
    errorMessage: 'Invalid ABClass update payload',
    requestId: 'req-update-abclass',
    withRequestId: true,
  },
]);

const IN_USE_FAILURE_CASES = Object.freeze([
  {
    description:
      'maps a plain Error with reason = IN_USE from deleteCohort to error.code = IN_USE (delete-blocked contract)',
    methodName: 'deleteCohort',
    params: REFERENCE_DATA_PARAMS.deleteCohort,
    handlerName: 'deleteCohort',
    errorMessage: 'Cohort record is referenced by one or more classes',
  },
  {
    description:
      'maps a plain Error with reason = IN_USE from deleteYearGroup to error.code = IN_USE (delete-blocked contract)',
    methodName: 'deleteYearGroup',
    params: REFERENCE_DATA_PARAMS.deleteYearGroup,
    handlerName: 'deleteYearGroup',
    errorMessage: 'Year group record is referenced by one or more classes',
  },
]);

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
          getProperty: (k) => (Object.hasOwn(store, k) ? store[k] : null),
          setProperty: (k, v) => {
            store[k] = v;
          },
        };
      },
    },
    ABLogger: { getInstance: () => ({ warn: () => {}, info: () => {}, error: () => {} }) },
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

  it('contains all reference-data methods in API_METHODS', () => {
    const { API_METHODS } = loadApiConstantsModule();

    expect(API_METHODS).toEqual(
      expect.objectContaining(
        Object.fromEntries(
          REFERENCE_DATA_API_METHOD_NAMES.map((methodName) => [methodName, methodName])
        )
      )
    );
  });

  it('contains all reference-data methods in API_ALLOWLIST', () => {
    const { API_ALLOWLIST } = loadApiConstantsModule();

    expect(API_ALLOWLIST).toEqual(
      expect.objectContaining(
        Object.fromEntries(
          REFERENCE_DATA_API_METHOD_NAMES.map((methodName) => [methodName, methodName])
        )
      )
    );
  });

  it('contains all ABClass transport methods in API_METHODS', () => {
    const { API_METHODS } = loadApiConstantsModule();

    expect(API_METHODS).toEqual(expect.objectContaining(ABCLASS_TRANSPORT_API_METHOD_ENTRIES));
  });

  it('contains all ABClass transport methods in API_ALLOWLIST', () => {
    const { API_ALLOWLIST } = loadApiConstantsModule();

    expect(API_ALLOWLIST).toEqual(expect.objectContaining(ABCLASS_TRANSPORT_API_METHOD_ENTRIES));
  });

  it('contains the backend configuration methods in API_METHODS', () => {
    const { API_METHODS } = loadApiConstantsModule();

    expect(API_METHODS).toEqual(expect.objectContaining(BACKEND_CONFIG_API_METHOD_ENTRIES));
  });

  it('contains the backend configuration methods in API_ALLOWLIST', () => {
    const { API_ALLOWLIST } = loadApiConstantsModule();

    expect(API_ALLOWLIST).toEqual(expect.objectContaining(BACKEND_CONFIG_API_METHOD_ENTRIES));
  });

  it('contains assignment-definition partial methods in API_METHODS', () => {
    const { API_METHODS } = loadApiConstantsModule();

    expect(API_METHODS).toEqual(expect.objectContaining(ASSIGNMENT_DEFINITION_API_METHOD_ENTRIES));
  });

  it('contains assignment-definition partial methods in API_ALLOWLIST', () => {
    const { API_ALLOWLIST } = loadApiConstantsModule();

    expect(API_ALLOWLIST).toEqual(
      expect.objectContaining(ASSIGNMENT_DEFINITION_API_METHOD_ENTRIES)
    );
  });
});

describe('Api/apiHandler dispatcher', () => {
  let context;

  beforeEach(() => {
    context = setupApiHandlerTestContext(vi, {
      installLogger: true,
      additionalHandlers: buildApiHandlerTestHandlers(),
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
    const syntheticHandlerName = 'syntheticNonAllowlistedHandler';
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

  it('captures boundary error diagnostics for unexpected handler failures through the shared logger harness', () => {
    const thrownError = new Error('dispatch exploded');
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw thrownError;
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
    expect(context.errorSpy).toHaveBeenCalledTimes(1);
    expect(context.errorSpy).toHaveBeenCalledWith(
      'API request failed.',
      expect.objectContaining({
        requestId: response.requestId,
        method: 'getAuthorisationStatus',
      }),
      thrownError
    );
  });

  it('preserves top-level Error details at the console.error seam when using the real ABLogger path', () => {
    teardownApiHandlerTestContext(vi, context);
    context = setupApiHandlerTestContext(vi, { installLogger: 'real' });

    const thrownError = new TypeError('dispatch exploded');
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw thrownError;
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
    expect(context.consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(context.consoleErrorSpy).toHaveBeenCalledWith(
      'API request failed.',
      expect.objectContaining({
        requestId: response.requestId,
        method: 'getAuthorisationStatus',
      }),
      expect.objectContaining({
        name: thrownError.name,
        message: thrownError.message,
        stack: thrownError.stack,
      })
    );
  });

  it.each([
    ['info', 'consoleInfoSpy', 'Controlled downstream info before failure.'],
    ['warn', 'consoleWarnSpy', 'Controlled downstream warning before failure.'],
  ])(
    'preserves controlled downstream ABLogger.%s activity when the handler later fails',
    (loggerMethod, consoleSpyName, downstreamMessage) => {
      teardownApiHandlerTestContext(vi, context);
      context = setupApiHandlerTestContext(vi, {
        installLogger: 'real',
        additionalHandlers: buildApiHandlerTestHandlers(),
      });

      const thrownError = new Error('controlled downstream ' + loggerMethod + ' failure');
      globalThis.getAuthorisationStatus = vi.fn(() => {
        ABLogger.getInstance()[loggerMethod](downstreamMessage, {
          source: 'controlled-downstream-stub',
        });
        throw thrownError;
      });

      const dispatcher = getApiDispatcherInstance();

      const response = callAuthorisationStatus(dispatcher);

      expectFailureEnvelope(response, {
        code: 'INTERNAL_ERROR',
        message: 'Internal API error.',
        withRequestId: true,
      });
      expect(context[consoleSpyName]).toHaveBeenCalledWith(downstreamMessage, {
        source: 'controlled-downstream-stub',
      });
      expectBoundaryFailureConsoleErrorLog(context.consoleErrorSpy, {
        response,
        methodName: 'getAuthorisationStatus',
        thrownError,
      });
    }
  );

  it('preserves controlled downstream error traffic shaped like ProgressTracker developer logging when the request fails', () => {
    teardownApiHandlerTestContext(vi, context);
    context = setupApiHandlerTestContext(vi, {
      installLogger: 'real',
      additionalHandlers: buildApiHandlerTestHandlers(),
    });

    const thrownError = new Error('controlled downstream request-path failure');
    globalThis.updateYearGroup = vi.fn(() => {
      ABLogger.getInstance().error('ProgressTracker logged a user-facing error.', {
        errorMessage: 'Could not update the year group.',
      });
      ABLogger.getInstance().error('Developer details - Stack trace:', thrownError.stack);
      ABLogger.getInstance().error('Developer details - Message:', thrownError.message);
      ABLogger.getInstance().error('Developer details - Error type:', thrownError.name);
      throw thrownError;
    });

    const response = handleApiRequest('updateYearGroup', REFERENCE_DATA_PARAMS.updateYearGroup);

    expectFailureEnvelope(response, {
      code: 'INTERNAL_ERROR',
      message: 'Internal API error.',
      withRequestId: true,
    });

    expect(context.consoleErrorSpy).toHaveBeenCalledWith(
      'ProgressTracker logged a user-facing error.',
      { errorMessage: 'Could not update the year group.' }
    );
    expect(context.consoleErrorSpy).toHaveBeenCalledWith(
      'Developer details - Stack trace:',
      thrownError.stack
    );
    expect(context.consoleErrorSpy).toHaveBeenCalledWith(
      'Developer details - Message:',
      thrownError.message
    );
    expect(context.consoleErrorSpy).toHaveBeenCalledWith(
      'Developer details - Error type:',
      thrownError.name
    );

    const lastDownstreamLogIndex = context.consoleErrorSpy.mock.calls
      .map((args, index) => ({ args, index }))
      .findLast(({ args }) => args[0] !== 'API request failed.')?.index;
    const boundaryLogIndex = context.consoleErrorSpy.mock.calls.findIndex(
      (args) => args[0] === 'API request failed.'
    );

    expect(lastDownstreamLogIndex).toBeGreaterThanOrEqual(0);
    expect(boundaryLogIndex).toBeGreaterThan(lastDownstreamLogIndex);
    expectBoundaryFailureConsoleErrorLog(context.consoleErrorSpy, {
      response,
      methodName: 'updateYearGroup',
      thrownError,
    });
  });

  it.each(REFERENCE_DATA_API_METHOD_NAMES)(
    'routes %s to the matching allowlisted handler',
    (methodName) => {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();
      const params = REFERENCE_DATA_PARAMS[methodName];
      const expectedData = REFERENCE_DATA_RESULTS[methodName];

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

  it.each(ABCLASS_TRANSPORT_API_METHOD_NAMES)(
    'routes %s to the matching allowlisted handler',
    (methodName) => {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();
      const params = ABCLASS_TRANSPORT_PARAMS[methodName];
      const expectedData = ABCLASS_TRANSPORT_RESULTS[methodName];

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

  it.each(ASSIGNMENT_DEFINITION_API_METHOD_NAMES)(
    'routes %s to the matching allowlisted handler',
    (methodName) => {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();
      const params = ASSIGNMENT_DEFINITION_PARAMS[methodName];
      const expectedData = ASSIGNMENT_DEFINITION_RESULTS[methodName];

      globalThis[methodName].mockImplementation(() => expectedData);

      const response = dispatcher.handle({
        method: methodName,
        ...(params === undefined ? {} : { params }),
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
    const expectedData = [
      { key: 'coh-2026', name: 'Cohort 2026', active: true, startYear: 2025, startMonth: 9 },
    ];

    globalThis.getCohorts.mockImplementation(() => expectedData);

    const response = dispatcher.handle({
      method: 'getCohorts',
    });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual(expectedData);
    expect(response.data.ok).toBeUndefined();
    expect(response.data.error).toBeUndefined();
  });

  it.each(INVALID_REQUEST_FAILURE_CASES)(
    '$description',
    ({ methodName, params, handlerName, errorMessage, requestId, withRequestId }) => {
      globalThis[handlerName].mockImplementation(() => {
        throw new ApiValidationError(errorMessage, { requestId });
      });

      const response = handleApiRequest(methodName, params);

      expectFailureEnvelope(response, {
        code: 'INVALID_REQUEST',
        message: errorMessage,
        withRequestId,
      });
    }
  );

  it.each(INVALID_REQUEST_FAILURE_CASES)(
    'emits one boundary diagnostic for $methodName validation failures while preserving the INVALID_REQUEST envelope',
    ({ methodName, params, handlerName, errorMessage, requestId, withRequestId }) => {
      const thrownError = new ApiValidationError(errorMessage, { requestId });
      globalThis[handlerName].mockImplementation(() => {
        throw thrownError;
      });

      const response = handleApiRequest(methodName, params);

      expectFailureEnvelope(response, {
        code: 'INVALID_REQUEST',
        message: errorMessage,
        withRequestId,
      });
      expectBoundaryFailureLog(context.errorSpy, {
        response,
        methodName,
        thrownValue: thrownError,
      });
    }
  );

  it.each(IN_USE_FAILURE_CASES)(
    '$description',
    ({ methodName, params, handlerName, errorMessage }) => {
      const blockedError = new Error(errorMessage);
      blockedError.reason = 'IN_USE';
      globalThis[handlerName].mockImplementation(() => {
        throw blockedError;
      });

      const response = handleApiRequest(methodName, params);

      expectFailureEnvelope(response, {
        code: 'IN_USE',
        message: expect.any(String),
        withRequestId: true,
      });
    }
  );

  it.each(IN_USE_FAILURE_CASES)(
    'emits one boundary diagnostic for $methodName delete-blocked failures while preserving the IN_USE envelope',
    ({ methodName, params, handlerName, errorMessage }) => {
      const blockedError = new Error(errorMessage);
      blockedError.reason = 'IN_USE';
      globalThis[handlerName].mockImplementation(() => {
        throw blockedError;
      });

      const response = handleApiRequest(methodName, params);

      expectFailureEnvelope(response, {
        code: 'IN_USE',
        message: expect.any(String),
        withRequestId: true,
      });
      expectBoundaryFailureLog(context.errorSpy, {
        response,
        methodName,
        thrownValue: blockedError,
      });
    }
  );

  it('does not map a plain Error without reason = IN_USE to IN_USE (generic errors remain INTERNAL_ERROR)', () => {
    globalThis.deleteCohort.mockImplementation(() => {
      throw new Error('Something else exploded');
    });

    const response = handleApiRequest('deleteCohort', REFERENCE_DATA_PARAMS.deleteCohort);

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        retriable: false,
      },
    });
  });

  it('maps unexpected controller failures for reference-data handlers to the existing API failure envelope', () => {
    globalThis.updateYearGroup.mockImplementation(() => {
      throw new Error('year-group update exploded');
    });

    const response = handleApiRequest('updateYearGroup', REFERENCE_DATA_PARAMS.updateYearGroup);

    expectFailureEnvelope(response, {
      code: 'INTERNAL_ERROR',
      message: 'Internal API error.',
    });
  });

  it('maps unexpected failures from deleteABClass to INTERNAL_ERROR and preserves the failure envelope shape', () => {
    globalThis.deleteABClass.mockImplementation(() => {
      throw new Error('delete exploded');
    });

    const response = handleApiRequest('deleteABClass', ABCLASS_TRANSPORT_PARAMS.deleteABClass);

    expectFailureEnvelope(response, {
      code: 'INTERNAL_ERROR',
      message: 'Internal API error.',
      withRequestId: true,
    });
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
      const error = new Error('placeholder message');
      error.name = 'ApiValidationError';
      error.message = undefined;
      throw error;
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

  it('logs non-Error thrown values deterministically while preserving the INTERNAL_ERROR envelope', () => {
    const thrownValue = { detail: 'plain-object-failure', severity: 'high' };
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw thrownValue;
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
    expectBoundaryFailureLog(context.errorSpy, {
      response,
      methodName: 'getAuthorisationStatus',
      thrownValue,
    });
  });

  it('records the failed request during completion after boundary logging has run', () => {
    const requestId = 'req-boundary-before-completion';
    const callOrder = [];
    const hadUtilities = Object.hasOwn(globalThis, 'Utilities');
    const originalUtilities = globalThis.Utilities;
    const originalGetUserProperties = globalThis.PropertiesService.getUserProperties;
    const baseUserProperties = originalGetUserProperties.call(globalThis.PropertiesService);

    globalThis.Utilities = {
      getUuid: vi.fn(() => requestId),
    };
    globalThis.PropertiesService.getUserProperties = () => ({
      getProperty(key) {
        return baseUserProperties.getProperty(key);
      },
      setProperty(key, value) {
        const parsed = JSON.parse(value);
        if (parsed[requestId]?.status === 'started') {
          callOrder.push('admissionSave');
        }
        if (parsed[requestId]?.status === 'error') {
          callOrder.push('completionSave');
        }
        return baseUserProperties.setProperty(key, value);
      },
    });
    context.errorSpy.mockImplementation(() => {
      callOrder.push('boundaryLog');
    });
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw new Error('completion should follow boundary logging');
    });

    try {
      const dispatcher = getApiDispatcherInstance();

      const response = callAuthorisationStatus(dispatcher);

      expect(response).toMatchObject({
        ok: false,
        requestId,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
      expect(readPersistedUserRequestStore()[requestId]).toMatchObject({
        status: 'error',
        errorMessage: 'Error: completion should follow boundary logging',
      });
      expect(callOrder).toEqual(expect.arrayContaining(['boundaryLog', 'completionSave']));
      expect(callOrder.indexOf('boundaryLog')).toBeLessThan(callOrder.indexOf('completionSave'));
    } finally {
      globalThis.PropertiesService.getUserProperties = originalGetUserProperties;
      if (hadUtilities) {
        globalThis.Utilities = originalUtilities;
      } else {
        delete globalThis.Utilities;
      }
    }
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
