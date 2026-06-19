// Vitest provides globals (describe/it/expect/beforeEach/afterEach/vi) via
// the project's `vitest.config.js` -> `test.globals: true` setting, so do not
// require/import vitest here; use the globals directly.
// Load the singleton base (setupGlobals already requires BaseSingleton)
const ABLogger = require('../../src/backend/Utils/ABLogger.js');

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

    expect(console.log).toHaveBeenNthCalledWith(1, 'one', 2);
    expect(console.info).toHaveBeenCalledWith('i');
    expect(console.warn).toHaveBeenCalledWith('w');
    expect(console.error).toHaveBeenCalledWith('e');
    expect(console.log).toHaveBeenNthCalledWith(2, '[DEBUG]', 'd');
    expect(console.debug).not.toHaveBeenCalled();
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

  it('serialises Error objects passed directly', () => {
    const err = new Error('boom');
    logger.error(err);
    expect(console.error).toHaveBeenCalled();
    const calledArgs = console.error.mock.calls[0];
    expect(calledArgs.length).toBe(1);
    const serial = calledArgs[0];
    expect(serial).toBeTruthy();
    expect(serial.name).toBe('Error');
    expect(serial.message).toBe('boom');
    expect(serial.stack).toBeTruthy();
  });

  it('serialises objects with cause and key properties', () => {
    const err = new Error('disk');
    logger.error('failed', { key: 'db', cause: err });
    expect(console.error).toHaveBeenCalled();
    const calledArgs = console.error.mock.calls[0];
    // First arg is the message
    expect(calledArgs[0]).toBe('failed');
    // Second arg should be a shallow-serialised object with key and cause
    const payload = calledArgs[1];
    expect(payload).toBeTruthy();
    expect(payload.key).toBe('db');
    expect(payload.cause).toBeTruthy();
    expect(payload.cause.name).toBe('Error');
    expect(payload.cause.message).toBe('disk');
  });

  describe('debug method', () => {
    it('prepends [DEBUG] prefix and calls console.log', () => {
      logger.debug('test message', 42);
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', 'test message', 42);
    });

    it('serialises Error arguments via debug', () => {
      const err = new Error('debug error');
      logger.debug(err);
      expect(console.log).toHaveBeenCalled();
      const args = console.log.mock.calls[0];
      expect(args[0]).toBe('[DEBUG]');
      expect(args[1]).toBeTruthy();
      expect(args[1].message).toBe('debug error');
    });
  });

  describe('serialiseArg', () => {
    it('returns falsy values as-is', () => {
      expect(logger.serialiseArg(null)).toBeNull();
      expect(logger.serialiseArg(undefined)).toBeUndefined();
      expect(logger.serialiseArg('')).toBe('');
      expect(logger.serialiseArg(0)).toBe(0);
      expect(logger.serialiseArg(false)).toBe(false);
    });

    it('serialises Error objects', () => {
      const err = new Error('test error');
      const result = logger.serialiseArg(err);
      expect(result.name).toBe('Error');
      expect(result.message).toBe('test error');
      expect(result.stack).toBeTruthy();
    });

    it('performs shallow serialisation on plain objects', () => {
      const obj = { a: 1, b: 'two' };
      const result = logger.serialiseArg(obj);
      expect(result).toEqual({ a: 1, b: 'two' });
      expect(result).not.toBe(obj); // should be a copy
    });

    it('returns primitives as-is', () => {
      expect(logger.serialiseArg('hello')).toBe('hello');
      expect(logger.serialiseArg(42)).toBe(42);
      expect(logger.serialiseArg(true)).toBe(true);
    });
  });

  describe('serialiseError', () => {
    it('serialises Error with name, message, and stack', () => {
      const err = new Error('something broke');
      err.name = 'TypeError';
      const result = logger.serialiseError(err);
      expect(result).toEqual({
        name: 'TypeError',
        message: 'something broke',
        stack: expect.any(String),
      });
    });

    it('serialises Error with cause', () => {
      const cause = new Error('root cause');
      const err = new Error('wrapped error', { cause });
      const result = logger.serialiseError(err);
      expect(result.message).toBe('wrapped error');
      expect(result.cause).toBeDefined();
      expect(result.cause.name).toBe('Error');
      expect(result.cause.message).toBe('root cause');
    });

    it('returns non-object values as-is', () => {
      expect(logger.serialiseError(null)).toBeNull();
      expect(logger.serialiseError('string')).toBe('string');
      expect(logger.serialiseError(42)).toBe(42);
    });

    it('handles Error-like objects without cause gracefully', () => {
      const err = new Error('simple');
      const result = logger.serialiseError(err);
      expect(result.cause).toBeUndefined();
    });
  });

  describe('isErrorLike', () => {
    it('returns true for Error instances', () => {
      // isErrorLike is not directly exported, but we can test it through serialiseArg
      const result = logger.serialiseArg(new Error('test'));
      expect(result.name).toBe('Error');
      expect(result.message).toBe('test');
    });

    it('returns true for objects with name, message, and stack', () => {
      const errLike = { name: 'CustomError', message: 'custom', stack: 'at line 1' };
      const result = logger.serialiseArg(errLike);
      // Should be serialised as an error-like object
      expect(result.name).toBe('CustomError');
      expect(result.message).toBe('custom');
    });
  });

  describe('shallowSerialiseObject', () => {
    it('returns a copy of the input', () => {
      const input = { a: 1 };
      const result = logger.shallowSerialiseObject(input, () => false);
      expect(result).toEqual(input);
      expect(result).not.toBe(input);
    });

    it('serialises error-like properties', () => {
      const err = new Error('nested error');
      const input = { key: 'value', error: err };
      const result = logger.shallowSerialiseObject(input, (v) => v instanceof Error);
      expect(result.key).toBe('value');
      expect(result.error.name).toBe('Error');
      expect(result.error.message).toBe('nested error');
    });

    it('handles arrays', () => {
      const err = new Error('error in array');
      const input = [1, err, 3];
      const result = logger.shallowSerialiseObject(input, (v) => v instanceof Error);
      expect(result[0]).toBe(1);
      expect(result[1].name).toBe('Error');
      expect(result[1].message).toBe('error in array');
      expect(result[2]).toBe(3);
    });

    it('handles empty objects', () => {
      const result = logger.shallowSerialiseObject({}, () => false);
      expect(result).toEqual({});
    });
  });

  describe('constructor singleton guard', () => {
    it('does not replace _instance when one already exists', () => {
      // _instance is already set from the beforeEach logger setup
      const existing = ABLogger._instance;
      // Call constructor directly (not through getInstance)
      const orphan = new ABLogger(false);
      // _instance should still point to the original
      expect(ABLogger._instance).toBe(existing);
      // The orphan instance is not the singleton
      expect(orphan).not.toBe(existing);
      expect(orphan).toBeInstanceOf(ABLogger);
    });
  });
});
