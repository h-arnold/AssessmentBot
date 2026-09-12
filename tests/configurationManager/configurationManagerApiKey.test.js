import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createConfiguredConfigurationManager,
  installInMemoryScriptProperties,
} from '../helpers/backendConfigTestHelpers.js';
const {
  CONFIG_KEYS: CONFIG_MANAGER_CONFIG_KEYS,
  CONFIG_SCHEMA: CONFIG_MANAGER_CONFIG_SCHEMA,
} = require('../../src/backend/ConfigurationManager/01_configKeysAndSchema.js');
const {
  DEFAULTS: CONFIG_MANAGER_DEFAULTS,
} = require('../../src/backend/ConfigurationManager/02_defaults.js');

let mocks;
const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

function expectPersistedConfig(mocks_, expectedConfig) {
  expect(mocks_.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
    ConfigurationManager.CONFIG_STORE_KEY,
    JSON.stringify(expectedConfig)
  );
}

describe('ConfigurationManager API key validation', () => {
  let configManager;

  beforeEach(() => {
    ({ mocks, configManager } = createConfiguredConfigurationManager(vi, ConfigurationManager));
  });

  describe('API_KEY validation', () => {
    it('should accept a valid API key with an alphanumeric prefix, underscore, and 32 base64url characters', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.API_KEY,
          'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1'
        );
      }).not.toThrow();

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.API_KEY]: 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1',
      });
    });

    it.each([
      ['an invalid token format', 'invalid-key-'],
      ['a non-string value', 123],
      ['a 31-character token (one too short)', 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF'],
      ['a 33-character token (one too long)', 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1X'],
      ['an illegal "+" character', 'abt_7pC98PCoGJOcjN+qz6rNlSzKkgySJF-1'],
      ['a missing underscore separator', 'abt7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1'],
      ['a leading hyphen in the prefix', '-abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1'],
      ['a legacy hyphen-separated key (no underscore)', 'abt-7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1'],
    ])('should reject an API key with %s', (_label, candidateKey) => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, candidateKey);
      }).toThrow('API Key must be an alphanumeric prefix');
    });
    // --- Trim behaviour ---

    it('should trim surrounding whitespace from the API key before storing', () => {
      const spacedKey = '  abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1  ';
      const trimmedKey = 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1';

      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, spacedKey);
      }).not.toThrow();

      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.API_KEY]: trimmedKey,
      });

      // Also verify the in-memory cache has the trimmed value
      expect(configManager.configCache[ConfigurationManager.CONFIG_KEYS.API_KEY]).toBe(trimmedKey);
    });
  });

  describe('isValidApiKey', () => {
    it('validates API keys using the configured token pattern', () => {
      expect(configManager.isValidApiKey('abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1')).toBe(true);
      expect(configManager.isValidApiKey('invalid-key-')).toBe(false);
    });
  });

  describe('setApiKey', () => {
    it('delegates setApiKey to setProperty', () => {
      const setPropertySpy = vi.spyOn(configManager, 'setProperty');

      configManager.setApiKey('abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1');

      expect(setPropertySpy).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.API_KEY,
        'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1'
      );
    });
  });

  describe('API key clearing via explicit empty string (real validation seam + locked write)', () => {
    /** Backs the serialised config blob with an in-memory store for a single test. */
    function installInMemoryConfigStore(initialConfig) {
      return installInMemoryScriptProperties(mocks.PropertiesService.scriptProperties, {
        configStoreKey: ConfigurationManager.CONFIG_STORE_KEY,
        initialConfig,
      });
    }

    it('accepts the explicit empty-string clear value through preparePropertyValue', () => {
      // preparePropertyValue is the manager-owned seam `setBackendConfig_` stages
      // every supplied field through; it must return '' so the clearing patch can
      // reach the locked write instead of throwing like any invalid key.
      expect(configManager.preparePropertyValue(ConfigurationManager.CONFIG_KEYS.API_KEY, '')).toBe(
        ''
      );
    });

    it('clears a stored API key through the real validation seam and the locked write path', () => {
      const store = installInMemoryConfigStore({
        [ConfigurationManager.CONFIG_KEYS.API_KEY]: 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1',
        [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL]: 'INFO',
      });

      // setProperty routes through CONFIG_SCHEMA.apiKey validation (validateApiKey_)
      // then the single locked write; the stored key must be replaced with ''.
      expect(() =>
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, '')
      ).not.toThrow();

      expect(JSON.parse(store[ConfigurationManager.CONFIG_STORE_KEY])).toEqual({
        [ConfigurationManager.CONFIG_KEYS.API_KEY]: '',
        [ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL]: 'INFO',
      });
    });

    it('still rejects invalid non-empty API keys through the real validation seam', () => {
      expect(() =>
        configManager.preparePropertyValue(ConfigurationManager.CONFIG_KEYS.API_KEY, 'invalid-key-')
      ).toThrow('API Key must be an alphanumeric prefix');
    });

    it('rejects whitespace-only and null clearing values, keeping the clear case explicit', () => {
      expect(() =>
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, '   ')
      ).toThrow('API Key must be an alphanumeric prefix');
      expect(() =>
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, null)
      ).toThrow('API Key must be an alphanumeric prefix');
    });
  });
});
