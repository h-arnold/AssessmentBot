import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  logFrontendError,
  logFrontendEvent,
  resetFrontendLogSink,
  setFrontendLogSink,
  type FrontendLogEntry,
} from './frontendLogger';

describe('frontendLogger', () => {
  afterEach(() => {
    resetFrontendLogSink();
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
