import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiHandlerPath = '../../src/backend/Api/apiHandler.js';

const {
  ACTIVE_LIMIT,
  STALE_REQUEST_AGE_MS,
  USER_REQUEST_STORE_KEY,
} = require('../../src/backend/Api/apiConstants.js');

function loadApiHandlerModule() {
  delete require.cache[require.resolve(apiHandlerPath)];
  return require(apiHandlerPath);
}

describe('Api/apiHandler – stale-entry pruning during admission', () => {
  let warnSpy;
  let mockLoggerInstance;
  let originalABLogger;

  beforeEach(() => {
    globalThis.PropertiesService._resetUserProperties();

    // Replace the global ABLogger with a spy so tests can assert on warn calls.
    originalABLogger = globalThis.ABLogger;
    warnSpy = vi.fn();
    mockLoggerInstance = {
      debug: () => {},
      debugUi: () => {},
      info: () => {},
      warn: warnSpy,
      error: () => {},
      log: () => {},
    };
    globalThis.ABLogger = {
      getInstance: () => mockLoggerInstance,
    };

    globalThis.getAuthorisationStatus = vi.fn(() => ({ authorised: true }));
  });

  afterEach(() => {
    globalThis.PropertiesService._resetUserProperties();
    globalThis.ABLogger = originalABLogger;

    if (globalThis.getAuthorisationStatus !== undefined) {
      delete globalThis.getAuthorisationStatus;
    }

    vi.restoreAllMocks();
  });

  it('stale started entries older than STALE_REQUEST_AGE_MS are pruned before active-count check and do not block new requests', () => {
    // Seed the store with ACTIVE_LIMIT stale started entries — all older than
    // the staleness threshold.  After pruning they should no longer count, so
    // the new request should be admitted (not rate-limited).
    const staleTime = Date.now() - STALE_REQUEST_AGE_MS - 1000;
    const store = {};
    for (let i = 0; i < ACTIVE_LIMIT; i++) {
      const id = `stale-seed-${i}`;
      store[id] = {
        requestId: id,
        method: 'getAuthorisationStatus',
        status: 'started',
        startedAtMs: staleTime,
      };
    }
    globalThis.PropertiesService.getUserProperties().setProperty(
      USER_REQUEST_STORE_KEY,
      JSON.stringify(store)
    );

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
      requestId: 'req-after-stale',
    });

    expect(result).toMatchObject({ ok: true, requestId: 'req-after-stale' });
    expect(globalThis.getAuthorisationStatus).toHaveBeenCalledTimes(1);
  });

  it('recent started entries still count towards the active limit and cause RATE_LIMITED', () => {
    // Seed the store with ACTIVE_LIMIT recent started entries — all within the
    // staleness window.  None should be pruned, so the new request must be
    // rate-limited.
    const recentTime = Date.now() - 1000;
    const store = {};
    for (let i = 0; i < ACTIVE_LIMIT; i++) {
      const id = `recent-seed-${i}`;
      store[id] = {
        requestId: id,
        method: 'getAuthorisationStatus',
        status: 'started',
        startedAtMs: recentTime,
      };
    }
    globalThis.PropertiesService.getUserProperties().setProperty(
      USER_REQUEST_STORE_KEY,
      JSON.stringify(store)
    );

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
      requestId: 'req-over-recent-limit',
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED', retriable: true },
    });
    expect(globalThis.getAuthorisationStatus).not.toHaveBeenCalled();
  });

  it('calls ABLogger.warn once for each stale entry that is pruned', () => {
    const staleTime = Date.now() - STALE_REQUEST_AGE_MS - 1000;
    const staleCount = 3;
    const store = {};
    for (let i = 0; i < staleCount; i++) {
      const id = `stale-warn-${i}`;
      store[id] = {
        requestId: id,
        method: 'getAuthorisationStatus',
        status: 'started',
        startedAtMs: staleTime,
      };
    }
    globalThis.PropertiesService.getUserProperties().setProperty(
      USER_REQUEST_STORE_KEY,
      JSON.stringify(store)
    );

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    dispatcher.handle({
      method: 'getAuthorisationStatus',
      requestId: 'req-warn-check',
    });

    expect(warnSpy).toHaveBeenCalledTimes(staleCount);
  });

  it('returns RATE_LIMITED when active count equals ACTIVE_LIMIT after pruning stale entries', () => {
    const recentTime = Date.now() - 1000;
    const staleTime = Date.now() - STALE_REQUEST_AGE_MS - 1000;
    const store = {};

    // One stale entry that will be pruned.
    store['stale-one'] = {
      requestId: 'stale-one',
      method: 'getAuthorisationStatus',
      status: 'started',
      startedAtMs: staleTime,
    };

    // Exactly ACTIVE_LIMIT recent entries that remain after pruning.
    for (let i = 0; i < ACTIVE_LIMIT; i++) {
      const id = `recent-limit-${i}`;
      store[id] = {
        requestId: id,
        method: 'getAuthorisationStatus',
        status: 'started',
        startedAtMs: recentTime,
      };
    }

    globalThis.PropertiesService.getUserProperties().setProperty(
      USER_REQUEST_STORE_KEY,
      JSON.stringify(store)
    );

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
      requestId: 'req-at-limit',
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED', retriable: true },
    });
  });

  it('returns RATE_LIMITED when active count exceeds ACTIVE_LIMIT after pruning stale entries', () => {
    const recentTime = Date.now() - 1000;
    const staleTime = Date.now() - STALE_REQUEST_AGE_MS - 1000;
    const store = {};

    // Two stale entries that will be pruned.
    for (let i = 0; i < 2; i++) {
      const id = `stale-excess-${i}`;
      store[id] = {
        requestId: id,
        method: 'getAuthorisationStatus',
        status: 'started',
        startedAtMs: staleTime,
      };
    }

    // ACTIVE_LIMIT + 1 recent entries, exceeding the limit even after pruning.
    for (let i = 0; i < ACTIVE_LIMIT + 1; i++) {
      const id = `recent-excess-${i}`;
      store[id] = {
        requestId: id,
        method: 'getAuthorisationStatus',
        status: 'started',
        startedAtMs: recentTime,
      };
    }

    globalThis.PropertiesService.getUserProperties().setProperty(
      USER_REQUEST_STORE_KEY,
      JSON.stringify(store)
    );

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
      requestId: 'req-over-limit',
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED', retriable: true },
    });
  });

  it('returns a success response when the store contains only stale started entries', () => {
    // All entries are stale — after pruning the active count is zero, so the
    // request must be admitted successfully.
    const staleTime = Date.now() - STALE_REQUEST_AGE_MS - 5000;
    const store = {};
    for (let i = 0; i < 5; i++) {
      const id = `stale-only-${i}`;
      store[id] = {
        requestId: id,
        method: 'getAuthorisationStatus',
        status: 'started',
        startedAtMs: staleTime,
      };
    }
    globalThis.PropertiesService.getUserProperties().setProperty(
      USER_REQUEST_STORE_KEY,
      JSON.stringify(store)
    );

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
      requestId: 'req-stale-only',
    });

    expect(result).toMatchObject({ ok: true, requestId: 'req-stale-only' });
    expect(globalThis.getAuthorisationStatus).toHaveBeenCalledTimes(1);
  });
});
