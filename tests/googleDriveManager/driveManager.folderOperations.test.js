/**
 * DriveManager facade folder-operation coverage.
 *
 * Exercises the `shareFolder` and `getParentFolderId` methods (including DriveApp
 * retries and Advanced Drive API fallbacks) plus the private `_validateFolderExists`
 * fail-fast guard, using mocked GAS services.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DriveManager from '../../src/backend/GoogleDriveManager/DriveManager.js';
import { createDriveManagerMocks, createIterator } from '../helpers/driveManagerFacadeMocks.js';

const DESTINATION_FOLDER_ID = 'destination-folder-id';
const FILE_ID = 'file-id';

describe('DriveManager folder operation facade', () => {
  let mocks;
  let restoreGlobals;

  beforeEach(() => {
    mocks = createDriveManagerMocks(vi);
    restoreGlobals = mocks.install();
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  describe('shareFolder', () => {
    it('requires a destination folder ID', () => {
      expect(() => DriveManager.shareFolder(undefined, new Set())).toThrow(
        'destinationFolderId is required for shareFolder'
      );
    });

    it('returns a none result when the email set is empty', () => {
      const result = DriveManager.shareFolder(DESTINATION_FOLDER_ID, new Set());

      expect(result).toEqual({
        status: 'none',
        message: 'No emails provided; nothing to share.',
        details: [],
      });
      expect(mocks.mockLogger.info).toHaveBeenCalledWith('No emails provided; nothing to share.');
    });

    it('returns a none result when no email collection is supplied', () => {
      const result = DriveManager.shareFolder(DESTINATION_FOLDER_ID, undefined);

      expect(result.status).toBe('none');
    });

    it('shares the folder with every email and reports complete', () => {
      const addEditor = vi.fn();
      mocks.mockDriveApp.getFolderById.mockReturnValue({ addEditor });

      const result = DriveManager.shareFolder(
        DESTINATION_FOLDER_ID,
        new Set(['a@school.edu', 'b@school.edu'])
      );

      expect(result.status).toBe('complete');
      expect(result.message).toBe('Shared folder with 2 email(s) successfully, 0 failed.');
      expect(result.details).toEqual([
        {
          email: 'a@school.edu',
          status: 'shared',
          message: 'Successfully shared with a@school.edu',
        },
        {
          email: 'b@school.edu',
          status: 'shared',
          message: 'Successfully shared with b@school.edu',
        },
      ]);
      expect(addEditor).toHaveBeenCalledTimes(2);
    });

    it('reports a partial result when one email cannot be shared', () => {
      const addEditor = vi.fn((email) => {
        if (email === 'bad@school.edu') throw new Error('permission denied');
      });
      mocks.mockDriveApp.getFolderById.mockReturnValue({ addEditor });

      const result = DriveManager.shareFolder(
        DESTINATION_FOLDER_ID,
        new Set(['ok@school.edu', 'bad@school.edu'])
      );

      expect(result.status).toBe('partial');
      expect(result.details).toEqual([
        {
          email: 'ok@school.edu',
          status: 'shared',
          message: 'Successfully shared with ok@school.edu',
        },
        {
          email: 'bad@school.edu',
          status: 'failed',
          message: 'Failed to share folder with bad@school.edu: permission denied',
        },
      ]);
      expect(mocks.mockLogger.error).toHaveBeenCalled();
    });

    it('fails fast when the folder cannot be accessed', () => {
      mocks.mockDrive.Files.get.mockImplementation(() => {
        throw new Error('forbidden');
      });

      expect(() =>
        DriveManager.shareFolder(DESTINATION_FOLDER_ID, new Set(['a@school.edu']))
      ).toThrow(`Failed to access folder with ID "${DESTINATION_FOLDER_ID}".`);
    });

    it('logs and propagates failures to obtain the folder', () => {
      mocks.mockDriveApp.getFolderById.mockImplementation(() => {
        throw new Error('folder unavailable');
      });

      expect(() =>
        DriveManager.shareFolder(DESTINATION_FOLDER_ID, new Set(['a@school.edu']))
      ).toThrow('folder unavailable');
      expect(mocks.mockLogger.error).toHaveBeenCalledWith(
        'Failed to get folder or share with emails',
        expect.any(Error)
      );
    });
  });

  describe('getParentFolderId', () => {
    it('requires a file ID', () => {
      expect(() => DriveManager.getParentFolderId(undefined)).toThrow(
        'fileId is required for getParentFolderId'
      );
    });

    it('returns the parent folder found via DriveApp', () => {
      mocks.mockDriveApp.getFileById.mockReturnValue({
        getParents: () => createIterator([{ getId: () => 'parent-folder-id' }]),
      });

      expect(DriveManager.getParentFolderId(FILE_ID)).toBe('parent-folder-id');
      expect(mocks.mockDrive.Files.get).not.toHaveBeenCalled();
    });

    it('falls back to the Advanced Drive API when DriveApp reports no parents', () => {
      mocks.mockDriveApp.getFileById.mockReturnValue({ getParents: () => createIterator([]) });
      mocks.mockDrive.Files.get.mockReturnValue({ parents: ['api-parent-id'] });

      expect(DriveManager.getParentFolderId(FILE_ID)).toBe('api-parent-id');
      expect(mocks.mockDriveApp.getFileById).toHaveBeenCalledTimes(1);
    });

    it('retries DriveApp with exponential backoff before using the API', () => {
      mocks.mockDriveApp.getFileById.mockImplementation(() => {
        throw new Error('DriveApp unavailable');
      });
      mocks.mockDrive.Files.get.mockReturnValue({ parents: ['api-parent-id'] });

      expect(DriveManager.getParentFolderId(FILE_ID)).toBe('api-parent-id');
      expect(mocks.mockDriveApp.getFileById).toHaveBeenCalledTimes(3);
      expect(mocks.mockUtilities.sleep).toHaveBeenNthCalledWith(1, 500);
      expect(mocks.mockUtilities.sleep).toHaveBeenNthCalledWith(2, 1000);
    });

    it('uses the Shared Drive id when the API reports no parents', () => {
      mocks.mockDriveApp.getFileById.mockReturnValue({ getParents: () => createIterator([]) });
      mocks.mockDrive.Files.get.mockReturnValue({ driveId: 'shared-drive-id' });

      expect(DriveManager.getParentFolderId(FILE_ID)).toBe('shared-drive-id');
    });

    it('falls back to the My Drive root when the API returns no location', () => {
      mocks.mockDriveApp.getFileById.mockReturnValue({ getParents: () => createIterator([]) });
      mocks.mockDrive.Files.get.mockReturnValue({});
      mocks.mockDriveApp.getRootFolder.mockReturnValue({ getId: () => 'my-drive-root-id' });

      expect(DriveManager.getParentFolderId(FILE_ID)).toBe('my-drive-root-id');
    });

    it('falls back to the My Drive root when the API request fails', () => {
      mocks.mockDriveApp.getFileById.mockReturnValue({ getParents: () => createIterator([]) });
      mocks.mockDrive.Files.get.mockImplementation(() => {
        throw new Error('api failed');
      });
      mocks.mockDriveApp.getRootFolder.mockReturnValue({ getId: () => 'my-drive-root-id' });

      expect(DriveManager.getParentFolderId(FILE_ID)).toBe('my-drive-root-id');
    });

    it('throws the API error when the root folder cannot be resolved either', () => {
      mocks.mockDriveApp.getFileById.mockReturnValue({ getParents: () => createIterator([]) });
      const apiError = new Error('api failed');
      mocks.mockDrive.Files.get.mockImplementation(() => {
        throw apiError;
      });
      mocks.mockDriveApp.getRootFolder.mockImplementation(() => {
        throw new Error('root failed');
      });

      expect(() => DriveManager.getParentFolderId(FILE_ID)).toThrow(apiError);
    });
  });

  describe('_validateFolderExists', () => {
    it('resolves when the folder is accessible', () => {
      mocks.mockDrive.Files.get.mockReturnValue({ id: DESTINATION_FOLDER_ID });

      expect(() => DriveManager._validateFolderExists(DESTINATION_FOLDER_ID)).not.toThrow();
      expect(mocks.mockDrive.Files.get).toHaveBeenCalledWith(DESTINATION_FOLDER_ID, {
        supportsAllDrives: true,
        fields: 'id',
      });
    });

    it('throws a wrapped error preserving the original cause and logs it', () => {
      const accessError = new Error('forbidden');
      mocks.mockDrive.Files.get.mockImplementation(() => {
        throw accessError;
      });

      let thrownError;
      try {
        DriveManager._validateFolderExists(DESTINATION_FOLDER_ID);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(Error);
      expect(thrownError.message).toBe(
        `Failed to access folder with ID "${DESTINATION_FOLDER_ID}".`
      );
      expect(thrownError.cause).toBe(accessError);
      expect(mocks.mockProgressTracker.logError).toHaveBeenCalledWith(
        `Failed to access folder with ID "${DESTINATION_FOLDER_ID}".`,
        { folderId: DESTINATION_FOLDER_ID, err: accessError }
      );
    });
  });
});
