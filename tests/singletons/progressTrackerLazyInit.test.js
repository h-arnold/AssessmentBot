const ProgressTracker = require('../../src/AdminSheet/Utils/ProgressTracker.js');

// Mock PropertiesService
// Use global vi (Vitest) if available; otherwise create simple stub factory for Node fallback.
const _vi =
  typeof vi !== 'undefined'
    ? vi
    : {
        fn: (impl = () => {}) => {
          const f = (...args) => impl(...args);
          f.mock = { calls: [] };
          const original = f;
          return original;
        },
      };
const mockSetProperty = _vi.fn();
const mockGetProperty = _vi.fn();
const mockDeleteProperty = _vi.fn();

beforeEach(() => {
  ProgressTracker.resetForTests();
  global.PropertiesService = {
    getDocumentProperties: _vi.fn(() => ({
      setProperty: mockSetProperty,
      getProperty: mockGetProperty,
      deleteProperty: mockDeleteProperty,
    })),
  };
  // Minimal ConfigurationManager mock used by ProgressTracker.complete()
  global.ConfigurationManager = {
    getInstance: () => ({ getIsAdminSheet: () => false }),
  };
  global.PropertiesCloner = function () {
    return { serialiseProperties: () => {} };
  };
  mockSetProperty.mockReset();
  mockGetProperty.mockReset();
  mockDeleteProperty.mockReset();
});

describe('ProgressTracker lazy initialization', () => {
  test('does not touch PropertiesService until first method requiring it', () => {
    expect(global.PropertiesService.getDocumentProperties).toHaveBeenCalledTimes(0);
    const pt = ProgressTracker.getInstance();
    // Still should not have initialised
    expect(global.PropertiesService.getDocumentProperties).toHaveBeenCalledTimes(0);
    // Trigger init
    pt.startTracking();
    expect(global.PropertiesService.getDocumentProperties).toHaveBeenCalledTimes(1);
  });

  test('ensureInitialized called only once across multiple operations', () => {
    const pt = ProgressTracker.getInstance();
    pt.startTracking();
    pt.updateProgress('Step 1');
    pt.updateProgress('Step 2');
    pt.complete();
    expect(global.PropertiesService.getDocumentProperties).toHaveBeenCalledTimes(1);
  });
});
