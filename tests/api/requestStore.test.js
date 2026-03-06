import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const requestStorePath = '../../src/backend/Api/requestStore.js';

// Known constants — will be defined in apiConstants.js during implementation.
const USER_REQUEST_STORE_KEY = 'AB_USER_REQUEST_STORE';
const MAX_TRACKED_REQUESTS = 30;

function loadRequestStoreModule() {
  delete require.cache[require.resolve(requestStorePath)];
  return require(requestStorePath);
}

describe('Api/requestStore', () => {
  beforeEach(() => {
    // Isolate each test with a clean in-memory property store.
    globalThis.PropertiesService._resetUserProperties();
    delete require.cache[require.resolve(requestStorePath)];
  });

  afterEach(() => {
    globalThis.PropertiesService._resetUserProperties();
  });

  // ── createStartedRecord ────────────────────────────────────────────────────

  describe('createStartedRecord', () => {
    it('returns a record with requestId, method, status "started", and a numeric startedAtMs', () => {
      const { createStartedRecord } = loadRequestStoreModule();

      const record = createStartedRecord('req-001', 'getAuthorisationStatus');

      expect(record.requestId).toBe('req-001');
      expect(record.method).toBe('getAuthorisationStatus');
      expect(record.status).toBe('started');
      expect(record.startedAtMs).toBeTypeOf('number');
      expect(record.startedAtMs).toBeGreaterThan(0);
    });
  });

  // ── markSuccess ───────────────────────────────────────────────────────────

  describe('markSuccess', () => {
    it('updates status to "success" and sets a numeric finishedAtMs', () => {
      const { createStartedRecord, markSuccess } = loadRequestStoreModule();

      const store = { 'req-002': createStartedRecord('req-002', 'someMethod') };

      const updated = markSuccess(store, 'req-002');

      expect(updated['req-002'].status).toBe('success');
      expect(updated['req-002'].finishedAtMs).toBeTypeOf('number');
      expect(updated['req-002'].finishedAtMs).toBeGreaterThan(0);
    });
  });

  // ── markError ─────────────────────────────────────────────────────────────

  describe('markError', () => {
    it('updates status to "error", sets finishedAtMs, and stores the errorMessage', () => {
      const { createStartedRecord, markError } = loadRequestStoreModule();

      const store = { 'req-003': createStartedRecord('req-003', 'someMethod') };

      const updated = markError(store, 'req-003', 'Something went wrong');

      expect(updated['req-003'].status).toBe('error');
      expect(updated['req-003'].finishedAtMs).toBeTypeOf('number');
      expect(updated['req-003'].finishedAtMs).toBeGreaterThan(0);
      expect(updated['req-003'].errorMessage).toBe('Something went wrong');
    });
  });

  // ── loadStore ─────────────────────────────────────────────────────────────

  describe('loadStore', () => {
    it('returns an empty object when the user property is absent (getProperty returns null)', () => {
      const { loadStore } = loadRequestStoreModule();

      // PropertiesService returns null by default — no prior setProperty call.
      const store = loadStore();

      expect(store).toEqual({});
    });

    it('recovers safely when stored JSON is malformed, returning an empty object', () => {
      globalThis.PropertiesService.getUserProperties().setProperty(
        USER_REQUEST_STORE_KEY,
        'not-valid-json{{{'
      );

      const { loadStore } = loadRequestStoreModule();

      const store = loadStore();

      expect(store).toEqual({});
    });

    it('recovers safely when stored JSON is a valid but non-object value (array), returning an empty object', () => {
      globalThis.PropertiesService.getUserProperties().setProperty(
        USER_REQUEST_STORE_KEY,
        JSON.stringify([1, 2, 3])
      );

      const { loadStore } = loadRequestStoreModule();

      const store = loadStore();

      expect(store).toEqual({});
    });

    it('recovers safely when stored JSON is a valid but non-object primitive (number), returning an empty object', () => {
      globalThis.PropertiesService.getUserProperties().setProperty(
        USER_REQUEST_STORE_KEY,
        JSON.stringify(42)
      );

      const { loadStore } = loadRequestStoreModule();

      const store = loadStore();

      expect(store).toEqual({});
    });
  });

  // ── saveStore ─────────────────────────────────────────────────────────────

  describe('saveStore', () => {
    it('persists the store so a subsequent loadStore returns the same data', () => {
      const { createStartedRecord, saveStore, loadStore } = loadRequestStoreModule();

      const record = createStartedRecord('req-save-01', 'someMethod');
      const store = { 'req-save-01': record };

      saveStore(store);

      const reloaded = loadStore();

      expect(reloaded).toEqual(store);
    });
  });

  // ── compactStore ──────────────────────────────────────────────────────────

  describe('compactStore', () => {
    it('removes oldest completed (success/error) entries first when count exceeds MAX_TRACKED_REQUESTS', () => {
      const { compactStore } = loadRequestStoreModule();

      // Build a store of exactly MAX_TRACKED_REQUESTS completed entries,
      // with ascending startedAtMs so req-completed-0 is the oldest.
      const store = {};
      for (let i = 0; i < MAX_TRACKED_REQUESTS; i++) {
        const id = `req-completed-${i}`;
        store[id] = {
          requestId: id,
          method: 'someMethod',
          status: i % 2 === 0 ? 'success' : 'error',
          startedAtMs: 1000 + i,
          finishedAtMs: 2000 + i,
        };
      }

      // Add one extra active entry, pushing the total above the limit.
      store['req-active-new'] = {
        requestId: 'req-active-new',
        method: 'someMethod',
        status: 'started',
        startedAtMs: 9999,
      };

      const compacted = compactStore(store);

      expect(Object.keys(compacted).length).toBeLessThanOrEqual(MAX_TRACKED_REQUESTS);
      // The active entry must survive.
      expect(compacted['req-active-new']).toBeDefined();
      // The oldest completed entry must have been evicted first.
      expect(compacted['req-completed-0']).toBeUndefined();
    });

    it('preserves all active (started) entries even when the store is at MAX_TRACKED_REQUESTS', () => {
      const { compactStore } = loadRequestStoreModule();

      // Fill the store entirely with active entries.
      const store = {};
      for (let i = 0; i < MAX_TRACKED_REQUESTS; i++) {
        const id = `req-active-${i}`;
        store[id] = {
          requestId: id,
          method: 'someMethod',
          status: 'started',
          startedAtMs: 1000 + i,
        };
      }

      const compacted = compactStore(store);

      for (let i = 0; i < MAX_TRACKED_REQUESTS; i++) {
        expect(compacted[`req-active-${i}`]).toBeDefined();
      }
    });
  });
});
