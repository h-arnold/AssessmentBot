import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildDefaultBackendConfigStore,
  createConfiguredConfigurationManager,
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

    it('should reject an API key with an invalid token format', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, 'invalid-key-');
      }).toThrow('API Key must be an alphanumeric prefix');
    });

    it('should reject a non-string API key', () => {
      expect(() => {
        configManager.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, 123);
      }).toThrow('API Key must be an alphanumeric prefix');
    });

    // --- Boundary case tests mirroring frontend backendConfigurationValidation.spec.ts ---

    it('should reject API key with 31-character token (one too short)', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.API_KEY,
          'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF'
        );
      }).toThrow('API Key must be an alphanumeric prefix');
    });

    it('should reject API key with 33-character token (one too long)', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.API_KEY,
          'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1X'
        );
      }).toThrow('API Key must be an alphanumeric prefix');
    });

    it('should reject API key containing illegal "+" character', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.API_KEY,
          'abt_7pC98PCoGJOcjN+qz6rNlSzKkgySJF-1'
        );
      }).toThrow('API Key must be an alphanumeric prefix');
    });

    it('should reject API key missing underscore separator', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.API_KEY,
          'abt7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1'
        );
      }).toThrow('API Key must be an alphanumeric prefix');
    });

    it('should reject API key with leading hyphen in prefix', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.API_KEY,
          '-abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1'
        );
      }).toThrow('API Key must be an alphanumeric prefix');
    });

    // --- Legacy format regression ---

    it('should reject legacy hyphen-separated API key (no underscore)', () => {
      expect(() => {
        configManager.setProperty(
          ConfigurationManager.CONFIG_KEYS.API_KEY,
          'abt-7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1'
        );
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
});
