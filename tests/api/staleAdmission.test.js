import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { ACTIVE_LIMIT, STALE_REQUEST_AGE_MS } = require('../../src/backend/Api/apiConstants.js');

const {
  buildStartedStore,
  loadApiHandlerModule,
  persistUserRequestStore,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
} = require('../helpers/apiHandlerTestUtils.js');

describe('Api/apiHandler – stale-entry pruning during admission', () => {
  let context;
  let warnSpy;

  beforeEach(() => {
    context = setupApiHandlerTestContext(vi, { installLogger: true });
    warnSpy = context.warnSpy;
  });

  afterEach(() => {
    teardownApiHandlerTestContext(vi, context);
  });

  it('stale started entries older than STALE_REQUEST_AGE_MS are pruned before active-count check and do not block new requests', () => {
    // Seed the store with ACTIVE_LIMIT stale started entries — all older than
    // the staleness threshold.  After pruning they should no longer count, so
    // the new request should be admitted (not rate-limited).
    const staleTime = Date.now() - STALE_REQUEST_AGE_MS - 1000;
    const store = buildStartedStore(
      ACTIVE_LIMIT,
      'stale-seed',
      staleTime,
      'getAuthorisationStatus'
    );
    persistUserRequestStore(store);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
    });

    expect(result).toMatchObject({ ok: true, requestId: expect.any(String) });
    expect(globalThis.getAuthorisationStatus).toHaveBeenCalledTimes(1);
  });

  it('recent started entries still count towards the active limit and cause RATE_LIMITED', () => {
    // Seed the store with ACTIVE_LIMIT recent started entries — all within the
    // staleness window.  None should be pruned, so the new request must be
    // rate-limited.
    const recentTime = Date.now() - 1000;
    const store = buildStartedStore(
      ACTIVE_LIMIT,
      'recent-seed',
      recentTime,
      'getAuthorisationStatus'
    );
    persistUserRequestStore(store);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
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
    const store = buildStartedStore(staleCount, 'stale-warn', staleTime, 'getAuthorisationStatus');
    persistUserRequestStore(store);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    dispatcher.handle({
      method: 'getAuthorisationStatus',
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

    persistUserRequestStore(store);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
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

    persistUserRequestStore(store);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
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
    persistUserRequestStore(store);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
    });

    expect(result).toMatchObject({ ok: true, requestId: expect.any(String) });
    expect(globalThis.getAuthorisationStatus).toHaveBeenCalledTimes(1);
  });
});
