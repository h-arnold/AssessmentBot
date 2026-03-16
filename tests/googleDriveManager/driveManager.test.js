import { describe, it, expect, vi, beforeEach } from 'vitest';
import DriveManager from '../../src/AdminSheet/GoogleDriveManager/DriveManager.js';

// Mock global DriveApp and Drive (Advanced Service)
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

describe('DriveManager.getFileModifiedTime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return ISO string from DriveApp.getLastUpdated', () => {
    const mockDate = new Date('2025-01-01T10:00:00Z');
    const mockFile = {
      getLastUpdated: vi.fn().mockReturnValue(mockDate),
    };
    globalThis.DriveApp.getFileById.mockReturnValue(mockFile);

    const result = DriveManager.getFileModifiedTime('file-123');
    expect(result).toBe('2025-01-01T10:00:00.000Z');
    expect(globalThis.DriveApp.getFileById).toHaveBeenCalledWith('file-123');
  });

  it('should fallback to Advanced Drive API if DriveApp fails', () => {
    globalThis.DriveApp.getFileById.mockImplementation(() => {
      throw new Error('DriveApp failed');
    });

    globalThis.Drive.Files.get.mockReturnValue({
      modifiedTime: '2025-01-02T10:00:00Z',
    });

    const result = DriveManager.getFileModifiedTime('file-456');
    expect(result).toBe('2025-01-02T10:00:00.000Z');
    expect(globalThis.Drive.Files.get).toHaveBeenCalledWith(
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
    globalThis.DriveApp.getFileById
      .mockImplementationOnce(() => {
        throw new Error('Fail 1');
      })
      .mockImplementationOnce(() => {
        throw new Error('Fail 2');
      })
      .mockReturnValue(mockFile);

    const result = DriveManager.getFileModifiedTime('file-retry');
    expect(result).toBe('2025-01-01T10:00:00.000Z');
    expect(globalThis.DriveApp.getFileById).toHaveBeenCalledTimes(3);
    expect(globalThis.Utilities.sleep).toHaveBeenCalledTimes(2);
  });

  it('should throw error if all attempts fail', () => {
    globalThis.DriveApp.getFileById.mockImplementation(() => {
      throw new Error('DriveApp Fail');
    });
    globalThis.Drive.Files.get.mockImplementation(() => {
      throw new Error('Advanced API Fail');
    });

    expect(() => DriveManager.getFileModifiedTime('file-fail')).toThrow();
  });
});
