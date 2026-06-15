const {
  loadSingletonsWithMocks,
  SingletonTestHarness,
} = require('../helpers/singletonTestSetup.js');

/**
 * Phase 2 behavior tests – focus on heavy boundary guarding & classroom manager laziness.
 */
let ConfigurationManager;
const harness = new SingletonTestHarness();

describe('Phase 2: Heavy boundary & classroom manager tests', () => {
  beforeEach(async () => {
    await harness.withFreshSingletons(() => {
      const singletons = loadSingletonsWithMocks(harness, {
        loadConfigurationManager: true,
      });
      ConfigurationManager = singletons.ConfigurationManager;
      globalThis.configurationManager = ConfigurationManager.getInstance();
    });
  });

  test('setting a script property triggers initialization exactly once', async () => {
    await harness.withFreshSingletons(() => {
      const singletons = loadSingletonsWithMocks(harness, {
        loadConfigurationManager: true,
      });
      ConfigurationManager = singletons.ConfigurationManager;
      const cfg = ConfigurationManager.getInstance();

      // Before any setter/getter: no PropertiesService access
      expect(harness.wasPropertiesServiceAccessed()).toBe(false);

      // First setter call should cause initialization
      cfg.setBackendUrl('https://example.com');
      expect(harness.wasPropertiesServiceAccessed()).toBe(true);
      const callsAfterFirst = globalThis.PropertiesService._calls.length;

      // Second unrelated setter should NOT cause a second heavy init beyond normal property set
      cfg.setApiKey('abc-123');
      const callsAfterSecond = globalThis.PropertiesService._calls.length;
      expect(callsAfterSecond).toBeGreaterThanOrEqual(callsAfterFirst); // sets will add minimal calls
      // but should not explode (heuristic: fewer than +5 calls)
      expect(callsAfterSecond - callsAfterFirst).toBeLessThan(5);
    });
  });

  test('validation of invalid folder id uses heuristic without Drive access', async () => {
    await harness.withFreshSingletons(() => {
      const singletons = loadSingletonsWithMocks(harness, {
        loadConfigurationManager: true,
      });
      ConfigurationManager = singletons.ConfigurationManager;
      const cfg = ConfigurationManager.getInstance();
      const invalidId = 'short';
      const result = cfg.isValidGoogleDriveFolderId(invalidId);
      expect(result).toBe(false);
      // Heuristic should avoid DriveApp access
      expect(harness.wasDriveAccessed()).toBe(false);
    });
  });
});
