/**
 * Tests for the ProgressTrackerStore namespace: keyed key derivation, record
 * writes with an embedded requestId, one-store reads and list filtering, plus
 * the shared `parse` helper. The real store module runs against the in-memory
 * PropertiesService mock; ABLogger warnings are asserted through a spy seam.
 *
 * Records are keyed as `ProgressTracker<requestId>`; the bare `ProgressTracker`
 * key only ever appears as pre-upgrade dead data that `readAll` still returns
 * (prefix filtering only).
 */
const ProgressTrackerStore = require('#backend/Utils/01_ProgressTrackerStore.js');
const { withGlobalMocks } = require('../helpers/globalMockManager.js');

/** User Property key of the unkeyed pre-upgrade progress record. */
const BARE_LEGACY_KEY = 'ProgressTracker';

describe('ProgressTrackerStore.parse', () => {
  let mockABLogger, restoreGlobals;

  beforeEach(() => {
    mockABLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      debugUi: vi.fn(),
    };
    const mockContext = withGlobalMocks({ ABLogger: () => ({ getInstance: () => mockABLogger }) });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('returns the stored record for valid JSON', () => {
    const record = {
      requestId: 'req-parse',
      step: 2,
      message: 'Marking task 2 of 3',
      completed: false,
      error: null,
      timestamp: '2026-01-01T09:00:00.000Z',
    };
    const key = ProgressTrackerStore.keyFor(record.requestId);

    expect(ProgressTrackerStore.parse(JSON.stringify(record), key)).toEqual(record);
    expect(mockABLogger.warn).not.toHaveBeenCalled();
  });

  it('returns null and warns once for a malformed value without throwing', () => {
    const key = ProgressTrackerStore.keyFor('req-malformed');

    let parsed;
    expect(() => {
      parsed = ProgressTrackerStore.parse('{not-valid-json', key);
    }).not.toThrow();

    expect(parsed).toBeNull();
    expect(mockABLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockABLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('malformed progress record'),
      expect.objectContaining({ key })
    );
  });

  it('returns null without a warning when no value is stored', () => {
    const key = ProgressTrackerStore.keyFor('req-missing');

    expect(ProgressTrackerStore.parse(null, key)).toBeNull();
    expect(mockABLogger.warn).not.toHaveBeenCalled();
  });

  it('warns and returns null for a stored JSON null while leaving the stored value intact', () => {
    const key = ProgressTrackerStore.keyFor('req-null-literal');
    globalThis.PropertiesService.getUserProperties().setProperty(key, 'null');
    const rawBefore = globalThis.PropertiesService.getUserProperties().getProperty(key);

    let parsed;
    expect(() => {
      parsed = ProgressTrackerStore.parse(rawBefore, key);
    }).not.toThrow();

    expect(parsed).toBeNull();
    expect(mockABLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockABLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('malformed progress record'),
      expect.objectContaining({ key })
    );
    expect(globalThis.PropertiesService.getUserProperties().getProperty(key)).toBe(rawBefore);
  });
});

describe('ProgressTrackerStore key derivation and writes', () => {
  beforeEach(() => {
    globalThis.PropertiesService._resetUserProperties();
  });

  it('exposes KEY_PREFIX and derives keys by appending the request ID', () => {
    expect(ProgressTrackerStore.KEY_PREFIX).toBe('ProgressTracker');
    expect(ProgressTrackerStore.keyFor('req-abc')).toBe(
      `${ProgressTrackerStore.KEY_PREFIX}req-abc`
    );
  });

  it('does not expose the legacy unkeyed key constant', () => {
    expect(ProgressTrackerStore).not.toHaveProperty('LEGACY_KEY');
  });

  it('throws on an absent or empty request ID', () => {
    expect(() => ProgressTrackerStore.keyFor(undefined)).toThrow();
    expect(() => ProgressTrackerStore.keyFor(null)).toThrow();
    expect(() => ProgressTrackerStore.keyFor('')).toThrow();
  });

  it('always embeds the request ID in the stored record', () => {
    const properties = globalThis.PropertiesService.getUserProperties();

    ProgressTrackerStore.write(properties, 'req-embed', {
      step: 1,
      message: 'Marking',
      completed: false,
      error: null,
      timestamp: '2026-01-01T09:00:00.000Z',
    });

    const stored = JSON.parse(properties.getProperty(ProgressTrackerStore.keyFor('req-embed')));
    expect(stored.requestId).toBe('req-embed');
  });

  it('throws when writing without a request ID', () => {
    const properties = globalThis.PropertiesService.getUserProperties();
    const record = { step: 1, message: 'Marking', completed: false, error: null };

    expect(() => ProgressTrackerStore.write(properties, undefined, record)).toThrow();
    expect(() => ProgressTrackerStore.write(properties, '', record)).toThrow();
    expect(properties.getProperty(BARE_LEGACY_KEY)).toBeNull();
  });

  it('returns every prefixed key from readAll including the bare pre-upgrade key', () => {
    const properties = globalThis.PropertiesService.getUserProperties();
    properties.setProperty(
      BARE_LEGACY_KEY,
      JSON.stringify({
        step: 0,
        message: 'pre-upgrade record',
        completed: false,
        error: null,
        timestamp: '2026-01-01T09:00:00.000Z',
      })
    );
    ProgressTrackerStore.write(properties, 'req-a', {
      step: 1,
      message: 'Keyed run',
      completed: false,
      error: null,
      timestamp: '2026-01-01T09:01:00.000Z',
    });

    const keys = ProgressTrackerStore.readAll(properties).map((entry) => entry.key);

    expect(keys).toContain(BARE_LEGACY_KEY);
    expect(keys).toContain(ProgressTrackerStore.keyFor('req-a'));
  });
});
