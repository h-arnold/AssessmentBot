// Lightweight ProgressTracker mock for tests
let instance = null;

function create() {
  return {
    startTracking() {
      // noop for tests
    },
    complete() {
      // noop for tests
    },
    updateProgress() {
      // noop for tests
    },
    logError(msg, err) {
      console.error('[ProgressTracker] ERROR', msg, err?.message ? err.message : err);
    },
    logAndThrowError(msg, err) {
      console.error('[ProgressTracker] FATAL', msg, err?.message ? err.message : err);
      throw new Error(msg);
    },
  };
}

module.exports = {
  getInstance() {
    if (!instance) instance = create();
    return instance;
  },
};
