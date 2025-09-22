const { SingletonTestHarness } = require('./SingletonTestHarness.js');

/**
 * Phase 1: Idempotency tests ensuring multiple getInstance() calls do not cause
 * repeated constructor side effects.
 */

describe('Singleton getInstance() idempotency', () => {
  const harness = new SingletonTestHarness();
  let ConfigurationManager, InitController, UIManager, ProgressTracker;

  beforeEach(async () => {
    await harness.withFreshSingletons(() => {
      harness.setupGASMocks();
      ConfigurationManager = require('../../src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js');
      InitController = require('../../src/AdminSheet/y_controllers/InitController.js');
      UIManager = require('../../src/AdminSheet/UI/UIManager.js');
      ProgressTracker = require('../../src/AdminSheet/Utils/ProgressTracker.js');
    });
    harness.resetMockCalls();
  });

  function repeat(n, fn) {
    for (let i = 0; i < n; i++) fn();
  }

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
