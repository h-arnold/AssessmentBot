import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  logFrontendError,
  logFrontendEvent,
  clearFrontendLogBuffer,
  getFrontendLogBuffer,
  resetFrontendLogSink,
  setFrontendLogSink,
  type FrontendLogEntry,
} from './frontendLogger';

describe('frontendLogger', () => {
  afterEach(() => {
    resetFrontendLogSink();
    clearFrontendLogBuffer();
  });

  it('redacts sensitive metadata fields before writing to the sink', () => {
    const nestedSensitiveKey = 'secret';
    const sink = vi.fn<(entry: FrontendLogEntry) => void>();
    setFrontendLogSink(sink);

    logFrontendEvent('info', {
      context: 'test/logger',
      metadata: {
        token: 'abc',
        nested: {
          [nestedSensitiveKey]: '1234',
        },
      },
    });

    expect(sink).toHaveBeenCalledTimes(1);
    const [entry] = sink.mock.calls[0];
    expect(entry.metadata).toEqual({
      token: '[REDACTED]',
      nested: {
        [nestedSensitiveKey]: '[REDACTED]',
      },
    });
  });


  it('buffers log entries in the default global sink', () => {
    resetFrontendLogSink();

    logFrontendEvent(
      'warn',
      {
        context: 'test/default-sink',
        errorMessage: 'Buffered warning',
      },
      { includeStack: false }
    );

    const bufferedEntries = getFrontendLogBuffer();

    expect(bufferedEntries).toBeDefined();
    expect(bufferedEntries).toContainEqual(
      expect.objectContaining({
        context: 'test/default-sink',
        errorMessage: 'Buffered warning',
      })
    );
  });



  it('drops debug and info logs when running in production mode', () => {
    clearFrontendLogBuffer();
    resetFrontendLogSink();

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

    const bufferedEntries = getFrontendLogBuffer();
    expect(bufferedEntries).toHaveLength(1);
    expect(bufferedEntries[0]?.context).toBe('test/warn');
  });


  it('suppresses stack traces when includeStack is false', () => {
    const sink = vi.fn<(entry: FrontendLogEntry) => void>();
    setFrontendLogSink(sink);

    const error = new Error('Operation failed.');
    logFrontendError('test/logger', error, undefined, { includeStack: false });

    const [entry] = sink.mock.calls[0];
    expect(entry.stack).toBeUndefined();
    expect(entry.errorMessage).toBe('Operation failed.');
  });
});
