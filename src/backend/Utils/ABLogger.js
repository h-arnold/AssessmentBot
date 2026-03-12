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
  /**
   *
   */
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
  debugUi(message) {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.DEBUG_UI) {
        console.log(`[DEBUG_UI] ${message}`);
      }
    } catch (error) {
      // Use a recursion guard to avoid re-entrant logging loops and surface via ProgressTracker
      try {
        if (!ABLogger._inLoggingFailure) {
          ABLogger._inLoggingFailure = true;
          ProgressTracker.getInstance().logError('ABLogger.debugUi logging failure', {
            err: error,
          });
        }
      } finally {
        ABLogger._inLoggingFailure = false;
      }
    }
  }

  // Helper: serialise Error objects (and nested causes) to plain objects for logging
  /**
   *
   */
  serialiseError(error) {
    if (!error || typeof error !== 'object') return error;
    const out = {};
    if (error.name) out.name = error.name;
    if (error.message) out.message = error.message;
    if (error.stack) out.stack = error.stack;
    // Do not recursively serialise nested causes — keep top-level cause out of scope
    if (error.cause && typeof error.cause === 'object') {
      out.cause = { name: error.cause.name, message: error.cause.message };
    }
    return out;
  }

  /**
   *
   */
  serialiseArg(argument) {
    if (!argument) return argument;

    // If it's an Error, serialise
    if (isErrorLike(argument)) return this.serialiseError(argument);

    // If it's an object/array, shallow-copy and serialise any direct Error-like properties
    if (typeof argument === 'object') {
      return this.shallowSerialiseObject(argument, isErrorLike);
    }

    return argument;
  }

  // Helper to shallow-copy objects/arrays and serialise any direct Error-like properties
  /**
   *
   */
  shallowSerialiseObject(object, isErrorLike) {
    try {
      const copy = Array.isArray(object) ? [...object] : { ...object };
      for (const k in copy) {
        if (!Object.hasOwn(copy, k)) continue;
        const v = copy[k];
        if (isErrorLike(v)) copy[k] = this.serialiseError(v);
      }
      return copy;
    } catch (error) {
      this.error('ABLogger.shallowSerialiseObject logging failure', error);
      return object;
    }
  }

  // Lightweight forwards to console for tests and runtime logging
  /**
   *
   */
  log(...arguments_) {
    console.log(...arguments_.map((a) => this.serialiseArg(a)));
  }
  /**
   *
   */
  info(...arguments_) {
    console.info(...arguments_.map((a) => this.serialiseArg(a)));
  }
  /**
   *
   */
  warn(...arguments_) {
    console.warn(...arguments_.map((a) => this.serialiseArg(a)));
  }
  /**
   *
   */
  error(...arguments_) {
    console.error(...arguments_.map((a) => this.serialiseArg(a)));
  }
  /**
   *
   */
  debug(...arguments_) {
    // Apps Script doesn't support console.debug; use console.log and make the output explicit
    console.log('[DEBUG]', ...arguments_.map((a) => this.serialiseArg(a)));
  }
}

/**
 *
 */
function isErrorLike(value) {
  return value instanceof Error || (value?.name && value?.message && value?.stack);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABLogger;
}
// Attach to globalThis for GAS runtime compatibility
if (typeof globalThis !== 'undefined') {
  globalThis.ABLogger = ABLogger;
}
