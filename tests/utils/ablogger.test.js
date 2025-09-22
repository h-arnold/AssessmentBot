// Vitest provides globals (describe/it/expect/beforeEach/afterEach/vi) via
// the project's `vitest.config.js` -> `test.globals: true` setting, so do not
// require/import vitest here; use the globals directly.
// Load the singleton base (setupGlobals already requires BaseSingleton)
const ABLogger = require('../../src/AdminSheet/Utils/ABLogger.js');

describe('ABLogger', () => {
  let logger;
  const originalConsole = { ...console };

  beforeEach(() => {
    // Reset any singleton instance if present
    if (ABLogger?._instance) {
      ABLogger._instance = null;
    }
    logger = ABLogger.getInstance();

    // Replace console methods with spies
    console.log = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    console.debug = vi.fn();
  });

  afterEach(() => {
    // Restore console methods
    Object.assign(console, originalConsole);
    // Clear DEBUG_UI
    if (typeof globalThis !== 'undefined') delete globalThis.DEBUG_UI;
    // Reset singleton
    if (ABLogger?._instance) {
      ABLogger._instance = null;
    }
    vi.resetAllMocks();
  });

  it('forwards log/info/warn/error/debug to console', () => {
    logger.log('one', 2);
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    logger.debug('d');

    expect(console.log).toHaveBeenCalledWith('one', 2);
    expect(console.info).toHaveBeenCalledWith('i');
    expect(console.warn).toHaveBeenCalledWith('w');
    expect(console.error).toHaveBeenCalledWith('e');
    expect(console.debug).toHaveBeenCalledWith('d');
  });

  it('debugUi only logs when globalThis.DEBUG_UI is true', () => {
    // By default undefined -> should not call
    logger.debugUi('nope');
    expect(console.log).not.toHaveBeenCalled();

    // Enable and call
    globalThis.DEBUG_UI = true;
    logger.debugUi('yes');
    expect(console.log).toHaveBeenCalledWith('[DEBUG_UI] yes');
  });
});
