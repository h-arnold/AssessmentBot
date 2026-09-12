import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DriveManager from '../../src/backend/GoogleDriveManager/DriveManager/index.js';
import { createDriveManagerMocks } from '../helpers/driveManagerFacadeMocks.js';

describe('DriveManager.getFileModifiedTime', () => {
  let mocks;
  let restoreGlobals;

  beforeEach(() => {
    // Install GAS service mocks per test and restore the originals afterwards.
    mocks = createDriveManagerMocks(vi);
    restoreGlobals = mocks.install();
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('should return ISO string from DriveApp.getLastUpdated', () => {
    const mockDate = new Date('2025-01-01T10:00:00Z');
    const mockFile = {
      getLastUpdated: vi.fn().mockReturnValue(mockDate),
    };
    mocks.mockDriveApp.getFileById.mockReturnValue(mockFile);

    const result = DriveManager.getFileModifiedTime('file-123');
    expect(result).toBe('2025-01-01T10:00:00.000Z');
    expect(mocks.mockDriveApp.getFileById).toHaveBeenCalledWith('file-123');
  });

  it('should fallback to Advanced Drive API if DriveApp fails', () => {
    mocks.mockDriveApp.getFileById.mockImplementation(() => {
      throw new Error('DriveApp failed');
    });

    mocks.mockDrive.Files.get.mockReturnValue({
      modifiedTime: '2025-01-02T10:00:00Z',
    });

    const result = DriveManager.getFileModifiedTime('file-456');
    expect(result).toBe('2025-01-02T10:00:00.000Z');
    expect(mocks.mockDrive.Files.get).toHaveBeenCalledWith(
      'file-456',
      expect.objectContaining({ fields: 'modifiedTime' })
    );
  });

  it('should retry on failure', () => {
    const mockDate = new Date('2025-01-01T10:00:00Z');
    const mockFile = {
      getLastUpdated: vi.fn().mockReturnValue(mockDate),
    };

    // Fail twice, succeed on third
    mocks.mockDriveApp.getFileById
      .mockImplementationOnce(() => {
        throw new Error('Fail 1');
      })
      .mockImplementationOnce(() => {
        throw new Error('Fail 2');
      })
      .mockReturnValue(mockFile);

    const result = DriveManager.getFileModifiedTime('file-retry');
    expect(result).toBe('2025-01-01T10:00:00.000Z');
    expect(mocks.mockDriveApp.getFileById).toHaveBeenCalledTimes(3);
    expect(mocks.mockUtilities.sleep).toHaveBeenCalledTimes(2);
  });

  it('should throw error if all attempts fail', () => {
    mocks.mockDriveApp.getFileById.mockImplementation(() => {
      throw new Error('DriveApp Fail');
    });
    mocks.mockDrive.Files.get.mockImplementation(() => {
      throw new Error('Advanced API Fail');
    });

    expect(() => DriveManager.getFileModifiedTime('file-fail')).toThrow();
  });
});
