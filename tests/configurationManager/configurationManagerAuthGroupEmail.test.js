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

describe('ConfigurationManager AUTH_GROUP_EMAIL', () => {
  let configManager;

  beforeEach(() => {
    ({ mocks, configManager } = createConfiguredConfigurationManager(vi, ConfigurationManager));
  });

  describe('config key, schema and default contract', () => {
    it('defines AUTH_GROUP_EMAIL in CONFIG_KEYS and a script-scoped CONFIG_SCHEMA entry', () => {
      expect(CONFIG_KEYS.AUTH_GROUP_EMAIL).toBe('authGroupEmail');
      expect(CONFIG_SCHEMA[CONFIG_KEYS.AUTH_GROUP_EMAIL]).toEqual(
        expect.objectContaining({ storage: 'script' })
      );
    });

    it('does not define an unused AUTH_GROUP_EMAIL default', () => {
      expect(CONFIG_MANAGER_DEFAULTS).not.toHaveProperty('AUTH_GROUP_EMAIL');
      expect(CONFIG_MANAGER_DEFAULTS).not.toHaveProperty('authGroupEmail');
    });
  });

  describe('AUTH_GROUP_EMAIL schema validation', () => {
    function getAuthGroupEmailValidator() {
      return CONFIG_SCHEMA[CONFIG_KEYS.AUTH_GROUP_EMAIL].validate;
    }

    it('allows a blank value', () => {
      const validator = getAuthGroupEmailValidator();

      expect(validator('', configManager)).toBe('');
    });

    it('rejects an invalid email value', () => {
      const validator = getAuthGroupEmailValidator();

      expect(() => validator('not-an-email', configManager)).toThrow();
    });

    it('accepts a valid email value', () => {
      const validator = getAuthGroupEmailValidator();

      expect(validator('teachers@school.edu', configManager)).toBe('teachers@school.edu');
    });
  });

  describe('getAuthGroupEmail', () => {
    it('returns an empty string when the key is unset', () => {
      expect(configManager.getAuthGroupEmail()).toBe('');
    });

    it('returns an empty string when the stored value is blank', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL]: '',
      };

      expect(configManager.getAuthGroupEmail()).toBe('');
    });

    it('returns the stored email when a valid email is configured', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL]: 'teachers@school.edu',
      };

      expect(configManager.getAuthGroupEmail()).toBe('teachers@school.edu');
    });
  });

  describe('setAuthGroupEmail', () => {
    it('persists a valid email and reads it back', () => {
      configManager.setAuthGroupEmail('teachers@school.edu');

      expect(configManager.getAuthGroupEmail()).toBe('teachers@school.edu');
      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL]: 'teachers@school.edu',
      });
    });

    it('allows setting a blank value when nothing is stored (bootstrap)', () => {
      expect(() => configManager.setAuthGroupEmail('')).not.toThrow();
      expect(configManager.getAuthGroupEmail()).toBe('');
    });

    it('rejects clearing the auth group email once a non-blank value is stored', () => {
      configManager.setAuthGroupEmail('teachers@school.edu');

      expect(() => configManager.setAuthGroupEmail('')).toThrow();
      expect(configManager.getAuthGroupEmail()).toBe('teachers@school.edu');
      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledTimes(1);
    });

    it('overwrites an existing auth group email with a different non-blank email', () => {
      configManager.setAuthGroupEmail('teachers@school.edu');
      configManager.setAuthGroupEmail('different@school.edu');

      expect(configManager.getAuthGroupEmail()).toBe('different@school.edu');
      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL]: 'different@school.edu',
      });
    });

    it('delegates to setProperty using the AUTH_GROUP_EMAIL key', () => {
      const setPropertySpy = vi.spyOn(configManager, 'setProperty');

      configManager.setAuthGroupEmail('teachers@school.edu');

      expect(setPropertySpy).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL,
        'teachers@school.edu'
      );
    });
  });
});
