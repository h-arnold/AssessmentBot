// Renamed from Logger.js to ABLogger.js due to protected name conflict in GAS.
// See original header below.
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
    } catch {
      // Swallow any unexpected errors to avoid impacting main flow
    }
  }

  /**
   * Internal: safely call console methods if available. Swallows errors.
   * @param {'log'|'info'|'warn'|'error'|'debug'} level
   * @param {...any} args
   */
  _safeConsole(level, ...args) {
    try {
      if (typeof console !== 'undefined' && console && typeof console[level] === 'function') {
        // Forward multiple args using spread to satisfy lint rules
        console[level](...args);
      }
    } catch {
      // Avoid throwing from the logger
    }
  }

  /**
   * Shorthand wrappers for common console levels.
   */
  log(...args) {
    this._safeConsole('log', ...args);
  }

  info(...args) {
    this._safeConsole('info', ...args);
  }

  warn(...args) {
    this._safeConsole('warn', ...args);
  }

  error(...args) {
    this._safeConsole('error', ...args);
  }

  debug(...args) {
    this._safeConsole('debug', ...args);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABLogger;
}
// Attach to globalThis for GAS runtime compatibility
if (typeof globalThis !== 'undefined') {
  globalThis.ABLogger = ABLogger;
}
