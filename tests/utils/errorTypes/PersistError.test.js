import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const PersistErrorPath = '../../../src/backend/Utils/ErrorTypes/PersistError.js';

describe('PersistError', () => {
  let PersistError;

  beforeEach(() => {
    // Clear module cache and reload
    delete require.cache[require.resolve(PersistErrorPath)];
    PersistError = require(PersistErrorPath);
  });

  afterEach(() => {
    delete require.cache[require.resolve(PersistErrorPath)];
  });

  describe('constructor', () => {
    it('should create PersistError with message only', () => {
      const err = new PersistError('Persistence failed');

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(PersistError);
      expect(err.name).toBe('PersistError');
      expect(err.message).toBe('Persistence failed');
      expect(err.cause).toBeNull();
      expect(err.key).toBeNull();
    });

    it('should create PersistError with message and cause', () => {
      const originalError = new Error('Database connection failed');
      const err = new PersistError('Persistence failed', { cause: originalError });

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(PersistError);
      expect(err.name).toBe('PersistError');
      expect(err.message).toBe('Persistence failed');
      expect(err.cause).toBe(originalError);
      expect(err.key).toBeNull();
    });

    it('should create PersistError with message and key', () => {
      const err = new PersistError('Persistence failed', { key: 'config.apiKey' });

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(PersistError);
      expect(err.name).toBe('PersistError');
      expect(err.message).toBe('Persistence failed');
      expect(err.cause).toBeNull();
      expect(err.key).toBe('config.apiKey');
    });

    it('should create PersistError with message, cause, and key', () => {
      const originalError = new Error('Write quota exceeded');
      const err = new PersistError('Persistence failed', {
        cause: originalError,
        key: 'user.settings',
      });

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(PersistError);
      expect(err.name).toBe('PersistError');
      expect(err.message).toBe('Persistence failed');
      expect(err.cause).toBe(originalError);
      expect(err.key).toBe('user.settings');
    });

    it('should create PersistError with empty message', () => {
      const err = new PersistError('');

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(PersistError);
      expect(err.name).toBe('PersistError');
      expect(err.message).toBe('');
      expect(err.cause).toBeNull();
      expect(err.key).toBeNull();
    });

    it('should create PersistError with empty options object', () => {
      const err = new PersistError('Persistence failed', {});

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(PersistError);
      expect(err.name).toBe('PersistError');
      expect(err.message).toBe('Persistence failed');
      expect(err.cause).toBeNull();
      expect(err.key).toBeNull();
    });

    it('should create PersistError with null cause (default)', () => {
      const err = new PersistError('Persistence failed', { cause: null, key: null });

      expect(err.cause).toBeNull();
      expect(err.key).toBeNull();
    });

    it('should create PersistError with undefined options', () => {
      const err = new PersistError('Persistence failed', undefined);

      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('PersistError');
      expect(err.message).toBe('Persistence failed');
      expect(err.cause).toBeNull();
      expect(err.key).toBeNull();
    });
  });

  describe('prototype chain', () => {
    it('should be an instance of Error', () => {
      const err = new PersistError('Test error');
      expect(err instanceof Error).toBe(true);
    });

    it('should be an instance of PersistError', () => {
      const err = new PersistError('Test error');
      expect(err instanceof PersistError).toBe(true);
    });

    it('should have correct name property', () => {
      const err = new PersistError('Test error');
      expect(err.name).toBe('PersistError');
    });
  });

  describe('toJSON', () => {
    it('should serialize PersistError with all fields', () => {
      const originalError = new Error('Original cause');
      originalError.name = 'TypeError';
      originalError.message = 'Original cause';

      const err = new PersistError('Persistence failed', {
        cause: originalError,
        key: 'config.key',
      });

      const json = err.toJSON();

      expect(json.name).toBe('PersistError');
      expect(json.message).toBe('Persistence failed');
      expect(json.key).toBe('config.key');
      expect(json.cause).toEqual({
        name: 'TypeError',
        message: 'Original cause',
      });
      expect(json.stack).toBe(err.stack);
    });

    it('should serialize PersistError without cause', () => {
      const err = new PersistError('Persistence failed', { key: 'config.key' });
      const json = err.toJSON();

      expect(json.name).toBe('PersistError');
      expect(json.message).toBe('Persistence failed');
      expect(json.key).toBe('config.key');
      expect(json.cause).toBeNull();
      expect(json.stack).toBe(err.stack);
    });

    it('should serialize PersistError without key', () => {
      const originalError = new Error('Cause');
      const err = new PersistError('Persistence failed', { cause: originalError });
      const json = err.toJSON();

      expect(json.name).toBe('PersistError');
      expect(json.message).toBe('Persistence failed');
      expect(json.key).toBeNull();
      expect(json.cause).toEqual({
        name: 'Error',
        message: 'Cause',
      });
      expect(json.stack).toBe(err.stack);
    });

    it('should serialize PersistError with no optional fields', () => {
      const err = new PersistError('Persistence failed');
      const json = err.toJSON();

      expect(json.name).toBe('PersistError');
      expect(json.message).toBe('Persistence failed');
      expect(json.key).toBeNull();
      expect(json.cause).toBeNull();
      expect(json.stack).toBe(err.stack);
    });

    it('should serialize PersistError with cause that has no name property', () => {
      const originalError = new Error('Cause');
      // Create an object that looks like an error but without name
      const causeObj = { message: 'Cause' };

      const err = new PersistError('Persistence failed', { cause: causeObj });
      const json = err.toJSON();

      expect(json.cause).toEqual({
        name: undefined,
        message: 'Cause',
      });
    });

    it('should serialize PersistError with cause that has no message property', () => {
      const originalError = new Error('Cause');
      // Create an object that looks like an error but without message
      const causeObj = { name: 'Error' };

      const err = new PersistError('Persistence failed', { cause: causeObj });
      const json = err.toJSON();

      expect(json.cause).toEqual({
        name: 'Error',
        message: undefined,
      });
    });
  });

  describe('round-trip serialization', () => {
    it('should round-trip basic PersistError', () => {
      const original = new PersistError('Persistence failed', {
        key: 'config.apiKey',
      });

      const json = original.toJSON();
      // Note: We cannot directly reconstruct from toJSON since it includes stack trace
      // But we can verify the serialized data is correct
      expect(json.name).toBe('PersistError');
      expect(json.message).toBe('Persistence failed');
      expect(json.key).toBe('config.apiKey');
      expect(json.cause).toBeNull();
    });

    it('should round-trip PersistError with cause', () => {
      const originalCause = new Error('Database error');
      originalCause.name = 'DatabaseError';

      const original = new PersistError('Persistence failed', {
        cause: originalCause,
        key: 'user.data',
      });

      const json = original.toJSON();

      expect(json.name).toBe('PersistError');
      expect(json.message).toBe('Persistence failed');
      expect(json.key).toBe('user.data');
      expect(json.cause).toEqual({
        name: 'DatabaseError',
        message: 'Database error',
      });
    });
  });

  describe('stack trace', () => {
    it('should have stack trace in Error environment', () => {
      const err = new PersistError('Persistence failed');
      expect(err.stack).toBeDefined();
      expect(typeof err.stack).toBe('string');
      expect(err.stack.length).toBeGreaterThan(0);
    });

    it('should include stack trace in toJSON', () => {
      const err = new PersistError('Persistence failed');
      const json = err.toJSON();
      expect(json.stack).toBeDefined();
      expect(typeof json.stack).toBe('string');
    });

    it('should have PersistError in stack trace', () => {
      const err = new PersistError('Persistence failed');
      expect(err.stack).toContain('PersistError');
    });

    it('should handle missing Error.captureStackTrace gracefully', () => {
      // Save the original function
      const originalCaptureStackTrace = Error.captureStackTrace;

      try {
        // Temporarily remove captureStackTrace to test the fallback path
        delete Error.captureStackTrace;

        // Clear the module cache to reload with the modified Error
        delete require.cache[require.resolve(PersistErrorPath)];
        PersistError = require(PersistErrorPath);

        // Create an error - should not throw even without captureStackTrace
        const err = new PersistError('Persistence failed without captureStackTrace');

        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(PersistError);
        expect(err.name).toBe('PersistError');
        expect(err.message).toBe('Persistence failed without captureStackTrace');
        // Stack trace should still exist (from Error constructor)
        expect(err.stack).toBeDefined();
      } finally {
        // Restore the original function
        Error.captureStackTrace = originalCaptureStackTrace;
      }
    });
  });

  describe('edge cases', () => {
    it('should handle cause that is not an Error object', () => {
      const err = new PersistError('Persistence failed', {
        cause: { name: 'CustomError', message: 'Custom message' },
      });

      expect(err.cause).toEqual({ name: 'CustomError', message: 'Custom message' });
    });

    it('should handle cause that is a string', () => {
      const err = new PersistError('Persistence failed', {
        cause: 'String cause',
      });

      expect(err.cause).toBe('String cause');
    });

    it('should handle cause that is null', () => {
      const err = new PersistError('Persistence failed', {
        cause: null,
      });

      expect(err.cause).toBeNull();
    });

    it('should handle key that is a number', () => {
      const err = new PersistError('Persistence failed', {
        key: 123,
      });

      expect(err.key).toBe(123);
    });

    it('should handle key that is an object', () => {
      const keyObj = { id: 'key1' };
      const err = new PersistError('Persistence failed', {
        key: keyObj,
      });

      expect(err.key).toBe(keyObj);
    });

    it('should handle very long message', () => {
      const longMessage = 'Error: '.repeat(1000);
      const err = new PersistError(longMessage);

      expect(err.message).toBe(longMessage);
      expect(err.message.length).toBe(7000);
    });

    it('should handle special characters in message', () => {
      const specialMessage = 'Error with \n newline \t tab and "quotes"';
      const err = new PersistError(specialMessage);

      expect(err.message).toBe(specialMessage);
    });

    it('should handle unicode in message', () => {
      const unicodeMessage = 'Error: Failed to persist data 💾';
      const err = new PersistError(unicodeMessage);

      expect(err.message).toBe(unicodeMessage);
    });

    it('should maintain separate instances', () => {
      const err1 = new PersistError('Error 1');
      const err2 = new PersistError('Error 2');

      expect(err1).not.toBe(err2);
      expect(err1.message).toBe('Error 1');
      expect(err2.message).toBe('Error 2');
    });
  });

  describe('inheritance and instanceof', () => {
    it('should pass instanceof check for Error', () => {
      const err = new PersistError('Test');
      expect(err instanceof Error).toBe(true);
    });

    it('should pass instanceof check for PersistError', () => {
      const err = new PersistError('Test');
      expect(err instanceof PersistError).toBe(true);
    });

    it('should not be instance of other error types', () => {
      const err = new PersistError('Test');
      expect(err instanceof TypeError).toBe(false);
      expect(err instanceof RangeError).toBe(false);
      expect(err instanceof SyntaxError).toBe(false);
    });

    it('should be catchable as Error', () => {
      let caughtError = null;

      try {
        throw new PersistError('Test error');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(PersistError);
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toBe('Test error');
    });

    it('should be catchable as PersistError', () => {
      let caughtError = null;

      try {
        throw new PersistError('Test error');
      } catch (err) {
        if (err instanceof PersistError) {
          caughtError = err;
        }
      }

      expect(caughtError).toBeInstanceOf(PersistError);
      expect(caughtError.message).toBe('Test error');
    });
  });
});
