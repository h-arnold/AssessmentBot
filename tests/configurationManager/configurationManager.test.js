import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Google Apps Script services
const mockScriptProperties = {
  setProperty: vi.fn(),
  getProperty: vi.fn(),
  getProperties: vi.fn().mockReturnValue({}),
  getKeys: vi.fn().mockReturnValue([]),
};

const mockDocumentProperties = {
  setProperty: vi.fn(),
  getProperty: vi.fn(),
  getKeys: vi.fn().mockReturnValue([]),
};

const mockPropertiesService = {
  getScriptProperties: vi.fn().mockReturnValue(mockScriptProperties),
  getDocumentProperties: vi.fn().mockReturnValue(mockDocumentProperties),
};

const mockUtils = {
  isValidUrl: vi.fn(),
  validateIsAdminSheet: vi.fn(),
};

const mockDriveApp = {
  getFileById: vi.fn(),
  getFolderById: vi.fn(),
};

const mockMimeType = {
  GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet',
};

const mockSpreadsheetApp = {
  getActiveSpreadsheet: vi.fn().mockReturnValue({
    getId: vi.fn().mockReturnValue('test-spreadsheet-id'),
  }),
};

const mockDriveManager = {
  getParentFolderId: vi.fn(),
  createFolder: vi.fn(),
};

const mockPropertiesCloner = vi.fn().mockImplementation(() => ({
  sheet: null,
  deserialiseProperties: vi.fn(),
}));

// Set up global mocks
global.PropertiesService = mockPropertiesService;
global.Utils = mockUtils;
global.DriveApp = mockDriveApp;
global.MimeType = mockMimeType;
global.SpreadsheetApp = mockSpreadsheetApp;
global.DriveManager = mockDriveManager;
global.PropertiesCloner = mockPropertiesCloner;
global.console = { log: vi.fn(), error: vi.fn() };

// Import the class after setting up mocks
const ConfigurationManager = require('../../src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js');

describe('ConfigurationManager', () => {
  let configManager;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset singleton instance
    ConfigurationManager.instance = null;

    // Setup default mock returns
    mockDocumentProperties.getProperty.mockReturnValue(false);
    mockUtils.isValidUrl.mockReturnValue(true);
    mockUtils.validateIsAdminSheet.mockReturnValue(true);

    // Create new instance
    configManager = new ConfigurationManager();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when instantiated multiple times', () => {
      const instance1 = new ConfigurationManager();
      const instance2 = new ConfigurationManager();
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(configManager);
    });

    it('should initialize properties services correctly', () => {
      expect(mockPropertiesService.getScriptProperties).toHaveBeenCalled();
      expect(mockPropertiesService.getDocumentProperties).toHaveBeenCalled();
    });
  });

  describe('CONFIG_KEYS', () => {
    it('should have all required configuration keys', () => {
      const keys = ConfigurationManager.CONFIG_KEYS;

      expect(keys).toHaveProperty('BACKEND_ASSESSOR_BATCH_SIZE', 'backendAssessorBatchSize');
      expect(keys).toHaveProperty('SLIDES_FETCH_BATCH_SIZE', 'slidesFetchBatchSize');
      expect(keys).toHaveProperty('API_KEY', 'apiKey');
      expect(keys).toHaveProperty('BACKEND_URL', 'backendUrl');
      expect(keys).toHaveProperty('ASSESSMENT_RECORD_TEMPLATE_ID', 'assessmentRecordTemplateId');
      expect(keys).toHaveProperty(
        'ASSESSMENT_RECORD_DESTINATION_FOLDER',
        'assessmentRecordDestinationFolder'
      );
      expect(keys).toHaveProperty('UPDATE_DETAILS_URL', 'updateDetailsUrl');
      expect(keys).toHaveProperty('UPDATE_STAGE', 'updateStage');
      expect(keys).toHaveProperty('IS_ADMIN_SHEET', 'isAdminSheet');
      expect(keys).toHaveProperty('REVOKE_AUTH_TRIGGER_SET', 'revokeAuthTriggerSet');
      expect(keys).toHaveProperty('DAYS_UNTIL_AUTH_REVOKE', 'daysUntilAuthRevoke');
      expect(keys).toHaveProperty('SCRIPT_AUTHORISED', 'scriptAuthorised');
    });
  });

  describe('DEFAULTS', () => {
    it('should have correct default values', () => {
      const defaults = ConfigurationManager.DEFAULTS;

      expect(defaults.BACKEND_ASSESSOR_BATCH_SIZE).toBe(120);
      expect(defaults.SLIDES_FETCH_BATCH_SIZE).toBe(30);
      expect(defaults.DAYS_UNTIL_AUTH_REVOKE).toBe(60);
      expect(defaults.UPDATE_STAGE).toBe(0);
      expect(defaults.UPDATE_DETAILS_URL).toContain('github.com');
    });
  });

  describe('Property Storage', () => {
    it('should store document properties for IS_ADMIN_SHEET', () => {
      configManager.setProperty(ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET, true);

      expect(mockDocumentProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET,
        'true'
      );
      expect(mockScriptProperties.setProperty).not.toHaveBeenCalled();
    });

    it('should store document properties for SCRIPT_AUTHORISED', () => {
      configManager.setProperty(ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED, true);

      expect(mockDocumentProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED,
        'true'
      );
    });

    it('should store document properties for REVOKE_AUTH_TRIGGER_SET', () => {
      configManager.setProperty(ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET, false);

      expect(mockDocumentProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET,
        'false'
      );
    });

    it('should store script properties for other keys', () => {
      configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, 'test-key');

      expect(mockScriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.API_KEY,
        'test-key'
      );
      expect(mockDocumentProperties.setProperty).not.toHaveBeenCalled();
    });
  });

  describe('Validation Methods', () => {
    describe('isValidApiKey', () => {
      it('should accept valid API keys with alphanumeric characters', () => {
        expect(configManager.isValidApiKey('abc123')).toBe(true);
        expect(configManager.isValidApiKey('test-key-123')).toBe(true);
        expect(configManager.isValidApiKey('sk-abc123def456')).toBe(true);
      });

      it('should reject API keys with invalid characters', () => {
        expect(configManager.isValidApiKey('test_key')).toBe(false);
        expect(configManager.isValidApiKey('test.key')).toBe(false);
        expect(configManager.isValidApiKey('test key')).toBe(false);
        expect(configManager.isValidApiKey('test@key')).toBe(false);
      });

      it('should reject API keys with leading/trailing hyphens', () => {
        expect(configManager.isValidApiKey('-testkey')).toBe(false);
        expect(configManager.isValidApiKey('testkey-')).toBe(false);
        expect(configManager.isValidApiKey('-test-key-')).toBe(false);
      });

      it('should reject API keys with consecutive hyphens', () => {
        expect(configManager.isValidApiKey('test--key')).toBe(false);
        expect(configManager.isValidApiKey('abc--123')).toBe(false);
      });

      it('should handle empty and whitespace strings', () => {
        expect(configManager.isValidApiKey('')).toBe(false);
        expect(configManager.isValidApiKey('   ')).toBe(false);
        expect(configManager.isValidApiKey('  valid-key  ')).toBe(true); // Should trim
      });
    });

    describe('isValidGoogleSheetId', () => {
      beforeEach(() => {
        // Setup mock file
        const mockFile = {
          getMimeType: vi.fn().mockReturnValue(MimeType.GOOGLE_SHEETS),
        };
        mockDriveApp.getFileById.mockReturnValue(mockFile);
      });

      it('should return true for valid Google Sheet ID', () => {
        const result = configManager.isValidGoogleSheetId('valid-sheet-id');

        expect(mockDriveApp.getFileById).toHaveBeenCalledWith('valid-sheet-id');
        expect(result).toBe(true);
      });

      it('should return false for invalid file ID', () => {
        mockDriveApp.getFileById.mockImplementation(() => {
          throw new Error('File not found');
        });

        const result = configManager.isValidGoogleSheetId('invalid-id');

        expect(result).toBe(false);
        expect(global.console.error).toHaveBeenCalled();
      });

      it('should return false for non-sheet file', () => {
        const mockFile = {
          getMimeType: vi.fn().mockReturnValue('application/pdf'),
        };
        mockDriveApp.getFileById.mockReturnValue(mockFile);

        const result = configManager.isValidGoogleSheetId('pdf-file-id');

        expect(result).toBe(false);
      });
    });

    describe('isValidGoogleDriveFolderId', () => {
      it('should return true for valid folder ID', () => {
        const mockFolder = {};
        mockDriveApp.getFolderById.mockReturnValue(mockFolder);

        const result = configManager.isValidGoogleDriveFolderId('valid-folder-id');

        expect(mockDriveApp.getFolderById).toHaveBeenCalledWith('valid-folder-id');
        expect(result).toBe(true);
      });

      it('should return false for invalid folder ID', () => {
        mockDriveApp.getFolderById.mockImplementation(() => {
          throw new Error('Folder not found');
        });

        const result = configManager.isValidGoogleDriveFolderId('invalid-id');

        expect(result).toBe(false);
        expect(global.console.error).toHaveBeenCalled();
      });
    });

    describe('isBoolean', () => {
      it('should accept boolean values', () => {
        expect(configManager.isBoolean(true)).toBe(true);
        expect(configManager.isBoolean(false)).toBe(true);
      });

      it('should accept string boolean values', () => {
        expect(configManager.isBoolean('true')).toBe(true);
        expect(configManager.isBoolean('false')).toBe(true);
        expect(configManager.isBoolean('TRUE')).toBe(true);
        expect(configManager.isBoolean('FALSE')).toBe(true);
        expect(configManager.isBoolean('True')).toBe(true);
        expect(configManager.isBoolean('False')).toBe(true);
      });

      it('should reject non-boolean values', () => {
        expect(configManager.isBoolean('invalid')).toBe(false);
        expect(configManager.isBoolean(123)).toBe(false);
        expect(configManager.isBoolean(null)).toBe(false);
        expect(configManager.isBoolean(undefined)).toBe(false);
        expect(configManager.isBoolean({})).toBe(false);
        expect(configManager.isBoolean([])).toBe(false);
      });
    });

    describe('_validateIntegerRange', () => {
      it('should return parsed integer for valid values', () => {
        const result = configManager._validateIntegerRange('42', 'testKey', 1, 100);
        expect(result).toBe(42);
      });

      it('should accept integer at min boundary', () => {
        const result = configManager._validateIntegerRange('1', 'testKey', 1, 100);
        expect(result).toBe(1);
      });

      it('should accept integer at max boundary', () => {
        const result = configManager._validateIntegerRange('100', 'testKey', 1, 100);
        expect(result).toBe(100);
      });

      it('should throw error for values below minimum', () => {
        expect(() => {
          configManager._validateIntegerRange('0', 'testKey', 1, 100);
        }).toThrow('Test Key must be an integer between 1 and 100.');
      });

      it('should throw error for values above maximum', () => {
        expect(() => {
          configManager._validateIntegerRange('101', 'testKey', 1, 100);
        }).toThrow('Test Key must be an integer between 1 and 100.');
      });

      it('should throw error for non-integer values', () => {
        expect(() => {
          configManager._validateIntegerRange('abc', 'testKey', 1, 100);
        }).toThrow('Test Key must be an integer between 1 and 100.');
      });

      it('should throw error for floating point values', () => {
        expect(() => {
          configManager._validateIntegerRange('42.5', 'testKey', 1, 100);
        }).toThrow('Test Key must be an integer between 1 and 100.');
      });
    });

    describe('toReadableKey', () => {
      it('should convert camelCase to readable format', () => {
        expect(configManager.toReadableKey('backendAssessorBatchSize')).toBe(
          'Backend Assessor Batch Size'
        );
        expect(configManager.toReadableKey('apiKey')).toBe('Api Key');
        expect(configManager.toReadableKey('updateDetailsUrl')).toBe('Update Details Url');
      });

      it('should handle single words', () => {
        expect(configManager.toReadableKey('backend')).toBe('Backend');
      });

      it('should handle already uppercase words', () => {
        expect(configManager.toReadableKey('URL')).toBe('U R L');
      });
    });
  });

  describe('setProperty Validation', () => {
    describe('BACKEND_ASSESSOR_BATCH_SIZE validation', () => {
      it('should accept valid batch sizes', () => {
        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
            50
          );
        }).not.toThrow();

        expect(mockScriptProperties.setProperty).toHaveBeenCalledWith(
          ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
          '50'
        );
      });

      it('should accept batch size at boundaries', () => {
        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
            1
          );
        }).not.toThrow();

        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
            500
          );
        }).not.toThrow();
      });

      it('should reject batch sizes outside valid range', () => {
        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
            0
          );
        }).toThrow('Backend Assessor Batch Size must be an integer between 1 and 500.');

        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
            501
          );
        }).toThrow('Backend Assessor Batch Size must be an integer between 1 and 500.');
      });

      it('should reject non-integer values', () => {
        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
            'abc'
          );
        }).toThrow('Backend Assessor Batch Size must be an integer between 1 and 500.');
      });
    });

    describe('API_KEY validation', () => {
      it('should accept valid API keys', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, 'valid-api-key');
        }).not.toThrow();

        expect(mockScriptProperties.setProperty).toHaveBeenCalledWith(
          ConfigurationManager.CONFIG_KEYS.API_KEY,
          'valid-api-key'
        );
      });

      it('should reject invalid API keys', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, 'invalid_key');
        }).toThrow(
          'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.'
        );
      });

      it('should reject empty API keys', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, '');
        }).toThrow(
          'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.'
        );
      });

      it('should reject non-string API keys', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, 123);
        }).toThrow(
          'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.'
        );
      });
    });

    describe('URL validation', () => {
      it('should accept valid URLs for BACKEND_URL', () => {
        mockUtils.isValidUrl.mockReturnValue(true);

        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.BACKEND_URL,
            'https://example.com'
          );
        }).not.toThrow();

        expect(mockScriptProperties.setProperty).toHaveBeenCalledWith(
          ConfigurationManager.CONFIG_KEYS.BACKEND_URL,
          'https://example.com'
        );
      });

      it('should reject invalid URLs for BACKEND_URL', () => {
        mockUtils.isValidUrl.mockReturnValue(false);

        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL, 'invalid-url');
        }).toThrow('Backend Url must be a valid URL string.');
      });

      it('should accept valid URLs for UPDATE_DETAILS_URL', () => {
        mockUtils.isValidUrl.mockReturnValue(true);

        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL,
            'https://example.com/update'
          );
        }).not.toThrow();

        expect(mockScriptProperties.setProperty).toHaveBeenCalledWith(
          ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL,
          'https://example.com/update'
        );
      });

      it('should reject invalid URLs for UPDATE_DETAILS_URL', () => {
        mockUtils.isValidUrl.mockReturnValue(false);

        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL,
            'invalid-url'
          );
        }).toThrow('Update Details Url must be a valid URL string.');
      });

      it('should reject non-string URLs', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL, 123);
        }).toThrow('Backend Url must be a valid URL string.');
      });
    });

    describe('Google Sheet ID validation', () => {
      beforeEach(() => {
        // Mock isValidGoogleSheetId to return true by default
        vi.spyOn(configManager, 'isValidGoogleSheetId').mockReturnValue(true);
      });

      it('should accept valid Google Sheet ID', () => {
        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID,
            'valid-sheet-id'
          );
        }).not.toThrow();

        expect(mockScriptProperties.setProperty).toHaveBeenCalledWith(
          ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID,
          'valid-sheet-id'
        );
      });

      it('should reject invalid Google Sheet ID', () => {
        vi.spyOn(configManager, 'isValidGoogleSheetId').mockReturnValue(false);

        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID,
            'invalid-id'
          );
        }).toThrow('Assessment Record Template ID must be a valid Google Sheet ID.');
      });

      it('should reject empty string', () => {
        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID,
            ''
          );
        }).toThrow('Assessment Record Template Id must be a non-empty string.');
      });

      it('should reject whitespace-only string', () => {
        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID,
            '   '
          );
        }).toThrow('Assessment Record Template Id must be a non-empty string.');
      });
    });

    describe('Google Drive Folder ID validation', () => {
      beforeEach(() => {
        // Mock isValidGoogleDriveFolderId to return true by default
        vi.spyOn(configManager, 'isValidGoogleDriveFolderId').mockReturnValue(true);
      });

      it('should accept valid Google Drive Folder ID', () => {
        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER,
            'valid-folder-id'
          );
        }).not.toThrow();

        expect(mockScriptProperties.setProperty).toHaveBeenCalledWith(
          ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER,
          'valid-folder-id'
        );
      });

      it('should reject invalid Google Drive Folder ID', () => {
        vi.spyOn(configManager, 'isValidGoogleDriveFolderId').mockReturnValue(false);

        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER,
            'invalid-id'
          );
        }).toThrow('Assessment Record Destination Folder must be a valid Google Drive Folder ID.');
      });

      it('should reject empty string', () => {
        expect(() => {
          configManager.setProperty(
            ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER,
            ''
          );
        }).toThrow('Assessment Record Destination Folder must be a non-empty string.');
      });
    });

    describe('UPDATE_STAGE validation', () => {
      it('should accept valid update stages', () => {
        [0, 1, 2].forEach((stage) => {
          expect(() => {
            configManager.setProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE, stage);
          }).not.toThrow();

          expect(mockScriptProperties.setProperty).toHaveBeenCalledWith(
            ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE,
            stage.toString()
          );
        });
      });

      it('should reject invalid update stages', () => {
        [-1, 3, 4, 100].forEach((stage) => {
          expect(() => {
            configManager.setProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE, stage);
          }).toThrow('Update Stage must be 0, 1, or 2');
        });
      });

      it('should reject non-integer values', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE, 'abc');
        }).toThrow('Update Stage must be 0, 1, or 2');
      });

      it('should reject floating point values', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE, 1.5);
        }).toThrow('Update Stage must be 0, 1, or 2');
      });
    });

    describe('Boolean validation for document properties', () => {
      ['IS_ADMIN_SHEET', 'SCRIPT_AUTHORISED', 'REVOKE_AUTH_TRIGGER_SET'].forEach((key) => {
        describe(key, () => {
          it('should accept boolean true', () => {
            expect(() => {
              configManager.setProperty(ConfigurationManager.CONFIG_KEYS[key], true);
            }).not.toThrow();

            expect(mockDocumentProperties.setProperty).toHaveBeenCalledWith(
              ConfigurationManager.CONFIG_KEYS[key],
              'true'
            );
          });

          it('should accept boolean false', () => {
            expect(() => {
              configManager.setProperty(ConfigurationManager.CONFIG_KEYS[key], false);
            }).not.toThrow();

            expect(mockDocumentProperties.setProperty).toHaveBeenCalledWith(
              ConfigurationManager.CONFIG_KEYS[key],
              'false'
            );
          });

          it('should accept string "true"', () => {
            expect(() => {
              configManager.setProperty(ConfigurationManager.CONFIG_KEYS[key], 'true');
            }).not.toThrow();

            expect(mockDocumentProperties.setProperty).toHaveBeenCalledWith(
              ConfigurationManager.CONFIG_KEYS[key],
              'true'
            );
          });

          it('should accept string "false"', () => {
            expect(() => {
              configManager.setProperty(ConfigurationManager.CONFIG_KEYS[key], 'false');
            }).not.toThrow();

            expect(mockDocumentProperties.setProperty).toHaveBeenCalledWith(
              ConfigurationManager.CONFIG_KEYS[key],
              'false'
            );
          });

          it('should reject invalid boolean values', () => {
            expect(() => {
              configManager.setProperty(ConfigurationManager.CONFIG_KEYS[key], 'invalid');
            }).toThrow(
              `${configManager.toReadableKey(
                ConfigurationManager.CONFIG_KEYS[key]
              )} must be a boolean.`
            );
          });

          it('should reject numeric values', () => {
            expect(() => {
              configManager.setProperty(ConfigurationManager.CONFIG_KEYS[key], 123);
            }).toThrow(
              `${configManager.toReadableKey(
                ConfigurationManager.CONFIG_KEYS[key]
              )} must be a boolean.`
            );
          });
        });
      });
    });

    describe('DAYS_UNTIL_AUTH_REVOKE validation', () => {
      it('should accept valid days values', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, 30);
        }).not.toThrow();

        expect(mockScriptProperties.setProperty).toHaveBeenCalledWith(
          ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE,
          '30'
        );
      });

      it('should accept days at boundaries', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, 1);
        }).not.toThrow();

        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, 365);
        }).not.toThrow();
      });

      it('should reject days outside valid range', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, 0);
        }).toThrow('Days Until Auth Revoke must be an integer between 1 and 365.');

        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, 366);
        }).toThrow('Days Until Auth Revoke must be an integer between 1 and 365.');
      });
    });

    describe('SLIDES_FETCH_BATCH_SIZE validation', () => {
      it('should accept valid batch sizes', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE, 50);
        }).not.toThrow();

        expect(mockScriptProperties.setProperty).toHaveBeenCalledWith(
          ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE,
          '50'
        );
      });

      it('should accept batch size at boundaries', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE, 1);
        }).not.toThrow();

        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE, 100);
        }).not.toThrow();
      });

      it('should reject batch sizes outside valid range', () => {
        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE, 0);
        }).toThrow('Slides Fetch Batch Size must be an integer between 1 and 100.');

        expect(() => {
          configManager.setProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE, 101);
        }).toThrow('Slides Fetch Batch Size must be an integer between 1 and 100.');
      });
    });

    describe('Unknown properties', () => {
      it('should accept any value for unknown properties without validation', () => {
        expect(() => {
          configManager.setProperty('unknown_property', 'any_value');
        }).not.toThrow();

        expect(mockScriptProperties.setProperty).toHaveBeenCalledWith(
          'unknown_property',
          'any_value'
        );
      });

      it('should invalidate cache for unknown properties', () => {
        // Set up cache
        configManager.getAllConfigurations();
        expect(configManager.configCache).not.toBeNull();

        // Set unknown property
        configManager.setProperty('unknown_property', 'value');

        // Cache should be invalidated
        expect(configManager.configCache).toBeNull();
      });
    });
  });

  describe('Property Retrieval', () => {
    describe('getProperty', () => {
      it('should return document properties for document-stored keys', () => {
        const documentKeys = [
          ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET,
          ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET,
          ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED,
        ];

        documentKeys.forEach((key) => {
          mockDocumentProperties.getProperty.mockReturnValue('test-value');

          const result = configManager.getProperty(key);

          expect(mockDocumentProperties.getProperty).toHaveBeenCalledWith(key);
          expect(result).toBe('test-value');
        });
      });

      it('should return false for document properties when not set', () => {
        mockDocumentProperties.getProperty.mockReturnValue(null);

        const result = configManager.getProperty(ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET);

        expect(result).toBe(false);
      });

      it('should return script properties for script-stored keys', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.API_KEY]: 'test-api-key',
        });

        const result = configManager.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);

        expect(result).toBe('test-api-key');
      });

      it('should return empty string for script properties when not set', () => {
        mockScriptProperties.getProperties.mockReturnValue({});

        const result = configManager.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);

        expect(result).toBe('');
      });

      it('should use cache for subsequent calls', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.API_KEY]: 'cached-value',
        });

        // First call
        const result1 = configManager.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);
        // Second call
        const result2 = configManager.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);

        expect(mockScriptProperties.getProperties).toHaveBeenCalledTimes(1);
        expect(result1).toBe('cached-value');
        expect(result2).toBe('cached-value');
      });
    });

    describe('hasProperty', () => {
      it('should return true for existing properties', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.API_KEY]: 'test-value',
        });

        const result = configManager.hasProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);

        expect(result).toBe(true);
      });

      it('should return false for non-existing properties', () => {
        mockScriptProperties.getProperties.mockReturnValue({});

        const result = configManager.hasProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);

        expect(result).toBe(false);
      });
    });

    describe('getAllConfigurations', () => {
      it('should return all script properties', () => {
        const mockProperties = {
          [ConfigurationManager.CONFIG_KEYS.API_KEY]: 'test-key',
          [ConfigurationManager.CONFIG_KEYS.BACKEND_URL]: 'https://test.com',
        };
        mockScriptProperties.getProperties.mockReturnValue(mockProperties);

        const result = configManager.getAllConfigurations();

        expect(result).toEqual(mockProperties);
        expect(mockScriptProperties.getProperties).toHaveBeenCalled();
      });

      it('should cache the properties', () => {
        const mockProperties = { test: 'value' };
        mockScriptProperties.getProperties.mockReturnValue(mockProperties);

        // First call
        configManager.getAllConfigurations();
        // Second call
        configManager.getAllConfigurations();

        expect(mockScriptProperties.getProperties).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Getter Methods', () => {
    describe('getBackendAssessorBatchSize', () => {
      it('should return parsed integer value', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: '50',
        });

        const result = configManager.getBackendAssessorBatchSize();

        expect(result).toBe(50);
      });

      it('should return default value for invalid input', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: 'invalid',
        });

        const result = configManager.getBackendAssessorBatchSize();

        expect(result).toBe(ConfigurationManager.DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE);
      });

      it('should return default value when property not set', () => {
        mockScriptProperties.getProperties.mockReturnValue({});

        const result = configManager.getBackendAssessorBatchSize();

        expect(result).toBe(ConfigurationManager.DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE);
      });
    });

    describe('getSlidesFetchBatchSize', () => {
      it('should return parsed integer value within valid range', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: '25',
        });

        const result = configManager.getSlidesFetchBatchSize();

        expect(result).toBe(25);
      });

      it('should return default for values outside valid range', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: '150',
        });

        const result = configManager.getSlidesFetchBatchSize();

        expect(result).toBe(ConfigurationManager.DEFAULTS.SLIDES_FETCH_BATCH_SIZE);
      });

      it('should return default for invalid input', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: 'invalid',
        });

        const result = configManager.getSlidesFetchBatchSize();

        expect(result).toBe(ConfigurationManager.DEFAULTS.SLIDES_FETCH_BATCH_SIZE);
      });

      it('should accept boundary values', () => {
        // Test minimum boundary
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: '1',
        });
        expect(configManager.getSlidesFetchBatchSize()).toBe(1);

        // Test maximum boundary
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: '100',
        });
        expect(configManager.getSlidesFetchBatchSize()).toBe(100);
      });
    });

    describe('getApiKey', () => {
      it('should return stored API key', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.API_KEY]: 'test-api-key',
        });

        const result = configManager.getApiKey();

        expect(result).toBe('test-api-key');
      });

      it('should return empty string when not set', () => {
        mockScriptProperties.getProperties.mockReturnValue({});

        const result = configManager.getApiKey();

        expect(result).toBe('');
      });
    });

    describe('getBackendUrl', () => {
      it('should return stored backend URL', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.BACKEND_URL]: 'https://api.example.com',
        });

        const result = configManager.getBackendUrl();

        expect(result).toBe('https://api.example.com');
      });

      it('should return empty string when not set', () => {
        mockScriptProperties.getProperties.mockReturnValue({});

        const result = configManager.getBackendUrl();

        expect(result).toBe('');
      });
    });

    describe('getRevokeAuthTriggerSet', () => {
      it('should return true for string "true"', () => {
        mockDocumentProperties.getProperty.mockReturnValue('true');

        const result = configManager.getRevokeAuthTriggerSet();

        expect(result).toBe(true);
      });

      it('should return false for string "false"', () => {
        mockDocumentProperties.getProperty.mockReturnValue('false');

        const result = configManager.getRevokeAuthTriggerSet();

        expect(result).toBe(false);
      });

      it('should return false for other values', () => {
        mockDocumentProperties.getProperty.mockReturnValue('invalid');

        const result = configManager.getRevokeAuthTriggerSet();

        expect(result).toBe(false);
      });

      it('should return false when not set', () => {
        mockDocumentProperties.getProperty.mockReturnValue(false);

        const result = configManager.getRevokeAuthTriggerSet();

        expect(result).toBe(false);
      });
    });

    describe('getDaysUntilAuthRevoke', () => {
      it('should return parsed integer value', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: '90',
        });

        const result = configManager.getDaysUntilAuthRevoke();

        expect(result).toBe(90);
      });

      it('should return default value for invalid input', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: 'invalid',
        });

        const result = configManager.getDaysUntilAuthRevoke();

        expect(result).toBe(ConfigurationManager.DEFAULTS.DAYS_UNTIL_AUTH_REVOKE);
      });

      it('should return default value when not set', () => {
        mockScriptProperties.getProperties.mockReturnValue({});

        const result = configManager.getDaysUntilAuthRevoke();

        expect(result).toBe(ConfigurationManager.DEFAULTS.DAYS_UNTIL_AUTH_REVOKE);
      });
    });

    describe('getUpdateDetailsUrl', () => {
      it('should return stored URL', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL]: 'https://custom.example.com',
        });

        const result = configManager.getUpdateDetailsUrl();

        expect(result).toBe('https://custom.example.com');
      });

      it('should return default URL when not set', () => {
        mockScriptProperties.getProperties.mockReturnValue({});

        const result = configManager.getUpdateDetailsUrl();

        expect(result).toBe(ConfigurationManager.DEFAULTS.UPDATE_DETAILS_URL);
      });
    });

    describe('getUpdateStage', () => {
      it('should return parsed integer value', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE]: '2',
        });

        const result = configManager.getUpdateStage();

        expect(result).toBe(2);
      });

      it('should return default value for invalid input', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE]: 'invalid',
        });

        const result = configManager.getUpdateStage();

        expect(result).toBe(ConfigurationManager.DEFAULTS.UPDATE_STAGE);
      });

      it('should return default value when not set', () => {
        mockScriptProperties.getProperties.mockReturnValue({});

        const result = configManager.getUpdateStage();

        expect(result).toBe(ConfigurationManager.DEFAULTS.UPDATE_STAGE);
      });
    });

    describe('getAssessmentRecordTemplateId', () => {
      it('should return stored template ID', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID]: 'template-123',
        });

        const result = configManager.getAssessmentRecordTemplateId();

        expect(result).toBe('template-123');
      });

      it('should return empty string when not set', () => {
        mockScriptProperties.getProperties.mockReturnValue({});

        const result = configManager.getAssessmentRecordTemplateId();

        expect(result).toBe('');
      });
    });

    describe('getAssessmentRecordDestinationFolder', () => {
      beforeEach(() => {
        mockUtils.validateIsAdminSheet.mockReturnValue(true);
      });

      it('should return stored folder ID when available', () => {
        mockScriptProperties.getProperties.mockReturnValue({
          [ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER]: 'folder-123',
        });

        const result = configManager.getAssessmentRecordDestinationFolder();

        expect(result).toBe('folder-123');
      });

      it('should create new folder when not set', () => {
        mockScriptProperties.getProperties.mockReturnValue({});
        mockDriveManager.getParentFolderId.mockReturnValue('parent-folder-id');
        mockDriveManager.createFolder.mockReturnValue({ newFolderId: 'new-folder-id' });

        const result = configManager.getAssessmentRecordDestinationFolder();

        expect(mockDriveManager.getParentFolderId).toHaveBeenCalledWith('test-spreadsheet-id');
        expect(mockDriveManager.createFolder).toHaveBeenCalledWith(
          'parent-folder-id',
          'Assessment Records'
        );
        expect(result).toBe('new-folder-id');
      });

      it('should return undefined when not admin sheet', () => {
        mockUtils.validateIsAdminSheet.mockReturnValue(false);

        const result = configManager.getAssessmentRecordDestinationFolder();

        expect(result).toBeUndefined();
      });
    });

    describe('getIsAdminSheet', () => {
      it('should return stored value', () => {
        mockDocumentProperties.getProperty.mockReturnValue('true');

        const result = configManager.getIsAdminSheet();

        expect(result).toBe('true');
      });

      it('should return false when not set', () => {
        mockDocumentProperties.getProperty.mockReturnValue(null);

        const result = configManager.getIsAdminSheet();

        expect(result).toBe(false);
      });
    });

    describe('getScriptAuthorised', () => {
      it('should return true for string "true"', () => {
        mockDocumentProperties.getProperty.mockReturnValue('true');

        const result = configManager.getScriptAuthorised();

        expect(result).toBe(true);
      });

      it('should return false for string "false"', () => {
        mockDocumentProperties.getProperty.mockReturnValue('false');

        const result = configManager.getScriptAuthorised();

        expect(result).toBe(false);
      });

      it('should return false for other values', () => {
        mockDocumentProperties.getProperty.mockReturnValue('invalid');

        const result = configManager.getScriptAuthorised();

        expect(result).toBe(false);
      });

      it('should return false when not set', () => {
        mockDocumentProperties.getProperty.mockReturnValue(false);

        const result = configManager.getScriptAuthorised();

        expect(result).toBe(false);
      });
    });
  });

  describe('Setter Methods', () => {
    it('should delegate to setProperty for all setters', () => {
      const setPropertySpy = vi.spyOn(configManager, 'setProperty');

      // Test all setter methods
      configManager.setBackendAssessorBatchSize(100);
      expect(setPropertySpy).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
        100
      );

      configManager.setSlidesFetchBatchSize(50);
      expect(setPropertySpy).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE,
        50
      );

      configManager.setApiKey('test-key');
      expect(setPropertySpy).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.API_KEY,
        'test-key'
      );

      configManager.setBackendUrl('https://example.com');
      expect(setPropertySpy).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.BACKEND_URL,
        'https://example.com'
      );

      configManager.setAssessmentRecordTemplateId('template-id');
      expect(setPropertySpy).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID,
        'template-id'
      );

      configManager.setAssessmentRecordDestinationFolder('folder-id');
      expect(setPropertySpy).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER,
        'folder-id'
      );

      configManager.setUpdateDetailsUrl('https://update.example.com');
      expect(setPropertySpy).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL,
        'https://update.example.com'
      );

      configManager.setUpdateStage(1);
      expect(setPropertySpy).toHaveBeenCalledWith(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE, 1);

      configManager.setRevokeAuthTriggerSet(true);
      expect(setPropertySpy).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET,
        true
      );

      configManager.setDaysUntilAuthRevoke(30);
      expect(setPropertySpy).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE,
        30
      );

      configManager.setScriptAuthorised(true);
      expect(setPropertySpy).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED,
        true
      );
    });

    describe('setIsAdminSheet', () => {
      it('should convert value to boolean and delegate to setProperty', () => {
        const setPropertySpy = vi.spyOn(configManager, 'setProperty');

        configManager.setIsAdminSheet('true');
        expect(setPropertySpy).toHaveBeenCalledWith(
          ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET,
          true
        );

        configManager.setIsAdminSheet(0);
        expect(setPropertySpy).toHaveBeenCalledWith(
          ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET,
          false
        );

        configManager.setIsAdminSheet('non-empty-string');
        expect(setPropertySpy).toHaveBeenCalledWith(
          ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET,
          true
        );
      });
    });
  });

  describe('maybeDeserializeProperties', () => {
    beforeEach(() => {
      // Mock getIsAdminSheet to return true by default
      vi.spyOn(configManager, 'getIsAdminSheet').mockReturnValue(true);
    });

    it('should not deserialize when script properties exist', () => {
      mockScriptProperties.getKeys.mockReturnValue(['existing-key']);
      mockDocumentProperties.getKeys.mockReturnValue([]);

      configManager.maybeDeserializeProperties();

      expect(mockPropertiesCloner).not.toHaveBeenCalled();
    });

    it('should not deserialize when document properties exist', () => {
      mockScriptProperties.getKeys.mockReturnValue([]);
      mockDocumentProperties.getKeys.mockReturnValue(['existing-key']);

      configManager.maybeDeserializeProperties();

      expect(mockPropertiesCloner).not.toHaveBeenCalled();
    });

    it('should attempt to deserialize when no properties exist', () => {
      mockScriptProperties.getKeys.mockReturnValue([]);
      mockDocumentProperties.getKeys.mockReturnValue([]);

      const mockCloner = {
        sheet: { name: 'propertiesStore' },
        deserialiseProperties: vi.fn(),
      };
      mockPropertiesCloner.mockImplementation(() => mockCloner);

      configManager.maybeDeserializeProperties();

      expect(mockPropertiesCloner).toHaveBeenCalled();
      expect(mockCloner.deserialiseProperties).toHaveBeenCalled();
      expect(global.console.log).toHaveBeenCalledWith(
        'Successfully copied properties from propertiesStore'
      );
    });

    it('should log message when no propertiesStore sheet found', () => {
      mockScriptProperties.getKeys.mockReturnValue([]);
      mockDocumentProperties.getKeys.mockReturnValue([]);

      const mockCloner = {
        sheet: null,
        deserialiseProperties: vi.fn(),
      };
      mockPropertiesCloner.mockImplementation(() => mockCloner);

      configManager.maybeDeserializeProperties();

      expect(global.console.log).toHaveBeenCalledWith('No propertiesStore sheet found');
      expect(mockCloner.deserialiseProperties).not.toHaveBeenCalled();
    });

    it('should handle errors during deserialization', () => {
      mockScriptProperties.getKeys.mockReturnValue([]);
      mockDocumentProperties.getKeys.mockReturnValue([]);

      mockPropertiesCloner.mockImplementation(() => {
        throw new Error('Test error');
      });

      configManager.maybeDeserializeProperties();

      expect(global.console.error).toHaveBeenCalledWith(
        'Error initializing properties:',
        expect.any(Error)
      );
    });

    it('should skip script properties check when not admin sheet', () => {
      vi.spyOn(configManager, 'getIsAdminSheet').mockReturnValue(false);
      mockDocumentProperties.getKeys.mockReturnValue([]);

      configManager.maybeDeserializeProperties();

      expect(mockScriptProperties.getKeys).not.toHaveBeenCalled();
      expect(mockPropertiesCloner).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache when setting script properties', () => {
      // Set up cache
      configManager.getAllConfigurations();
      expect(configManager.configCache).not.toBeNull();

      // Set a script property
      configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, 'test-key');

      // Cache should be invalidated
      expect(configManager.configCache).toBeNull();
    });

    it('should not invalidate cache when setting document properties', () => {
      // Set up cache
      configManager.getAllConfigurations();
      const cache = configManager.configCache;

      // Set a document property
      configManager.setProperty(ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET, true);

      // Cache should not be invalidated for document properties
      expect(configManager.configCache).toBe(cache);
    });
  });
});
