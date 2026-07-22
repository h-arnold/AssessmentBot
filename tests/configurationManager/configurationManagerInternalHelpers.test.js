import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createConfiguredConfigurationManager } from '../helpers/backendConfigTestHelpers.js';
const {
  CONFIG_KEYS: CONFIG_MANAGER_CONFIG_KEYS,
  CONFIG_SCHEMA: CONFIG_MANAGER_CONFIG_SCHEMA,
} = require('../../src/backend/ConfigurationManager/01_configKeysAndSchema.js');
const {
  DEFAULTS: CONFIG_MANAGER_DEFAULTS,
} = require('../../src/backend/ConfigurationManager/02_defaults.js');

let mocks;
const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

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
    ({ mocks, configManager } = createConfiguredConfigurationManager(vi, ConfigurationManager));
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
    expect(mocks.PropertiesService.getDocumentProperties).not.toHaveBeenCalled();
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

  it('delegates backend URL setter to setProperty', () => {
    const setPropertySpy = vi.spyOn(configManager, 'setProperty');

    configManager.setBackendUrl('https://example.com');

    expect(setPropertySpy).toHaveBeenCalledWith(
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
