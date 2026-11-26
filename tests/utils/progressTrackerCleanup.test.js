/**
 * Unit tests for the deferred cleanup coordinator (ProgressTrackerCleanup).
 *
 * Both entry points are reached through the `globalThis.ProgressTrackerCleanup`
 * seam (schedule/sweep/rearm) loaded by tests/setupGlobals.js in GAS
 * concatenation order. The suite covers the coordinator contract:
 *   - `schedule()` dedupes pending cleanups per user: one time-based trigger on
 *     the first write, cache-flag repopulation from the durable marker on a
 *     cache miss, no duplicate trigger on later writes, no marker or cache flag
 *     left behind when trigger creation fails so a later write can retry, and
 *     a warning with no trigger when the user lock cannot be acquired.
 *   - `sweep()` deletes terminal keyed records and deletes the bare
 *   `ProgressTracker` key (pre-upgrade data) unconditionally, terminal or
 *   not, keeping in-flight keyed records and malformed values untouched.
 *   It clears the marker and cache flag on every path, re-arms one trigger
 *   after a successful sweep that observed an in-flight keyed record, and
 *   rethrows failures without re-arming.
 *
 * Property and cache state use the in-memory mocks from tests/setupGlobals.js;
 * no canonical analysis fixture applies to transient progress state.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

/** User Property key of the unkeyed pre-upgrade progress record. */
const BARE_LEGACY_KEY = 'ProgressTracker';
const MARKER_KEY = 'AB_PROGRESS_CLEANUP_TRIGGER';
const CLEANUP_METHOD = 'cleanupProgress';
const CLEANUP_FLAG_TTL_SECONDS = 600;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const SCHEDULE_TOLERANCE_MS = 5000;

// Asymmetric matcher pinning the trigger time to `now + 10 minutes` with a small
// tolerance, while keeping the three-argument createTimeBasedTrigger assertion.
function cleanupTriggerDateScheduledFrom(nowMs) {
  return {
    asymmetricMatch(actual) {
      if (!(actual instanceof Date)) {
        return false;
      }
      const scheduledMs = actual.getTime();
      return (
        scheduledMs >= nowMs + TEN_MINUTES_MS - SCHEDULE_TOLERANCE_MS &&
        scheduledMs <= nowMs + TEN_MINUTES_MS + SCHEDULE_TOLERANCE_MS
      );
    },
    toString() {
      return 'a Date approximately ten minutes after the progress write';
    },
  };
}

function record(requestId, overrides = {}) {
  return {
    step: 1,
    message: 'progress message',
    completed: false,
    error: null,
    timestamp: '2026-01-01T00:00:00.000Z',
    ...(requestId ? { requestId } : {}),
    ...overrides,
  };
}

function writeRecord(requestId, overrides) {
  globalThis.PropertiesService.getUserProperties().setProperty(
    globalThis.ProgressTrackerStore.keyFor(requestId),
    JSON.stringify(record(requestId, overrides))
  );
}

function writeRaw(key, rawValue) {
  globalThis.PropertiesService.getUserProperties().setProperty(key, rawValue);
}

function readRaw(key) {
  return globalThis.PropertiesService.getUserProperties().getProperty(key);
}

function readMarker(properties = globalThis.PropertiesService.getUserProperties()) {
  return properties.getProperty(MARKER_KEY);
}

function seedMarker(uid) {
  globalThis.PropertiesService.getUserProperties().setProperty(MARKER_KEY, uid);
}

/** Installs live project triggers carrying the supplied UIDs. */
function installLiveCleanupTriggers(...triggerUids) {
  globalThis.ScriptApp._setProjectTriggers(
    triggerUids.map((triggerUid) => ({
      getUniqueId: () => triggerUid,
      getHandler: () => 'triggerHandler',
    }))
  );
}

describe('ProgressTrackerCleanup', () => {
  let restoreGlobals;
  let createTimeBasedTrigger;
  let storeTriggerContext;
  let removeTriggers;
  let controller;
  let mockABLogger;
  let userCachePutSpy;
  let userCacheRemoveSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.PropertiesService._resetUserProperties();
    globalThis.CacheService._resetScriptCache();
    globalThis.CacheService._resetUserCache();
    globalThis.ScriptApp._resetProjectTriggers();

    createTimeBasedTrigger = vi.fn(() => 'cleanup-uid-1');
    storeTriggerContext = vi.fn();
    removeTriggers = vi.fn();
    controller = {
      createTimeBasedTrigger,
      storeTriggerContext,
      removeTriggers,
    };

    mockABLogger = {
      debug: vi.fn(),
      debugUi: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    };

    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockABLogger }),
      TriggerController: () =>
        vi.fn(function () {
          return controller;
        }),
    });
    restoreGlobals = mockContext.restore;

    userCachePutSpy = vi.spyOn(globalThis.CacheService.getUserCache(), 'put');
    userCacheRemoveSpy = vi.spyOn(globalThis.CacheService.getUserCache(), 'remove');
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
    globalThis.PropertiesService._resetUserProperties();
    globalThis.CacheService._resetUserCache();
  });

  describe('schedule', () => {
    it('schedules one cleanup trigger on the first progress write and none on later writes', () => {
      const nowMs = Date.now();
      const properties = globalThis.PropertiesService.getUserProperties();
      globalThis.ProgressTrackerCleanup.schedule(properties);

      expect(createTimeBasedTrigger).toHaveBeenCalledTimes(1);
      expect(createTimeBasedTrigger).toHaveBeenCalledWith(
        'triggerHandler',
        cleanupTriggerDateScheduledFrom(nowMs),
        {
          skipTooManyTriggersRecovery: true,
        }
      );
      expect(storeTriggerContext).toHaveBeenCalledWith('cleanup-uid-1', {
        method: CLEANUP_METHOD,
        params: {},
      });
      expect(readMarker()).toBe('cleanup-uid-1');
      expect(userCachePutSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        CLEANUP_FLAG_TTL_SECONDS
      );

      globalThis.ProgressTrackerCleanup.schedule(properties);
      expect(createTimeBasedTrigger).toHaveBeenCalledTimes(1);
    });

    it('repopulates the cache flag from a marker with a live trigger without creating one', () => {
      seedMarker('existing-cleanup-uid');
      installLiveCleanupTriggers('existing-cleanup-uid');

      globalThis.ProgressTrackerCleanup.schedule(globalThis.PropertiesService.getUserProperties());

      expect(createTimeBasedTrigger).not.toHaveBeenCalled();
      expect(userCachePutSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        CLEANUP_FLAG_TTL_SECONDS
      );
    });

    it('clears a marker whose trigger was deleted externally and arms a fresh one', () => {
      seedMarker('deleted-cleanup-uid');
      installLiveCleanupTriggers();

      globalThis.ProgressTrackerCleanup.schedule(globalThis.PropertiesService.getUserProperties());

      expect(createTimeBasedTrigger).toHaveBeenCalledTimes(1);
      expect(storeTriggerContext).toHaveBeenCalledWith('cleanup-uid-1', {
        method: CLEANUP_METHOD,
        params: {},
      });
      expect(readMarker()).toBe('cleanup-uid-1');
      expect(userCachePutSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        CLEANUP_FLAG_TTL_SECONDS
      );
    });

    it('does not create a duplicate trigger when the cache flag appears after the lock is acquired', () => {
      const userCache = globalThis.CacheService.getUserCache();
      // CacheManager.get parses stored JSON, so a flag appearing mid-schedule
      // is represented by the serialised flag value.
      const getSpy = vi
        .spyOn(userCache, 'get')
        .mockReturnValueOnce(null)
        .mockReturnValue(JSON.stringify('pending'));

      globalThis.ProgressTrackerCleanup.schedule(globalThis.PropertiesService.getUserProperties());

      expect(getSpy).toHaveBeenCalledTimes(2);
      expect(createTimeBasedTrigger).not.toHaveBeenCalled();
      expect(userCachePutSpy).not.toHaveBeenCalled();
      expect(readMarker()).toBeNull();
    });

    it('leaves no marker after a trigger creation failure so a later write retries', () => {
      createTimeBasedTrigger.mockReturnValueOnce(null);
      const properties = globalThis.PropertiesService.getUserProperties();

      globalThis.ProgressTrackerCleanup.schedule(properties);

      expect(createTimeBasedTrigger).toHaveBeenCalledTimes(1);
      expect(readMarker()).toBeNull();
      expect(userCachePutSpy).not.toHaveBeenCalled();

      createTimeBasedTrigger.mockReturnValue('retry-cleanup-uid');
      globalThis.ProgressTrackerCleanup.schedule(properties);
      expect(createTimeBasedTrigger).toHaveBeenCalledTimes(2);
    });

    it('logs a warning and schedules no trigger when the user lock cannot be acquired', () => {
      const tryLock = vi.fn(() => false);
      const releaseLock = vi.fn();
      const lockContext = withGlobalMocks({
        LockService: () => ({ getUserLock: () => ({ tryLock, releaseLock }) }),
      });

      try {
        expect(() =>
          globalThis.ProgressTrackerCleanup.schedule(
            globalThis.PropertiesService.getUserProperties()
          )
        ).not.toThrow();
        expect(mockABLogger.warn).toHaveBeenCalled();
        expect(createTimeBasedTrigger).not.toHaveBeenCalled();
        expect(readMarker()).toBeNull();
        expect(userCachePutSpy).not.toHaveBeenCalled();
      } finally {
        lockContext.restore();
      }
    });
  });

  describe('sweep', () => {
    it('deletes terminal keyed records and the bare pre-upgrade key, keeping in-flight keyed records', () => {
      writeRecord('terminal-completed', { completed: true });
      writeRecord('terminal-error', { error: 'Run failed' });
      writeRecord('still-running', { completed: false, error: null });
      writeRaw(BARE_LEGACY_KEY, JSON.stringify(record(null, { completed: true })));
      seedMarker('cleanup-uid-1');

      globalThis.ProgressTrackerCleanup.sweep();

      expect(readRaw(globalThis.ProgressTrackerStore.keyFor('terminal-completed'))).toBeNull();
      expect(readRaw(globalThis.ProgressTrackerStore.keyFor('terminal-error'))).toBeNull();
      expect(readRaw(BARE_LEGACY_KEY)).toBeNull();
      expect(readRaw(globalThis.ProgressTrackerStore.keyFor('still-running'))).not.toBeNull();
    });

    it('keeps a partial record with a requestId but no error field as in flight', () => {
      const key = globalThis.ProgressTrackerStore.keyFor('partial-no-error');
      const partialRecord = {
        requestId: 'partial-no-error',
        step: 2,
        message: 'still working',
        completed: false,
        timestamp: '2026-01-01T00:00:00.000Z',
      };
      writeRaw(key, JSON.stringify(partialRecord));
      seedMarker('cleanup-uid-1');

      globalThis.ProgressTrackerCleanup.sweep();

      expect(readRaw(key)).not.toBeNull();
      expect(JSON.parse(readRaw(key))).toEqual(partialRecord);
    });

    it('deletes a non-terminal pre-upgrade record unconditionally without re-arming for it', () => {
      writeRaw(BARE_LEGACY_KEY, JSON.stringify(record(null, { completed: false, error: null })));
      seedMarker('cleanup-uid-1');

      globalThis.ProgressTrackerCleanup.sweep();

      expect(readRaw(BARE_LEGACY_KEY)).toBeNull();
      expect(createTimeBasedTrigger).not.toHaveBeenCalled();
      expect(readMarker()).toBeNull();
    });

    it('re-arms exactly one trigger and rewrites the marker and cache flag when a non-terminal record survives', () => {
      writeRecord('still-running', { completed: false, error: null });
      seedMarker('old-cleanup-uid');
      createTimeBasedTrigger.mockReturnValue('new-cleanup-uid');

      const nowMs = Date.now();
      globalThis.ProgressTrackerCleanup.sweep();

      expect(createTimeBasedTrigger).toHaveBeenCalledTimes(1);
      expect(createTimeBasedTrigger).toHaveBeenCalledWith(
        'triggerHandler',
        cleanupTriggerDateScheduledFrom(nowMs),
        {
          skipTooManyTriggersRecovery: true,
        }
      );
      expect(storeTriggerContext).toHaveBeenCalledWith('new-cleanup-uid', {
        method: CLEANUP_METHOD,
        params: {},
      });
      expect(readMarker()).toBe('new-cleanup-uid');
      expect(userCachePutSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        CLEANUP_FLAG_TTL_SECONDS
      );
    });

    it('clears the marker and cache flag before rethrowing a sweep failure without re-arming', () => {
      const realProperties = globalThis.PropertiesService.getUserProperties();
      writeRecord('terminal-ok', { completed: true });
      writeRecord('failing-record', { completed: true });
      seedMarker('old-cleanup-uid');

      const failingStore = {
        getProperty: (key) => realProperties.getProperty(key),
        getProperties: () => realProperties.getProperties(),
        setProperty: (key, value) => realProperties.setProperty(key, value),
        deleteProperty: (key) => {
          if (key === globalThis.ProgressTrackerStore.keyFor('failing-record')) {
            throw new Error('user property delete failed');
          }
          realProperties.deleteProperty(key);
        },
      };
      const failingContext = withGlobalMocks({
        PropertiesService: () => ({ getUserProperties: () => failingStore }),
      });

      try {
        expect(() => globalThis.ProgressTrackerCleanup.sweep()).toThrow(
          'user property delete failed'
        );
        expect(readMarker(realProperties)).toBeNull();
        expect(userCacheRemoveSpy).toHaveBeenCalled();
        expect(createTimeBasedTrigger).not.toHaveBeenCalled();
      } finally {
        failingContext.restore();
      }
    });

    it('logs and skips a malformed keyed value while still deleting valid terminal records', () => {
      const malformedKey = globalThis.ProgressTrackerStore.keyFor('malformed');
      writeRaw(malformedKey, 'not-json{{{');
      writeRecord('terminal-valid', { completed: true });
      seedMarker('cleanup-uid-1');

      expect(() => globalThis.ProgressTrackerCleanup.sweep()).not.toThrow();

      expect(readRaw(globalThis.ProgressTrackerStore.keyFor('terminal-valid'))).toBeNull();
      expect(readRaw(malformedKey)).toBe('not-json{{{');
      expect(mockABLogger.warn).toHaveBeenCalled();
    });
  });
});
