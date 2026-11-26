/**
 * Tests for the ProgressTracker facade and the ProgressTrackerStore helper
 * namespace: real modules, in-memory PropertiesService mock, ABLogger spy seam.
 *
 * Every progress write lands on a keyed `ProgressTracker<requestId>` record.
 * Facade calls made without a bound run (startTracking with no argument, and
 * unbound error, reset, read and delete calls) bind a generated correlation ID
 * first, so the bare unkeyed `ProgressTracker` key is never written or read.
 */
const ProgressTracker = require('#backend/Utils/ProgressTracker.js');
const ProgressTrackerStore = require('#backend/Utils/01_ProgressTrackerStore.js');
const { withGlobalMocks } = require('../helpers/globalMockManager.js');

/** User Property key of the unkeyed pre-upgrade progress record. */
const BARE_LEGACY_KEY = 'ProgressTracker';

/**
 * Seeds a record directly under the bare pre-upgrade key, in the shape a
 * deployment from before keyed records would have left behind. Bypasses
 * ProgressTrackerStore key derivation, which requires a request ID.
 * @param {Object} [overrides] - Fields to set on the seeded record.
 * @returns {Object} The seeded record.
 */
function seedBareLegacyRecord(overrides = {}) {
  const record = {
    step: 3,
    message: 'pre-upgrade progress',
    completed: false,
    error: null,
    timestamp: '2026-01-01T09:00:00.000Z',
    ...overrides,
  };
  globalThis.PropertiesService.getUserProperties().setProperty(
    BARE_LEGACY_KEY,
    JSON.stringify(record)
  );
  return record;
}

/**
 * Makes Utilities.getUuid return a deterministic sequence and records every
 * generated value so tests can reference the correlation ID the facade binds.
 *
 * @returns {string[]} Live array of generated IDs in generation order.
 */
function stubGeneratedRequestIds() {
  const generated = [];
  vi.spyOn(globalThis.Utilities, 'getUuid').mockImplementation(() => {
    const id = `generated-run-${generated.length + 1}`;
    generated.push(id);
    return id;
  });
  return generated;
}

/**
 * Reads a parsed User Property record from the in-memory store.
 * @param {string} key - property key to read
 * @returns {Object|null} stored record, or null when the key is absent
 */
function readUserProperty(key) {
  const raw = globalThis.PropertiesService.getUserProperties().getProperty(key);
  return raw === null ? null : JSON.parse(raw);
}

describe('ProgressTracker', () => {
  let tracker;
  let mockABLogger;
  let cleanupScheduleSpy;
  let restoreGlobals;
  let generatedIds;

  beforeEach(() => {
    // Reset singleton state before each test
    ProgressTracker.resetForTests();

    // Use a spy ABLogger so we can assert log calls
    mockABLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      debugUi: vi.fn(),
    };

    // Cleanup scheduling is a separate collaborator. Injecting its schedule
    // entry point keeps the deferCleanup contract testable without a real
    // trigger, cache or marker state.
    cleanupScheduleSpy = vi.fn();
    const mockContext = withGlobalMocks({
      ABLogger: () => ({
        getInstance: () => mockABLogger,
      }),
      ProgressTrackerCleanup: () => ({
        schedule: cleanupScheduleSpy,
      }),
    });
    restoreGlobals = mockContext.restore;

    // Every correlation ID the facade generates comes from Utilities.getUuid;
    // the deterministic sequence keeps generated keys predictable in tests.
    generatedIds = stubGeneratedRequestIds();

    // Reset PropertiesService in-memory store
    globalThis.PropertiesService._resetUserProperties();

    // Get a fresh ProgressTracker instance
    tracker = ProgressTracker.getInstance();
  });

  afterEach(() => {
    restoreGlobals();
    ProgressTracker.resetForTests();
    vi.restoreAllMocks();
  });

  describe('getInstance singleton', () => {
    it('returns the same instance across multiple calls', () => {
      const instance1 = ProgressTracker.getInstance();
      const instance2 = ProgressTracker.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('returns a ProgressTracker instance', () => {
      expect(tracker).toBeDefined();
      expect(typeof tracker.startTracking).toBe('function');
    });
  });

  describe('startTracking', () => {
    it('binds a generated correlation ID and writes the initial keyed record when called without an ID', () => {
      tracker.startTracking();

      expect(generatedIds.length).toBeGreaterThan(0);
      const generatedId = generatedIds[0];
      const stored = readUserProperty(ProgressTrackerStore.keyFor(generatedId));
      expect(stored).not.toBeNull();
      expect(stored.requestId).toBe(generatedId);
      expect(stored.message).toContain('Starting the assessment');
      expect(stored.completed).toBe(false);
      expect(stored.error).toBeNull();
      expect(stored.step).toBe(0);
      expect(readUserProperty(BARE_LEGACY_KEY)).toBeNull();
    });

    it('keeps writing to the generated run record after an unanchored start', () => {
      tracker.startTracking();
      tracker.updateProgress('Marking submissions');

      const stored = readUserProperty(ProgressTrackerStore.keyFor(generatedIds[0]));
      expect(generatedIds).toHaveLength(1);
      expect(stored).not.toBeNull();
      expect(stored.message).toBe('Marking submissions');
      expect(readUserProperty(BARE_LEGACY_KEY)).toBeNull();
    });
  });

  describe('incrementStep', () => {
    it('increments the step counter', () => {
      expect(tracker.step).toBe(0);
      tracker.incrementStep();
      expect(tracker.step).toBe(1);
      tracker.incrementStep();
      expect(tracker.step).toBe(2);
    });
  });

  describe('clearProgress', () => {
    it('deletes the keyed record of the bound run', () => {
      tracker.startTracking('req-clear');
      expect(readUserProperty(ProgressTrackerStore.keyFor('req-clear'))).not.toBeNull();

      tracker.clearProgress();

      expect(readUserProperty(ProgressTrackerStore.keyFor('req-clear'))).toBeNull();
      expect(readUserProperty(BARE_LEGACY_KEY)).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('returns default status when no progress data exists', () => {
      const status = tracker.getStatus();
      expect(status.step).toBe(0);
      expect(status.message).toBe('No progress data found.');
      expect(status.completed).toBe(false);
      expect(status.error).toBeNull();
    });

    it('returns current progress data after startTracking', () => {
      tracker.startTracking();
      const status = tracker.getStatus();
      expect(status.completed).toBe(false);
      expect(status.step).toBe(0);
      expect(status.message).toContain('Starting the assessment');
    });
  });

  describe('getStepAsNumber', () => {
    /**
     * Rewrites the bound run record so a step field can be removed or retyped
     * without relying on the facade's own write paths.
     */
    function writeStepOverride(requestId, override) {
      const key = ProgressTrackerStore.keyFor(requestId);
      const stored = readUserProperty(key);
      if (override === undefined) {
        delete stored.step;
      } else {
        stored.step = override;
      }
      globalThis.PropertiesService.getUserProperties().setProperty(key, JSON.stringify(stored));
    }

    it('returns null when the bound record has a missing or null step', () => {
      tracker.startTracking('req-missing-step');
      writeStepOverride('req-missing-step', undefined);
      expect(tracker.getStepAsNumber()).toBeNull();

      tracker.startTracking('req-null-step');
      writeStepOverride('req-null-step', null);
      expect(tracker.getStepAsNumber()).toBeNull();
    });

    it('parses a string step from the bound record as a base-10 number', () => {
      tracker.startTracking('req-string-step');
      writeStepOverride('req-string-step', '12');

      expect(tracker.getStepAsNumber()).toBe(12);
    });

    it('returns the in-memory step when no run context is bound', () => {
      tracker.incrementStep();
      tracker.incrementStep();

      expect(tracker.activeRequestId).toBeNull();
      expect(tracker.getStepAsNumber()).toBe(2);
    });
  });

  describe('captureError', () => {
    it('logs a user-facing error message and returns it', () => {
      const error = new Error('Something went wrong');
      const result = tracker.captureError(error, 'Context message');

      expect(result).toBe('Context message: Something went wrong');
    });

    it('stores the error in the bound run record', () => {
      tracker.startTracking('req-capture');
      const error = new Error('Disk failure');
      tracker.captureError(error, 'Save failed');

      const keyed = readUserProperty(ProgressTrackerStore.keyFor('req-capture'));
      expect(keyed.error).toBe('Save failed: Disk failure');
      expect(readUserProperty(BARE_LEGACY_KEY)).toBeNull();
    });

    it('uses error message alone when no context provided', () => {
      const error = new Error('Plain error');
      const result = tracker.captureError(error);

      expect(result).toBe('Plain error');
    });
  });

  describe('logAndThrowError', () => {
    it('throws an error with the given message', () => {
      expect(() => tracker.logAndThrowError('Fatal error')).toThrow('Fatal error');
    });

    it('logs the error into the bound run record before throwing', () => {
      tracker.startTracking('req-thrown');
      expect(() => tracker.logAndThrowError('Log before throw')).toThrow();

      const keyed = readUserProperty(ProgressTrackerStore.keyFor('req-thrown'));
      expect(keyed.error).toBe('Log before throw');
      expect(readUserProperty(BARE_LEGACY_KEY)).toBeNull();
    });
  });

  describe('complete', () => {
    it('marks the bound run record as completed', () => {
      tracker.startTracking('req-complete');
      tracker.complete();

      const keyed = readUserProperty(ProgressTrackerStore.keyFor('req-complete'));
      expect(keyed.completed).toBe(true);
      expect(keyed.message).toBe('Task completed successfully.');
      expect(readUserProperty(BARE_LEGACY_KEY)).toBeNull();
    });
  });

  describe('keyed records for assessment runs', () => {
    it('startTracking with a request ID writes a keyed record at step zero', () => {
      tracker.startTracking('req-a');

      const keyed = readUserProperty('ProgressTrackerreq-a');
      expect(keyed).not.toBeNull();
      expect(keyed.requestId).toBe('req-a');
      expect(keyed.step).toBe(0);
      expect(keyed.message).toContain('Starting the assessment');
      expect(keyed.completed).toBe(false);
      expect(keyed.error).toBeNull();
    });

    it('keeps two runs independent when updating progress', () => {
      tracker.startTracking('req-a');
      tracker.updateProgress('Run A step');
      const runABeforeOtherUpdates = readUserProperty('ProgressTrackerreq-a');
      expect(runABeforeOtherUpdates).not.toBeNull();
      expect(runABeforeOtherUpdates.message).toBe('Run A step');

      tracker.startTracking('req-b');
      tracker.updateProgress('Run B step');

      expect(readUserProperty('ProgressTrackerreq-a')).toEqual(runABeforeOtherUpdates);
      const runB = readUserProperty('ProgressTrackerreq-b');
      expect(runB).not.toBeNull();
      expect(runB.message).toBe('Run B step');
      expect(runB.step).toBe(1);
    });
  });

  describe('active run context', () => {
    it('reads the bound keyed record while a run is active', () => {
      tracker.startTracking();

      tracker.startTracking('req-a');
      tracker.updateProgress('Run A in flight');

      expect(tracker.getCurrentProgress()).toEqual(readUserProperty('ProgressTrackerreq-a'));
      expect(tracker.getCurrentProgress().requestId).toBe('req-a');
      expect(tracker.getStatus().message).toBe('Run A in flight');
      expect(tracker.getStepAsNumber()).toBe(1);
    });

    it('writes the terminal record to the bound run record and clears the run context', () => {
      tracker.startTracking('req-a');
      tracker.updateProgress('Run A in flight');

      tracker.complete();

      const keyed = readUserProperty('ProgressTrackerreq-a');
      expect(keyed).not.toBeNull();
      expect(keyed.completed).toBe(true);
      expect(keyed.message).toBe('Task completed successfully.');
      expect(readUserProperty(BARE_LEGACY_KEY)).toBeNull();
      expect(tracker.getCurrentProgress()).toBeNull();
    });

    it('fresh instance reads only keyed records after resetForTests clears the context', () => {
      seedBareLegacyRecord({ message: 'pre-upgrade leftover' });

      tracker.startTracking('req-a');
      tracker.updateProgress('Run A in flight');

      ProgressTracker.resetForTests();
      const freshTracker = ProgressTracker.getInstance();

      expect(freshTracker).not.toBe(tracker);
      expect(freshTracker.getCurrentProgress()).toBeNull();
    });

    it('captureError writes to the bound record and leaves the legacy record untouched', () => {
      tracker.startTracking('req-a');

      const result = tracker.captureError(new Error('Disk failure'), 'Save failed');

      expect(result).toBe('Save failed: Disk failure');
      const keyed = readUserProperty('ProgressTrackerreq-a');
      expect(keyed).not.toBeNull();
      expect(keyed.error).toBe('Save failed: Disk failure');
      expect(readUserProperty(BARE_LEGACY_KEY)).toBeNull();
    });

    it('logAndThrowError writes to the bound record before throwing', () => {
      tracker.startTracking('req-a');

      expect(() => tracker.logAndThrowError('Fatal run failure')).toThrow('Fatal run failure');
      const keyed = readUserProperty('ProgressTrackerreq-a');
      expect(keyed).not.toBeNull();
      expect(keyed.error).toBe('Fatal run failure');
      expect(readUserProperty(BARE_LEGACY_KEY)).toBeNull();
    });
  });

  describe('unbound calls bind a generated run context', () => {
    it('logError writes a terminal keyed record under the generated key and schedules cleanup', () => {
      expect(cleanupScheduleSpy).not.toHaveBeenCalled();

      tracker.logError('Unbound failure');

      expect(generatedIds.length).toBeGreaterThan(0);
      const keyed = readUserProperty(ProgressTrackerStore.keyFor(generatedIds[0]));
      expect(keyed).not.toBeNull();
      expect(keyed.requestId).toBe(generatedIds[0]);
      expect(keyed.error).toBe('Unbound failure');
      expect(keyed.message).toBe('An error occurred.');
      expect(readUserProperty(BARE_LEGACY_KEY)).toBeNull();
      expect(cleanupScheduleSpy).toHaveBeenCalledTimes(1);
    });

    it('getCurrentProgress never selects the bare pre-upgrade record', () => {
      const preUpgrade = seedBareLegacyRecord();

      const progress = tracker.getCurrentProgress();

      expect(progress).not.toEqual(preUpgrade);
      expect(progress).toBeNull();
    });

    it('logAndThrowError writes a terminal keyed record under the generated key and throws', () => {
      expect(() => tracker.logAndThrowError('Unbound fatal')).toThrow('Unbound fatal');

      expect(generatedIds.length).toBeGreaterThan(0);
      const keyed = readUserProperty(ProgressTrackerStore.keyFor(generatedIds[0]));
      expect(keyed).not.toBeNull();
      expect(keyed.error).toBe('Unbound fatal');
      expect(readUserProperty(BARE_LEGACY_KEY)).toBeNull();
    });

    it('captureError writes a terminal keyed record under the generated key and returns the message', () => {
      const result = tracker.captureError(new Error('Disk failure'), 'Save failed');

      expect(result).toBe('Save failed: Disk failure');
      expect(generatedIds.length).toBeGreaterThan(0);
      const keyed = readUserProperty(ProgressTrackerStore.keyFor(generatedIds[0]));
      expect(keyed).not.toBeNull();
      expect(keyed.error).toBe('Save failed: Disk failure');
      expect(readUserProperty(BARE_LEGACY_KEY)).toBeNull();
    });

    it('clearProgress leaves a pre-upgrade bare-key record untouched', () => {
      const preUpgrade = seedBareLegacyRecord();

      tracker.clearProgress();

      expect(readUserProperty(BARE_LEGACY_KEY)).toEqual(preUpgrade);
    });
  });

  describe('_logDeveloperDetails', () => {
    it('logs stack trace and message for Error objects', () => {
      const err = new Error('dev error');
      tracker._logDeveloperDetails(err);

      expect(mockABLogger.error).toHaveBeenCalledWith(
        'Developer details - Stack trace:',
        err.stack
      );
      expect(mockABLogger.error).toHaveBeenCalledWith('Developer details - Message:', 'dev error');
      expect(mockABLogger.error).toHaveBeenCalledWith('Developer details - Error type:', 'Error');
    });

    it('stringifies plain objects', () => {
      tracker._logDeveloperDetails({ reason: 'timeout', code: 500 });

      expect(mockABLogger.error).toHaveBeenCalledWith(
        'Developer details:',
        '{"reason":"timeout","code":500}'
      );
    });

    it('logs primitive values directly', () => {
      tracker._logDeveloperDetails('connection refused');

      expect(mockABLogger.error).toHaveBeenCalledWith('Developer details:', 'connection refused');
    });
  });
});
