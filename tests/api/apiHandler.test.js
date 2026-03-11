import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const apiHandlerPath = '../../src/backend/z_Api/apiHandler.js';
const apiConstantsPath = '../../src/backend/z_Api/apiConstants.js';

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
