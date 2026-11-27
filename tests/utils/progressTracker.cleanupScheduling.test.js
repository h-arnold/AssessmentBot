/**
 * Tests for cleanup scheduling by the ProgressTracker write methods: every
 * progress write calls ProgressTrackerCleanup.schedule(), the deferCleanup
 * option skips it, and repeated writes dedupe to one pending trigger through
 * the coordinator. The facade is real; scheduling is observed through the
 * globalThis.ProgressTrackerCleanup seam from tests/setupGlobals.js.
 */

const ProgressTracker = require('#backend/Utils/ProgressTracker.js');
const { withGlobalMocks } = require('../helpers/globalMockManager.js');

/**
 * Reads a parsed User Property record from the in-memory store.
 * @param {string} key - Property key to read.
 * @returns {Object|null} Stored record, or null when the key is absent.
 */
function readUserProperty(key) {
  const raw = globalThis.PropertiesService.getUserProperties().getProperty(key);
  return raw === null ? null : JSON.parse(raw);
}

describe('ProgressTracker cleanup scheduling on writes', () => {
  let tracker;
  let cleanupScheduleSpy;
  let restoreGlobals;
  let savedGlobals;

  beforeEach(() => {
    ProgressTracker.resetForTests();

    const mockABLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      debugUi: vi.fn(),
    };

    cleanupScheduleSpy = vi.fn();
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockABLogger }),
      ProgressTrackerCleanup: () => ({ schedule: cleanupScheduleSpy }),
    });
    restoreGlobals = mockContext.restore;
    savedGlobals = mockContext.savedGlobals;

    globalThis.PropertiesService._resetUserProperties();

    tracker = ProgressTracker.getInstance();
  });

  afterEach(() => {
    restoreGlobals();
    ProgressTracker.resetForTests();
    vi.restoreAllMocks();
  });

  describe('deferred cleanup on error writes', () => {
    it('logError with deferCleanup writes the error without scheduling cleanup', () => {
      tracker.startTracking('req-a');
      cleanupScheduleSpy.mockClear();

      tracker.logError('Deferred failure', undefined, { deferCleanup: true });

      const keyed = readUserProperty('ProgressTrackerreq-a');
      expect(keyed).not.toBeNull();
      expect(keyed.error).toBe('Deferred failure');
      expect(cleanupScheduleSpy).not.toHaveBeenCalled();
    });

    it('logError without options writes the error and still schedules cleanup', () => {
      tracker.startTracking('req-a');
      cleanupScheduleSpy.mockClear();

      tracker.logError('Ordinary failure');

      const keyed = readUserProperty('ProgressTrackerreq-a');
      expect(keyed).not.toBeNull();
      expect(keyed.error).toBe('Ordinary failure');
      expect(cleanupScheduleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup scheduling on every progress write', () => {
    it('schedules cleanup from startTracking', () => {
      tracker.startTracking('req-schedule');

      expect(cleanupScheduleSpy).toHaveBeenCalledTimes(1);
    });

    it('schedules cleanup from updateProgress', () => {
      tracker.startTracking('req-schedule');
      cleanupScheduleSpy.mockClear();

      tracker.updateProgress('Run A in flight');

      expect(cleanupScheduleSpy).toHaveBeenCalledTimes(1);
    });

    it('schedules cleanup from complete', () => {
      tracker.startTracking('req-schedule');
      cleanupScheduleSpy.mockClear();

      tracker.complete();

      expect(cleanupScheduleSpy).toHaveBeenCalledTimes(1);
    });

    it('creates only one cleanup trigger across repeated progress writes', () => {
      const originalCleanup = savedGlobals.ProgressTrackerCleanup;
      const createTimeBasedTrigger = vi.fn(() => 'cleanup-uid');
      const controller = {
        createTimeBasedTrigger,
        storeTriggerContext: vi.fn(),
      };
      const nested = withGlobalMocks({
        ProgressTrackerCleanup: () => originalCleanup,
        TriggerController: () =>
          vi.fn(function () {
            return controller;
          }),
      });

      try {
        tracker.startTracking('req-dedupe');
        tracker.updateProgress('step 1');
        tracker.complete();

        expect(createTimeBasedTrigger).toHaveBeenCalledTimes(1);
      } finally {
        nested.restore();
      }
    });
  });
});
