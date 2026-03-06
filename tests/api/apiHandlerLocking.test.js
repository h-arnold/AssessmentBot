import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiHandlerPath = '../../src/backend/Api/apiHandler.js';

function loadApiHandlerModule() {
  delete require.cache[require.resolve(apiHandlerPath)];
  return require(apiHandlerPath);
}

describe('Api/apiHandler – atomicity and lock-protected tracking', () => {
  let mockLock;
  let originalGetAuthorisationStatus;
  let originalLockService;

  beforeEach(() => {
    globalThis.PropertiesService._resetUserProperties();

    originalGetAuthorisationStatus = globalThis.getAuthorisationStatus;
    globalThis.getAuthorisationStatus = vi.fn(() => ({ authorised: true }));

    originalLockService = globalThis.LockService;
    mockLock = { tryLock: vi.fn(() => true), releaseLock: vi.fn() };
    globalThis.LockService = {
      getUserLock: vi.fn(() => mockLock),
    };
  });

  afterEach(() => {
    globalThis.PropertiesService._resetUserProperties();

    if (originalGetAuthorisationStatus === undefined) {
      delete globalThis.getAuthorisationStatus;
    } else {
      globalThis.getAuthorisationStatus = originalGetAuthorisationStatus;
    }

    if (originalLockService === undefined) {
      delete globalThis.LockService;
    } else {
      globalThis.LockService = originalLockService;
    }

    vi.restoreAllMocks();
  });

  it('acquires and releases the lock atomically around the admission store-write', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const callOrder = [];
    mockLock.tryLock.mockImplementation(() => {
      callOrder.push('tryLock');
      return true;
    });
    mockLock.releaseLock.mockImplementation(() => {
      callOrder.push('releaseLock');
    });
    globalThis.getAuthorisationStatus = vi.fn(() => {
      callOrder.push('handler');
      return { authorised: true };
    });

    dispatcher.handle({ method: 'getAuthorisationStatus', params: {}, requestId: 'req-lock-1' });

    // tryLock must be called before the handler (admission lock acquired first)
    const firstTryLock = callOrder.indexOf('tryLock');
    const handlerCall = callOrder.indexOf('handler');
    expect(firstTryLock).toBeGreaterThanOrEqual(0);
    expect(handlerCall).toBeGreaterThan(firstTryLock);
  });

  it('acquires and releases a second lock atomically around the completion store-write', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    dispatcher.handle({ method: 'getAuthorisationStatus', params: {}, requestId: 'req-lock-2' });

    // Lock must be acquired at least twice (admission + completion)
    expect(mockLock.tryLock.mock.calls.length).toBeGreaterThanOrEqual(2);
    // Lock must be released at least twice
    expect(mockLock.releaseLock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('calls the handler AFTER the admission lock has been released', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const callOrder = [];
    let releaseCount = 0;
    mockLock.releaseLock.mockImplementation(() => {
      releaseCount++;
      callOrder.push(`releaseLock-${releaseCount}`);
    });
    globalThis.getAuthorisationStatus = vi.fn(() => {
      callOrder.push('handler');
      return { authorised: true };
    });

    dispatcher.handle({ method: 'getAuthorisationStatus', params: {}, requestId: 'req-lock-3' });

    // The admission releaseLock (first release) must come before the handler
    const firstRelease = callOrder.indexOf('releaseLock-1');
    const handlerCall = callOrder.indexOf('handler');
    expect(firstRelease).toBeGreaterThanOrEqual(0);
    expect(handlerCall).toBeGreaterThan(firstRelease);
  });

  it('releases the lock after successful handler execution', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
      params: {},
      requestId: 'req-lock-4',
    });

    expect(result.ok).toBe(true);
    expect(mockLock.releaseLock).toHaveBeenCalled();
  });

  it('releases the lock even when the handler throws', () => {
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw new Error('handler failure');
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
      params: {},
      requestId: 'req-lock-5',
    });

    // releaseLock must still have been called in the completion phase
    expect(mockLock.releaseLock).toHaveBeenCalled();
    // The response must indicate failure
    expect(result.ok).toBe(false);
  });

  it('returns RATE_LIMITED when admission-phase tryLock returns false', () => {
    mockLock.tryLock.mockReturnValue(false);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
      params: {},
      requestId: 'req-lock-6',
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED', retriable: true },
    });
    // Handler must not have been called
    expect(globalThis.getAuthorisationStatus).not.toHaveBeenCalled();
  });

  it('does not leave the admission lock held when completion-phase lock acquisition fails', () => {
    let callCount = 0;
    mockLock.tryLock.mockImplementation(() => {
      callCount++;
      // Admission lock succeeds; completion lock fails
      return callCount === 1;
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    dispatcher.handle({ method: 'getAuthorisationStatus', params: {}, requestId: 'req-lock-7' });

    // The admission lock must have been released (called at least once)
    expect(mockLock.releaseLock).toHaveBeenCalled();
  });

  it('returns RATE_LIMITED when the active request count has reached the configured limit', () => {
    const {
      ACTIVE_LIMIT,
      USER_REQUEST_STORE_KEY,
    } = require('../../src/backend/Api/apiConstants.js');

    // Seed the store with ACTIVE_LIMIT started entries so the next admission is rejected.
    const store = {};
    for (let i = 0; i < ACTIVE_LIMIT; i++) {
      const id = `seed-req-${i}`;
      store[id] = {
        requestId: id,
        method: 'getAuthorisationStatus',
        status: 'started',
        startedAtMs: Date.now(),
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
    // Handler must not have been called.
    expect(globalThis.getAuthorisationStatus).not.toHaveBeenCalled();
  });
});
