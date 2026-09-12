const { withGlobalMocks } = require('./globalMockManager.js');

/**
 * Builds the Google Apps Script service mocks used when exercising the
 * DriveManager facade in Node/Vitest.
 *
 * The returned `install` function replaces the GAS globals via the shared
 * `globalMockManager` helper so the originals are always restored, and returns
 * the restore callback for use in `afterEach`.
 *
 * @param {Object} vi - Vitest's `vi` helper used to create spies.
 * @returns {{
 *   mockDrive: Object,
 *   mockDriveApp: Object,
 *   mockUtilities: Object,
 *   mockLogger: Object,
 *   mockProgressTracker: Object,
 *   install: Function
 * }} The mocks and the install function.
 */
function createDriveManagerMocks(vi) {
  const mockDrive = {
    Files: {
      get: vi.fn(() => ({
        id: 'folder-id',
        mimeType: 'application/vnd.google-apps.folder',
      })),
      update: vi.fn(),
      list: vi.fn(),
      copy: vi.fn(),
      create: vi.fn(),
    },
  };

  const mockDriveApp = {
    getFileById: vi.fn(),
    getFolderById: vi.fn(),
    getRootFolder: vi.fn(),
  };

  const mockUtilities = {
    sleep: vi.fn(),
  };

  const mockLogger = {
    debug: vi.fn(),
    debugUi: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const mockProgressTracker = {
    logError: vi.fn(),
  };

  const install = () =>
    withGlobalMocks({
      Drive: () => mockDrive,
      DriveApp: () => mockDriveApp,
      Utilities: () => mockUtilities,
      ABLogger: () => ({ getInstance: () => mockLogger }),
      ProgressTracker: () => ({ getInstance: () => mockProgressTracker }),
    }).restore;

  return { mockDrive, mockDriveApp, mockUtilities, mockLogger, mockProgressTracker, install };
}

/**
 * Creates a DriveApp-style folder iterator over the provided items.
 *
 * @param {Array} items - Items the iterator should yield.
 * @returns {{hasNext: Function, next: Function}} Iterator matching the DriveApp API.
 */
function createIterator(items) {
  let index = 0;
  return {
    hasNext: () => index < items.length,
    next: () => items[index++],
  };
}

module.exports = { createDriveManagerMocks, createIterator };
