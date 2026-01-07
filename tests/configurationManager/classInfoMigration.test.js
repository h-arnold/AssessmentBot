import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupGlobalGASMocks } from '../helpers/mockFactories.js';

let mocks;

// Import class under test
const ConfigurationManager = require('../../src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js');

describe('ConfigurationManager Class Info Migration', () => {
  let configManager;
  let mockGoogleClassroomManagerInstance;
  let mockClassroomApiClient;

  beforeEach(() => {
    mocks = setupGlobalGASMocks(vi);

    // Mock GoogleClassroomManager (Constructor and Instance)
    mockGoogleClassroomManagerInstance = {
      getCourseId: vi.fn(),
      deleteClassInfoSheet: vi.fn(),
    };
    globalThis.GoogleClassroomManager = vi.fn().mockImplementation(function () {
      return mockGoogleClassroomManagerInstance;
    });

    // Mock ClassroomApiClient (Static methods)
    mockClassroomApiClient = {
      fetchCourse: vi.fn(),
    };
    globalThis.ClassroomApiClient = mockClassroomApiClient;

    // Helper mocks
    globalThis.ABLogger = {
      getInstance: () => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
      }),
    };

    // Reset singleton
    ConfigurationManager.instance = null;
    configManager = new ConfigurationManager();
    configManager.scriptProperties = mocks.PropertiesService.scriptProperties;
    configManager.documentProperties = mocks.PropertiesService.documentProperties;
    configManager._initialized = true;
  });

  afterEach(() => {
    delete globalThis.GoogleClassroomManager;
    delete globalThis.ClassroomApiClient;
    delete globalThis.ABLogger;
    vi.unstubAllGlobals();
  });

  it('should return class info from document properties if exists', () => {
    const storedInfo = {
      ClassName: 'Test Class',
      CourseId: '12345',
      YearGroup: null,
    };
    mocks.PropertiesService.documentProperties.getProperty.mockReturnValue(
      JSON.stringify(storedInfo)
    );

    const result = configManager.getClassInfo();

    expect(result).toEqual(storedInfo);
    expect(mocks.PropertiesService.documentProperties.getProperty).toHaveBeenCalledWith(
      'assessmentRecordClassInfo'
    );
    expect(globalThis.GoogleClassroomManager).not.toHaveBeenCalled();
  });

  it('should migrate from legacy sheet if property missing', () => {
    // Property missing
    mocks.PropertiesService.documentProperties.getProperty.mockReturnValue(null);

    // Legacy course ID available
    mockGoogleClassroomManagerInstance.getCourseId.mockReturnValue('legacy-id');

    // Helper to fetch name
    mockClassroomApiClient.fetchCourse.mockReturnValue({
      name: 'Legacy Class Name',
    });

    const result = configManager.getClassInfo();

    expect(result).toEqual({
      ClassName: 'Legacy Class Name',
      CourseId: 'legacy-id',
      YearGroup: null,
    });

    // Verify setProperty was called
    expect(mocks.PropertiesService.documentProperties.setProperty).toHaveBeenCalledWith(
      'assessmentRecordClassInfo',
      expect.stringContaining('Legacy Class Name')
    );

    // Verify deleteClassInfoSheet was called
    expect(mockGoogleClassroomManagerInstance.deleteClassInfoSheet).toHaveBeenCalled();
  });

  it('should return null if property missing and legacy migration fails', () => {
    mocks.PropertiesService.documentProperties.getProperty.mockReturnValue(null);
    mockGoogleClassroomManagerInstance.getCourseId.mockImplementation(() => {
      throw new Error('No sheet');
    });

    // Mock getIsAdminSheet to return true so migration failure is handled gracefully
    configManager.getIsAdminSheet = vi.fn().mockReturnValue(true);

    const result = configManager.getClassInfo();

    expect(result).toBeNull();
    const setPropSpy = mocks.PropertiesService.documentProperties.setProperty;
    if (setPropSpy.mock) {
      expect(setPropSpy).not.toHaveBeenCalledWith('assessmentRecordClassInfo', expect.anything());
    }

    expect(mockGoogleClassroomManagerInstance.deleteClassInfoSheet).not.toHaveBeenCalled();
  });

  it('should return null if stored JSON is malformed', () => {
    // Provide invalid JSON string
    mocks.PropertiesService.documentProperties.getProperty.mockReturnValue('{ invalid json }');

    const loggerSpy = vi.fn();
    globalThis.ABLogger = {
      getInstance: () => ({
        error: loggerSpy,
        warn: vi.fn(),
        info: vi.fn(),
      }),
    };

    const result = configManager.getClassInfo();

    expect(result).toBeNull();
    expect(loggerSpy).toHaveBeenCalledWith(
      'Failed to parse Assessment Record Class Info',
      expect.any(Error)
    );
    expect(globalThis.GoogleClassroomManager).not.toHaveBeenCalled();
  });
});
