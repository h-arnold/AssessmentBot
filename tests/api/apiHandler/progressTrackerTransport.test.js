import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { setupApiHandlerTestContext, teardownApiHandlerTestContext } = require('./shared.js');

/** User Property key of the unkeyed pre-upgrade progress record. */
const BARE_LEGACY_KEY = 'ProgressTracker';

/**
 * Loads the getProgress transport handler from its production module.
 *
 * The handler takes no parameters and defines the read side of progress
 * polling: it returns `{ tasks }` holding every record that passes the
 * field-level `requestId` check, sorted by timestamp then requestId. Records
 * without a `requestId` (including pre-upgrade bare-key records) and
 * malformed values are skipped with a logged warning, and property-store read
 * failures propagate to the apiHandler error boundary.
 *
 * @returns {Function} The getProgress_ handler.
 */
function loadGetProgressHandler() {
  const transport = require('#backend/z_Api/progressTracker.js');
  expect(transport.getProgress_, 'getProgress_ must be exported for Node tests').toBeTypeOf(
    'function'
  );
  return transport.getProgress_;
}

/**
 * Writes one keyed progress record into the in-memory User Properties mock.
 * @param {string} requestId - Non-empty correlation ID; keyed as `ProgressTracker<requestId>`.
 * @param {Object} overrides - Fields to set on the stored record.
 * @returns {{key: string, record: Object}} The stored key and parsed record.
 */
function writeProgressRecord(requestId, overrides = {}) {
  const key = globalThis.ProgressTrackerStore.keyFor(requestId);
  const record = {
    requestId,
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

/**
 * Writes a record in the pre-upgrade shape directly under the bare key, as a
 * deployment from before keyed records would have left behind. Bypasses key
 * derivation, which requires a request ID.
 *
 * @param {Object} overrides - Fields to set on the stored record.
 * @returns {{key: string, record: Object}} The stored key and parsed record.
 */
function writePreUpgradeRecord(overrides = {}) {
  const record = {
    step: 0,
    message: 'Assessment in progress',
    completed: false,
    error: null,
    timestamp: '2026-01-01T09:00:00.000Z',
    ...overrides,
  };
  globalThis.PropertiesService.getUserProperties().setProperty(
    BARE_LEGACY_KEY,
    JSON.stringify(record)
  );
  return { key: BARE_LEGACY_KEY, record };
}

describe('Api/getProgress transport helper', () => {
  let context;

  beforeEach(() => {
    context = setupApiHandlerTestContext(vi, { installLogger: 'mock' });
  });

  afterEach(() => {
    teardownApiHandlerTestContext(vi, context);
  });

  it('skips a pre-upgrade record with no requestId, warns, and returns an empty tasks array', () => {
    writePreUpgradeRecord({ message: 'Pre-upgrade run', completed: true });
    const getProgress = loadGetProgressHandler();

    expect(getProgress()).toEqual({ tasks: [] });
    expect(context.warnSpy).toHaveBeenCalled();
  });

  it('returns keyed records sorted by timestamp then requestId, skipping pre-upgrade records', () => {
    const early = writeProgressRecord('req-early', { timestamp: '2026-01-01T09:00:00.000Z' });
    const laterZ = writeProgressRecord('req-z', { timestamp: '2026-01-01T10:00:00.000Z' });
    const laterA = writeProgressRecord('req-a', { timestamp: '2026-01-01T10:00:00.000Z' });
    writePreUpgradeRecord({ timestamp: '2026-01-01T08:00:00.000Z' });
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
