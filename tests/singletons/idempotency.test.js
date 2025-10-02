const {
  loadSingletonsWithMocks,
  SingletonTestHarness,
} = require('../helpers/singletonTestSetup.js');
const { repeat } = require('../helpers/testUtils.js');

/**
 * Phase 1: Idempotency tests ensuring multiple getInstance() calls do not cause
 * repeated constructor side effects.
 */

describe('Singleton getInstance() idempotency', () => {
  const harness = new SingletonTestHarness();
  let ConfigurationManager, InitController, UIManager, ProgressTracker;

  beforeEach(async () => {
    await harness.withFreshSingletons(() => {
      const singletons = loadSingletonsWithMocks(harness, {
        loadConfigurationManager: true,
        loadInitController: true,
        loadUIManager: true,
        loadProgressTracker: true,
      });
      ConfigurationManager = singletons.ConfigurationManager;
      InitController = singletons.InitController;
      UIManager = singletons.UIManager;
      ProgressTracker = singletons.ProgressTracker;
    });
    harness.resetMockCalls();
  });

  test('ConfigurationManager.getInstance() returns same instance across calls', () => {
    const instances = [];
    repeat(10, () => instances.push(ConfigurationManager.getInstance()));
    const first = instances[0];
    instances.forEach((i) => expect(i).toBe(first));
  });

  test('InitController.getInstance() returns same instance across calls', () => {
    const instances = [];
    repeat(10, () => instances.push(InitController.getInstance()));
    const first = instances[0];
    instances.forEach((i) => expect(i).toBe(first));
  });

  test('UIManager.getInstance() returns same instance across calls', () => {
    const instances = [];
    repeat(10, () => instances.push(UIManager.getInstance()));
    const first = instances[0];
    instances.forEach((i) => expect(i).toBe(first));
  });

  test('ProgressTracker.getInstance() returns same instance across calls', () => {
    const instances = [];
    repeat(10, () => instances.push(ProgressTracker.getInstance()));
    const first = instances[0];
    instances.forEach((i) => expect(i).toBe(first));
  });
});
