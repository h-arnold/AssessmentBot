import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock ConfigurationManager
const mockConfigurationManager = {
  getBackendAssessorBatchSize: vi.fn(),
  getApiKey: vi.fn(),
  getBackendUrl: vi.fn(),
  getAssessmentRecordTemplateId: vi.fn(),
  getAssessmentRecordDestinationFolder: vi.fn(),
  getUpdateDetailsUrl: vi.fn(),
  getUpdateStage: vi.fn(),
  getIsAdminSheet: vi.fn(),
  getRevokeAuthTriggerSet: vi.fn(),
  getDaysUntilAuthRevoke: vi.fn(),
  getScriptAuthorised: vi.fn(),
  getSlidesFetchBatchSize: vi.fn(),
  setBackendAssessorBatchSize: vi.fn(),
  setSlidesFetchBatchSize: vi.fn(),
  setApiKey: vi.fn(),
  setBackendUrl: vi.fn(),
  setAssessmentRecordTemplateId: vi.fn(),
  setAssessmentRecordDestinationFolder: vi.fn(),
  setUpdateDetailsUrl: vi.fn(),
  setDaysUntilAuthRevoke: vi.fn(),
};

// Mock classroom save function
const mockSaveClassroom = vi.fn();

// Setup global mocks
global.configurationManager = mockConfigurationManager;
global.console = { log: vi.fn(), error: vi.fn() };

// Create a mock context for globals.js functions that need access to these variables
const createMockContext = () => {
  return {
    configurationManager: mockConfigurationManager,
    saveClassroom: mockSaveClassroom,
    console: global.console,
  };
};

// Manually implement the functions from globals.js based on the source code
const createGlobalsFromSource = (context) => {
  const safeGet = (getter, name, fallback = '') => {
    try {
      return getter();
    } catch (err) {
      // Avoid logging full error objects which may contain sensitive details.
      context.console.error(
        `Error retrieving configuration value for ${name}: ${err && err.name ? err.name : 'Error'}`
      );
      return fallback;
    }
  };

  const maskApiKey = (key) => {
    if (!key) return '';
    const s = String(key);
    if (s.length <= 4) return '****';
    return '****' + s.slice(-4);
  };

  const getConfiguration = () => {
    const errors = [];

    const safeGetWithErrors = (getter, name, fallback = '') => {
      try {
        return getter();
      } catch (err) {
        // Avoid logging full error objects which may contain sensitive details.
        context.console.error(
          `Error retrieving configuration value for ${name}: ${
            err && err.name ? err.name : 'Error'
          }`
        );
        errors.push(`${name}: ${err && err.message ? err.message : 'REDACTED'}`);
        return fallback;
      }
    };

    const rawApiKey = safeGetWithErrors(
      () => context.configurationManager.getApiKey(),
      'apiKey',
      ''
    );

    const config = {
      backendAssessorBatchSize: safeGetWithErrors(
        () => context.configurationManager.getBackendAssessorBatchSize(),
        'backendAssessorBatchSize',
        30
      ),
      // Return a redacted API key to prevent accidental clear-text logging.
      apiKey: maskApiKey(rawApiKey),
      // Provide a boolean so callers can know whether a key is present without exposing it.
      hasApiKey: !!rawApiKey,
      backendUrl: safeGetWithErrors(
        () => context.configurationManager.getBackendUrl(),
        'backendUrl',
        ''
      ),
      assessmentRecordTemplateId: safeGetWithErrors(
        () => context.configurationManager.getAssessmentRecordTemplateId(),
        'assessmentRecordTemplateId',
        ''
      ),
      assessmentRecordDestinationFolder: safeGetWithErrors(
        () => context.configurationManager.getAssessmentRecordDestinationFolder(),
        'assessmentRecordDestinationFolder',
        ''
      ),
      updateDetailsUrl: safeGetWithErrors(
        () => context.configurationManager.getUpdateDetailsUrl(),
        'updateDetailsUrl',
        ''
      ),
      updateStage: safeGetWithErrors(
        () => context.configurationManager.getUpdateStage(),
        'updateStage',
        0
      ),
      isAdminSheet: safeGetWithErrors(
        () => context.configurationManager.getIsAdminSheet(),
        'isAdminSheet',
        false
      ),
      revokeAuthTriggerSet: safeGetWithErrors(
        () => context.configurationManager.getRevokeAuthTriggerSet(),
        'revokeAuthTriggerSet',
        false
      ),
      daysUntilAuthRevoke: safeGetWithErrors(
        () => context.configurationManager.getDaysUntilAuthRevoke(),
        'daysUntilAuthRevoke',
        60
      ),
      scriptAuthorised: safeGetWithErrors(
        () => context.configurationManager.getScriptAuthorised(),
        'scriptAuthorised',
        false
      ),
      slidesFetchBatchSize: safeGetWithErrors(
        () => context.configurationManager.getSlidesFetchBatchSize(),
        'slidesFetchBatchSize',
        20
      ),
    };

    if (errors.length > 0) {
      config.loadError = errors.join('; ');
    }

    return config;
  };

  const saveConfiguration = (config) => {
    const errors = [];

    const safeSet = (action, name) => {
      try {
        action();
        return true;
      } catch (err) {
        // Avoid logging or storing potentially sensitive details (e.g. API keys) in clear text.
        // Log only a generic error identifier and mark the detailed message as redacted.
        context.console.error(`Error saving configuration value for ${name}: REDACTED`);
        errors.push(`${name}: REDACTED`);
        return false;
      }
    };

    // Save classroom data if provided
    if (config.classroom) {
      try {
        context.saveClassroom(config.classroom.courseName, config.classroom.courseId);
        delete config.classroom; // Remove classroom data before saving other configs
      } catch (err) {
        context.console.error('Error saving classroom configuration:', err);
        errors.push(`classroom: ${err.message}`);
      }
    }

    // Delegate configuration saving to ConfigurationManager using safeSet
    if (config.backendAssessorBatchSize !== undefined) {
      safeSet(
        () =>
          context.configurationManager.setBackendAssessorBatchSize(config.backendAssessorBatchSize),
        'backendAssessorBatchSize'
      );
    }
    if (config.slidesFetchBatchSize !== undefined) {
      safeSet(
        () => context.configurationManager.setSlidesFetchBatchSize(config.slidesFetchBatchSize),
        'slidesFetchBatchSize'
      );
    }
    if (config.apiKey !== undefined) {
      safeSet(() => context.configurationManager.setApiKey(config.apiKey), 'apiKey');
    }
    if (config.backendUrl !== undefined) {
      safeSet(() => context.configurationManager.setBackendUrl(config.backendUrl), 'backendUrl');
    }

    // Handle Assessment Record values
    if (config.assessmentRecordTemplateId !== undefined) {
      safeSet(
        () =>
          context.configurationManager.setAssessmentRecordTemplateId(
            config.assessmentRecordTemplateId
          ),
        'assessmentRecordTemplateId'
      );
    }
    if (config.assessmentRecordDestinationFolder !== undefined) {
      safeSet(
        () =>
          context.configurationManager.setAssessmentRecordDestinationFolder(
            config.assessmentRecordDestinationFolder
          ),
        'assessmentRecordDestinationFolder'
      );
    }

    // Handle updateDetailsUrl parameter
    if (config.updateDetailsUrl !== undefined) {
      safeSet(
        () => context.configurationManager.setUpdateDetailsUrl(config.updateDetailsUrl),
        'updateDetailsUrl'
      );
    }

    // Handle daysUntilAuthRevoke parameter
    if (config.daysUntilAuthRevoke !== undefined) {
      safeSet(
        () => context.configurationManager.setDaysUntilAuthRevoke(config.daysUntilAuthRevoke),
        'daysUntilAuthRevoke'
      );
    }

    if (errors.length > 0) {
      const message = `Failed to save some configuration values: ${errors.join('; ')}`;
      context.console.error(message);
      return { success: false, error: message };
    }

    context.console.log('Configuration saved successfully.');
    return { success: true };
  };

  return { getConfiguration, saveConfiguration };
};

describe('Configuration Globals', () => {
  let globals;
  let context;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create fresh context and globals
    context = createMockContext();
    globals = createGlobalsFromSource(context);
  });

  describe('getConfiguration', () => {
    beforeEach(() => {
      // Setup default mock returns
      mockConfigurationManager.getBackendAssessorBatchSize.mockReturnValue(50);
      mockConfigurationManager.getApiKey.mockReturnValue('test-api-key');
      mockConfigurationManager.getBackendUrl.mockReturnValue('https://api.example.com');
      mockConfigurationManager.getAssessmentRecordTemplateId.mockReturnValue('template-123');
      mockConfigurationManager.getAssessmentRecordDestinationFolder.mockReturnValue('folder-456');
      mockConfigurationManager.getUpdateDetailsUrl.mockReturnValue('https://update.example.com');
      mockConfigurationManager.getUpdateStage.mockReturnValue(1);
      mockConfigurationManager.getIsAdminSheet.mockReturnValue(true);
      mockConfigurationManager.getRevokeAuthTriggerSet.mockReturnValue(false);
      mockConfigurationManager.getDaysUntilAuthRevoke.mockReturnValue(30);
      mockConfigurationManager.getScriptAuthorised.mockReturnValue(true);
      mockConfigurationManager.getSlidesFetchBatchSize.mockReturnValue(25);
    });

    it('should return all configuration values', () => {
      const config = globals.getConfiguration();

      expect(config).toMatchObject({
        backendAssessorBatchSize: 50,
        hasApiKey: true,
        backendUrl: 'https://api.example.com',
        assessmentRecordTemplateId: 'template-123',
        assessmentRecordDestinationFolder: 'folder-456',
        updateDetailsUrl: 'https://update.example.com',
        updateStage: 1,
        isAdminSheet: true,
        revokeAuthTriggerSet: false,
        daysUntilAuthRevoke: 30,
        scriptAuthorised: true,
        slidesFetchBatchSize: 25,
      });
    });

    it('should mask API key in response', () => {
      mockConfigurationManager.getApiKey.mockReturnValue('sk-1234567890abcdef');

      const config = globals.getConfiguration();

      expect(config.apiKey).toBe('****cdef');
      expect(config.hasApiKey).toBe(true);
    });

    it('should handle short API keys', () => {
      mockConfigurationManager.getApiKey.mockReturnValue('abc');

      const config = globals.getConfiguration();

      expect(config.apiKey).toBe('****');
      expect(config.hasApiKey).toBe(true);
    });

    it('should handle empty API key', () => {
      mockConfigurationManager.getApiKey.mockReturnValue('');

      const config = globals.getConfiguration();

      expect(config.apiKey).toBe('');
      expect(config.hasApiKey).toBe(false);
    });

    it('should handle null API key', () => {
      mockConfigurationManager.getApiKey.mockReturnValue(null);

      const config = globals.getConfiguration();

      expect(config.apiKey).toBe('');
      expect(config.hasApiKey).toBe(false);
    });

    it('should use fallback values when methods throw errors', () => {
      mockConfigurationManager.getBackendAssessorBatchSize.mockImplementation(() => {
        throw new Error('Test error');
      });
      mockConfigurationManager.getApiKey.mockImplementation(() => {
        throw new Error('API key error');
      });

      const config = globals.getConfiguration();

      expect(config.backendAssessorBatchSize).toBe(30); // fallback
      expect(config.apiKey).toBe(''); // fallback for masked key
      expect(config.hasApiKey).toBe(false); // fallback for boolean
      expect(config.loadError).toContain('backendAssessorBatchSize');
      expect(config.loadError).toContain('apiKey');
    });

    it('should collect all errors in loadError field', () => {
      mockConfigurationManager.getBackendUrl.mockImplementation(() => {
        throw new Error('Backend URL error');
      });
      mockConfigurationManager.getUpdateStage.mockImplementation(() => {
        throw new Error('Update stage error');
      });

      const config = globals.getConfiguration();

      expect(config.loadError).toContain('backendUrl');
      expect(config.loadError).toContain('updateStage');
      expect(config.loadError.split(';')).toHaveLength(2);
    });

    it('should log errors without exposing sensitive details', () => {
      const sensitiveError = new Error('API key sk-sensitive123 is invalid');
      sensitiveError.name = 'ValidationError';

      mockConfigurationManager.getApiKey.mockImplementation(() => {
        throw sensitiveError;
      });

      const config = globals.getConfiguration();

      expect(global.console.error).toHaveBeenCalledWith(
        'Error retrieving configuration value for apiKey: ValidationError'
      );
      expect(config.loadError).toBe('apiKey: API key sk-sensitive123 is invalid');
    });

    it('should handle errors without name property', () => {
      const error = new Error('Test error');
      delete error.name;

      mockConfigurationManager.getBackendUrl.mockImplementation(() => {
        throw error;
      });

      const config = globals.getConfiguration();

      expect(global.console.error).toHaveBeenCalledWith(
        'Error retrieving configuration value for backendUrl: Error'
      );
    });

    it('should call all configuration manager methods', () => {
      globals.getConfiguration();

      expect(mockConfigurationManager.getBackendAssessorBatchSize).toHaveBeenCalled();
      expect(mockConfigurationManager.getApiKey).toHaveBeenCalled();
      expect(mockConfigurationManager.getBackendUrl).toHaveBeenCalled();
      expect(mockConfigurationManager.getAssessmentRecordTemplateId).toHaveBeenCalled();
      expect(mockConfigurationManager.getAssessmentRecordDestinationFolder).toHaveBeenCalled();
      expect(mockConfigurationManager.getUpdateDetailsUrl).toHaveBeenCalled();
      expect(mockConfigurationManager.getUpdateStage).toHaveBeenCalled();
      expect(mockConfigurationManager.getIsAdminSheet).toHaveBeenCalled();
      expect(mockConfigurationManager.getRevokeAuthTriggerSet).toHaveBeenCalled();
      expect(mockConfigurationManager.getDaysUntilAuthRevoke).toHaveBeenCalled();
      expect(mockConfigurationManager.getScriptAuthorised).toHaveBeenCalled();
      expect(mockConfigurationManager.getSlidesFetchBatchSize).toHaveBeenCalled();
    });
  });

  describe('saveConfiguration', () => {
    const sampleConfig = {
      backendAssessorBatchSize: 100,
      slidesFetchBatchSize: 50,
      apiKey: 'test-api-key',
      backendUrl: 'https://api.example.com',
      assessmentRecordTemplateId: 'template-123',
      assessmentRecordDestinationFolder: 'folder-456',
      updateDetailsUrl: 'https://update.example.com',
      daysUntilAuthRevoke: 90,
    };

    it('should save all configuration values successfully', () => {
      const result = globals.saveConfiguration(sampleConfig);

      expect(result.success).toBe(true);
      expect(mockConfigurationManager.setBackendAssessorBatchSize).toHaveBeenCalledWith(100);
      expect(mockConfigurationManager.setSlidesFetchBatchSize).toHaveBeenCalledWith(50);
      expect(mockConfigurationManager.setApiKey).toHaveBeenCalledWith('test-api-key');
      expect(mockConfigurationManager.setBackendUrl).toHaveBeenCalledWith(
        'https://api.example.com'
      );
      expect(mockConfigurationManager.setAssessmentRecordTemplateId).toHaveBeenCalledWith(
        'template-123'
      );
      expect(mockConfigurationManager.setAssessmentRecordDestinationFolder).toHaveBeenCalledWith(
        'folder-456'
      );
      expect(mockConfigurationManager.setUpdateDetailsUrl).toHaveBeenCalledWith(
        'https://update.example.com'
      );
      expect(mockConfigurationManager.setDaysUntilAuthRevoke).toHaveBeenCalledWith(90);
    });

    it('should handle undefined values by not calling setters', () => {
      const partialConfig = {
        apiKey: 'test-key',
        // other values undefined
      };

      const result = globals.saveConfiguration(partialConfig);

      expect(result.success).toBe(true);
      expect(mockConfigurationManager.setApiKey).toHaveBeenCalledWith('test-key');
      expect(mockConfigurationManager.setBackendUrl).not.toHaveBeenCalled();
      expect(mockConfigurationManager.setBackendAssessorBatchSize).not.toHaveBeenCalled();
    });

    it('should save classroom data when provided', () => {
      const configWithClassroom = {
        ...sampleConfig,
        classroom: {
          courseId: 'course-123',
          courseName: 'Test Course',
        },
      };

      globals.saveConfiguration(configWithClassroom);

      expect(mockSaveClassroom).toHaveBeenCalledWith('Test Course', 'course-123');
    });

    it('should handle classroom save errors', () => {
      mockSaveClassroom.mockImplementation(() => {
        throw new Error('Classroom save failed');
      });

      const configWithClassroom = {
        apiKey: 'test-key',
        classroom: {
          courseId: 'course-123',
          courseName: 'Test Course',
        },
      };

      const result = globals.saveConfiguration(configWithClassroom);

      expect(result.success).toBe(false);
      expect(result.error).toContain('classroom: Classroom save failed');
      expect(global.console.error).toHaveBeenCalledWith(
        'Error saving classroom configuration:',
        expect.any(Error)
      );
    });

    it('should handle configuration setter errors', () => {
      mockConfigurationManager.setApiKey.mockImplementation(() => {
        throw new Error('API key validation failed');
      });
      mockConfigurationManager.setBackendUrl.mockImplementation(() => {
        throw new Error('Invalid URL');
      });

      const result = globals.saveConfiguration(sampleConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to save some configuration values');
      expect(result.error).toContain('apiKey: REDACTED');
      expect(result.error).toContain('backendUrl: REDACTED');
    });

    it('should continue saving other values when some fail', () => {
      mockConfigurationManager.setApiKey.mockImplementation(() => {
        throw new Error('API key error');
      });
      // Other setters should still be called
      mockConfigurationManager.setBackendUrl.mockImplementation(() => {
        // This should succeed
      });

      const result = globals.saveConfiguration(sampleConfig);

      expect(result.success).toBe(false);
      expect(mockConfigurationManager.setApiKey).toHaveBeenCalled();
      expect(mockConfigurationManager.setBackendUrl).toHaveBeenCalled();
    });

    it('should redact sensitive information in error messages', () => {
      mockConfigurationManager.setApiKey.mockImplementation(() => {
        throw new Error('API key sk-sensitive123 is invalid');
      });

      const result = globals.saveConfiguration(sampleConfig);

      expect(global.console.error).toHaveBeenCalledWith(
        'Error saving configuration value for apiKey: REDACTED'
      );
      expect(result.error).toContain('apiKey: REDACTED');
    });

    it('should log success message when all saves succeed', () => {
      const result = globals.saveConfiguration(sampleConfig);

      expect(result.success).toBe(true);
      expect(global.console.log).toHaveBeenCalledWith('Configuration saved successfully.');
    });

    it('should handle empty configuration object', () => {
      const result = globals.saveConfiguration({});

      expect(result.success).toBe(true);
      expect(global.console.log).toHaveBeenCalledWith('Configuration saved successfully.');
    });

    it('should remove classroom data before saving other configs', () => {
      const configWithClassroom = {
        apiKey: 'test-key',
        classroom: {
          courseId: 'course-123',
          courseName: 'Test Course',
        },
      };

      globals.saveConfiguration(configWithClassroom);

      // Classroom should be removed from config object before other saves
      expect(mockConfigurationManager.setApiKey).toHaveBeenCalledWith('test-key');
      // The classroom property should be deleted
      expect(configWithClassroom.classroom).toBeUndefined();
    });

    describe('Individual property handling', () => {
      it('should handle backendAssessorBatchSize', () => {
        globals.saveConfiguration({ backendAssessorBatchSize: 150 });
        expect(mockConfigurationManager.setBackendAssessorBatchSize).toHaveBeenCalledWith(150);
      });

      it('should handle slidesFetchBatchSize', () => {
        globals.saveConfiguration({ slidesFetchBatchSize: 75 });
        expect(mockConfigurationManager.setSlidesFetchBatchSize).toHaveBeenCalledWith(75);
      });

      it('should handle apiKey', () => {
        globals.saveConfiguration({ apiKey: 'new-key' });
        expect(mockConfigurationManager.setApiKey).toHaveBeenCalledWith('new-key');
      });

      it('should handle backendUrl', () => {
        globals.saveConfiguration({ backendUrl: 'https://new.api.com' });
        expect(mockConfigurationManager.setBackendUrl).toHaveBeenCalledWith('https://new.api.com');
      });

      it('should handle assessmentRecordTemplateId', () => {
        globals.saveConfiguration({ assessmentRecordTemplateId: 'new-template' });
        expect(mockConfigurationManager.setAssessmentRecordTemplateId).toHaveBeenCalledWith(
          'new-template'
        );
      });

      it('should handle assessmentRecordDestinationFolder', () => {
        globals.saveConfiguration({ assessmentRecordDestinationFolder: 'new-folder' });
        expect(mockConfigurationManager.setAssessmentRecordDestinationFolder).toHaveBeenCalledWith(
          'new-folder'
        );
      });

      it('should handle updateDetailsUrl', () => {
        globals.saveConfiguration({ updateDetailsUrl: 'https://new.update.com' });
        expect(mockConfigurationManager.setUpdateDetailsUrl).toHaveBeenCalledWith(
          'https://new.update.com'
        );
      });

      it('should handle daysUntilAuthRevoke', () => {
        globals.saveConfiguration({ daysUntilAuthRevoke: 120 });
        expect(mockConfigurationManager.setDaysUntilAuthRevoke).toHaveBeenCalledWith(120);
      });
    });
  });
});
