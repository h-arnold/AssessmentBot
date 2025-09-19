/**
 * SingletonTestHarness - Utilities for testing singleton behavior and lazy initialization
 *
 * This harness provides tools to:
 * - Reset singleton instances between tests
 * - Track constructor calls and heavy initialization
 * - Measure performance of singleton initialization
 * - Provide isolated test environments for singletons
 */

const gasMocks = require('../__mocks__/googleAppsScript');

class SingletonTestHarness {
  constructor() {
    this.constructorCalls = new Map();
    this.initializationCalls = new Map();
    this.performanceTimings = new Map();
  }

  /**
   * Reset all singleton static instances to null for clean test isolation
   */
  resetAllSingletons() {
    // Reset singleton instances
    const singletonClasses = [
      'ConfigurationManager',
      'InitController',
      'UIManager',
      'ProgressTracker',
    ];

    // Clear static instances if they exist
    for (const className of singletonClasses) {
      try {
        const ClassRef = global[className];
        if (ClassRef?.instance) {
          ClassRef.instance = null;
        }
        if (ClassRef?._instance) {
          ClassRef._instance = null;
        }
      } catch (e) {
        // Class might not be loaded, that's OK — log for visibility in tests
        console.debug(`Could not reset singleton ${className}: ${e.message}`);
      }
    }

    // Reset mock call tracking
    this.resetMockCalls();

    // Reset internal tracking
    this.constructorCalls.clear();
    this.initializationCalls.clear();
    this.performanceTimings.clear();
  }

  /**
   * Reset all mock call tracking
   */
  resetMockCalls() {
    // Reset GAS mock calls
    if (gasMocks.PropertiesService._calls) gasMocks.PropertiesService._calls.length = 0;
    if (gasMocks.SpreadsheetApp._calls) gasMocks.SpreadsheetApp._calls.length = 0;
    if (gasMocks.HtmlService._calls) gasMocks.HtmlService._calls.length = 0;
    if (gasMocks.DriveApp._calls) gasMocks.DriveApp._calls.length = 0;
    gasMocks.GoogleClassroomManager._constructorCalls = 0;
    gasMocks.PropertiesCloner._constructorCalls = 0;
    if (gasMocks.PropertiesCloner._calls) gasMocks.PropertiesCloner._calls.length = 0;
  }

  /**
   * Setup GAS globals with mocks for testing
   */
  setupGASMocks() {
    global.PropertiesService = gasMocks.PropertiesService;
    global.SpreadsheetApp = gasMocks.SpreadsheetApp;
    global.HtmlService = gasMocks.HtmlService;
    global.DriveApp = gasMocks.DriveApp;
    global.GoogleClassroomManager = gasMocks.GoogleClassroomManager;
    global.PropertiesCloner = gasMocks.PropertiesCloner;
  }

  /**
   * Run a test function with fresh singleton state
   * @param {Function} testFn - The test function to run
   * @returns {Promise} - Result of the test function
   */
  async withFreshSingletons(testFn) {
    this.resetAllSingletons();
    this.setupGASMocks();

    try {
      return await testFn();
    } finally {
      // Cleanup after test
      this.resetAllSingletons();
    }
  }

  /**
   * Track when a constructor is called
   * @param {string} className - Name of the class
   */
  trackConstructorCall(className) {
    const count = this.constructorCalls.get(className) || 0;
    this.constructorCalls.set(className, count + 1);
  }

  /**
   * Track when heavy initialization occurs
   * @param {string} className - Name of the class
   * @param {string} method - Name of the initialization method
   */
  trackInitializationCall(className, method = 'initialize') {
    const key = `${className}.${method}`;
    const count = this.initializationCalls.get(key) || 0;
    this.initializationCalls.set(key, count + 1);
  }

  /**
   * Start timing for performance measurement
   * @param {string} operation - Name of the operation being timed
   */
  startTiming(operation) {
    this.performanceTimings.set(`${operation}_start`, Date.now());
  }

  /**
   * End timing for performance measurement
   * @param {string} operation - Name of the operation being timed
   * @returns {number} - Duration in milliseconds
   */
  endTiming(operation) {
    const startTime = this.performanceTimings.get(`${operation}_start`);
    if (!startTime) {
      throw new Error(`No start time found for operation: ${operation}`);
    }
    const endTime = Date.now();
    const duration = endTime - startTime;
    this.performanceTimings.set(`${operation}_duration`, duration);
    return duration;
  }

  /**
   * Get constructor call count for a class
   * @param {string} className - Name of the class
   * @returns {number} - Number of constructor calls
   */
  getConstructorCallCount(className) {
    return this.constructorCalls.get(className) || 0;
  }

  /**
   * Get initialization call count for a class method
   * @param {string} className - Name of the class
   * @param {string} method - Name of the method
   * @returns {number} - Number of initialization calls
   */
  getInitializationCallCount(className, method = 'initialize') {
    const key = `${className}.${method}`;
    return this.initializationCalls.get(key) || 0;
  }

  /**
   * Get timing duration for an operation
   * @param {string} operation - Name of the operation
   * @returns {number} - Duration in milliseconds
   */
  getTimingDuration(operation) {
    return this.performanceTimings.get(`${operation}_duration`) || 0;
  }

  /**
   * Check if PropertiesService was accessed
   * @returns {boolean}
   */
  wasPropertiesServiceAccessed() {
    return gasMocks.PropertiesService._calls.length > 0;
  }

  /**
   * Check if SpreadsheetApp UI was accessed
   * @returns {boolean}
   */
  wasUIAccessed() {
    return gasMocks.SpreadsheetApp._calls.length > 0;
  }

  /**
   * Check if DriveApp was accessed
   * @returns {boolean}
   */
  wasDriveAccessed() {
    return gasMocks.DriveApp._calls.length > 0;
  }

  /**
   * Check if GoogleClassroomManager was instantiated
   * @returns {boolean}
   */
  wasClassroomManagerInstantiated() {
    return gasMocks.GoogleClassroomManager._constructorCalls > 0;
  }

  /**
   * Get the number of GoogleClassroomManager instances created
   * @returns {number}
   */
  getClassroomManagerInstanceCount() {
    return gasMocks.GoogleClassroomManager._constructorCalls;
  }

  /**
   * Log current state for debugging
   */
  logState() {
    console.log('=== SingletonTestHarness State ===');
    console.log('Constructor calls:', Object.fromEntries(this.constructorCalls));
    console.log('Initialization calls:', Object.fromEntries(this.initializationCalls));
    console.log('Performance timings:', Object.fromEntries(this.performanceTimings));
    console.log('PropertiesService calls:', gasMocks.PropertiesService._calls);
    console.log('SpreadsheetApp calls:', gasMocks.SpreadsheetApp._calls);
    console.log(
      'GoogleClassroomManager instances:',
      gasMocks.GoogleClassroomManager._constructorCalls
    );
    console.log('=================================');
  }
}

module.exports = { SingletonTestHarness };
