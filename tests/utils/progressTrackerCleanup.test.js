/**
 * RED-phase tests for the deferred cleanup coordinator.
 *
 * The coordinator is reached through the `globalThis.ProgressTrackerCleanup`
 * seam (schedule/sweep/rearm) so this file collects cleanly while implementation
 * is pending. Every assertion below describes required behaviour and fails while
 * the seam is a no-op, except the non-terminal legacy guard, which passes in RED
 * by design. The green phase loads the real coordinator at that global.
 *
 * Property and cache state use the in-memory mocks from tests/setupGlobals.js;
 * no canonical analysis fixture applies to transient progress state.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

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

function keyFor(requestId) {
  return requestId ? `ProgressTracker${requestId}` : 'ProgressTracker';
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
    keyFor(requestId),
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
      globalThis.ProgressTrackerCleanup.schedule();

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

      globalThis.ProgressTrackerCleanup.schedule();
      expect(createTimeBasedTrigger).toHaveBeenCalledTimes(1);
    });

    it('repopulates the cache flag from a valid marker on a cache miss without creating a trigger', () => {
      seedMarker('existing-cleanup-uid');

      globalThis.ProgressTrackerCleanup.schedule();

      expect(createTimeBasedTrigger).not.toHaveBeenCalled();
      expect(userCachePutSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        CLEANUP_FLAG_TTL_SECONDS
      );
    });

    it('leaves no marker after a trigger creation failure so a later write retries', () => {
      createTimeBasedTrigger.mockReturnValueOnce(null);

      globalThis.ProgressTrackerCleanup.schedule();

      expect(createTimeBasedTrigger).toHaveBeenCalledTimes(1);
      expect(readMarker()).toBeNull();
      expect(userCachePutSpy).not.toHaveBeenCalled();

      createTimeBasedTrigger.mockReturnValue('retry-cleanup-uid');
      globalThis.ProgressTrackerCleanup.schedule();
      expect(createTimeBasedTrigger).toHaveBeenCalledTimes(2);
    });

    it('logs a warning and schedules no trigger when the user lock cannot be acquired', () => {
      const tryLock = vi.fn(() => false);
      const releaseLock = vi.fn();
      const lockContext = withGlobalMocks({
        LockService: () => ({ getUserLock: () => ({ tryLock, releaseLock }) }),
      });

      try {
        expect(() => globalThis.ProgressTrackerCleanup.schedule()).not.toThrow();
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
    it('deletes terminal keyed records and a terminal legacy record but keeps non-terminal keyed records', () => {
      writeRecord('terminal-completed', { completed: true });
      writeRecord('terminal-error', { error: 'Run failed' });
      writeRecord('still-running', { completed: false, error: null });
      writeRaw('ProgressTracker', JSON.stringify(record(null, { completed: true })));
      seedMarker('cleanup-uid-1');

      globalThis.ProgressTrackerCleanup.sweep();

      expect(readRaw(keyFor('terminal-completed'))).toBeNull();
      expect(readRaw(keyFor('terminal-error'))).toBeNull();
      expect(readRaw('ProgressTracker')).toBeNull();
      expect(readRaw(keyFor('still-running'))).not.toBeNull();
    });

    it('keeps a non-terminal legacy record', () => {
      writeRaw('ProgressTracker', JSON.stringify(record(null, { completed: false, error: null })));
      seedMarker('cleanup-uid-1');

      globalThis.ProgressTrackerCleanup.sweep();

      expect(readRaw('ProgressTracker')).not.toBeNull();
      expect(JSON.parse(readRaw('ProgressTracker')).completed).toBe(false);
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
          if (key === keyFor('failing-record')) {
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
      const malformedKey = keyFor('malformed');
      writeRaw(malformedKey, 'not-json{{{');
      writeRecord('terminal-valid', { completed: true });
      seedMarker('cleanup-uid-1');

      expect(() => globalThis.ProgressTrackerCleanup.sweep()).not.toThrow();

      expect(readRaw(keyFor('terminal-valid'))).toBeNull();
      expect(readRaw(malformedKey)).toBe('not-json{{{');
      expect(mockABLogger.warn).toHaveBeenCalled();
    });
  });
});
