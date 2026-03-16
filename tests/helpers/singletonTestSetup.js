/**
 * Helper functions for setting up singleton tests
 * Extracts common patterns from singleton test files to reduce duplication
 */

const { SingletonTestHarness } = require('../singletons/SingletonTestHarness.js');

/**
 * Create a test context with harness and loaded singletons
 * @param {Object} options - Configuration options
 * @param {boolean} options.loadConfigurationManager - Load ConfigurationManager
 * @param {boolean} options.loadInitController - Load InitController
 * @param {boolean} options.loadUIManager - Load UIManager
 * @param {boolean} options.loadProgressTracker - Load ProgressTracker
 * @returns {Object} Context with harness and loaded singletons
 */
function createSingletonTestContext() {
  const harness = new SingletonTestHarness();
  const context = { harness };

  return context;
}

/**
 * Setup function to load singletons with proper error handling
 * Extracts the common try-catch pattern for loading singleton classes
 * @param {SingletonTestHarness} harness - The test harness instance
 * @param {Object} options - Which singletons to load
 * @returns {Object} Loaded singleton classes
 */
function loadSingletonsWithMocks(harness, options = {}) {
  const {
    loadConfigurationManager = false,
    loadInitController = false,
    loadUIManager = false,
    loadProgressTracker = false,
  } = options;

  harness.setupGASMocks();

  const singletons = {};

  if (loadConfigurationManager) {
    try {
      let ConfigurationManager = require('../../src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js');
      if (ConfigurationManager.default) ConfigurationManager = ConfigurationManager.default;
      globalThis.ConfigurationManager = ConfigurationManager;
      singletons.ConfigurationManager = ConfigurationManager;
    } catch (e) {
      console.warn('Could not load ConfigurationManager:', e.message);
      singletons.ConfigurationManager = null;
    }
  }

  if (loadInitController) {
    try {
      let InitController = require('../../src/AdminSheet/y_controllers/InitController.js');
      if (InitController.default) InitController = InitController.default;
      singletons.InitController = InitController;
    } catch (e) {
      console.warn('Could not load InitController:', e.message);
      singletons.InitController = null;
    }
  }

  if (loadUIManager) {
    try {
      let UIManager = require('../../src/AdminSheet/UI/98_UIManager.js');
      if (UIManager.default) UIManager = UIManager.default;
      globalThis.UIManager = UIManager;
      singletons.UIManager = UIManager;
    } catch (e) {
      console.warn('Could not load UIManager:', e.message);
      singletons.UIManager = null;
    }
  }

  if (loadProgressTracker) {
    try {
      let ProgressTracker = require('../../src/AdminSheet/Utils/ProgressTracker.js');
      if (ProgressTracker.default) ProgressTracker = ProgressTracker.default;
      singletons.ProgressTracker = ProgressTracker;
    } catch (e) {
      console.warn('Could not load ProgressTracker:', e.message);
      singletons.ProgressTracker = null;
    }
  }

  return singletons;
}

/**
 * Create a standard beforeEach setup for singleton tests
 * @param {Object} options - Which singletons to load
 * @returns {Function} beforeEach callback
 */
function createSingletonBeforeEach(options = {}) {
  const harness = new SingletonTestHarness();

  return async function () {
    const singletons = {};
    await harness.withFreshSingletons(() => {
      Object.assign(singletons, loadSingletonsWithMocks(harness, options));
    });
    return { harness, ...singletons };
  };
}

module.exports = {
  createSingletonTestContext,
  loadSingletonsWithMocks,
  createSingletonBeforeEach,
  SingletonTestHarness,
};
