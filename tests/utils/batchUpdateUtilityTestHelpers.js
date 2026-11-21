import { beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Shared setup for the BatchUpdateUtility companion suites. Each suite calls
// useBatchUpdateUtilityMocks() inside its own describe so the hooks register
// against that file. The mocks are shared const objects whose methods are reset
// in beforeEach, which keeps the moved test bodies unchanged.

export const mockProgressTracker = {
  logError: vi.fn(),
  logAndThrowError: vi.fn((message, context) => {
    const error = new Error(message);
    throw error;
  }),
};

export const mockSheets = {
  Spreadsheets: {
    batchUpdate: vi.fn(),
  },
};

let restoreBatchUtilityGlobals;
const originalConsole = { ...console };

/**
 * Registers the per-test console spy, Sheets and ProgressTracker mocks, and the
 * global mock lifecycle for a BatchUpdateUtility suite.
 *
 * @returns {void}
 */
export function useBatchUpdateUtilityMocks() {
  beforeEach(() => {
    // Replace console.log with a spy
    console.log = vi.fn();

    // Reset mock ProgressTracker methods
    mockProgressTracker.logError = vi.fn();
    mockProgressTracker.logAndThrowError = vi.fn((message, context) => {
      const error = new Error(message);
      throw error;
    });

    // Reset mock Sheets service methods
    mockSheets.Spreadsheets.batchUpdate = vi.fn();

    // Setup global mocks - saves originals and installs mocks
    const mockContext = withGlobalMocks({
      ProgressTracker: () => ({ getInstance: () => mockProgressTracker }),
      Sheets: () => mockSheets,
    });
    restoreBatchUtilityGlobals = mockContext.restore;
  });

  afterEach(() => {
    // Restore console
    Object.assign(console, originalConsole);

    // Restore globals
    restoreBatchUtilityGlobals();

    vi.resetAllMocks();
  });
}
