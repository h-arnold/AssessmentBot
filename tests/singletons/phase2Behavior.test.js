const { SingletonTestHarness } = require('./SingletonTestHarness.js');

/**
 * Phase 2 behavior tests – focus on heavy boundary guarding & classroom manager laziness.
 */
let ConfigurationManager, UIManager;
const harness = new SingletonTestHarness();

describe('Phase 2: Heavy boundary & classroom manager tests', () => {
  beforeEach(async () => {
    await harness.withFreshSingletons(() => {
      harness.setupGASMocks();
      ConfigurationManager = require('../../src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js');
      UIManager = require('../../src/AdminSheet/UI/UIManager.js');
      global.configurationManager = ConfigurationManager.getInstance();
    });
  });

  test('setting a script property triggers initialization exactly once', async () => {
    await harness.withFreshSingletons(() => {
      ConfigurationManager = require('../../src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js');
      const cfg = ConfigurationManager.getInstance();

      // Before any setter/getter: no PropertiesService access
      expect(harness.wasPropertiesServiceAccessed()).toBe(false);

      // First setter call should cause initialization
      cfg.setBackendUrl('https://example.com');
      expect(harness.wasPropertiesServiceAccessed()).toBe(true);
      const callsAfterFirst = global.PropertiesService._calls.length;

      // Second unrelated setter should NOT cause a second heavy init beyond normal property set
      cfg.setApiKey('abc-123');
      const callsAfterSecond = global.PropertiesService._calls.length;
      expect(callsAfterSecond).toBeGreaterThanOrEqual(callsAfterFirst); // sets will add minimal calls
      // but should not explode (heuristic: fewer than +5 calls)
      expect(callsAfterSecond - callsAfterFirst).toBeLessThan(5);
    });
  });

  test('validation of invalid sheet id uses heuristic without Drive access', async () => {
    await harness.withFreshSingletons(() => {
      ConfigurationManager = require('../../src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js');
      const cfg = ConfigurationManager.getInstance();
      const invalidId = 'short';
      const result = cfg.isValidGoogleSheetId(invalidId);
      expect(result).toBe(false);
      // Heuristic should avoid DriveApp access
      expect(harness.wasDriveAccessed()).toBe(false);
    });
  });

  test('first classroom UI call instantiates GoogleClassroomManager exactly once', async () => {
    await harness.withFreshSingletons(() => {
      UIManager = require('../../src/AdminSheet/UI/UIManager.js');
      const ui = UIManager.getInstance();

      // Non-classroom operation should not instantiate classroom manager
      if (ui.showProgressModal) ui.showProgressModal();
      expect(harness.wasClassroomManagerInstantiated()).toBe(false);

      // Classroom operation
      if (ui.showAssignmentDropdown) ui.showAssignmentDropdown();
      expect(harness.wasClassroomManagerInstantiated()).toBe(true);
      const firstCount = harness.getClassroomManagerInstanceCount();

      // Subsequent classroom call should not increase count
      if (ui.showClassroomDropdown) ui.showClassroomDropdown();
      expect(harness.getClassroomManagerInstanceCount()).toBe(firstCount);
    });
  });
});
