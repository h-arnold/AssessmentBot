/**
 * 99_BaseSingleton.js - NOTE:
 * Lightweight abstract base providing a standard getInstance/resetForTests pattern
 * plus optional freezing after first initialization.
 *
 * Subclasses should:
 *  - Implement a constructor that accepts (isSingletonCreator = false) and avoids heavy work
 *  - Implement ensureInitialized() if heavy/lazy initialization is required
 *  - (Optional) set a static FREEZE_AFTER_INIT = true to enable automatic Object.freeze(instance)
 */
class BaseSingleton {
  constructor() {
    if (new.target === BaseSingleton) {
      throw new Error('BaseSingleton is abstract and cannot be instantiated directly.');
    }
  }

  /**
   * Generic getter; subclasses override _createInstance if special construction needed.
   */
  static getInstance() {
    if (!this._instance) {
      // Use dedicated factory to allow subclasses to pass flag or do pre-init wiring.
      this._instance = this._createInstance();
    }
    return this._instance;
  }

  /**
   * Factory hook; subclasses may override to pass a flag (e.g. new ThisClass(true)).
   */
  static _createInstance() {
    return new this(true); // convention: flag indicates legitimate singleton construction
  }

  /** Reset helper for tests. */
  static resetForTests() {
    this._instance = null;
  }

  /**
   * Helper invoked by subclasses inside ensureInitialized() once heavy init completes.
   */
  static _maybeFreeze(instance) {
    if (this.FREEZE_AFTER_INIT && instance && !Object.isFrozen(instance)) {
      Object.freeze(instance); // Should not throw in supported environments
    }
  }
}

// Always export for CommonJS and also attach to globalThis so test bootstrap
// (which simply requires this module) guarantees `globalThis.BaseSingleton` is defined.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseSingleton;
}
if (typeof globalThis !== 'undefined') {
  globalThis.BaseSingleton = BaseSingleton;
}
