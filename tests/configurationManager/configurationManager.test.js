import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupGlobalGASMocks } from '../helpers/mockFactories.js';
const {
  CONFIG_KEYS: CONFIG_MANAGER_CONFIG_KEYS,
  CONFIG_SCHEMA: CONFIG_MANAGER_CONFIG_SCHEMA,
} = require('../../src/backend/ConfigurationManager/01_configKeysAndSchema.js');
const {
  DEFAULTS: CONFIG_MANAGER_DEFAULTS,
} = require('../../src/backend/ConfigurationManager/02_defaults.js');

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

describe('ConfigurationManager internal helper branches', () => {
  let configManager;

  function withTemporaryStatics(statics, globals, callback) {
    const originals = {};
    const globalOriginals = {};

    for (const [key, value] of Object.entries(statics)) {
      originals[key] = ConfigurationManager[key];
      ConfigurationManager[key] = value;
    }

    for (const [key, value] of Object.entries(globals || {})) {
      globalOriginals[key] = globalThis[key];
      globalThis[key] = value;
    }

    try {
      callback();
    } finally {
      for (const [key, value] of Object.entries(originals)) {
        ConfigurationManager[key] = value;
      }
      for (const [key, value] of Object.entries(globalOriginals)) {
        globalThis[key] = value;
      }
    }
  }

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

  it('reuses the singleton instance on repeated construction attempts', () => {
    const first = configManager;
    const second = new ConfigurationManager(true);

    expect(second).toBe(first);
  });

  it('skips propertyStore deserialisation when script properties already exist', () => {
    mocks.PropertiesService.scriptProperties.getKeys.mockReturnValue(['existing']);

    configManager.maybeDeserializeProperties();

    expect(mocks.PropertiesCloner).not.toHaveBeenCalled();
  });

  it('continues when property key lookup throws during deserialisation bootstrap', () => {
    mocks.PropertiesService.scriptProperties.getKeys.mockImplementation(() => {
      throw new Error('script keys failed');
    });

    configManager.maybeDeserializeProperties();

    expect(mocks.PropertiesCloner).toHaveBeenCalledTimes(1);
  });

  it('constructs PropertiesCloner when propertyStore deserialisation is unavailable', () => {
    configManager.maybeDeserializeProperties();

    expect(mocks.PropertiesCloner).toHaveBeenCalledTimes(1);
  });

  it('treats null property stores as absent during deserialisation bootstrap', () => {
    configManager.scriptProperties = null;
    configManager.documentProperties = null;

    expect(() => configManager.maybeDeserializeProperties()).not.toThrow();
    expect(mocks.PropertiesCloner).toHaveBeenCalledTimes(1);
  });

  it('treats property stores without getKeys as empty during deserialisation bootstrap', () => {
    configManager.scriptProperties = {};
    configManager.documentProperties = {};

    expect(() => configManager.maybeDeserializeProperties()).not.toThrow();
    expect(mocks.PropertiesCloner).toHaveBeenCalledTimes(1);
  });

  it('deserialises properties when a propertiesStore sheet is available', () => {
    const deserialiseProperties = vi.fn();
    const originalPropertiesCloner = globalThis.PropertiesCloner;
    globalThis.PropertiesCloner = function PropertiesCloner() {
      this.sheet = { name: 'propertiesStore' };
      this.deserialiseProperties = deserialiseProperties;
      this.serialiseProperties = vi.fn();
    };

    try {
      configManager.maybeDeserializeProperties();

      expect(deserialiseProperties).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.PropertiesCloner = originalPropertiesCloner;
    }
  });

  it('initialises lazily on the first access to persisted configuration', () => {
    configManager._initialized = false;
    configManager.scriptProperties = null;
    configManager.documentProperties = null;

    expect(() => configManager.ensureInitialized()).not.toThrow();
    expect(mocks.PropertiesService.getScriptProperties).toHaveBeenCalledTimes(1);
    expect(mocks.PropertiesService.getDocumentProperties).toHaveBeenCalledTimes(1);
    expect(configManager._initialized).toBe(true);
  });

  it('returns immediately when already initialised', () => {
    configManager._initialized = true;

    expect(() => configManager.ensureInitialized()).not.toThrow();
    expect(mocks.PropertiesService.getScriptProperties).not.toHaveBeenCalled();
    expect(mocks.PropertiesService.getDocumentProperties).not.toHaveBeenCalled();
  });

  it('logs and continues when PropertiesCloner construction fails during bootstrap', () => {
    const originalPropertiesCloner = globalThis.PropertiesCloner;
    globalThis.PropertiesCloner = function PropertiesCloner() {
      throw new Error('properties cloner unavailable');
    };

    try {
      expect(() => configManager.maybeDeserializeProperties()).not.toThrow();
    } finally {
      globalThis.PropertiesCloner = originalPropertiesCloner;
    }
  });

  it('returns an empty object for invalid stored configuration JSON', () => {
    mocks.PropertiesService.scriptProperties.getProperty.mockReturnValueOnce('{');
    configManager.configCache = null;

    expect(configManager.getAllConfigurations()).toEqual({});
  });

  it('returns an empty object when stored configuration is not an object', () => {
    mocks.PropertiesService.scriptProperties.getProperty.mockReturnValueOnce('123');
    configManager.configCache = null;

    expect(configManager.getAllConfigurations()).toEqual({});
  });

  it('returns an empty object when stored configuration is an array', () => {
    mocks.PropertiesService.scriptProperties.getProperty.mockReturnValueOnce('[]');
    configManager.configCache = null;

    expect(configManager.getAllConfigurations()).toEqual({});
  });

  it('falls back to the injected regex patterns when pattern caches are cleared', () => {
    withTemporaryStatics(
      {
        _API_KEY_PATTERN: null,
        _DRIVE_ID_PATTERN: null,
      },
      {
        API_KEY_PATTERN: globalThis.API_KEY_PATTERN,
        DRIVE_ID_PATTERN: globalThis.DRIVE_ID_PATTERN,
      },
      () => {
        expect(ConfigurationManager.API_KEY_PATTERN).toBeInstanceOf(RegExp);
        expect(ConfigurationManager.DRIVE_ID_PATTERN).toBeInstanceOf(RegExp);
      }
    );
  });

  it('falls back to the injected config maps and defaults when cache values are cleared', () => {
    withTemporaryStatics(
      {
        _CONFIG_KEYS: null,
        _CONFIG_SCHEMA: null,
        _JSON_DB_LOG_LEVELS: null,
        _DEFAULTS: null,
      },
      {
        CONFIG_KEYS: CONFIG_MANAGER_CONFIG_KEYS,
        CONFIG_SCHEMA: CONFIG_MANAGER_CONFIG_SCHEMA,
        JSON_DB_LOG_LEVELS: globalThis.JSON_DB_LOG_LEVELS,
        DEFAULTS: CONFIG_MANAGER_DEFAULTS,
      },
      () => {
        expect(ConfigurationManager.CONFIG_KEYS).toHaveProperty('API_KEY');
        expect(ConfigurationManager.CONFIG_SCHEMA).toHaveProperty(
          ConfigurationManager.CONFIG_KEYS.API_KEY
        );
        expect(ConfigurationManager.JSON_DB_LOG_LEVELS).toContain('INFO');
        expect(ConfigurationManager.DEFAULTS).toHaveProperty('JSON_DB_LOG_LEVEL');
      }
    );
  });

  it('falls back to the hard-coded config store key when the cache value is cleared', () => {
    withTemporaryStatics(
      {
        _CONFIG_STORE_KEY: null,
      },
      {},
      () => {
        expect(ConfigurationManager.CONFIG_STORE_KEY).toBe('__CONFIG_STORE_KEY__');
      }
    );
  });

  it('returns false when Google Drive folder IDs are missing or malformed', () => {
    mocks.DriveApp.getFolderById.mockReturnValue({});

    expect(configManager.isValidGoogleDriveFolderId(null)).toBe(false);
    expect(configManager.isValidGoogleDriveFolderId('short')).toBe(false);
    expect(configManager.isValidGoogleDriveFolderId('folder-12345')).toBe(true);
    expect(mocks.DriveApp.getFolderById).toHaveBeenCalledWith('folder-12345');
  });

  it('returns false when Google Drive folder lookup throws', () => {
    mocks.DriveApp.getFolderById.mockImplementation(() => {
      throw new Error('folder lookup failed');
    });

    expect(configManager.isValidGoogleDriveFolderId('folder-12345')).toBe(false);
  });

  it('validates API keys using the configured token pattern', () => {
    expect(configManager.isValidApiKey('sk-abc123')).toBe(true);
    expect(configManager.isValidApiKey('invalid-key-')).toBe(false);
  });

  it('falls back to the local boolean helpers when injected validators are absent', () => {
    const originalToBoolean = ConfigurationManager._toBoolean;
    const originalToBooleanString = ConfigurationManager._toBooleanString;
    ConfigurationManager._toBoolean = null;
    ConfigurationManager._toBooleanString = null;

    try {
      expect(ConfigurationManager.toBoolean('true')).toBe(true);
      expect(ConfigurationManager.toBooleanString(false)).toBe('false');
    } finally {
      ConfigurationManager._toBoolean = originalToBoolean;
      ConfigurationManager._toBooleanString = originalToBooleanString;
    }
  });

  it('delegates JSON DB root folder updates to setProperty', () => {
    const setPropertySpy = vi.spyOn(configManager, 'setProperty');
    const validatorSpy = vi
      .spyOn(configManager, 'isValidGoogleDriveFolderId')
      .mockReturnValue(true);

    configManager.setJsonDbRootFolderId('folder-123');

    expect(setPropertySpy).toHaveBeenCalledWith(
      ConfigurationManager.CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID,
      'folder-123'
    );
    expect(validatorSpy).toHaveBeenCalledWith('folder-123');
  });

  it('delegates API key and backend URL setters to setProperty', () => {
    const setPropertySpy = vi.spyOn(configManager, 'setProperty');

    configManager.setApiKey('sk-abc123');
    configManager.setBackendUrl('https://example.com');

    expect(setPropertySpy).toHaveBeenNthCalledWith(
      1,
      ConfigurationManager.CONFIG_KEYS.API_KEY,
      'sk-abc123'
    );
    expect(setPropertySpy).toHaveBeenNthCalledWith(
      2,
      ConfigurationManager.CONFIG_KEYS.BACKEND_URL,
      'https://example.com'
    );
  });

  it('throws when persisting a property fails', () => {
    mocks.PropertiesService.scriptProperties.setProperty.mockImplementation(() => {
      throw new Error('persist failed');
    });

    expect(() => {
      configManager.setProperty(
        ConfigurationManager.CONFIG_KEYS.BACKEND_URL,
        'https://example.com'
      );
    }).toThrow('persist failed');
  });
});
