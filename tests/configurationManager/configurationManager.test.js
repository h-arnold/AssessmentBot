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

describe('shared backend test mocks', () => {
  it('should not expose deprecated validateIsAdminSheet on Utils mocks', () => {
    expect(mocks.Utils).not.toHaveProperty('validateIsAdminSheet');
  });
});

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

describe('ConfigurationManager default backend configuration bootstrap', () => {
  let configManager;

  beforeEach(() => {
    vi.clearAllMocks();
    ConfigurationManager.resetForTests();

    mocks.PropertiesService.documentProperties.getProperty.mockReturnValue(false);
    mocks.PropertiesService.scriptProperties.getProperty.mockReturnValue(null);
    mocks.Utils.isValidUrl.mockReturnValue(true);

    configManager = new ConfigurationManager(true);
    configManager.scriptProperties = mocks.PropertiesService.scriptProperties;
    configManager.documentProperties = mocks.PropertiesService.documentProperties;
    configManager._initialized = true;
    configManager.configCache = null;
  });

  it('seeds the default backend configuration once when the config store is empty', () => {
    const result = configManager.ensureDefaultConfiguration();

    expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledTimes(8);
    expect(
      JSON.parse(mocks.PropertiesService.scriptProperties.setProperty.mock.calls.at(-1)[1])
    ).toEqual({
      [ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: String(
        ConfigurationManager.DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE
      ),
      [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: String(
        ConfigurationManager.DEFAULTS.SLIDES_FETCH_BATCH_SIZE
      ),
      [ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'false',
      [ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: String(
        ConfigurationManager.DEFAULTS.DAYS_UNTIL_AUTH_REVOKE
      ),
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY]:
        ConfigurationManager.DEFAULTS.JSON_DB_MASTER_INDEX_KEY,
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS]: String(
        ConfigurationManager.DEFAULTS.JSON_DB_LOCK_TIMEOUT_MS
      ),
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL]:
        ConfigurationManager.DEFAULTS.JSON_DB_LOG_LEVEL,
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE]: String(
        ConfigurationManager.DEFAULTS.JSON_DB_BACKUP_ON_INITIALISE
      ),
    });
    expect(result).toEqual({
      [ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: String(
        ConfigurationManager.DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE
      ),
      [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: String(
        ConfigurationManager.DEFAULTS.SLIDES_FETCH_BATCH_SIZE
      ),
      [ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'false',
      [ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: String(
        ConfigurationManager.DEFAULTS.DAYS_UNTIL_AUTH_REVOKE
      ),
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY]:
        ConfigurationManager.DEFAULTS.JSON_DB_MASTER_INDEX_KEY,
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS]: String(
        ConfigurationManager.DEFAULTS.JSON_DB_LOCK_TIMEOUT_MS
      ),
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL]:
        ConfigurationManager.DEFAULTS.JSON_DB_LOG_LEVEL,
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE]: String(
        ConfigurationManager.DEFAULTS.JSON_DB_BACKUP_ON_INITIALISE
      ),
    });
    expect(configManager.getJsonDbRootFolderId()).toBe(
      ConfigurationManager.DEFAULTS.JSON_DB_ROOT_FOLDER_ID
    );
    expect(configManager.getApiKey()).toBe('');
    expect(configManager.getBackendUrl()).toBe('');
  });

  it('does not seed defaults when backend configuration already exists', () => {
    const existingConfig = {
      [ConfigurationManager.CONFIG_KEYS.API_KEY]: 'live-secret-7890',
      [ConfigurationManager.CONFIG_KEYS.BACKEND_URL]: 'https://backend.example.test',
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY]: 'EXISTING_MASTER_INDEX',
    };
    mocks.PropertiesService.scriptProperties.getProperty.mockReturnValue(
      JSON.stringify(existingConfig)
    );

    const result = configManager.ensureDefaultConfiguration();

    expect(mocks.PropertiesService.scriptProperties.setProperty).not.toHaveBeenCalled();
    expect(result).toEqual(existingConfig);
    expect(configManager.getApiKey()).toBe('live-secret-7890');
    expect(configManager.getBackendUrl()).toBe('https://backend.example.test');
  });
});

describe('ConfigurationManager getter and helper behaviour', () => {
  let configManager;

  beforeEach(() => {
    vi.clearAllMocks();
    ConfigurationManager.resetForTests();

    mocks.PropertiesService.documentProperties.getProperty.mockReturnValue(false);
    mocks.PropertiesService.scriptProperties.getProperty.mockReturnValue(null);
    mocks.Utils.isValidUrl.mockReturnValue(true);

    configManager = new ConfigurationManager(true);
    configManager.scriptProperties = mocks.PropertiesService.scriptProperties;
    configManager.documentProperties = mocks.PropertiesService.documentProperties;
    configManager._initialized = true;
    configManager.configCache = null;
  });

  it('reads typed configuration values from the persisted store', () => {
    const storedConfig = {
      [ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: '42',
      [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: '24',
      [ConfigurationManager.CONFIG_KEYS.API_KEY]: 'live-secret-7890',
      [ConfigurationManager.CONFIG_KEYS.BACKEND_URL]: 'https://backend.example.test',
      [ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'true',
      [ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: '15',
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY]: 'MASTER_INDEX_X',
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS]: '20000',
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL]: 'warn',
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE]: 'true',
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID]: ' folder-123 ',
    };

    mocks.PropertiesService.scriptProperties.getProperty.mockReturnValue(
      JSON.stringify(storedConfig)
    );

    expect(configManager.getBackendAssessorBatchSize()).toBe(42);
    expect(configManager.getSlidesFetchBatchSize()).toBe(24);
    expect(configManager.getApiKey()).toBe('live-secret-7890');
    expect(configManager.getBackendUrl()).toBe('https://backend.example.test');
    expect(configManager.getRevokeAuthTriggerSet()).toBe(true);
    expect(configManager.getDaysUntilAuthRevoke()).toBe(15);
    expect(configManager.getJsonDbMasterIndexKey()).toBe('MASTER_INDEX_X');
    expect(configManager.getJsonDbLockTimeoutMs()).toBe(20000);
    expect(configManager.getJsonDbLogLevel()).toBe('WARN');
    expect(configManager.getJsonDbBackupOnInitialise()).toBe(true);
    expect(configManager.getJsonDbRootFolderId()).toBe('folder-123');
    expect(configManager.hasProperty(ConfigurationManager.CONFIG_KEYS.API_KEY)).toBe(true);
    expect(configManager.hasProperty('missing')).toBe(false);
  });

  it('falls back to defaults for blank or invalid stored values', () => {
    const storedConfig = {
      [ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: 'abc',
      [ConfigurationManager.CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: '0',
      [ConfigurationManager.CONFIG_KEYS.API_KEY]: '',
      [ConfigurationManager.CONFIG_KEYS.BACKEND_URL]: '',
      [ConfigurationManager.CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: '',
      [ConfigurationManager.CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: '999',
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY]: '',
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS]: '999',
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL]: '',
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE]: '',
      [ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID]: '   ',
    };

    mocks.PropertiesService.scriptProperties.getProperty.mockReturnValue(
      JSON.stringify(storedConfig)
    );

    expect(configManager.getBackendAssessorBatchSize()).toBe(
      ConfigurationManager.DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE
    );
    expect(configManager.getSlidesFetchBatchSize()).toBe(
      ConfigurationManager.DEFAULTS.SLIDES_FETCH_BATCH_SIZE
    );
    expect(configManager.getApiKey()).toBe('');
    expect(configManager.getBackendUrl()).toBe('');
    expect(configManager.getRevokeAuthTriggerSet()).toBe(false);
    expect(configManager.getDaysUntilAuthRevoke()).toBe(
      ConfigurationManager.DEFAULTS.DAYS_UNTIL_AUTH_REVOKE
    );
    expect(configManager.getJsonDbMasterIndexKey()).toBe(
      ConfigurationManager.DEFAULTS.JSON_DB_MASTER_INDEX_KEY
    );
    expect(configManager.getJsonDbLockTimeoutMs()).toBe(
      ConfigurationManager.DEFAULTS.JSON_DB_LOCK_TIMEOUT_MS
    );
    expect(configManager.getJsonDbLogLevel()).toBe(ConfigurationManager.DEFAULTS.JSON_DB_LOG_LEVEL);
    expect(configManager.getJsonDbBackupOnInitialise()).toBe(
      ConfigurationManager.DEFAULTS.JSON_DB_BACKUP_ON_INITIALISE
    );
    expect(configManager.getJsonDbRootFolderId()).toBe(
      ConfigurationManager.DEFAULTS.JSON_DB_ROOT_FOLDER_ID
    );
  });

  it('converts values with the static boolean helpers', () => {
    expect(ConfigurationManager.toBoolean(true)).toBe(true);
    expect(ConfigurationManager.toBoolean(0)).toBe(false);
    expect(ConfigurationManager.toBooleanString('yes')).toBe('true');
    expect(ConfigurationManager.toBooleanString('')).toBe('false');
  });
});
