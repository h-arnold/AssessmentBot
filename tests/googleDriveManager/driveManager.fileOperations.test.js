/**
 * DriveManager facade file-operation coverage.
 *
 * Exercises the `moveFiles` and `copyTemplateSheet` methods on the facade using
 * mocked GAS services, verifying the observable behaviour that the refactor must
 * preserve.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DriveManager from '../../src/backend/GoogleDriveManager/DriveManager.js';
import { createDriveManagerMocks } from '../helpers/driveManagerFacadeMocks.js';

const DESTINATION_FOLDER_ID = 'destination-folder-id';
const TEMPLATE_SHEET_ID = 'template-sheet-id';
const FILE_ID = 'file-id';

describe('DriveManager file operation facade', () => {
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

  describe('moveFiles', () => {
    it('requires a destination folder ID', () => {
      expect(() => DriveManager.moveFiles(undefined, [FILE_ID])).toThrow(
        'destinationFolderId is required for moveFiles'
      );
    });

    it('returns a none result when no file IDs are provided', () => {
      const result = DriveManager.moveFiles(DESTINATION_FOLDER_ID, []);

      expect(result).toEqual({
        status: 'none',
        message: 'No file IDs provided; nothing to move.',
        details: [],
      });
      expect(mocks.mockLogger.info).toHaveBeenCalledWith('No file IDs provided; nothing to move.');
      expect(mocks.mockDrive.Files.get).not.toHaveBeenCalled();
    });

    it('moves a file into the destination and removes its previous parent', () => {
      mocks.mockDrive.Files.get.mockImplementation((fileId, options) => {
        if (options?.fields === 'id') return { id: fileId };
        return { name: 'Report', parents: ['previous-parent'] };
      });

      const result = DriveManager.moveFiles(DESTINATION_FOLDER_ID, [FILE_ID]);

      expect(result.status).toBe('complete');
      expect(result.details).toEqual([
        {
          fileId: FILE_ID,
          status: 'moved',
          message: `File ${FILE_ID} moved to folder ${DESTINATION_FOLDER_ID} successfully.`,
        },
      ]);
      expect(mocks.mockDrive.Files.update).toHaveBeenCalledWith({}, FILE_ID, null, {
        supportsAllDrives: true,
        addParents: DESTINATION_FOLDER_ID,
        removeParents: 'previous-parent',
      });
    });

    it('appends the optional string to the file name before moving', () => {
      mocks.mockDrive.Files.get.mockImplementation((fileId, options) => {
        if (options?.fields === 'id') return { id: fileId };
        return { name: 'Report', parents: [] };
      });

      DriveManager.moveFiles(DESTINATION_FOLDER_ID, [FILE_ID], '-archived');

      expect(mocks.mockDrive.Files.update).toHaveBeenCalledWith(
        { name: 'Report-archived' },
        FILE_ID,
        null,
        { supportsAllDrives: true }
      );
    });

    it('does not reassign parents when the file already lives only in the destination', () => {
      mocks.mockDrive.Files.get.mockImplementation((fileId, options) => {
        if (options?.fields === 'id') return { id: fileId };
        return { name: 'Report', parents: [DESTINATION_FOLDER_ID] };
      });

      const result = DriveManager.moveFiles(DESTINATION_FOLDER_ID, [FILE_ID]);

      expect(result.status).toBe('complete');
      expect(mocks.mockDrive.Files.update).not.toHaveBeenCalled();
    });

    it('reports a partial result and logs when a file cannot be moved', () => {
      mocks.mockDrive.Files.get.mockImplementation((fileId, options) => {
        if (options?.fields === 'id') return { id: fileId };
        throw new Error('file missing');
      });

      const result = DriveManager.moveFiles(DESTINATION_FOLDER_ID, ['missing-file']);

      expect(result.status).toBe('partial');
      expect(result.details).toEqual([
        {
          fileId: 'missing-file',
          status: 'failed',
          message: 'Failed to move file missing-file: file missing',
        },
      ]);
      expect(mocks.mockLogger.error).toHaveBeenCalled();
    });

    it('fails fast when the destination folder cannot be accessed', () => {
      mocks.mockDrive.Files.get.mockImplementation(() => {
        throw new Error('forbidden');
      });

      expect(() => DriveManager.moveFiles(DESTINATION_FOLDER_ID, [FILE_ID])).toThrow(
        `Failed to access folder with ID "${DESTINATION_FOLDER_ID}".`
      );
      expect(mocks.mockProgressTracker.logError).toHaveBeenCalledWith(
        `Failed to access folder with ID "${DESTINATION_FOLDER_ID}".`,
        { folderId: DESTINATION_FOLDER_ID, err: expect.any(Error) }
      );
    });
  });

  describe('copyTemplateSheet', () => {
    it('requires a template sheet ID and new sheet name', () => {
      expect(() =>
        DriveManager.copyTemplateSheet(undefined, DESTINATION_FOLDER_ID, 'Copy')
      ).toThrow('templateSheetId is required for copyTemplateSheet');
      expect(() =>
        DriveManager.copyTemplateSheet(TEMPLATE_SHEET_ID, DESTINATION_FOLDER_ID, undefined)
      ).toThrow('newSheetName is required for copyTemplateSheet');
    });

    it('resolves the destination from the template parents when not provided', () => {
      mocks.mockDrive.Files.get.mockImplementation((fileId, options) => {
        if (options?.fields === 'parents') return { parents: [DESTINATION_FOLDER_ID] };
        return { id: fileId };
      });
      mocks.mockDrive.Files.list.mockReturnValue({ files: [] });
      mocks.mockDrive.Files.copy.mockReturnValue({ id: 'copied-id' });

      const result = DriveManager.copyTemplateSheet(TEMPLATE_SHEET_ID, undefined, 'New Sheet');

      expect(result).toEqual({
        status: 'copied',
        file: null,
        fileId: 'copied-id',
        message: 'Template sheet copied successfully. Copied sheet ID: copied-id',
      });
      expect(mocks.mockDrive.Files.copy).toHaveBeenCalledWith(
        { name: 'New Sheet', parents: [DESTINATION_FOLDER_ID] },
        TEMPLATE_SHEET_ID,
        { supportsAllDrives: true }
      );
    });

    it('skips copying when a file with the same name already exists', () => {
      mocks.mockDrive.Files.list.mockReturnValue({
        files: [{ id: 'existing-id', name: 'New Sheet' }],
      });

      const result = DriveManager.copyTemplateSheet(
        TEMPLATE_SHEET_ID,
        DESTINATION_FOLDER_ID,
        'New Sheet'
      );

      expect(result).toEqual({
        status: 'skipped',
        file: null,
        fileId: 'existing-id',
        message: 'File with the name "New Sheet" already exists. Skipping copy.',
      });
      expect(mocks.mockDrive.Files.copy).not.toHaveBeenCalled();
    });

    it('escapes single quotes in the duplicate-name search query', () => {
      mocks.mockDrive.Files.list.mockReturnValue({ files: [] });
      mocks.mockDrive.Files.copy.mockReturnValue({ id: 'copied-id' });

      DriveManager.copyTemplateSheet(TEMPLATE_SHEET_ID, DESTINATION_FOLDER_ID, "Bob's Sheet");

      const [listArguments] = mocks.mockDrive.Files.list.mock.calls[0];
      expect(listArguments.q).toBe(
        `'${DESTINATION_FOLDER_ID}' in parents and trashed = false ` +
          String.raw`and name = 'Bob\\'s Sheet'`
      );
    });

    it('throws when no destination folder can be determined', () => {
      mocks.mockDrive.Files.get.mockImplementation((fileId, options) => {
        if (options?.fields === 'parents') return { parents: [] };
        return { id: fileId };
      });

      expect(() =>
        DriveManager.copyTemplateSheet(TEMPLATE_SHEET_ID, undefined, 'New Sheet')
      ).toThrow('destinationFolderId is required for copyTemplateSheet');
    });

    it('logs and propagates errors raised while copying', () => {
      mocks.mockDrive.Files.list.mockImplementation(() => {
        throw new Error('list failed');
      });

      expect(() =>
        DriveManager.copyTemplateSheet(TEMPLATE_SHEET_ID, DESTINATION_FOLDER_ID, 'New Sheet')
      ).toThrow('list failed');
      expect(mocks.mockLogger.error).toHaveBeenCalledWith('Failed to copy template sheet', {
        templateSheetId: TEMPLATE_SHEET_ID,
        destinationFolderId: DESTINATION_FOLDER_ID,
        newSheetName: 'New Sheet',
        err: expect.any(Error),
      });
    });
  });
});
