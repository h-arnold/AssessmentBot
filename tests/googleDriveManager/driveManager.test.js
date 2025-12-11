import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DriveManager from '../../src/AdminSheet/GoogleDriveManager/DriveManager.js';
import ProgressTracker from '../../src/AdminSheet/00_BaseSingleton.js';

// Mock global DriveApp and Drive (Advanced Service)
global.DriveApp = {
  getFileById: vi.fn(),
};
global.Drive = {
  Files: {
    get: vi.fn(),
  },
};
global.Utilities = {
  sleep: vi.fn(),
};

describe('DriveManager.getFileModifiedTime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return ISO string from DriveApp.getLastUpdated', () => {
    const mockDate = new Date('2025-01-01T10:00:00Z');
    const mockFile = {
      getLastUpdated: vi.fn().mockReturnValue(mockDate),
    };
    global.DriveApp.getFileById.mockReturnValue(mockFile);

    const result = DriveManager.getFileModifiedTime('file-123');
    expect(result).toBe('2025-01-01T10:00:00.000Z');
    expect(global.DriveApp.getFileById).toHaveBeenCalledWith('file-123');
  });

  it('should fallback to Advanced Drive API if DriveApp fails', () => {
    global.DriveApp.getFileById.mockImplementation(() => {
      throw new Error('DriveApp failed');
    });

    global.Drive.Files.get.mockReturnValue({
      modifiedTime: '2025-01-02T10:00:00Z',
    });

    const result = DriveManager.getFileModifiedTime('file-456');
    expect(result).toBe('2025-01-02T10:00:00.000Z');
    expect(global.Drive.Files.get).toHaveBeenCalledWith(
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
    global.DriveApp.getFileById
      .mockImplementationOnce(() => {
        throw new Error('Fail 1');
      })
      .mockImplementationOnce(() => {
        throw new Error('Fail 2');
      })
      .mockReturnValue(mockFile);

    const result = DriveManager.getFileModifiedTime('file-retry');
    expect(result).toBe('2025-01-01T10:00:00.000Z');
    expect(global.DriveApp.getFileById).toHaveBeenCalledTimes(3);
    expect(global.Utilities.sleep).toHaveBeenCalledTimes(2);
  });

  it('should throw error if all attempts fail', () => {
    global.DriveApp.getFileById.mockImplementation(() => {
      throw new Error('DriveApp Fail');
    });
    global.Drive.Files.get.mockImplementation(() => {
      throw new Error('Advanced API Fail');
    });

    expect(() => DriveManager.getFileModifiedTime('file-fail')).toThrow();
  });
});
