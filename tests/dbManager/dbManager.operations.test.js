/**
 * DbManager collection operations: reads, saves and bulk insert/upsert writes.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  mockJsonDbApp,
  mockProgressTracker,
  useDbManagerTestContext,
} from './dbManagerTestHelpers.js';

describe('DbManager', () => {
  let DbManager;
  useDbManagerTestContext((value) => {
    DbManager = value;
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
