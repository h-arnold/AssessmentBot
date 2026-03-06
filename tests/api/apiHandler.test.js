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
      requestId: 'req-valid-1',
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: 'req-valid-1',
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
      requestId: 'req-unknown-method',
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: 'req-unknown-method',
      error: {
        code: 'UNKNOWN_METHOD',
      },
    });
  });

  it('preserves caller-supplied requestId', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getAuthorisationStatus',
      requestId: 'req-preserved-123',
    });

    expect(response.requestId).toBe('req-preserved-123');
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

  it('returns DISPATCH_ERROR when an allowlisted handler throws', () => {
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw new Error('dispatch exploded');
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'getAuthorisationStatus',
      requestId: 'req-dispatch-error-1',
    });

    expect(response).toMatchObject({
      ok: false,
      requestId: 'req-dispatch-error-1',
      error: {
        code: 'DISPATCH_ERROR',
        message: 'dispatch exploded',
        retriable: true,
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

  it('uses global API_ALLOWLIST in vm context and returns DISPATCH_ERROR for unknown mapped handler', () => {
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
        code: 'DISPATCH_ERROR',
        message: 'Allowlisted handler is not implemented.',
        retriable: true,
      },
    });
  });

  it('GAS-global apiHandler delegates to ApiDispatcher.getInstance().handle(request)', () => {
    const { apiHandler, ApiDispatcher } = loadApiHandlerModule();

    const request = {
      method: 'getAuthorisationStatus',
      requestId: 'req-wrapper-1',
    };
    const handle = vi.fn(() => ({
      ok: true,
      requestId: request.requestId,
      data: { delegated: true },
    }));
    const getInstance = vi.spyOn(ApiDispatcher, 'getInstance').mockReturnValue({ handle });

    const response = apiHandler(request);

    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith(request);
    expect(response).toEqual({
      ok: true,
      requestId: request.requestId,
      data: { delegated: true },
    });
  });
});
