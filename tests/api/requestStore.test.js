import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const requestStorePath = '../../src/backend/z_Api/requestStore.js';

const {
  USER_REQUEST_STORE_KEY,
  MAX_TRACKED_REQUESTS,
} = require('../../src/backend/z_Api/apiConstants.js');

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

  // ── createStartedRecord_ ────────────────────────────────────────────────────

  describe('createStartedRecord_', () => {
    it('returns a record with requestId, method, status "started", and a numeric startedAtMs', () => {
      const { createStartedRecord_ } = loadRequestStoreModule();

      const record = createStartedRecord_('req-001', 'getAuthorisationStatus');

      expect(record.requestId).toBe('req-001');
      expect(record.method).toBe('getAuthorisationStatus');
      expect(record.status).toBe('started');
      expect(record.startedAtMs).toBeTypeOf('number');
      expect(record.startedAtMs).toBeGreaterThan(0);
    });

    it('uses a provided startedAtMs value without calling Date.now again', () => {
      const { createStartedRecord_ } = loadRequestStoreModule();

      const record = createStartedRecord_('req-001', 'getAuthorisationStatus', 12345);

      expect(record.startedAtMs).toBe(12345);
    });
  });

  // ── markSuccess_ ───────────────────────────────────────────────────────────

  describe('markSuccess_', () => {
    it('updates status to "success" and sets a numeric finishedAtMs', () => {
      const { createStartedRecord_, markSuccess_ } = loadRequestStoreModule();

      const store = { 'req-002': createStartedRecord_('req-002', 'someMethod') };

      const updated = markSuccess_(store, 'req-002');

      expect(updated['req-002'].status).toBe('success');
      expect(updated['req-002'].finishedAtMs).toBeTypeOf('number');
      expect(updated['req-002'].finishedAtMs).toBeGreaterThan(0);
    });
  });

  // ── markError_ ─────────────────────────────────────────────────────────────

  describe('markError_', () => {
    it('updates status to "error", sets finishedAtMs, and stores the errorMessage', () => {
      const { createStartedRecord_, markError_ } = loadRequestStoreModule();

      const store = { 'req-003': createStartedRecord_('req-003', 'someMethod') };

      const updated = markError_(store, 'req-003', 'Something went wrong');

      expect(updated['req-003'].status).toBe('error');
      expect(updated['req-003'].finishedAtMs).toBeTypeOf('number');
      expect(updated['req-003'].finishedAtMs).toBeGreaterThan(0);
      expect(updated['req-003'].errorMessage).toBe('Something went wrong');
    });
  });

  // ── loadStore_ ─────────────────────────────────────────────────────────────

  describe('loadStore_', () => {
    it('returns an empty object when the user property is absent (getProperty returns null)', () => {
      const { loadStore_ } = loadRequestStoreModule();

      // PropertiesService returns null by default — no prior setProperty call.
      const store = loadStore_();

      expect(store).toEqual({});
    });

    it('recovers safely when stored JSON is malformed, returning an empty object', () => {
      globalThis.PropertiesService.getUserProperties().setProperty(
        USER_REQUEST_STORE_KEY,
        'not-valid-json{{{'
      );

      const { loadStore_ } = loadRequestStoreModule();

      const store = loadStore_();

      expect(store).toEqual({});
    });

    it('recovers safely when stored JSON is a valid but non-object value (array), returning an empty object', () => {
      globalThis.PropertiesService.getUserProperties().setProperty(
        USER_REQUEST_STORE_KEY,
        JSON.stringify([1, 2, 3])
      );

      const { loadStore_ } = loadRequestStoreModule();

      const store = loadStore_();

      expect(store).toEqual({});
    });

    it('recovers safely when stored JSON is a valid but non-object primitive (number), returning an empty object', () => {
      globalThis.PropertiesService.getUserProperties().setProperty(
        USER_REQUEST_STORE_KEY,
        JSON.stringify(42)
      );

      const { loadStore_ } = loadRequestStoreModule();

      const store = loadStore_();

      expect(store).toEqual({});
    });
  });

  // ── saveStore_ ─────────────────────────────────────────────────────────────

  describe('saveStore_', () => {
    it('persists the store so a subsequent loadStore_ returns the same data', () => {
      const { createStartedRecord_, saveStore_, loadStore_ } = loadRequestStoreModule();

      const record = createStartedRecord_('req-save-01', 'someMethod');
      const store = { 'req-save-01': record };

      saveStore_(store);

      const reloaded = loadStore_();

      expect(reloaded).toEqual(store);
    });
  });

  // ── validation guards ─────────────────────────────────────────────────────

  describe('validation guards', () => {
    it.each([
      [
        'createStartedRecord_ — missing requestId',
        () => loadRequestStoreModule().createStartedRecord_(null, 'someMethod'),
      ],
      [
        'createStartedRecord_ — missing method',
        () => loadRequestStoreModule().createStartedRecord_('req-v-1', null),
      ],
      [
        'createStartedRecord_ — invalid startedAtMs',
        () => loadRequestStoreModule().createStartedRecord_('req-v-1', 'someMethod', Number.NaN),
      ],
      ['saveStore_ — missing store', () => loadRequestStoreModule().saveStore_(null)],
      [
        'markSuccess_ — missing store',
        () => loadRequestStoreModule().markSuccess_(null, 'req-v-1'),
      ],
      ['markSuccess_ — missing requestId', () => loadRequestStoreModule().markSuccess_({}, null)],
      [
        'markError_ — missing store',
        () => loadRequestStoreModule().markError_(null, 'req-v-1', 'msg'),
      ],
      [
        'markError_ — missing requestId',
        () => loadRequestStoreModule().markError_({}, null, 'msg'),
      ],
      [
        'markError_ — missing errorMessage',
        () => loadRequestStoreModule().markError_({}, 'req-v-1', null),
      ],
      [
        'pruneStaleEntries_ — invalid referenceTimeMs',
        () => loadRequestStoreModule().pruneStaleEntries_({}, 1000, Number.POSITIVE_INFINITY),
      ],
      ['compactStore_ — missing store', () => loadRequestStoreModule().compactStore_(null)],
    ])('throws when validation fails: %s', (_label, fn) => {
      expect(fn).toThrow();
    });
  });

  describe('pruneStaleEntries_', () => {
    it('removes only started entries older than the provided reference time threshold', () => {
      const { pruneStaleEntries_ } = loadRequestStoreModule();

      const store = {
        'stale-req-1': {
          requestId: 'stale-req-1',
          method: 'getAuthorisationStatus',
          status: 'started',
          startedAtMs: 1000,
        },
        'recent-req-1': {
          requestId: 'recent-req-1',
          method: 'getAuthorisationStatus',
          status: 'started',
          startedAtMs: 9000,
        },
      };

      pruneStaleEntries_(store, 5000, 7000);

      expect(store['stale-req-1']).toBeUndefined();
      expect(store['recent-req-1']).toBeDefined();
    });
  });

  describe('pruneStaleEntries_ — pruned-ID reporting contract', () => {
    it('returns { store, prunedIds } with the same store reference and the pruned entry IDs', () => {
      const { pruneStaleEntries_ } = loadRequestStoreModule();

      const store = {
        'stale-contract-1': {
          requestId: 'stale-contract-1',
          method: 'getAuthorisationStatus',
          status: 'started',
          startedAtMs: 1000,
        },
        'recent-contract-1': {
          requestId: 'recent-contract-1',
          method: 'getAuthorisationStatus',
          status: 'started',
          startedAtMs: 9000,
        },
        'completed-contract-1': {
          requestId: 'completed-contract-1',
          method: 'getAuthorisationStatus',
          status: 'success',
          startedAtMs: 1000,
          finishedAtMs: 2000,
        },
      };

      const result = pruneStaleEntries_(store, 5000, 7000);

      // The new contract reports the pruned IDs alongside the mutated store; the
      // store is still the same object reference and remains mutated in place.
      expect(result.store).toBe(store);
      expect(result.prunedIds).toEqual(['stale-contract-1']);
      expect(store['stale-contract-1']).toBeUndefined();
      expect(store['recent-contract-1']).toBeDefined();
      expect(store['completed-contract-1']).toBeDefined();
    });
  });

  describe('compactStore_', () => {
    it('removes oldest completed (success/error) entries first when count exceeds MAX_TRACKED_REQUESTS', () => {
      const { compactStore_ } = loadRequestStoreModule();

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

      const compacted = compactStore_(store);

      expect(Object.keys(compacted).length).toBeLessThanOrEqual(MAX_TRACKED_REQUESTS);
      // The active entry must survive.
      expect(compacted['req-active-new']).toBeDefined();
      // The oldest completed entry must have been evicted first.
      expect(compacted['req-completed-0']).toBeUndefined();
    });

    it('preserves all active (started) entries even when the store is at MAX_TRACKED_REQUESTS', () => {
      const { compactStore_ } = loadRequestStoreModule();

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

      const compacted = compactStore_(store);

      for (let i = 0; i < MAX_TRACKED_REQUESTS; i++) {
        expect(compacted[`req-active-${i}`]).toBeDefined();
      }
    });

    it('drops the oldest completed entries first across a large store while preserving the active entry', () => {
      const { compactStore_ } = loadRequestStoreModule();

      // MAX_TRACKED_REQUESTS + 5 completed entries (ascending startedAtMs) plus one
      // active entry with a newer timestamp. The compacted store must stay at or
      // below the limit, keep the active entry and the newest completed entries,
      // and evict the oldest completed entries first.
      const store = {};
      for (let i = 0; i < MAX_TRACKED_REQUESTS + 5; i++) {
        const id = `req-bulk-${i}`;
        store[id] = {
          requestId: id,
          method: 'someMethod',
          status: i % 2 === 0 ? 'success' : 'error',
          startedAtMs: 1000 + i,
          finishedAtMs: 2000 + i,
        };
      }
      store['req-bulk-active'] = {
        requestId: 'req-bulk-active',
        method: 'someMethod',
        status: 'started',
        startedAtMs: 100000,
      };

      const compacted = compactStore_(store);

      expect(Object.keys(compacted).length).toBeLessThanOrEqual(MAX_TRACKED_REQUESTS);
      // The active entry always survives compaction.
      expect(compacted['req-bulk-active']).toBeDefined();
      // The 5 oldest completed entries are evicted first.
      for (let i = 0; i < 5; i++) {
        expect(compacted[`req-bulk-${i}`]).toBeUndefined();
      }
      // At least one of the newest completed entries survives.
      expect(compacted[`req-bulk-${MAX_TRACKED_REQUESTS + 4}`]).toBeDefined();
    });
  });
});
