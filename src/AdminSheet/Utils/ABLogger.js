/**
 * ABLogger - centralised (in-progress) logging facility.
 *
 * CURRENT SCOPE (initial extraction):
 *  - Provides debugUi(msg) previously embedded in UIManager.
 *  - Gated by globalThis.DEBUG_UI flag.
 *
 * FUTURE MIGRATION (planned):
 *  - Consolidate general debug/info/error logging patterns.
 *  - Route ProgressTracker / error handling helpers through this class.
 *  - Provide category-based gating (e.g. DEBUG_UI, DEBUG_SINGLETON, DEBUG_ERRORS).
 *  - Structured log formatting & optional buffering for Apps Script limitations.
 *
 * Usage:
 *   const logger = ABLogger.getInstance();
 *   logger.debugUi('Some UI related debug');
 *
 * NOTE: Keep constructor lightweight; no external service calls.
 */
class ABLogger extends BaseSingleton {
  constructor(isSingletonCreator = false) {
    super();
    /**
     * JSDoc Singleton Banner
     * Use ABLogger.getInstance(); do not call constructor directly.
     */
    if (!isSingletonCreator && ABLogger._instance) {
      return; // ignore duplicate constructions
    }
    if (!ABLogger._instance) {
      ABLogger._instance = this;
    }
  }

  /**
   * UI-focused debug logging gated by DEBUG_UI flag.
   * @param {string} msg
   */
  debugUi(msg) {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.DEBUG_UI) {
        console.log(`[DEBUG_UI] ${msg}`);
      }
    } catch (e) {
      // Swallow any unexpected errors to avoid impacting main flow
      void e;
    }
  }

  // Lightweight forwards to console for tests and runtime logging
  log(...args) {
    console.log(...args);
  }
  info(...args) {
    console.info(...args);
  }
  warn(...args) {
    console.warn(...args);
  }
  error(...args) {
    console.error(...args);
  }
  debug(...args) {
    console.debug(...args);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABLogger;
}
// Attach to globalThis for GAS runtime compatibility
if (typeof globalThis !== 'undefined') {
  globalThis.ABLogger = ABLogger;
}
