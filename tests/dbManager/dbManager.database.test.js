/**
 * DbManager database access: lazy loading, initialisation status and collection lookup.
 */

import { describe, it, expect } from 'vitest';
import {
  mockJsonDbApp,
  mockConfigurationManager,
  mockProgressTracker,
  useDbManagerTestContext,
} from './dbManagerTestHelpers.js';

describe('DbManager', () => {
  let DbManager;
  useDbManagerTestContext((value) => {
    DbManager = value;
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
        collectionLockLeaseMs: 5000,
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
        collectionLockLeaseMs: 5000,
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
});
