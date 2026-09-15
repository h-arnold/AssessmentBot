import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Hermetic behaviour coverage for DbManager initialisation, collection access
// and bulk writes. The suite reuses the cached module (no cache clearing) and
// resets singleton state manually so V8 coverage accumulates across files.
const DbManager = require('../../src/backend/DbManager/DbManager.js');

describe('DbManager coverage behaviour', () => {
  let restoreGlobals;
  let mockJsonDbApp;
  let mockConfig;
  let mockTracker;

  beforeEach(() => {
    mockJsonDbApp = { loadDatabase: vi.fn(), createAndInitialiseDatabase: vi.fn() };
    mockConfig = {
      getJsonDbRootFolderId: vi.fn(() => 'root-folder'),
      getJsonDbMasterIndexKey: vi.fn(() => 'master-key'),
      getJsonDbLockTimeoutMs: vi.fn(() => 1000),
      getJsonDbLogLevel: vi.fn(() => 'info'),
      getJsonDbBackupOnInitialise: vi.fn(() => false),
    };
    mockTracker = {
      logAndThrowError: vi.fn((message) => {
        throw new Error(message);
      }),
    };
    const mockContext = withGlobalMocks({
      JsonDbApp: () => mockJsonDbApp,
      ConfigurationManager: () => ({ getInstance: () => mockConfig }),
      ProgressTracker: () => ({ getInstance: () => mockTracker }),
    });
    restoreGlobals = mockContext.restore;
    DbManager._instance = null;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
    DbManager._instance = null;
  });

  function createManager() {
    return new DbManager(true);
  }

  it('builds configuration with and without a root folder', () => {
    const manager = createManager();
    const withRoot = manager._getConfig();
    expect(withRoot.rootFolderId).toBe('root-folder');
    expect(withRoot.autoCreateCollections).toBe(true);

    mockConfig.getJsonDbRootFolderId.mockReturnValue(null);
    const withoutRoot = manager._getConfig();
    expect(withoutRoot).not.toHaveProperty('rootFolderId');
  });

  it('fails fast when the library is unavailable', () => {
    const manager = createManager();
    const mockContext = withGlobalMocks({ JsonDbApp: () => ({}) });
    expect(() => manager._assertLibraryAvailable()).toThrow('JsonDbApp library is not available.');
    mockContext.restore();
  });

  it('returns cached databases without re-consuming the library', () => {
    const manager = createManager();
    manager._db = { cached: true };
    expect(manager.getDb()).toEqual({ cached: true });
    expect(mockJsonDbApp.loadDatabase).not.toHaveBeenCalled();
  });

  it('loads existing databases and creates new ones without a master key', () => {
    const manager = createManager();
    mockJsonDbApp.loadDatabase.mockReturnValue({ loaded: true });
    expect(manager.getDb()).toEqual({ loaded: true });

    DbManager._instance = null;
    const fresh = createManager();
    mockConfig.getJsonDbMasterIndexKey.mockReturnValue(null);
    mockJsonDbApp.createAndInitialiseDatabase.mockReturnValue({ created: true });
    expect(fresh.getDb()).toEqual({ created: true });
  });

  it('recovers from missing master indexes on first load', () => {
    const manager = createManager();
    mockJsonDbApp.loadDatabase.mockImplementation(() => {
      throw new Error('Master index not found');
    });
    mockJsonDbApp.createAndInitialiseDatabase.mockReturnValue({ recovered: true });
    expect(manager.getDb()).toEqual({ recovered: true });
  });

  it('reports initialisation failures for missing masters and load errors', () => {
    const manager = createManager();
    mockJsonDbApp.loadDatabase.mockImplementation(() => {
      throw new Error('Master index missing');
    });
    mockJsonDbApp.createAndInitialiseDatabase.mockImplementation(() => {
      throw new Error('init failed');
    });
    expect(() => manager.getDb()).toThrow('Failed to initialise database (first-time setup).');

    DbManager._instance = null;
    const failing = createManager();
    mockJsonDbApp.loadDatabase.mockImplementation(() => {
      throw new Error('connection refused');
    });
    expect(() => failing.getDb()).toThrow('Failed to load database.');
  });

  it('summarises initialisation with collection and freeze fallbacks', () => {
    const manager = createManager();
    manager.getDb = vi.fn(() => ({
      listCollections: () => ['alpha', 'beta'],
    }));
    manager._getConfig = vi.fn(() => ({ masterIndexKey: 'master-key' }));
    const ok = manager.ensureInitialised();
    expect(ok).toEqual({ ok: true, masterIndexKey: 'master-key', collections: ['alpha', 'beta'] });

    manager.getDb = vi.fn(() => ({
      listCollections: () => {
        throw new Error('list failed');
      },
    }));
    const degraded = manager.ensureInitialised();
    expect(degraded.collections).toEqual([]);
  });

  it('validates collection names and reports fetch failures', () => {
    const manager = createManager();
    manager.getDb = vi.fn(() => ({}));
    expect(() => manager.getCollection(null)).toThrow(
      'Collection name must be a non-empty string.'
    );
    expect(() => manager.getCollection('')).toThrow('Collection name must be a non-empty string.');

    manager.getDb = vi.fn(() => ({
      getCollection: () => {
        throw new Error('backend down');
      },
    }));
    expect(() => manager.getCollection('missing')).toThrow('Failed to get collection "missing".');
  });

  it('reads all documents and reports read failures', () => {
    const manager = createManager();
    manager.getCollection = vi.fn(() => ({ find: (query) => (query ? [{ id: 1 }] : []) }));
    expect(manager.readAll('things')).toEqual([{ id: 1 }]);

    manager.getCollection = vi.fn(() => ({
      find: () => {
        throw new Error('find failed');
      },
    }));
    expect(() => manager.readAll('things')).toThrow('Failed to read documents from "things".');
  });

  it('saves collections by instance or name', () => {
    const manager = createManager();
    const instance = { save: vi.fn() };
    expect(manager.saveCollection(instance)).toBe(true);
    expect(instance.save).toHaveBeenCalled();

    manager.getCollection = vi.fn(() => ({ save: vi.fn() }));
    expect(manager.saveCollection('named')).toBe(true);

    manager.getCollection = vi.fn(() => ({
      save: () => {
        throw new Error('save failed');
      },
    }));
    expect(() => manager.saveCollection('named')).toThrow('Failed to save collection "named".');
    const failingInstance = {
      save: () => {
        throw new Error('save failed');
      },
    };
    expect(() => manager.saveCollection(failingInstance)).toThrow(
      'Failed to save collection "<collection>".'
    );
  });

  it('inserts many documents and reports failures', () => {
    const manager = createManager();
    expect(() => manager.insertMany('things', 'not-an-array')).toThrow(
      'insertMany requires an array of documents.'
    );
    const collection = { insertOne: vi.fn(), save: vi.fn() };
    manager.getCollection = vi.fn(() => collection);
    expect(manager.insertMany('things', [{ id: 1 }, { id: 2 }])).toEqual({ inserted: 2 });
    expect(collection.insertOne).toHaveBeenCalledTimes(2);

    manager.getCollection = vi.fn(() => ({
      insertOne: () => {
        throw new Error('insert failed');
      },
      save: vi.fn(),
    }));
    expect(() => manager.insertMany('things', [{ id: 1 }])).toThrow(
      'Failed to insert into "things".'
    );
  });

  it('upserts many documents by id with validation', () => {
    const manager = createManager();
    expect(() => manager.upsertManyById('things', 'not-an-array')).toThrow(
      'upsertManyById requires an array of documents.'
    );
    const collection = { updateOne: vi.fn(), save: vi.fn() };
    manager.getCollection = vi.fn(() => collection);
    expect(manager.upsertManyById('things', [{ _id: 'one' }, { _id: 'two' }])).toEqual({
      upserted: 2,
    });

    expect(() => manager.upsertManyById('things', [{ id: 'missing-id' }])).toThrow(
      'Failed to upsert into "things".'
    );
    manager.getCollection = vi.fn(() => ({
      updateOne: () => {
        throw new Error('upsert failed');
      },
      save: vi.fn(),
    }));
    expect(() => manager.upsertManyById('things', [{ _id: 'one' }])).toThrow(
      'Failed to upsert into "things".'
    );
  });
});
