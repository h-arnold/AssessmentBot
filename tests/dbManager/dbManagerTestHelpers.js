/**
 * Shared setup for the DbManager suites. Owns the mock collaborators, the
 * module cache reset and the per-test global and singleton lifecycle so each
 * focused suite reuses the same setup path.
 */

import { beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Mock JsonDbApp library
export const mockJsonDbApp = {
  loadDatabase: vi.fn(),
  createAndInitialiseDatabase: vi.fn(),
};

// Mock ConfigurationManager
export const mockConfigurationManager = {
  getJsonDbRootFolderId: vi.fn(),
  getJsonDbMasterIndexKey: vi.fn(),
  getJsonDbLockTimeoutMs: vi.fn(),
  getJsonDbLogLevel: vi.fn(),
  getJsonDbBackupOnInitialise: vi.fn(),
};

// Mock ProgressTracker
export const mockProgressTracker = {
  logAndThrowError: vi.fn(),
  logError: vi.fn(),
};

export function createDbManagerTestContext() {
  // Clear module cache
  delete require.cache[require.resolve('../../src/backend/DbManager/DbManager.js')];
  delete require.cache[require.resolve('../../src/backend/00_BaseSingleton.js')];

  // Load BaseSingleton first (dependency)
  require('#backend/00_BaseSingleton.js');
  // Load DbManager
  const DbManager = require('#backend/DbManager/DbManager.js');

  return { DbManager };
}

/**
 * Registers the per-test global mock and singleton lifecycle for a suite. The
 * setter receives the freshly loaded DbManager so callers keep a local binding.
 *
 * @param {Function} setDbManager Callback that receives the DbManager class.
 * @returns {void}
 */
export function useDbManagerTestContext(setDbManager) {
  // Global mock context - installed in beforeEach and torn down in afterEach
  let restoreDbManagerGlobals;
  let DbManager;

  beforeEach(() => {
    // Setup global mocks - saves originals and installs mocks
    const mockContext = withGlobalMocks({
      JsonDbApp: () => mockJsonDbApp,
      ConfigurationManager: () => ({ getInstance: () => mockConfigurationManager }),
      ProgressTracker: () => ({ getInstance: () => mockProgressTracker }),
    });
    restoreDbManagerGlobals = mockContext.restore;

    // Reset all mocks
    vi.resetAllMocks();

    // Setup default mock responses
    mockJsonDbApp.loadDatabase.mockReturnValue({
      listCollections: () => ['collection1', 'collection2'],
      getCollection: (name) => ({
        name,
        find: () => [],
        insertOne: vi.fn(),
        updateOne: vi.fn(),
        save: vi.fn(),
      }),
    });

    mockJsonDbApp.createAndInitialiseDatabase.mockReturnValue({
      listCollections: () => ['collection1', 'collection2'],
      getCollection: (name) => ({
        name,
        find: () => [],
        insertOne: vi.fn(),
        updateOne: vi.fn(),
        save: vi.fn(),
      }),
    });

    mockConfigurationManager.getJsonDbRootFolderId.mockReturnValue('root-folder-id');
    mockConfigurationManager.getJsonDbMasterIndexKey.mockReturnValue('master-index-key');
    mockConfigurationManager.getJsonDbLockTimeoutMs.mockReturnValue(5000);
    mockConfigurationManager.getJsonDbLogLevel.mockReturnValue('INFO');
    mockConfigurationManager.getJsonDbBackupOnInitialise.mockReturnValue(true);

    mockProgressTracker.logAndThrowError.mockImplementation((msg, err) => {
      throw new Error(msg);
    });

    // Create fresh context
    const context = createDbManagerTestContext();
    DbManager = context.DbManager;
    setDbManager(DbManager);

    // Reset singleton state
    DbManager.resetForTests?.();
    BaseSingleton._instance = null;
    DbManager._instance = null;
  });

  afterEach(() => {
    restoreDbManagerGlobals();
    vi.restoreAllMocks();
    // Reset singleton state
    BaseSingleton._instance = null;
    DbManager._instance = null;
  });
}
