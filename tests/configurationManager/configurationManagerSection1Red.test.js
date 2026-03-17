import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupGlobalGASMocks } from '../helpers/mockFactories.js';

const {
  CONFIG_KEYS,
  CONFIG_SCHEMA,
} = require('../../src/backend/ConfigurationManager/01_configKeysAndSchema.js');
const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

describe('ConfigurationManager Section 1 red contract', () => {
  let mocks;
  let logger;

  function createManager() {
    ConfigurationManager.resetForTests();
    const manager = new ConfigurationManager(true);
    manager.scriptProperties = mocks.PropertiesService.scriptProperties;
    manager.documentProperties = mocks.PropertiesService.documentProperties;
    manager._initialized = true;
    manager.configCache = null;
    return manager;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = setupGlobalGASMocks(vi, { mockConsole: true });
    logger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debugUi: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };
    globalThis.ABLogger = { getInstance: () => logger };
    ConfigurationManager.resetForTests();
  });

  describe('schema contract', () => {
    it('removes IS_ADMIN_SHEET from config keys and schema', () => {
      expect(CONFIG_KEYS).not.toHaveProperty('IS_ADMIN_SHEET');
      expect(Object.values(CONFIG_KEYS)).not.toContain('isAdminSheet');
      expect(CONFIG_SCHEMA).not.toHaveProperty('isAdminSheet');
    });

    it('persists REVOKE_AUTH_TRIGGER_SET in script scope', () => {
      expect(CONFIG_SCHEMA[CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]).toEqual(
        expect.objectContaining({ storage: 'script' })
      );
    });

    it('defines a dedicated config store key for the serialised config object', () => {
      expect(ConfigurationManager.CONFIG_STORE_KEY).toEqual(expect.any(String));
    });
  });

  it('writes a valid field by updating only that field in the in-memory object and persisting one serialised store object', () => {
    const configManager = createManager();
    const expectedStoreKey = ConfigurationManager.CONFIG_STORE_KEY || '__CONFIG_STORE_KEY__';
    configManager.configCache = {
      [CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: '25',
      [CONFIG_KEYS.API_KEY]: 'sk-old',
      [CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'false',
    };

    configManager.setProperty(CONFIG_KEYS.API_KEY, 'sk-new');

    expect(configManager.configCache).toEqual({
      [CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: '25',
      [CONFIG_KEYS.API_KEY]: 'sk-new',
      [CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'false',
    });
    expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledTimes(1);

    const [storeKey, serialisedConfig] =
      mocks.PropertiesService.scriptProperties.setProperty.mock.calls[0];

    expect(storeKey).toBe(expectedStoreKey);
    expect(JSON.parse(serialisedConfig)).toEqual({
      [CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: '25',
      [CONFIG_KEYS.API_KEY]: 'sk-new',
      [CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'false',
    });
    expect(mocks.PropertiesService.documentProperties.setProperty).not.toHaveBeenCalled();
  });

  it('reads values from the serialised config store for numeric, string, and boolean-backed fields', () => {
    const configManager = createManager();
    const expectedStoreKey = ConfigurationManager.CONFIG_STORE_KEY || '__CONFIG_STORE_KEY__';
    mocks.PropertiesService.scriptProperties.getProperty.mockReturnValue(
      JSON.stringify({
        [CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: '42',
        [CONFIG_KEYS.API_KEY]: 'sk-live',
        [CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'true',
      })
    );

    expect(configManager.getProperty(CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE)).toBe('42');
    expect(configManager.getProperty(CONFIG_KEYS.API_KEY)).toBe('sk-live');
    expect(configManager.getRevokeAuthTriggerSet()).toBe(true);
    expect(mocks.PropertiesService.scriptProperties.getProperty).toHaveBeenCalledWith(
      expectedStoreKey
    );
    expect(mocks.PropertiesService.documentProperties.getProperty).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'malformed JSON', storedValue: '{not-json' },
    { label: 'non-object JSON', storedValue: 'true' },
  ])('treats $label as an empty config object', ({ storedValue }) => {
    const configManager = createManager();
    const expectedStoreKey = ConfigurationManager.CONFIG_STORE_KEY || '__CONFIG_STORE_KEY__';
    mocks.PropertiesService.scriptProperties.getProperty.mockReturnValue(storedValue);

    expect(() => configManager.getProperty(CONFIG_KEYS.API_KEY)).not.toThrow();
    expect(configManager.getProperty(CONFIG_KEYS.API_KEY)).toBe('');
    expect(mocks.PropertiesService.scriptProperties.getProperty).toHaveBeenCalledWith(
      expectedStoreKey
    );
    expect(mocks.PropertiesService.documentProperties.getProperty).not.toHaveBeenCalled();
  });

  it('validates and normalises REVOKE_AUTH_TRIGGER_SET under script-scoped persistence', () => {
    const configManager = createManager();
    const expectedStoreKey = ConfigurationManager.CONFIG_STORE_KEY || '__CONFIG_STORE_KEY__';
    configManager.configCache = {
      [CONFIG_KEYS.API_KEY]: 'sk-live',
      [CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'false',
    };

    configManager.setProperty(CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET, 'TRUE');

    expect(configManager.configCache).toEqual({
      [CONFIG_KEYS.API_KEY]: 'sk-live',
      [CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'true',
    });

    const [storeKey, serialisedConfig] =
      mocks.PropertiesService.scriptProperties.setProperty.mock.calls[0];

    expect(storeKey).toBe(expectedStoreKey);
    expect(JSON.parse(serialisedConfig)).toEqual({
      [CONFIG_KEYS.API_KEY]: 'sk-live',
      [CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: 'true',
    });
    expect(mocks.PropertiesService.documentProperties.setProperty).not.toHaveBeenCalled();
  });

  it('logs and rethrows persistence failures from the serialised config store write', () => {
    const configManager = createManager();
    const expectedStoreKey = ConfigurationManager.CONFIG_STORE_KEY || '__CONFIG_STORE_KEY__';
    const persistError = new Error('serialised config write failed');
    configManager.configCache = {
      [CONFIG_KEYS.API_KEY]: 'sk-live',
    };

    mocks.PropertiesService.scriptProperties.setProperty.mockImplementation((key) => {
      if (key === expectedStoreKey) {
        throw persistError;
      }
    });

    expect(() => configManager.setProperty(CONFIG_KEYS.API_KEY, 'sk-next')).toThrow(persistError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to persist'),
      expect.any(Object)
    );
  });
});
