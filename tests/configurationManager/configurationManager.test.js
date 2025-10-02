import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupGlobalGASMocks } from '../helpers/mockFactories.js';

// Set up global mocks using helper
const mocks = setupGlobalGASMocks(vi, { mockConsole: true });

// Import the class after setting up mocks
const ConfigurationManager = require('../../src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js');

describe('ConfigurationManager setProperty', () => {
  let configManager;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset singleton instance
    ConfigurationManager.instance = null;

    // Setup default mock returns
    mocks.PropertiesService.documentProperties.getProperty.mockReturnValue(false);
    mocks.Utils.isValidUrl.mockReturnValue(true);
    mocks.Utils.validateIsAdminSheet.mockReturnValue(true);

    configManager = new ConfigurationManager();
  });

  describe('BACKEND_ASSESSOR_BATCH_SIZE validation', () => {
    it('should accept valid batch size within range', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
          120
        );
      }).not.toThrow();

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
        '120'
      );
    });

    it('should reject batch size below minimum', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE, 0);
      }).toThrow('Backend Assessor Batch Size must be an integer between 1 and 500');
    });

    it('should reject batch size above maximum', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
          501
        );
      }).toThrow('Backend Assessor Batch Size must be an integer between 1 and 500');
    });

    it('should reject non-integer values', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
          'abc'
        );
      }).toThrow('Backend Assessor Batch Size must be an integer between 1 and 500');
    });
  });

  describe('SLIDES_FETCH_BATCH_SIZE validation', () => {
    it('should accept valid batch size within range', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE, 50);
      }).not.toThrow();

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE,
        '50'
      );
    });

    it('should reject batch size below minimum', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE, 0);
      }).toThrow('Slides Fetch Batch Size must be an integer between 1 and 100');
    });

    it('should reject batch size above maximum', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE, 101);
      }).toThrow('Slides Fetch Batch Size must be an integer between 1 and 100');
    });
  });

  describe('DAYS_UNTIL_AUTH_REVOKE validation', () => {
    it('should accept valid days within range', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, 60);
      }).not.toThrow();

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE,
        '60'
      );
    });

    it('should reject days below minimum', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, 0);
      }).toThrow('Days Until Auth Revoke must be an integer between 1 and 365');
    });

    it('should reject days above maximum', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE, 366);
      }).toThrow('Days Until Auth Revoke must be an integer between 1 and 365');
    });
  });

  describe('API_KEY validation', () => {
    it('should accept valid API key', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, 'sk-abc123');
      }).not.toThrow();

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.API_KEY,
        'sk-abc123'
      );
    });

    it('should reject invalid API key', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, 'invalid-key-');
      }).toThrow('API Key must be a valid string of alphanumeric characters and hyphens');
    });

    it('should reject non-string API key', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, 123);
      }).toThrow('API Key must be a valid string of alphanumeric characters and hyphens');
    });
  });

  describe('URL validation (BACKEND_URL, UPDATE_DETAILS_URL)', () => {
    it('should accept valid URL for BACKEND_URL', () => {
      mocks.Utils.isValidUrl.mockReturnValue(true);

      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.BACKEND_URL,
          'https://example.com'
        );
      }).not.toThrow();

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.BACKEND_URL,
        'https://example.com'
      );
    });

    it('should reject invalid URL for BACKEND_URL', () => {
      mocks.Utils.isValidUrl.mockReturnValue(false);

      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL, 'invalid-url');
      }).toThrow('Backend Url must be a valid URL string');
    });

    it('should accept valid URL for UPDATE_DETAILS_URL', () => {
      mocks.Utils.isValidUrl.mockReturnValue(true);

      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL,
          'https://example.com/update'
        );
      }).not.toThrow();

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL,
        'https://example.com/update'
      );
    });

    it('should reject invalid URL for UPDATE_DETAILS_URL', () => {
      mocks.Utils.isValidUrl.mockReturnValue(false);

      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.UPDATE_DETAILS_URL,
          'invalid-url'
        );
      }).toThrow('Update Details Url must be a valid URL string');
    });
  });

  describe('Google Sheet ID validation (ASSESSMENT_RECORD_TEMPLATE_ID)', () => {
    beforeEach(() => {
      // Mock the isValidGoogleSheetId method
      vi.spyOn(configManager, 'isValidGoogleSheetId').mockReturnValue(true);
    });

    it('should accept valid non-empty string with valid Google Sheet ID', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID,
          'valid-sheet-id'
        );
      }).not.toThrow();

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID,
        'valid-sheet-id'
      );
    });

    it('should reject empty string', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID,
          ''
        );
      }).toThrow('Assessment Record Template Id must be a non-empty string');
    });

    it('should reject string with only whitespace', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID,
          '   '
        );
      }).toThrow('Assessment Record Template Id must be a non-empty string');
    });

    it('should reject invalid Google Sheet ID', () => {
      configManager.isValidGoogleSheetId.mockReturnValue(false);

      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID,
          'invalid-id'
        );
      }).toThrow('Assessment Record Template ID must be a valid Google Sheet ID');
    });
  });

  describe('Google Drive Folder ID validation (ASSESSMENT_RECORD_DESTINATION_FOLDER)', () => {
    beforeEach(() => {
      // Mock the isValidGoogleDriveFolderId method
      vi.spyOn(configManager, 'isValidGoogleDriveFolderId').mockReturnValue(true);
    });

    it('should accept valid non-empty string with valid Google Drive Folder ID', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER,
          'valid-folder-id'
        );
      }).not.toThrow();

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER,
        'valid-folder-id'
      );
    });

    it('should reject empty string', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER,
          ''
        );
      }).toThrow('Assessment Record Destination Folder must be a non-empty string');
    });

    it('should reject invalid Google Drive Folder ID', () => {
      configManager.isValidGoogleDriveFolderId.mockReturnValue(false);

      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER,
          'invalid-id'
        );
      }).toThrow('Assessment Record Destination Folder must be a valid Google Drive Folder ID');
    });
  });

  describe('UPDATE_STAGE validation', () => {
    it('should accept valid stage 0', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE, 0);
      }).not.toThrow();

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE,
        '0'
      );
    });

    it('should accept valid stage 1', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE, 1);
      }).not.toThrow();

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE,
        '1'
      );
    });

    it('should accept valid stage 2', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE, 2);
      }).not.toThrow();

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE,
        '2'
      );
    });

    it('should reject stage below 0', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE, -1);
      }).toThrow('Update Stage must be 0, 1, or 2');
    });

    it('should reject stage above 2', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE, 3);
      }).toThrow('Update Stage must be 0, 1, or 2');
    });

    it('should reject non-integer stage', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.UPDATE_STAGE, 'abc');
      }).toThrow('Update Stage must be 0, 1, or 2');
    });
  });

  describe('Boolean properties (IS_ADMIN_SHEET, SCRIPT_AUTHORISED, REVOKE_AUTH_TRIGGER_SET)', () => {
    it('should accept boolean true for IS_ADMIN_SHEET and store in document properties', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET, true);
      }).not.toThrow();

      expect(mocks.PropertiesService.documentProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET,
        'true'
      );

      // Should return early and not call script properties
      expect(mocks.PropertiesService.scriptProperties.setProperty).not.toHaveBeenCalled();
    });

    it('should accept boolean false for SCRIPT_AUTHORISED and store in document properties', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED, false);
      }).not.toThrow();

      expect(mocks.PropertiesService.documentProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED,
        'false'
      );
    });

    it('should accept string "true" for REVOKE_AUTH_TRIGGER_SET', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET, 'true');
      }).not.toThrow();

      expect(mocks.PropertiesService.documentProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET,
        'true'
      );
    });

    it('should accept string "false" for IS_ADMIN_SHEET', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET, 'false');
      }).not.toThrow();

      expect(mocks.PropertiesService.documentProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET,
        'false'
      );
    });

    it('should reject invalid boolean values', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET, 'invalid');
      }).toThrow(/must be a boolean \(true\/false\)/);
    });

    it('should reject numeric values', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.SCRIPT_AUTHORISED, 123);
      }).toThrow(/must be a boolean \(true\/false\)/);
    });
  });

  describe('Default case (unknown properties)', () => {
    it('should accept any value for unknown properties without validation', () => {
      expect(() => {
        configManager.setProperty('unknown_property', 'any_value');
      }).not.toThrow();

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        'unknown_property',
        'any_value'
      );
    });

    it('should invalidate cache for unknown properties', () => {
      configManager.configCache = { some: 'cache' };

      configManager.setProperty('unknown_property', 'value');

      expect(configManager.configCache).toBeNull();
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate cache after setting any script property', () => {
      configManager.configCache = { some: 'cache' };

      configManager.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE, 120);

      expect(configManager.configCache).toBeNull();
    });

    it('should not invalidate cache for document properties that return early', () => {
      configManager.configCache = { some: 'cache' };

      configManager.setProperty(ConfigurationManager.CONFIG_KEYS.IS_ADMIN_SHEET, true);

      // Cache should still be intact since the method returns early for document properties
      expect(configManager.configCache).toEqual({ some: 'cache' });
    });
  });
});
