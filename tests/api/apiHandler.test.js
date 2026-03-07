import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const apiHandlerPath = '../../src/backend/Api/apiHandler.js';
const apiConstantsPath = '../../src/backend/Api/apiConstants.js';

function loadApiHandlerModule() {
  delete require.cache[require.resolve(apiHandlerPath)];
  return require(apiHandlerPath);
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
});

describe('Api/apiHandler dispatcher', () => {
  let originalGetAuthorisationStatus;

  beforeEach(() => {
    globalThis.PropertiesService._resetUserProperties();
    originalGetAuthorisationStatus = globalThis.getAuthorisationStatus;
    globalThis.getAuthorisationStatus = vi.fn(() => ({ authorised: true }));
  });

  afterEach(() => {
    globalThis.PropertiesService._resetUserProperties();
    if (originalGetAuthorisationStatus === undefined) {
      delete globalThis.getAuthorisationStatus;
    } else {
      globalThis.getAuthorisationStatus = originalGetAuthorisationStatus;
    }

    vi.restoreAllMocks();
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
