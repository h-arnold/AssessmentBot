import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Load the module under test
const { logError } = require('../../src/backend/Utils/logError.js');

describe('logError utility', () => {
  const originalConsole = { ...console };
  const originalDebugErrors = globalThis.DEBUG_ERRORS;

  beforeEach(() => {
    // Replace console.error with a spy
    console.error = vi.fn();
    // Reset DEBUG_ERRORS flag
    globalThis.DEBUG_ERRORS = undefined;
  });

  afterEach(() => {
    // Restore console.error
    Object.assign(console, originalConsole);
    // Restore DEBUG_ERRORS flag
    globalThis.DEBUG_ERRORS = originalDebugErrors;
    vi.resetAllMocks();
  });

  describe('basic error logging', () => {
    it('logs string error message with context', () => {
      const context = 'TestContext';
      const errorMessage = 'Something went wrong';

      logError(context, errorMessage);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] ${errorMessage}`);
    });

    it('logs Error object message with context', () => {
      const context = 'TestContext';
      const error = new Error('Test error');

      logError(context, error);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] Test error`);
    });

    it('logs object with toString method', () => {
      const context = 'TestContext';
      const errorObj = {
        toString: () => 'Custom error string',
      };

      logError(context, errorObj);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] Custom error string`);
    });

    it('logs null error as string', () => {
      const context = 'TestContext';

      logError(context, null);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] null`);
    });

    it('logs undefined error as string', () => {
      const context = 'TestContext';

      logError(context, undefined);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] undefined`);
    });

    it('logs number error as string', () => {
      const context = 'TestContext';
      const errorCode = 404;

      logError(context, errorCode);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] 404`);
    });

    it('logs boolean error as string', () => {
      const context = 'TestContext';

      logError(context, false);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] false`);
    });
  });

  describe('error with stack trace', () => {
    it('logs error with stack trace when DEBUG_ERRORS is truthy and error has stack', () => {
      const context = 'TestContext';
      const error = new Error('Test error with stack');
      error.stack = 'Error: Test error with stack\n    at test (test.js:1:1)';

      globalThis.DEBUG_ERRORS = true;

      logError(context, error);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        `[ERROR][${context}] Test error with stack\n${error.stack}`
      );
    });

    it('logs without stack trace when DEBUG_ERRORS is falsy', () => {
      const context = 'TestContext';
      const error = new Error('Test error with stack');
      error.stack = 'Error: Test error with stack\n    at test (test.js:1:1)';

      globalThis.DEBUG_ERRORS = false;

      logError(context, error);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] Test error with stack`);
    });

    it('logs without stack trace when DEBUG_ERRORS is undefined', () => {
      const context = 'TestContext';
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test (test.js:1:1)';

      // DEBUG_ERRORS is undefined (default)
      globalThis.DEBUG_ERRORS = undefined;

      logError(context, error);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] Test error`);
    });

    it('logs without stack trace when error has no stack property', () => {
      const context = 'TestContext';
      const error = { message: 'Error without stack' };

      globalThis.DEBUG_ERRORS = true;

      logError(context, error);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] Error without stack`);
    });

    it('logs with stack trace when DEBUG_ERRORS is truthy and error.stack is empty string', () => {
      const context = 'TestContext';
      const error = new Error('Test error');
      error.stack = '';

      globalThis.DEBUG_ERRORS = true;

      logError(context, error);

      // Empty string is falsy, so it should not include the newline + empty string
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] Test error`);
    });
  });

  describe('message extraction priority', () => {
    it('prefers error.message over toString', () => {
      const context = 'TestContext';
      const error = {
        message: 'Message property',
        toString: () => 'toString result',
      };

      logError(context, error);

      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] Message property`);
    });

    it('falls back to toString when message is missing', () => {
      const context = 'TestContext';
      const error = {
        toString: () => 'toString result',
      };

      logError(context, error);

      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] toString result`);
    });

    it('falls back to String() when neither message nor toString is available', () => {
      const context = 'TestContext';
      const error = { value: 123 };

      logError(context, error);

      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] [object Object]`);
    });

    it('handles error with null message', () => {
      const context = 'TestContext';
      const error = {
        message: null,
        toString: () => 'toString result',
      };

      logError(context, error);

      // message is null which is falsy, so it falls back to toString
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] toString result`);
    });

    it('handles error with undefined message', () => {
      const context = 'TestContext';
      const error = {
        message: undefined,
        toString: () => 'toString result',
      };

      logError(context, error);

      // message is undefined which is falsy, so it falls back to toString
      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] toString result`);
    });
  });

  describe('edge cases', () => {
    it('handles empty context string', () => {
      const error = new Error('Test error');

      logError('', error);

      expect(console.error).toHaveBeenCalledWith('[ERROR][] Test error');
    });

    it('handles empty error message', () => {
      const error = { message: '' };

      logError('Context', error);

      // Empty string is falsy, so it falls back to toString() which is [object Object]
      expect(console.error).toHaveBeenCalledWith('[ERROR][Context] [object Object]');
    });

    it('handles error with empty string message and no toString', () => {
      const error = { message: '' };

      logError('Context', error);

      // Empty string is falsy, so it falls back to toString() which is [object Object]
      expect(console.error).toHaveBeenCalledWith('[ERROR][Context] [object Object]');
    });

    it('handles object without message or toString properties', () => {
      const context = 'TestContext';
      const error = { someProperty: 'value' };

      logError(context, error);

      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] [object Object]`);
    });

    it('handles symbol error', () => {
      const context = 'TestContext';
      const error = Symbol('test symbol');

      logError(context, error);

      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] Symbol(test symbol)`);
    });

    it('handles array error', () => {
      const context = 'TestContext';
      const error = [1, 2, 3];

      logError(context, error);

      expect(console.error).toHaveBeenCalledWith(`[ERROR][${context}] 1,2,3`);
    });
  });

  describe('return value', () => {
    it('returns undefined (void function)', () => {
      const result = logError('Context', new Error('Test'));

      expect(result).toBeUndefined();
    });
  });
});
