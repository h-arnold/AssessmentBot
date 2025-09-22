const { SingletonTestHarness } = require('./SingletonTestHarness.js');

/**
 * Tests for lazy UI probing behavior introduced in UIManager.
 */

describe('UIManager lazy UI probe', () => {
  const harness = new SingletonTestHarness();
  let UIManager;

  beforeEach(async () => {
    await harness.withFreshSingletons(() => {
      harness.setupGASMocks();
      UIManager = require('../../src/AdminSheet/UI/UIManager.js');
    });
  });

  test('constructor does not probe UI immediately', () => {
    const ui = UIManager.getInstance();
    // Internal flag should indicate no probe yet
    expect(ui._uiProbed).toBe(false);
  });

  test('first safeUiOperation triggers probe exactly once', () => {
    const ui = UIManager.getInstance();
    expect(ui._uiProbed).toBe(false);
    ui.safeUiOperation(() => {}, 'noop');
    expect(ui._uiProbed).toBe(true);
    const firstState = ui.uiAvailable;
    // second call should not re-probe
    ui.safeUiOperation(() => {}, 'noop2');
    expect(ui._uiProbed).toBe(true);
    expect(ui.uiAvailable).toBe(firstState);
  });
});
