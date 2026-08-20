import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createConfiguredConfigurationManager } from '../helpers/backendConfigTestHelpers.js';

const {
  CONFIG_KEYS,
  CONFIG_SCHEMA,
} = require('../../src/backend/ConfigurationManager/01_configKeysAndSchema.js');
const {
  DEFAULTS: CONFIG_MANAGER_DEFAULTS,
} = require('../../src/backend/ConfigurationManager/02_defaults.js');
const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

let mocks;

function expectPersistedConfig(mocks_, expectedConfig) {
  expect(mocks_.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
    ConfigurationManager.CONFIG_STORE_KEY,
    JSON.stringify(expectedConfig)
  );
}

describe('ConfigurationManager AUTH_MODE', () => {
  let configManager;

  beforeEach(() => {
    ({ mocks, configManager } = createConfiguredConfigurationManager(vi, ConfigurationManager));
  });

  describe('config key, schema and default contract', () => {
    it('defines AUTH_MODE in CONFIG_KEYS and a script-scoped CONFIG_SCHEMA entry', () => {
      expect(CONFIG_KEYS.AUTH_MODE).toBe('authMode');
      expect(CONFIG_SCHEMA[CONFIG_KEYS.AUTH_MODE]).toEqual(
        expect.objectContaining({ storage: 'script' })
      );
    });

    it('does not define an AUTH_MODE default in DEFAULTS', () => {
      expect(CONFIG_MANAGER_DEFAULTS).not.toHaveProperty('AUTH_MODE');
      expect(CONFIG_MANAGER_DEFAULTS).not.toHaveProperty('authMode');
    });
  });

  describe('AUTH_MODE schema validation', () => {
    function getAuthModeValidator() {
      return CONFIG_SCHEMA[CONFIG_KEYS.AUTH_MODE].validate;
    }

    it('returns the canonical value for the none mode', () => {
      const validator = getAuthModeValidator();

      expect(validator('none', configManager)).toBe('none');
    });

    it('returns the canonical value for the googleGroups mode', () => {
      const validator = getAuthModeValidator();

      expect(validator('googleGroups', configManager)).toBe('googleGroups');
    });

    it('rejects an unknown auth mode value', () => {
      const validator = getAuthModeValidator();

      expect(() => validator('foo', configManager)).toThrow();
    });
  });

  describe('getAuthMode', () => {
    it('returns googleGroups when no value is stored', () => {
      expect(configManager.getAuthMode()).toBe('googleGroups');
    });

    it('returns googleGroups when the stored value is blank', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: '',
      };

      expect(configManager.getAuthMode()).toBe('googleGroups');
    });

    it('returns googleGroups when an unknown value is stored', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'foo',
      };

      expect(configManager.getAuthMode()).toBe('googleGroups');
    });

    it('returns none when the literal none value is stored', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'none',
      };

      expect(configManager.getAuthMode()).toBe('none');
    });
  });

  describe('setAuthMode', () => {
    it('persists the none mode and reads it back', () => {
      configManager.setAuthMode('none');

      expect(configManager.getAuthMode()).toBe('none');
      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'none',
      });
    });

    it('rejects an invalid auth mode value', () => {
      expect(() => configManager.setAuthMode('foo')).toThrow();
    });
  });
});
