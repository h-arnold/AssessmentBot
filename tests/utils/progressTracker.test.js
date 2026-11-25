/**
 * Unit tests for ProgressTracker.
 *
 * Uses the real ProgressTracker module with PropertiesService mocked
 * via setupGlobals.js (in-memory store). The ABLogger global mock
 * prevents spurious console output.
 */
const ProgressTracker = require('#backend/Utils/ProgressTracker.js');
const { withGlobalMocks } = require('../helpers/globalMockManager.js');

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
    it('initialises properties and resets steps', () => {
      tracker.startTracking();

      // Should have set a property
      const stored = JSON.parse(
        globalThis.PropertiesService.getUserProperties().getProperty('ProgressTracker')
      );
      expect(stored).toBeDefined();
      expect(stored.message).toContain('Starting the assessment');
      expect(stored.completed).toBe(false);
      expect(stored.error).toBeNull();
      expect(stored.step).toBe(0);
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

  describe('resetSteps', () => {
    it('resets step counter to 0 and persists', () => {
      tracker.startTracking(); // initialises properties
      tracker.incrementStep();
      tracker.incrementStep();
      tracker.incrementStep();
      expect(tracker.step).toBe(3);

      tracker.resetSteps();
      expect(tracker.step).toBe(0);
    });
  });

  describe('clearProgress', () => {
    it('deletes the stored progress property', () => {
      tracker.startTracking();
      expect(
        globalThis.PropertiesService.getUserProperties().getProperty('ProgressTracker')
      ).toBeTruthy();

      tracker.clearProgress();
      expect(
        globalThis.PropertiesService.getUserProperties().getProperty('ProgressTracker')
      ).toBeNull();
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

  describe('captureError', () => {
    it('logs a user-facing error message and returns it', () => {
      const error = new Error('Something went wrong');
      const result = tracker.captureError(error, 'Context message');

      expect(result).toBe('Context message: Something went wrong');
    });

    it('stores the error in progress data', () => {
      const error = new Error('Disk failure');
      tracker.captureError(error, 'Save failed');

      const stored = JSON.parse(
        globalThis.PropertiesService.getUserProperties().getProperty('ProgressTracker')
      );
      expect(stored.error).toBe('Save failed: Disk failure');
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

    it('logs the error before throwing', () => {
      expect(() => tracker.logAndThrowError('Log before throw')).toThrow();

      const stored = JSON.parse(
        globalThis.PropertiesService.getUserProperties().getProperty('ProgressTracker')
      );
      expect(stored.error).toBe('Log before throw');
    });
  });

  describe('complete', () => {
    it('marks progress as completed', () => {
      tracker.startTracking();
      tracker.complete();

      const stored = JSON.parse(
        globalThis.PropertiesService.getUserProperties().getProperty('ProgressTracker')
      );
      expect(stored.completed).toBe(true);
      expect(stored.message).toBe('Task completed successfully.');
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

    it('startTracking without a request ID writes the legacy unkeyed record', () => {
      tracker.startTracking();

      const legacy = readUserProperty('ProgressTracker');
      expect(legacy).not.toBeNull();
      expect(legacy.message).toContain('Starting the assessment');
      expect(legacy.step).toBe(0);
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

    it('writes completion to the bound record before falling back to the legacy record', () => {
      tracker.startTracking();
      const legacyBefore = readUserProperty('ProgressTracker');

      tracker.startTracking('req-a');
      tracker.updateProgress('Run A in flight');
      tracker.complete();

      const keyed = readUserProperty('ProgressTrackerreq-a');
      expect(keyed).not.toBeNull();
      expect(keyed.completed).toBe(true);
      expect(keyed.message).toBe('Task completed successfully.');
      expect(readUserProperty('ProgressTracker')).toEqual(legacyBefore);
      expect(tracker.getCurrentProgress()).toEqual(legacyBefore);
    });

    it('fresh instance reads the legacy record after resetForTests clears the context', () => {
      tracker.startTracking();
      const legacyBefore = readUserProperty('ProgressTracker');

      tracker.startTracking('req-a');
      tracker.updateProgress('Run A in flight');
      const keyedBeforeReset = readUserProperty('ProgressTrackerreq-a');

      ProgressTracker.resetForTests();
      const freshTracker = ProgressTracker.getInstance();

      expect(freshTracker).not.toBe(tracker);
      expect(keyedBeforeReset).not.toBeNull();
      expect(freshTracker.getCurrentProgress()).toEqual(legacyBefore);
    });

    it('captureError writes to the bound record and leaves the legacy record untouched', () => {
      tracker.startTracking('req-a');

      const result = tracker.captureError(new Error('Disk failure'), 'Save failed');

      expect(result).toBe('Save failed: Disk failure');
      const keyed = readUserProperty('ProgressTrackerreq-a');
      expect(keyed).not.toBeNull();
      expect(keyed.error).toBe('Save failed: Disk failure');
      expect(readUserProperty('ProgressTracker')).toBeNull();
    });

    it('logAndThrowError writes to the bound record before throwing', () => {
      tracker.startTracking('req-a');

      expect(() => tracker.logAndThrowError('Fatal run failure')).toThrow('Fatal run failure');
      const keyed = readUserProperty('ProgressTrackerreq-a');
      expect(keyed).not.toBeNull();
      expect(keyed.error).toBe('Fatal run failure');
      expect(readUserProperty('ProgressTracker')).toBeNull();
    });
  });

  describe('deferred cleanup on error writes', () => {
    it('logError with deferCleanup writes the error without scheduling cleanup', () => {
      tracker.startTracking('req-a');

      tracker.logError('Deferred failure', undefined, { deferCleanup: true });

      const keyed = readUserProperty('ProgressTrackerreq-a');
      expect(keyed).not.toBeNull();
      expect(keyed.error).toBe('Deferred failure');
      expect(cleanupScheduleSpy).not.toHaveBeenCalled();
    });

    it('logError without options writes the error and still schedules cleanup', () => {
      tracker.startTracking('req-a');

      tracker.logError('Ordinary failure');

      const keyed = readUserProperty('ProgressTrackerreq-a');
      expect(keyed).not.toBeNull();
      expect(keyed.error).toBe('Ordinary failure');
      expect(cleanupScheduleSpy).toHaveBeenCalledTimes(1);
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
