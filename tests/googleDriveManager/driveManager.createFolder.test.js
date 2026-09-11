/**
 * DriveManager facade createFolder coverage.
 *
 * Verifies the DriveApp happy paths and the Advanced Drive API fallback used
 * when DriveApp cannot operate on Shared Drives, using mocked GAS services.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DriveManager from '../../src/backend/GoogleDriveManager/DriveManager.js';
import { createDriveManagerMocks, createIterator } from '../helpers/driveManagerFacadeMocks.js';

const PARENT_FOLDER_ID = 'parent-folder-id';
const FOLDER_NAME = 'New Folder';

describe('DriveManager createFolder facade', () => {
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

  it('requires a parent folder ID and folder name', () => {
    expect(() => DriveManager.createFolder(undefined, FOLDER_NAME)).toThrow(
      'parentFolderId is required for createFolder'
    );
    expect(() => DriveManager.createFolder(PARENT_FOLDER_ID, undefined)).toThrow(
      'folderName is required for createFolder'
    );
  });

  it('returns the existing folder when one with the same name is found', () => {
    mocks.mockDriveApp.getFolderById.mockReturnValue({
      getFoldersByName: () => createIterator([{ getId: () => 'existing-folder-id' }]),
    });

    expect(DriveManager.createFolder(PARENT_FOLDER_ID, FOLDER_NAME)).toEqual({
      parentFolderId: PARENT_FOLDER_ID,
      newFolderId: 'existing-folder-id',
    });
  });

  it('creates a new folder via DriveApp when none exists', () => {
    const createFolder = vi.fn(() => ({ getId: () => 'created-folder-id' }));
    mocks.mockDriveApp.getFolderById.mockReturnValue({
      getFoldersByName: () => createIterator([]),
      createFolder,
    });

    expect(DriveManager.createFolder(PARENT_FOLDER_ID, FOLDER_NAME)).toEqual({
      parentFolderId: PARENT_FOLDER_ID,
      newFolderId: 'created-folder-id',
    });
    expect(createFolder).toHaveBeenCalledWith(FOLDER_NAME);
  });

  it('falls back to the Advanced Drive API and reuses an existing folder', () => {
    mocks.mockDriveApp.getFolderById.mockImplementation(() => {
      throw new Error('shared drive not supported by DriveApp');
    });
    mocks.mockDrive.Files.list.mockReturnValue({ files: [{ id: 'api-existing-folder-id' }] });

    expect(DriveManager.createFolder(PARENT_FOLDER_ID, FOLDER_NAME)).toEqual({
      parentFolderId: PARENT_FOLDER_ID,
      newFolderId: 'api-existing-folder-id',
    });
    expect(mocks.mockDrive.Files.create).not.toHaveBeenCalled();
  });

  it('falls back to the Advanced Drive API and creates a folder', () => {
    mocks.mockDriveApp.getFolderById.mockImplementation(() => {
      throw new Error('shared drive not supported by DriveApp');
    });
    mocks.mockDrive.Files.list.mockReturnValue({ files: [] });
    mocks.mockDrive.Files.create.mockReturnValue({ id: 'api-created-folder-id' });

    expect(DriveManager.createFolder(PARENT_FOLDER_ID, FOLDER_NAME)).toEqual({
      parentFolderId: PARENT_FOLDER_ID,
      newFolderId: 'api-created-folder-id',
    });
    expect(mocks.mockDrive.Files.create).toHaveBeenCalledWith(
      {
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [PARENT_FOLDER_ID],
      },
      null,
      { supportsAllDrives: true }
    );
  });

  it('escapes single quotes in the Advanced Drive API query', () => {
    mocks.mockDriveApp.getFolderById.mockImplementation(() => {
      throw new Error('shared drive not supported by DriveApp');
    });
    mocks.mockDrive.Files.list.mockReturnValue({ files: [] });
    mocks.mockDrive.Files.create.mockReturnValue({ id: 'api-created-folder-id' });

    DriveManager.createFolder(PARENT_FOLDER_ID, "Bob's Folder");

    const [listArguments] = mocks.mockDrive.Files.list.mock.calls[0];
    expect(listArguments.q).toContain(String.raw`name = 'Bob\\'s Folder'`);
  });

  it('logs and propagates Advanced Drive API fallback failures', () => {
    mocks.mockDriveApp.getFolderById.mockImplementation(() => {
      throw new Error('shared drive not supported by DriveApp');
    });
    const apiError = new Error('list failed');
    mocks.mockDrive.Files.list.mockImplementation(() => {
      throw apiError;
    });

    expect(() => DriveManager.createFolder(PARENT_FOLDER_ID, FOLDER_NAME)).toThrow(apiError);
    expect(mocks.mockLogger.error).toHaveBeenCalledWith('Drive API createFolder fallback failed', {
      parentFolderId: PARENT_FOLDER_ID,
      folderName: FOLDER_NAME,
      err: apiError,
    });
  });

  it('fails fast when the parent folder cannot be accessed', () => {
    mocks.mockDrive.Files.get.mockImplementation(() => {
      throw new Error('forbidden');
    });

    expect(() => DriveManager.createFolder(PARENT_FOLDER_ID, FOLDER_NAME)).toThrow(
      `Failed to access folder with ID "${PARENT_FOLDER_ID}".`
    );
  });
});
