import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupGlobalGASMocks } from '../helpers/mockFactories.js';

// Set up global mocks using helper (once at module level)
let mocks;

beforeEach(() => {
  // Create fresh GAS mocks for each test
  mocks = setupGlobalGASMocks(vi, { mockConsole: true });
});

// Import the class after setting up mocks
const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

function expectPersistedConfig(mocks_, expectedConfig) {
  expect(mocks_.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
    ConfigurationManager.CONFIG_STORE_KEY,
    JSON.stringify(expectedConfig)
  );
}

describe('ConfigurationManager setProperty', () => {
  let configManager;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset singleton instance
    ConfigurationManager.resetForTests();

    // Setup default mock returns
    mocks.PropertiesService.documentProperties.getProperty.mockReturnValue(false);
    mocks.PropertiesService.scriptProperties.getProperty.mockReturnValue(null);
    mocks.Utils.isValidUrl.mockReturnValue(true);

    configManager = new ConfigurationManager(true);

    // Manually inject the mock properties services to ensure the test spies work
    configManager.scriptProperties = mocks.PropertiesService.scriptProperties;
    configManager.documentProperties = mocks.PropertiesService.documentProperties;
    configManager._initialized = true; // Mark as initialized to skip ensureInitialized's service calls
  });

  describe('BACKEND_ASSESSOR_BATCH_SIZE validation', () => {
    it('should accept valid batch size within range', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE,
          120
        );
      }).not.toThrow();

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: '120',
      });
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

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: '50',
      });
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

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: '60',
      });
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

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.API_KEY]: 'sk-abc123',
      });
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

  describe('URL validation (BACKEND_URL)', () => {
    it('should accept valid URL for BACKEND_URL', () => {
      mocks.Utils.isValidUrl.mockReturnValue(true);

      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.BACKEND_URL,
          'https://example.com'
        );
      }).not.toThrow();

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.BACKEND_URL]: 'https://example.com',
      });
    });

    it('should reject invalid URL for BACKEND_URL', () => {
      mocks.Utils.isValidUrl.mockReturnValue(false);

      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_URL, 'invalid-url');
      }).toThrow('Backend Url must be a valid URL string');
    });
  });

  describe('Boolean properties (REVOKE_AUTH_TRIGGER_SET)', () => {
    it('should accept string "true" for REVOKE_AUTH_TRIGGER_SET', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET, 'true');
      }).not.toThrow();

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'true',
      });
    });

    it('should reject invalid boolean values', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET,
          'invalid'
        );
      }).toThrow(/must be a boolean \(true\/false\)/);
    });

    it('should reject numeric values for boolean properties', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET, 123);
      }).toThrow(/must be a boolean \(true\/false\)/);
    });
  });

  describe('JSON DB configuration validations', () => {
    it('should accept valid master index key', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY,
          'MASTER_INDEX'
        );
      }).not.toThrow();

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY]: 'MASTER_INDEX',
      });
    });

    it('should reject empty master index key', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY, '');
      }).toThrow('JSON DB Master Index Key must be a non-empty string.');
    });

    it('should accept valid lock timeout within range', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS, 2000);
      }).not.toThrow();

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS]: '2000',
      });
    });

    it('should reject lock timeout below minimum', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS, 500);
      }).toThrow('JSON DB Lock Timeout (ms) must be an integer between 1000 and 600000.');
    });

    it('should normalise log level to uppercase', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL, 'debug');
      }).not.toThrow();

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL]: 'DEBUG',
      });
    });

    it('should reject invalid log level', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL, 'TRACE');
      }).toThrow('JSON DB Log Level must be one of: DEBUG, INFO, WARN, ERROR');
    });

    it('should accept boolean for backup on initialise', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE,
          'true'
        );
      }).not.toThrow();

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE]: 'true',
      });
    });

    it('should reject invalid value for backup on initialise', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE,
          'yes'
        );
      }).toThrow('JSON DB Backup On Initialise must be a boolean (true/false).');
    });

    it('should accept valid JSON DB root folder id', () => {
      const driveSpy = vi.spyOn(configManager, 'isValidGoogleDriveFolderId').mockReturnValue(true);

      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID,
          'folder-id-123'
        );
      }).not.toThrow();

      expect(driveSpy).toHaveBeenCalledWith('folder-id-123');
      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID]: 'folder-id-123',
      });

      driveSpy.mockRestore();
    });

    it('should allow clearing JSON DB root folder id with blank input', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID, '   ');
      }).not.toThrow();

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID]: '',
      });
    });

    it('should reject invalid JSON DB root folder id', () => {
      const driveSpy = vi.spyOn(configManager, 'isValidGoogleDriveFolderId').mockReturnValue(false);

      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID,
          'invalid-id'
        );
      }).toThrow('JSON DB Root Folder ID must be a valid Google Drive Folder ID.');

      driveSpy.mockRestore();
    });
  });

  describe('Default case (unknown properties)', () => {
    it('should accept any value for unknown properties without validation', () => {
      expect(() => {
        configManager.setProperty('unknown_property', 'any_value');
      }).not.toThrow();

      expectPersistedConfig(mocks, {
        unknown_property: 'any_value',
      });
    });

    it('should update cache for unknown properties', () => {
      configManager.configCache = { some: 'cache' };

      configManager.setProperty('unknown_property', 'value');

      expect(configManager.configCache).toEqual({ some: 'cache', unknown_property: 'value' });
    });
  });

  describe('Cache updates', () => {
    it('should update the in-memory cache after setting any script property', () => {
      configManager.configCache = { some: 'cache' };

      configManager.setProperty(ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE, 120);

      expect(configManager.configCache).toEqual({
        some: 'cache',
        [ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: '120',
      });
    });

    it('should update the in-memory cache for REVOKE_AUTH_TRIGGER_SET', () => {
      configManager.configCache = { some: 'cache' };

      configManager.setProperty(ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET, true);

      expect(configManager.configCache).toEqual({
        some: 'cache',
        [ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'true',
      });
    });
  });
});
