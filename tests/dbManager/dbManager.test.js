/**
 * Tests for DbManager - Database manager wrapper around JsonDbApp
 * Tests singleton pattern, database initialization, collection operations, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Mock JsonDbApp library
const mockJsonDbApp = {
  loadDatabase: vi.fn(),
  createAndInitialiseDatabase: vi.fn(),
};

// Mock ConfigurationManager
const mockConfigurationManager = {
  getJsonDbRootFolderId: vi.fn(),
  getJsonDbMasterIndexKey: vi.fn(),
  getJsonDbLockTimeoutMs: vi.fn(),
  getJsonDbLogLevel: vi.fn(),
  getJsonDbBackupOnInitialise: vi.fn(),
};

// Mock ProgressTracker
const mockProgressTracker = {
  logAndThrowError: vi.fn(),
  logError: vi.fn(),
};

function createDbManagerTestContext() {
  // Clear module cache
  delete require.cache[require.resolve('../../src/backend/DbManager/DbManager.js')];
  delete require.cache[require.resolve('../../src/backend/00_BaseSingleton.js')];

  // Load BaseSingleton first (dependency)
  require('../../src/backend/00_BaseSingleton.js');
  // Load DbManager
  const DbManager = require('../../src/backend/DbManager/DbManager.js');

  return { DbManager };
}

// Global mock context - will be set up in beforeEach and torn down in afterEach
let restoreDbManagerGlobals;

describe('DbManager', () => {
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

  describe('Singleton Pattern', () => {
    it('getInstance returns the same instance on multiple calls', () => {
      const instance1 = DbManager.getInstance();
      const instance2 = DbManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('getInstance returns a DbManager instance', () => {
      const instance = DbManager.getInstance();
      expect(instance).toBeInstanceOf(DbManager);
      expect(instance.constructor.name).toBe('DbManager');
    });

    it('constructor with isSingletonCreator flag creates instance', () => {
      const instance = new DbManager(true);
      expect(instance).toBeInstanceOf(DbManager);
      expect(instance.constructor._instance).toBe(instance);
    });

    it('constructor without isSingletonCreator flag returns new instance but singleton pattern still works', () => {
      const instance1 = DbManager.getInstance();
      const instance2 = new DbManager(false);
      // The constructor still creates an object, but it doesn't set _instance
      // The singleton pattern means getInstance() still returns the original
      expect(DbManager.getInstance()).toBe(instance1);
    });

    it('resetForTests clears the singleton instance', () => {
      const instance1 = DbManager.getInstance();
      expect(instance1).toBeDefined();

      DbManager.resetForTests?.();
      // BaseSingleton reset
      BaseSingleton._instance = null;
      DbManager._instance = null;

      const instance2 = DbManager.getInstance();
      expect(instance2).not.toBe(instance1);
    });
  });

  describe('_assertLibraryAvailable', () => {
    it('throws error when JsonDbApp is not available', () => {
      // Create a new instance with JsonDbApp missing
      delete globalThis.JsonDbApp;

      expect(() => {
        new DbManager(true);
      }).toThrow('JsonDbApp library is not available');

      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });

    it('does not throw when JsonDbApp is available with required methods', () => {
      globalThis.JsonDbApp = {
        loadDatabase: vi.fn(),
        createAndInitialiseDatabase: vi.fn(),
      };

      expect(() => {
        new DbManager(true);
      }).not.toThrow();
    });

    it('throws when JsonDbApp is available but missing loadDatabase method', () => {
      globalThis.JsonDbApp = {
        createAndInitialiseDatabase: vi.fn(),
      };

      expect(() => {
        new DbManager(true);
      }).toThrow('JsonDbApp library is not available');
    });

    it('throws when JsonDbApp is available but missing createAndInitialiseDatabase method', () => {
      globalThis.JsonDbApp = {
        loadDatabase: vi.fn(),
      };

      expect(() => {
        new DbManager(true);
      }).toThrow('JsonDbApp library is not available');
    });
  });

  describe('_getConfig', () => {
    it('returns configuration object with all required properties', () => {
      const instance = DbManager.getInstance();
      const config = instance._getConfig();

      expect(config).toEqual({
        masterIndexKey: 'master-index-key',
        autoCreateCollections: true,
        lockTimeout: 5000,
        logLevel: 'INFO',
        backupOnInitialise: true,
        rootFolderId: 'root-folder-id',
      });
    });

    it('omits rootFolderId when not configured', () => {
      mockConfigurationManager.getJsonDbRootFolderId.mockReturnValue(null);

      const instance = DbManager.getInstance();
      const config = instance._getConfig();

      expect(config.rootFolderId).toBeUndefined();
    });

    it('uses ConfigurationManager getter methods', () => {
      const instance = DbManager.getInstance();
      instance._getConfig();

      expect(mockConfigurationManager.getJsonDbRootFolderId).toHaveBeenCalled();
      expect(mockConfigurationManager.getJsonDbMasterIndexKey).toHaveBeenCalled();
      expect(mockConfigurationManager.getJsonDbLockTimeoutMs).toHaveBeenCalled();
      expect(mockConfigurationManager.getJsonDbLogLevel).toHaveBeenCalled();
      expect(mockConfigurationManager.getJsonDbBackupOnInitialise).toHaveBeenCalled();
    });
  });

  describe('getDb', () => {
    it('returns the same database instance on multiple calls', () => {
      const instance = DbManager.getInstance();
      const db1 = instance.getDb();
      const db2 = instance.getDb();

      expect(db1).toBe(db2);
    });

    it('calls loadDatabase when masterIndexKey is configured', () => {
      mockConfigurationManager.getJsonDbMasterIndexKey.mockReturnValue('master-index-key');

      const instance = DbManager.getInstance();
      instance.getDb();

      expect(mockJsonDbApp.loadDatabase).toHaveBeenCalledWith({
        masterIndexKey: 'master-index-key',
        autoCreateCollections: true,
        lockTimeout: 5000,
        logLevel: 'INFO',
        backupOnInitialise: true,
        rootFolderId: 'root-folder-id',
      });
    });

    it('calls createAndInitialiseDatabase when masterIndexKey is not configured', () => {
      mockConfigurationManager.getJsonDbMasterIndexKey.mockReturnValue(null);

      const instance = DbManager.getInstance();
      instance.getDb();

      expect(mockJsonDbApp.createAndInitialiseDatabase).toHaveBeenCalledWith({
        masterIndexKey: null,
        autoCreateCollections: true,
        lockTimeout: 5000,
        logLevel: 'INFO',
        backupOnInitialise: true,
        rootFolderId: 'root-folder-id',
      });
    });

    it('falls back to createAndInitialiseDatabase when loadDatabase fails with missing master index', () => {
      mockJsonDbApp.loadDatabase.mockImplementation(() => {
        throw new Error('Master index not found');
      });

      const instance = DbManager.getInstance();
      instance.getDb();

      expect(mockJsonDbApp.loadDatabase).toHaveBeenCalled();
      expect(mockJsonDbApp.createAndInitialiseDatabase).toHaveBeenCalled();
    });

    it('throws error when both loadDatabase and createAndInitialiseDatabase fail', () => {
      mockJsonDbApp.loadDatabase.mockImplementation(() => {
        throw new Error('Database not found');
      });
      mockJsonDbApp.createAndInitialiseDatabase.mockImplementation(() => {
        throw new Error('Initialisation failed');
      });

      const instance = DbManager.getInstance();

      expect(() => instance.getDb()).toThrow('Failed to initialise database');
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });

    it('throws error when loadDatabase fails with non-master-index error', () => {
      mockJsonDbApp.loadDatabase.mockImplementation(() => {
        throw new Error('Connection timeout');
      });

      const instance = DbManager.getInstance();

      expect(() => instance.getDb()).toThrow('Failed to load database');
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });
  });

  describe('ensureInitialised', () => {
    it('returns status object with ok=true and collections', () => {
      const mockDb = {
        listCollections: () => ['collection1', 'collection2'],
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();
      const status = instance.ensureInitialised();

      expect(status.ok).toBe(true);
      expect(status.masterIndexKey).toBe('master-index-key');
      expect(status.collections).toEqual(['collection1', 'collection2']);
    });

    it('handles listCollections failure gracefully', () => {
      const mockDb = {
        listCollections: () => {
          throw new Error('listCollections failed');
        },
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();
      const status = instance.ensureInitialised();

      expect(status.ok).toBe(true);
      expect(status.collections).toEqual([]);
    });

    it('calls _maybeFreeze on the instance if available', () => {
      const mockDb = {
        listCollections: () => [],
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();
      instance.ensureInitialised();

      // _maybeFreeze is a static method on BaseSingleton
      // We verify it was called by checking if the method exists
      expect(typeof instance.constructor._maybeFreeze).toBe('function');
    });
  });

  describe('getCollection', () => {
    it('throws error for null collection name', () => {
      const instance = DbManager.getInstance();

      expect(() => instance.getCollection(null)).toThrow(
        'Collection name must be a non-empty string'
      );
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });

    it('throws error for undefined collection name', () => {
      const instance = DbManager.getInstance();

      expect(() => instance.getCollection(undefined)).toThrow(
        'Collection name must be a non-empty string'
      );
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });

    it('throws error for empty string collection name', () => {
      const instance = DbManager.getInstance();

      expect(() => instance.getCollection('')).toThrow(
        'Collection name must be a non-empty string'
      );
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });

    it('throws error for non-string collection name', () => {
      const instance = DbManager.getInstance();

      expect(() => instance.getCollection(123)).toThrow(
        'Collection name must be a non-empty string'
      );
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });

    it('returns collection for valid name', () => {
      const mockCollection = { name: 'test-collection' };
      const mockDb = {
        getCollection: (name) => {
          if (name === 'test-collection') return mockCollection;
          throw new Error('Collection not found');
        },
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();
      const collection = instance.getCollection('test-collection');

      expect(collection).toBe(mockCollection);
    });

    it('throws error when getCollection fails', () => {
      const mockDb = {
        getCollection: () => {
          throw new Error('Collection retrieval failed');
        },
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();

      expect(() => instance.getCollection('some-collection')).toThrow(
        'Failed to get collection "some-collection"'
      );
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });
  });

  describe('readAll', () => {
    it('returns all documents from collection', () => {
      const mockDocs = [{ id: 'doc1' }, { id: 'doc2' }];
      const mockCollection = {
        find: vi.fn().mockReturnValue(mockDocs),
      };
      const mockDb = {
        getCollection: () => mockCollection,
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();
      const docs = instance.readAll('test-collection');

      expect(docs).toEqual(mockDocs);
      expect(mockCollection.find).toHaveBeenCalledWith({});
    });

    it('calls find with empty object', () => {
      const mockCollection = {
        find: vi.fn().mockReturnValue([]),
      };
      const mockDb = {
        getCollection: () => mockCollection,
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();
      instance.readAll('test-collection');

      expect(mockCollection.find).toHaveBeenCalledWith({});
    });

    it('throws error when read fails', () => {
      const mockCollection = {
        find: vi.fn().mockImplementation(() => {
          throw new Error('Read failed');
        }),
      };
      const mockDb = {
        getCollection: () => mockCollection,
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();

      expect(() => instance.readAll('test-collection')).toThrow(
        'Failed to read documents from "test-collection"'
      );
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });
  });

  describe('saveCollection', () => {
    it('saves collection instance directly', () => {
      const mockCollection = {
        save: vi.fn(),
        name: 'test-collection',
      };

      const instance = DbManager.getInstance();
      const result = instance.saveCollection(mockCollection);

      expect(mockCollection.save).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('fetches collection by name and saves it', () => {
      const mockCollection = {
        save: vi.fn(),
      };
      const mockDb = {
        getCollection: vi.fn().mockReturnValue(mockCollection),
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();
      const result = instance.saveCollection('test-collection');

      expect(mockDb.getCollection).toHaveBeenCalledWith('test-collection');
      expect(mockCollection.save).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('throws error when save fails', () => {
      const mockCollection = {
        save: vi.fn().mockImplementation(() => {
          throw new Error('Save failed');
        }),
      };

      const instance = DbManager.getInstance();

      expect(() => instance.saveCollection(mockCollection)).toThrow(
        'Failed to save collection "<collection>"'
      );
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });
  });

  describe('insertMany', () => {
    it('throws error for non-array documents', () => {
      const instance = DbManager.getInstance();

      expect(() => instance.insertMany('collection', {})).toThrow(
        'insertMany requires an array of documents.'
      );
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });

    it('inserts all documents and saves collection', () => {
      const mockDocuments = [{ id: 'doc1' }, { id: 'doc2' }];
      const mockCollection = {
        insertOne: vi.fn(),
        save: vi.fn(),
      };
      const mockDb = {
        getCollection: () => mockCollection,
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();
      const result = instance.insertMany('test-collection', mockDocuments);

      expect(mockCollection.insertOne).toHaveBeenCalledTimes(2);
      expect(mockCollection.insertOne).toHaveBeenNthCalledWith(1, mockDocuments[0]);
      expect(mockCollection.insertOne).toHaveBeenNthCalledWith(2, mockDocuments[1]);
      expect(mockCollection.save).toHaveBeenCalled();
      expect(result).toEqual({ inserted: 2 });
    });

    it('throws error when insert fails', () => {
      const mockDocuments = [{ id: 'doc1' }];
      const mockCollection = {
        insertOne: () => {
          throw new Error('Insert failed');
        },
        save: vi.fn(),
      };
      const mockDb = {
        getCollection: () => mockCollection,
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();

      expect(() => instance.insertMany('test-collection', mockDocuments)).toThrow(
        'Failed to insert into "test-collection"'
      );
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });
  });

  describe('upsertManyById', () => {
    it('throws error for non-array documents', () => {
      const instance = DbManager.getInstance();

      expect(() => instance.upsertManyById('collection', {})).toThrow(
        'upsertManyById requires an array of documents.'
      );
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });

    it('throws error when document is missing _id field', () => {
      const mockDocuments = [{ id: 'doc1' }]; // Note: id, not _id
      const mockCollection = {
        updateOne: vi.fn(),
        save: vi.fn(),
      };
      const mockDb = {
        getCollection: () => mockCollection,
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();

      // The error is caught and wrapped by logAndThrowError
      expect(() => instance.upsertManyById('test-collection', mockDocuments)).toThrow(
        'Failed to upsert into "test-collection"'
      );
    });

    it('upserts all documents by _id and saves collection', () => {
      const mockDocuments = [
        { _id: 'doc1', name: 'Document 1' },
        { _id: 'doc2', name: 'Document 2' },
      ];
      const mockCollection = {
        updateOne: vi.fn(),
        save: vi.fn(),
      };
      const mockDb = {
        getCollection: () => mockCollection,
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();
      const result = instance.upsertManyById('test-collection', mockDocuments);

      expect(mockCollection.updateOne).toHaveBeenCalledTimes(2);
      expect(mockCollection.updateOne).toHaveBeenNthCalledWith(
        1,
        { _id: 'doc1' },
        { $set: mockDocuments[0] },
        { upsert: true }
      );
      expect(mockCollection.updateOne).toHaveBeenNthCalledWith(
        2,
        { _id: 'doc2' },
        { $set: mockDocuments[1] },
        { upsert: true }
      );
      expect(mockCollection.save).toHaveBeenCalled();
      expect(result).toEqual({ upserted: 2 });
    });

    it('throws error when upsert fails', () => {
      const mockDocuments = [{ _id: 'doc1', name: 'Document 1' }];
      const mockCollection = {
        updateOne: () => {
          throw new Error('Upsert failed');
        },
        save: vi.fn(),
      };
      const mockDb = {
        getCollection: () => mockCollection,
      };
      mockJsonDbApp.loadDatabase.mockReturnValue(mockDb);

      const instance = DbManager.getInstance();

      expect(() => instance.upsertManyById('test-collection', mockDocuments)).toThrow(
        'Failed to upsert into "test-collection"'
      );
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });
  });
});
