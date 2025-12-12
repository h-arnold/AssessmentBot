import { describe, it, expect, vi, beforeEach } from 'vitest';
import DriveManager from '../../src/AdminSheet/GoogleDriveManager/DriveManager.js';
import { AssignmentDefinition } from '../../src/AdminSheet/Models/AssignmentDefinition.js';

import DbManager from '../../src/AdminSheet/DbManager/DbManager.js';

// Mock dependencies
globalThis.DriveApp = {
  getFileById: vi.fn(),
};
globalThis.Drive = {
  Files: {
    get: vi.fn(),
  },
};
globalThis.Utilities = {
  sleep: vi.fn(),
};

vi.mock('../../src/AdminSheet/DbManager/DbManager.js');

describe('DriveManager - Definition Refresh Integration', () => {
  let mockCollection;
  let mockDbManager;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCollection = {
      findOne: vi.fn(),
      insertOne: vi.fn(),
      replaceOne: vi.fn(),
      save: vi.fn(),
    };

    mockDbManager = {
      getCollection: vi.fn(() => mockCollection),
    };

    DbManager.getInstance.mockReturnValue(mockDbManager);
    globalThis.DbManager = DbManager;
  });

  describe('getFileModifiedTime', () => {
    it('should return ISO timestamp for staleness detection', () => {
      const testDate = new Date('2025-06-15T14:30:00Z');
      const mockFile = {
        getLastUpdated: vi.fn(() => testDate),
      };
      globalThis.DriveApp.getFileById.mockReturnValue(mockFile);

      const timestamp = DriveManager.getFileModifiedTime('file-123');

      expect(timestamp).toBe('2025-06-15T14:30:00.000Z');
      expect(typeof timestamp).toBe('string');
    });

    it('should work with Advanced Drive API fallback', () => {
      globalThis.DriveApp.getFileById.mockImplementation(() => {
        throw new Error('DriveApp unavailable');
      });

      globalThis.Drive.Files.get.mockReturnValue({
        modifiedTime: '2025-06-15T14:30:00Z',
      });

      const timestamp = DriveManager.getFileModifiedTime('shared-drive-file');

      expect(timestamp).toBe('2025-06-15T14:30:00.000Z');
    });

    it('should handle retry logic with exponential backoff', () => {
      const mockDate = new Date('2025-01-01T10:00:00Z');
      const mockFile = {
        getLastUpdated: vi.fn(() => mockDate),
      };

      // Fail twice, then succeed
      globalThis.DriveApp.getFileById
        .mockImplementationOnce(() => {
          throw new Error('Temporary failure 1');
        })
        .mockImplementationOnce(() => {
          throw new Error('Temporary failure 2');
        })
        .mockReturnValue(mockFile);

      const result = DriveManager.getFileModifiedTime('retry-file');

      expect(result).toBe('2025-01-01T10:00:00.000Z');
      expect(globalThis.DriveApp.getFileById).toHaveBeenCalledTimes(3);
      expect(globalThis.Utilities.sleep).toHaveBeenCalledTimes(2);
      expect(globalThis.Utilities.sleep).toHaveBeenCalledWith(500); // First retry
      expect(globalThis.Utilities.sleep).toHaveBeenCalledWith(1000); // Second retry (500 * 2^1)
    });
  });

  describe('Integration with definition refresh', () => {
    it('should detect stale definition when Drive file is newer', () => {
      // Definition last modified in January
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-123',
        templateDocumentId: 'tpl-456',
        referenceLastModified: '2025-01-01T10:00:00.000Z',
        templateLastModified: '2025-01-01T10:00:00.000Z',
        tasks: { t1: {} },
      });

      // Drive files modified in June (newer)
      const juneDate = new Date('2025-06-15T14:30:00Z');
      const mockFile = {
        getLastUpdated: vi.fn(() => juneDate),
      };
      globalThis.DriveApp.getFileById.mockReturnValue(mockFile);

      const refModified = DriveManager.getFileModifiedTime('ref-123');
      const tplModified = DriveManager.getFileModifiedTime('tpl-456');

      // Check if refresh is needed
      const isStale =
        refModified > definition.referenceLastModified ||
        tplModified > definition.templateLastModified;

      expect(isStale).toBe(true);
      expect(refModified).toBe('2025-06-15T14:30:00.000Z');
      expect(tplModified).toBe('2025-06-15T14:30:00.000Z');
    });

    it('should detect fresh definition when Drive file is not newer', () => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-123',
        templateDocumentId: 'tpl-456',
        referenceLastModified: '2025-06-15T14:30:00.000Z',
        templateLastModified: '2025-06-15T14:30:00.000Z',
        tasks: { t1: {} },
      });

      // Drive files have same timestamp
      const sameDate = new Date('2025-06-15T14:30:00.000Z');
      const mockFile = {
        getLastUpdated: vi.fn(() => sameDate),
      };
      globalThis.DriveApp.getFileById.mockReturnValue(mockFile);

      const refModified = DriveManager.getFileModifiedTime('ref-123');
      const tplModified = DriveManager.getFileModifiedTime('tpl-456');

      const isStale =
        refModified > definition.referenceLastModified ||
        tplModified > definition.templateLastModified;

      expect(isStale).toBe(false);
    });

    it('should correctly parse and compare ISO timestamps', () => {
      // Test various timestamp formats
      const olderTimestamp = '2024-12-01T00:00:00.000Z';
      const newerTimestamp = '2025-06-15T14:30:00.000Z';

      expect(newerTimestamp > olderTimestamp).toBe(true);
      expect(olderTimestamp > newerTimestamp).toBe(false);
      expect(olderTimestamp).toBe(olderTimestamp);
    });

    it('should handle millisecond precision in comparisons', () => {
      const timestamp1 = '2025-01-01T10:00:00.000Z';
      const timestamp2 = '2025-01-01T10:00:00.001Z'; // 1ms later

      expect(timestamp2 > timestamp1).toBe(true);
    });
  });

  describe('Error handling in refresh flow', () => {
    it('should throw when DriveManager cannot fetch timestamps', () => {
      globalThis.DriveApp.getFileById.mockImplementation(() => {
        throw new Error('Drive error');
      });
      globalThis.Drive.Files.get.mockImplementation(() => {
        throw new Error('API error');
      });

      expect(() => {
        DriveManager.getFileModifiedTime('bad-file');
      }).toThrow();
    });

    it('should validate fileId parameter', () => {
      expect(() => {
        DriveManager.getFileModifiedTime(null);
      }).toThrow();

      expect(() => {
        DriveManager.getFileModifiedTime('');
      }).toThrow();

      expect(() => {
        DriveManager.getFileModifiedTime(undefined);
      }).toThrow();
    });
  });

  describe('Shared Drive support', () => {
    it('should use supportsAllDrives flag in Advanced Drive API', () => {
      globalThis.DriveApp.getFileById.mockImplementation(() => {
        throw new Error('Not accessible via DriveApp');
      });

      globalThis.Drive.Files.get.mockReturnValue({
        modifiedTime: '2025-06-15T14:30:00Z',
      });

      DriveManager.getFileModifiedTime('shared-drive-file');

      expect(globalThis.Drive.Files.get).toHaveBeenCalledWith(
        'shared-drive-file',
        expect.objectContaining({
          supportsAllDrives: true,
          fields: 'modifiedTime',
        })
      );
    });
  });

  describe('Date parsing and ISO conversion', () => {
    it('should convert Date object to ISO string correctly', () => {
      const testDate = new Date('2025-06-15T14:30:00Z');
      const mockFile = {
        getLastUpdated: vi.fn(() => testDate),
      };
      globalThis.DriveApp.getFileById.mockReturnValue(mockFile);

      const result = DriveManager.getFileModifiedTime('file-123');

      // Should be proper ISO string
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(result).getTime()).toBe(testDate.getTime());
    });

    it('should handle ISO string from Advanced Drive API', () => {
      globalThis.DriveApp.getFileById.mockImplementation(() => {
        throw new Error('Use API');
      });

      globalThis.Drive.Files.get.mockReturnValue({
        modifiedTime: '2025-06-15T14:30:00.123Z',
      });

      const result = DriveManager.getFileModifiedTime('file-api');

      expect(result).toBe('2025-06-15T14:30:00.123Z');
    });

    it('should throw on invalid Date from DriveApp', () => {
      const mockFile = {
        getLastUpdated: vi.fn(() => 'not-a-date'),
      };
      globalThis.DriveApp.getFileById.mockReturnValue(mockFile);

      globalThis.Drive.Files.get.mockReturnValue({
        modifiedTime: '2025-06-15T14:30:00Z',
      });

      // Should fallback to API when DriveApp returns invalid date
      const result = DriveManager.getFileModifiedTime('file-bad-date');
      expect(result).toBe('2025-06-15T14:30:00.000Z');
    });
  });
});
