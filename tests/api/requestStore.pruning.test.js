import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const requestStorePath = '../../src/backend/z_Api/requestStore.js';

const { STALE_REQUEST_AGE_MS } = require('../../src/backend/z_Api/apiConstants.js');

function loadRequestStoreModule() {
  delete require.cache[require.resolve(requestStorePath)];
  return require(requestStorePath);
}

describe('Api/requestStore – pruneStaleEntries', () => {
  beforeEach(() => {
    globalThis.PropertiesService._resetUserProperties();
  });

  afterEach(() => {
    globalThis.PropertiesService._resetUserProperties();
  });

  it('removes started entries whose startedAtMs is older than the staleness threshold', () => {
    const { pruneStaleEntries } = loadRequestStoreModule();

    const staleTime = Date.now() - STALE_REQUEST_AGE_MS - 1000;
    const store = {
      'stale-req-1': {
        requestId: 'stale-req-1',
        method: 'getAuthorisationStatus',
        status: 'started',
        startedAtMs: staleTime,
      },
      'stale-req-2': {
        requestId: 'stale-req-2',
        method: 'getAuthorisationStatus',
        status: 'started',
        startedAtMs: staleTime - 5000,
      },
    };

    pruneStaleEntries(store, STALE_REQUEST_AGE_MS);

    expect(store['stale-req-1']).toBeUndefined();
    expect(store['stale-req-2']).toBeUndefined();
  });

  it('leaves recent started entries untouched when startedAtMs is within the threshold', () => {
    const { pruneStaleEntries } = loadRequestStoreModule();

    const recentTime = Date.now() - 1000;
    const store = {
      'recent-req-1': {
        requestId: 'recent-req-1',
        method: 'getAuthorisationStatus',
        status: 'started',
        startedAtMs: recentTime,
      },
    };

    pruneStaleEntries(store, STALE_REQUEST_AGE_MS);

    expect(store['recent-req-1']).toBeDefined();
    expect(store['recent-req-1'].status).toBe('started');
  });

  it('never removes success entries regardless of age', () => {
    const { pruneStaleEntries } = loadRequestStoreModule();

    const veryOldTime = Date.now() - STALE_REQUEST_AGE_MS * 10;
    const store = {
      'old-success-1': {
        requestId: 'old-success-1',
        method: 'getAuthorisationStatus',
        status: 'success',
        startedAtMs: veryOldTime,
        finishedAtMs: veryOldTime + 500,
      },
    };

    pruneStaleEntries(store, STALE_REQUEST_AGE_MS);

    expect(store['old-success-1']).toBeDefined();
    expect(store['old-success-1'].status).toBe('success');
  });

  it('never removes error entries regardless of age', () => {
    const { pruneStaleEntries } = loadRequestStoreModule();

    const veryOldTime = Date.now() - STALE_REQUEST_AGE_MS * 10;
    const store = {
      'old-error-1': {
        requestId: 'old-error-1',
        method: 'getAuthorisationStatus',
        status: 'error',
        startedAtMs: veryOldTime,
        finishedAtMs: veryOldTime + 500,
        errorMessage: 'something failed',
      },
    };

    pruneStaleEntries(store, STALE_REQUEST_AGE_MS);

    expect(store['old-error-1']).toBeDefined();
    expect(store['old-error-1'].status).toBe('error');
  });

  it('mutates and returns the same store object', () => {
    const { pruneStaleEntries } = loadRequestStoreModule();

    const staleTime = Date.now() - STALE_REQUEST_AGE_MS - 1000;
    const store = {
      'stale-req-mut': {
        requestId: 'stale-req-mut',
        method: 'getAuthorisationStatus',
        status: 'started',
        startedAtMs: staleTime,
      },
    };

    const returned = pruneStaleEntries(store, STALE_REQUEST_AGE_MS);

    expect(returned).toBe(store);
  });

  it('returns an empty store unchanged when called on an empty store', () => {
    const { pruneStaleEntries } = loadRequestStoreModule();

    const store = {};
    const returned = pruneStaleEntries(store, STALE_REQUEST_AGE_MS);

    expect(returned).toBe(store);
    expect(Object.keys(returned)).toHaveLength(0);
  });
});
