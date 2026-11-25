import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { setupApiHandlerTestContext, teardownApiHandlerTestContext } = require('./shared.js');

const PROGRESS_TRACKER_TRANSPORT_PATH = '../../../src/backend/z_Api/progressTracker.js';

/**
 * Loads the getProgress transport helper from its production module.
 *
 * The module is added in the implementation phase, so a missing file is surfaced
 * as a failed assertion here rather than as a collection error. Once the module
 * exists, the same call returns the real trailing-underscore handler.
 *
 * @returns {Function} The getProgress_ handler.
 */
function loadGetProgressHandler() {
  let resolvedPath;
  try {
    resolvedPath = require.resolve(PROGRESS_TRACKER_TRANSPORT_PATH);
  } catch (error) {
    if (error?.code === 'MODULE_NOT_FOUND') {
      expect(
        null,
        'getProgress transport module must exist at src/backend/z_Api/progressTracker.js'
      ).not.toBeNull();
    }
    throw error;
  }

  delete require.cache[resolvedPath];
  const transport = require(resolvedPath);
  expect(transport.getProgress_, 'getProgress_ must be exported for Node tests').toBeTypeOf(
    'function'
  );
  return transport.getProgress_;
}

/**
 * Writes one progress record into the in-memory User Properties mock.
 * @param {string|null} requestId - Correlation ID, or null for the legacy record.
 * @param {Object} overrides - Fields to set on the stored record.
 * @returns {{key: string, record: Object}} The stored key and parsed record.
 */
function writeProgressRecord(requestId, overrides = {}) {
  const key = globalThis.ProgressTrackerStore.keyFor(requestId);
  const record = {
    ...(requestId ? { requestId } : {}),
    step: 0,
    message: 'Assessment in progress',
    completed: false,
    error: null,
    timestamp: '2026-01-01T09:00:00.000Z',
    ...overrides,
  };
  globalThis.PropertiesService.getUserProperties().setProperty(key, JSON.stringify(record));
  return { key, record };
}

describe('Api/getProgress transport helper', () => {
  let context;

  beforeEach(() => {
    context = setupApiHandlerTestContext(vi, { installLogger: 'mock' });
  });

  afterEach(() => {
    teardownApiHandlerTestContext(vi, context);
  });

  it('returns an empty tasks array when only the legacy unkeyed record exists', () => {
    writeProgressRecord(null, { message: 'Legacy run', completed: true });
    const getProgress = loadGetProgressHandler();

    expect(getProgress()).toEqual({ tasks: [] });
  });

  it('returns keyed records sorted by timestamp then requestId, excluding the legacy record', () => {
    const early = writeProgressRecord('req-early', { timestamp: '2026-01-01T09:00:00.000Z' });
    const laterZ = writeProgressRecord('req-z', { timestamp: '2026-01-01T10:00:00.000Z' });
    const laterA = writeProgressRecord('req-a', { timestamp: '2026-01-01T10:00:00.000Z' });
    writeProgressRecord(null, { timestamp: '2026-01-01T08:00:00.000Z' });
    const getProgress = loadGetProgressHandler();

    expect(getProgress()).toEqual({ tasks: [early.record, laterA.record, laterZ.record] });
  });

  it('logs a warning and skips a malformed keyed record while returning the valid records', () => {
    globalThis.PropertiesService.getUserProperties().setProperty(
      globalThis.ProgressTrackerStore.keyFor('req-malformed'),
      '{invalid-json'
    );
    const first = writeProgressRecord('req-first', { timestamp: '2026-01-01T09:00:00.000Z' });
    const second = writeProgressRecord('req-second', { timestamp: '2026-01-01T10:00:00.000Z' });
    const getProgress = loadGetProgressHandler();

    expect(getProgress()).toEqual({ tasks: [first.record, second.record] });
    expect(context.warnSpy).toHaveBeenCalled();
  });

  it('propagates a User Property read failure instead of swallowing it', () => {
    const getProgress = loadGetProgressHandler();
    const originalGetUserProperties = globalThis.PropertiesService.getUserProperties;

    try {
      globalThis.PropertiesService.getUserProperties = () => ({
        getProperties: () => {
          throw new Error('property store unavailable');
        },
      });

      expect(() => getProgress()).toThrow('property store unavailable');
    } finally {
      globalThis.PropertiesService.getUserProperties = originalGetUserProperties;
    }
  });
});
