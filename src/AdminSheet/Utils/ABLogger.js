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
      // Use a recursion guard to avoid re-entrant logging loops and surface via ProgressTracker
      try {
        if (!ABLogger._inLoggingFailure) {
          ABLogger._inLoggingFailure = true;
          ProgressTracker.getInstance().logError('ABLogger.debugUi logging failure', { err: e });
        }
      } finally {
        ABLogger._inLoggingFailure = false;
      }
    }
  }

  // Helper: serialise Error objects (and nested causes) to plain objects for logging
  serialiseError(err) {
    if (!err || typeof err !== 'object') return err;
    const out = {};
    if (err.name) out.name = err.name;
    if (err.message) out.message = err.message;
    if (err.stack) out.stack = err.stack;
    // Do not recursively serialise nested causes — keep top-level cause out of scope
    if (err.cause && typeof err.cause === 'object') {
      out.cause = { name: err.cause.name, message: err.cause.message };
    }
    return out;
  }

  serialiseArg(arg) {
    if (!arg) return arg;

    const isErrorLike = (v) => v instanceof Error || (v?.name && v?.message && v?.stack);

    // If it's an Error, serialise
    if (isErrorLike(arg)) return this.serialiseError(arg);

    // If it's an object/array, shallow-copy and serialise any direct Error-like properties
    if (typeof arg === 'object') {
      return this.shallowSerialiseObject(arg, isErrorLike);
    }

    return arg;
  }

  // Helper to shallow-copy objects/arrays and serialise any direct Error-like properties
  shallowSerialiseObject(obj, isErrorLike) {
    try {
      const copy = Array.isArray(obj) ? obj.slice() : { ...obj };
      for (const k in copy) {
        if (!Object.hasOwn(copy, k)) continue;
        const v = copy[k];
        if (isErrorLike(v)) copy[k] = this.serialiseError(v);
      }
      return copy;
    } catch (err) {
      this.error('ABLogger.shallowSerialiseObject logging failure', err);
      return obj;
    }
  }

  // Lightweight forwards to console for tests and runtime logging
  log(...args) {
    console.log(...args.map((a) => this.serialiseArg(a)));
  }
  info(...args) {
    console.info(...args.map((a) => this.serialiseArg(a)));
  }
  warn(...args) {
    console.warn(...args.map((a) => this.serialiseArg(a)));
  }
  error(...args) {
    console.error(...args.map((a) => this.serialiseArg(a)));
  }
  debug(...args) {
    // Apps Script doesn't support console.debug; use console.log and make the output explicit
    console.log('[DEBUG]', ...args.map((a) => this.serialiseArg(a)));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABLogger;
}
// Attach to globalThis for GAS runtime compatibility
if (typeof globalThis !== 'undefined') {
  globalThis.ABLogger = ABLogger;
}
