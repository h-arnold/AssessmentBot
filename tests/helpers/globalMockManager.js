/**
 * Global Mock Manager
 *
 * Provides a consistent pattern for saving and restoring global mocks in tests.
 * This prevents test pollution where one test's cleanup deletes globals
 * that other tests depend on.
 *
 * Usage:
 *
 *   const { withGlobalMocks } = require('../helpers/globalMockManager.js');
 *
 *   describe('MyTest', () => {
 *     const { restoreGlobals } = withGlobalMocks({
 *       ProgressTracker: () => ({ getInstance: () => mockTracker }),
 *       ConfigurationManager: () => mockConfigManager,
 *     });
 *
 *     afterEach(() => {
 *       restoreGlobals();
 *     });
 *
 *     it('should work with mocked globals', () => {
 *       // globals are mocked
 *     });
 *   });
 *
 * Or use the automatic beforeEach/afterEach pattern:
 *
 *   const { mockGlobals } = require('../helpers/globalMockManager.js');
 *
 *   describe('MyTest', () => {
 *     const cleanup = mockGlobals({
 *       ProgressTracker: () => mockProgressTracker,
 *       ConfigurationManager: () => mockConfigManager,
 *     });
 *
 *     // cleanup is automatically added to afterEach
 *   });
 */

/**
 * Saves the current values of specified global properties.
 * @param {string[]} globalNames - Array of global property names to save
 * @returns {Object} Map of global names to their original values
 */
function saveGlobals(globalNames) {
  const saved = {};
  for (const name of globalNames) {
    saved[name] = globalThis[name];
  }
  return saved;
}

/**
 * Restores saved global values.
 * If a global was undefined when saved, it will be deleted.
 * If it had a value, that value will be restored.
 * @param {Object} savedGlobals - Map of global names to their saved values
 */
function restoreGlobals(savedGlobals) {
  for (const [name, value] of Object.entries(savedGlobals)) {
    if (value === undefined) {
      delete globalThis[name];
    } else {
      globalThis[name] = value;
    }
  }
}

/**
 * Creates a mock context for specified globals.
 * Saves original values and provides a restore function.
 *
 * @param {Object} mocks - Map of global names to mock factories or values
 * @param {string[]} mocks.* - Global name as key, factory function or value as value
 * @returns {Object} Context with restore function
 *
 * @example
 * const context = withGlobalMocks({
 *   ProgressTracker: () => mockProgressTracker,
 *   ConfigurationManager: () => mockConfigManager,
 * });
 * // Use context.restore() in afterEach
 */
function withGlobalMocks(mocks) {
  const globalNames = Object.keys(mocks);
  const savedGlobals = saveGlobals(globalNames);

  // Apply mocks
  for (const [name, mockFactory] of Object.entries(mocks)) {
    globalThis[name] = typeof mockFactory === 'function' ? mockFactory() : mockFactory;
  }

  return {
    restore: () => restoreGlobals(savedGlobals),
    savedGlobals,
  };
}

/**
 * Creates a beforeEach/afterEach pair that automatically manages global mocks.
 *
 * @param {Object} mocks - Map of global names to mock factories or values
 * @returns {Object} Object with beforeEach and afterEach functions
 *
 * @example
 * const { beforeEach: setupMocks, afterEach: teardownMocks } =
 *   mockGlobals({ ProgressTracker: () => mockTracker });
 *
 * describe('MyTest', () => {
 *   beforeEach(setupMocks);
 *   afterEach(teardownMocks);
 *   // tests...
 * });
 */
function mockGlobals(mocks) {
  const globalNames = Object.keys(mocks);

  // For compatibility with Vitest's describe block scoping,
  // we need a closure-based approach.
  const savedGlobalsRef = { current: null };

  const setup = () => {
    savedGlobalsRef.current = saveGlobals(globalNames);
    for (const [name, mockFactory] of Object.entries(mocks)) {
      globalThis[name] = typeof mockFactory === 'function' ? mockFactory() : mockFactory;
    }
  };

  const teardown = () => {
    if (savedGlobalsRef.current) {
      restoreGlobals(savedGlobalsRef.current);
      savedGlobalsRef.current = null;
    }
  };

  return { beforeEach: setup, afterEach: teardown, setup, teardown };
}

/**
 * Temporarily replaces specified globals with mocks, then restores them.
 * Useful for one-off mocking in a single test.
 *
 * @param {Object} mocks - Map of global names to mock factories or values
 * @param {Function} fn - Test function to run with mocked globals
 * @returns {*} The return value of fn
 */
function withTemporaryGlobals(mocks, fn) {
  const globalNames = Object.keys(mocks);
  const savedGlobals = saveGlobals(globalNames);

  try {
    // Apply mocks
    for (const [name, mockFactory] of Object.entries(mocks)) {
      globalThis[name] = typeof mockFactory === 'function' ? mockFactory() : mockFactory;
    }
    return fn();
  } finally {
    restoreGlobals(savedGlobals);
  }
}

/**
 * Resets a specific global to its original value from setupGlobals.
 * This is a simpler alternative when you only need to reset one global.
 *
 * @param {string} globalName - Name of the global to reset
 */
function resetGlobal(globalName) {
  // This is a best-effort reset. In a real test suite,
  // the original should be saved before modification.
  delete globalThis[globalName];
}

module.exports = {
  saveGlobals,
  restoreGlobals,
  withGlobalMocks,
  mockGlobals,
  withTemporaryGlobals,
  resetGlobal,
};
