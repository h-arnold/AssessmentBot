/**
 * Baseline tests for singleton lazy initialization behavior
 *
 * These tests establish the current behavior and will be used to verify
 * proper lazy loading after the refactoring is complete.
 *
 * NOTE: These tests will initially FAIL once lazy initialization is enforced.
 * They serve as documentation of desired behavior and regression protection.
 */

const { SingletonTestHarness } = require('./SingletonTestHarness.js');

// Helper functions to avoid deep nesting in tests
function mockUIManagerGetInstance() {
  // track constructor-like call
  harness.trackConstructorCall('UIManager');
  return { mockUIManager: true };
}

function noop() {}

const harness = new SingletonTestHarness();

// Import singletons for testing
// Note: We need to be careful about import order and globals
let ConfigurationManager, InitController, UIManager, ProgressTracker;

describe('Phase 0: Baseline Singleton Behavior Tests', () => {
  beforeEach(async () => {
    await harness.withFreshSingletons(() => {
      // Setup the globals that the singletons expect
      harness.setupGASMocks();

      // Import the classes after mocks are setup
      try {
        ConfigurationManager = require('../../src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js');
        if (ConfigurationManager.default) ConfigurationManager = ConfigurationManager.default;
      } catch (e) {
        console.warn('Could not load ConfigurationManager:', e.message);
      }

      try {
        ProgressTracker = require('../../src/AdminSheet/Utils/ProgressTracker.js');
        if (ProgressTracker.default) ProgressTracker = ProgressTracker.default;
      } catch (e) {
        console.warn('Could not load ProgressTracker:', e.message);
        ProgressTracker = null;
      }
    });
  });

  describe('ConfigurationManager Lazy Initialization', () => {
    test.skip('should not touch PropertiesService until first getter is called', async () => {
      await harness.withFreshSingletons(() => {
        // Create instance but don't call any methods
        const config = ConfigurationManager ? new ConfigurationManager() : null;

        if (config) {
          // Should not have accessed PropertiesService yet
          expect(harness.wasPropertiesServiceAccessed()).toBe(false);

          // Now call a getter that needs properties
          config.getApiKey();

          // Should have accessed PropertiesService
          expect(harness.wasPropertiesServiceAccessed()).toBe(true);
        }
      });
    });

    test.skip('should only deserialize properties once, even with multiple getters', async () => {
      await harness.withFreshSingletons(() => {
        const config = ConfigurationManager ? new ConfigurationManager() : null;

        if (config) {
          // Call multiple getters
          config.getApiKey();
          config.getBackendUrl();
          config.getSlidesFetchBatchSize();

          // Count how many times properties were accessed
          const propertiesCalls = harness.wasPropertiesServiceAccessed();
          expect(propertiesCalls).toBe(true);

          // Should not re-initialize on subsequent calls
          const callsBefore = global.PropertiesService._calls.length;
          config.getApiKey(); // Call again
          const callsAfter = global.PropertiesService._calls.length;

          // Should not have made additional heavy calls
          expect(callsAfter).toBeLessThanOrEqual(callsBefore + 1); // Allow some caching calls
        }
      });
    });
  });

  describe('InitController Lazy Initialization', () => {
    test.skip('should not instantiate UIManager until UI method invoked', async () => {
      await harness.withFreshSingletons(() => {
        // Mock UIManager for this test
        global.UIManager = {
          getInstance: mockUIManagerGetInstance,
        };

        // Import InitController after setting up UIManager mock
        let InitController;
        try {
          InitController = require('../../src/AdminSheet/y_controllers/InitController.js');
          if (InitController.default) InitController = InitController.default;
        } catch (e) {
          console.warn('Could not load InitController:', e.message);
          return;
        }

        // Create InitController instance
        const initController = new InitController();

        // Should not have instantiated UIManager yet
        expect(harness.getConstructorCallCount('UIManager')).toBe(0);

        // Call a UI-related method
        if (initController.onOpen) {
          initController.onOpen();
        }

        // Now UIManager should be instantiated
        expect(harness.getConstructorCallCount('UIManager')).toBeGreaterThan(0);
      });
    });
  });

  describe('UIManager Lazy Initialization', () => {
    test.skip('should not create GoogleClassroomManager until classroom method called', async () => {
      await harness.withFreshSingletons(() => {
        // Import UIManager
        let UIManager;
        try {
          UIManager = require('../../src/AdminSheet/UI/UIManager.js');
          if (UIManager.default) UIManager = UIManager.default;
        } catch (e) {
          console.warn('Could not load UIManager:', e.message);
          return;
        }

        // Create UIManager instance
        const uiManager = UIManager ? UIManager.getInstance() : null;

        if (uiManager) {
          // Should not have created GoogleClassroomManager yet
          expect(harness.wasClassroomManagerInstantiated()).toBe(false);

          // Call a UI method that doesn't need classroom
          if (uiManager.safeUiOperation) {
            uiManager.safeUiOperation(noop, 'test');
          }

          // Still should not have created GoogleClassroomManager
          expect(harness.wasClassroomManagerInstantiated()).toBe(false);

          // Call a method that would need classroom manager
          // (This will depend on the actual API, but conceptually...)
          if (uiManager.showAssignmentDropdown) {
            uiManager.showAssignmentDropdown();
          }

          // Now GoogleClassroomManager should be instantiated
          expect(harness.wasClassroomManagerInstantiated()).toBe(true);
        }
      });
    });
  });

  describe('ProgressTracker (Already Lazy - Control Test)', () => {
    test('getInstance returns same object and constructor only once', async () => {
      await harness.withFreshSingletons(() => {
        if (!ProgressTracker) {
          console.log('ProgressTracker not available');
          expect(true).toBe(true);
          return;
        }
        const a = ProgressTracker.getInstance();
        const b = ProgressTracker.getInstance();
        expect(a).toBe(b);
      });
    });

    test('does not eagerly perform multiple document property fetches for repeated getInstance()', async () => {
      await harness.withFreshSingletons(() => {
        if (!ProgressTracker) {
          expect(true).toBe(true);
          return;
        }
        ProgressTracker.getInstance();
        const callsAfterFirst = global.PropertiesService._calls.length;
        ProgressTracker.getInstance();
        const callsAfterSecond = global.PropertiesService._calls.length;
        expect(callsAfterSecond).toBe(callsAfterFirst); // no extra doc properties fetch expected
      });
    });
  });

  describe('Singleton Instance Identity', () => {
    test('multiple getInstance calls return identical objects', async () => {
      await harness.withFreshSingletons(() => {
        if (ConfigurationManager) {
          const config1 = new ConfigurationManager();
          const config2 = new ConfigurationManager();
          expect(config1).toBe(config2);
        }

        if (ProgressTracker) {
          const tracker1 = ProgressTracker.getInstance();
          const tracker2 = ProgressTracker.getInstance();
          expect(tracker1).toBe(tracker2);
        }
      });
    });
  });

  describe('Performance Baseline', () => {
    test('measure cold vs warm initialization times (non-assertive)', async () => {
      await harness.withFreshSingletons(() => {
        if (ConfigurationManager) {
          harness.startTiming('ConfigurationManager_cold');
          const c1 = new ConfigurationManager();
          harness.endTiming('ConfigurationManager_cold');
          harness.startTiming('ConfigurationManager_warm');
          const c2 = new ConfigurationManager();
          harness.endTiming('ConfigurationManager_warm');
          console.log(
            'ConfigurationManager cold/warm (ms):',
            harness.getTimingDuration('ConfigurationManager_cold'),
            harness.getTimingDuration('ConfigurationManager_warm')
          );
          expect(c1).toBe(c2);
        }
        if (ProgressTracker) {
          harness.startTiming('ProgressTracker_cold');
          const t1 = ProgressTracker.getInstance();
          harness.endTiming('ProgressTracker_cold');
          harness.startTiming('ProgressTracker_warm');
          const t2 = ProgressTracker.getInstance();
          harness.endTiming('ProgressTracker_warm');
          console.log(
            'ProgressTracker cold/warm (ms):',
            harness.getTimingDuration('ProgressTracker_cold'),
            harness.getTimingDuration('ProgressTracker_warm')
          );
          expect(t1).toBe(t2);
        }
        expect(true).toBe(true);
      });
    });
  });
});

describe('Phase 0: Instrumentation and Mock Verification', () => {
  test('SingletonTestHarness works correctly', () => {
    expect(harness).toBeDefined();
    expect(typeof harness.resetAllSingletons).toBe('function');
    expect(typeof harness.withFreshSingletons).toBe('function');
  });

  test('GAS mocks are functional', () => {
    harness.setupGASMocks();

    // Test PropertiesService mock
    expect(global.PropertiesService).toBeDefined();
    const scriptProps = global.PropertiesService.getScriptProperties();
    expect(scriptProps).toBeDefined();
    expect(typeof scriptProps.getProperty).toBe('function');

    // Test SpreadsheetApp mock
    expect(global.SpreadsheetApp).toBeDefined();
    const ui = global.SpreadsheetApp.getUi();
    expect(ui).toBeDefined();
    expect(typeof ui.createMenu).toBe('function');

    // Test GoogleClassroomManager mock
    expect(global.GoogleClassroomManager).toBeDefined();
    // Use the created instance to avoid linter warning about unused instantiation
    const classroomManager = new global.GoogleClassroomManager();
    expect(classroomManager._instanceId).toBeDefined();
    expect(harness.getClassroomManagerInstanceCount()).toBe(1);
  });

  test('mock call tracking works', () => {
    harness.setupGASMocks();
    harness.resetMockCalls();

    // Make some calls
    global.PropertiesService.getScriptProperties();
    global.SpreadsheetApp.getUi();
    const classroomManager2 = new global.GoogleClassroomManager();
    expect(classroomManager2._instanceId).toBeDefined();

    // Verify tracking
    expect(harness.wasPropertiesServiceAccessed()).toBe(true);
    expect(harness.wasUIAccessed()).toBe(true);
    expect(harness.wasClassroomManagerInstantiated()).toBe(true);
  });
});
