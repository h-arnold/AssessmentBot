import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  logFrontendError,
  logFrontendEvent,
} from './frontendLogger';

describe('frontendLogger', () => {
  let debugSpy: MockInstance;
  let infoSpy: MockInstance;
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts sensitive metadata fields before writing to the console endpoint', () => {
    const nestedSensitiveKey = 'secret';

    logFrontendEvent('info', {
      context: 'test/logger',
      metadata: {
        token: 'abc',
        nested: {
          [nestedSensitiveKey]: '1234',
        },
      },
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [, entry] = infoSpy.mock.calls[0];
    expect(entry.metadata).toEqual({
      token: '[REDACTED]',
      nested: {
        [nestedSensitiveKey]: '[REDACTED]',
      },
    });
  });

  it('writes warning events to the console warning endpoint', () => {
    logFrontendEvent(
      'warn',
      {
        context: 'test/default-sink',
        errorMessage: 'Buffered warning',
      },
      { includeStack: false }
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, entry] = warnSpy.mock.calls[0];
    expect(entry).toEqual(
      expect.objectContaining({
        context: 'test/default-sink',
        errorMessage: 'Buffered warning',
        level: 'warn',
      })
    );
  });

  it('drops debug and info logs when running in production mode', () => {
    logFrontendEvent(
      'debug',
      { context: 'test/debug', errorMessage: 'Hidden' },
      { includeStack: false, isDevelopmentRuntime: false }
    );
    logFrontendEvent(
      'info',
      { context: 'test/info', errorMessage: 'Hidden' },
      { includeStack: false, isDevelopmentRuntime: false }
    );
    logFrontendEvent(
      'warn',
      { context: 'test/warn', errorMessage: 'Shown' },
      { includeStack: false, isDevelopmentRuntime: false }
    );

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, entry] = warnSpy.mock.calls[0];
    expect(entry.context).toBe('test/warn');
  });

  it('suppresses stack traces when includeStack is false', () => {
    const error = new Error('Operation failed.');
    logFrontendError('test/logger', error, undefined, { includeStack: false });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [, entry] = errorSpy.mock.calls[0];
    expect(entry.stack).toBeUndefined();
    expect(entry.errorMessage).toBe('Operation failed.');
  });
});
