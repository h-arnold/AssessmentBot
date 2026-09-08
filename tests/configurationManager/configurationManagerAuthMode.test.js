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

    it('rejects the removed none mode', () => {
      const validator = getAuthModeValidator();

      expect(() => validator('none', configManager)).toThrow();
    });

    it('accepts the googleGroups mode', () => {
      const validator = getAuthModeValidator();

      expect(validator('googleGroups', configManager)).toBe('googleGroups');
    });

    it('accepts the scriptProperties mode', () => {
      const validator = getAuthModeValidator();

      expect(validator('scriptProperties', configManager)).toBe('scriptProperties');
    });

    it('rejects an unknown auth mode value', () => {
      const validator = getAuthModeValidator();

      expect(() => validator('foo', configManager)).toThrow();
    });
  });

  describe('getAuthMode (forgiving transport getter)', () => {
    it('returns googleGroups when the stored value is googleGroups', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'googleGroups',
      };

      expect(configManager.getAuthMode()).toBe('googleGroups');
    });

    it('returns scriptProperties when the stored value is scriptProperties', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'scriptProperties',
      };

      expect(configManager.getAuthMode()).toBe('scriptProperties');
    });

    it('applies the single leniency: absent mode with a non-blank group reads as googleGroups', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL]: 'teachers@school.edu',
      };

      expect(configManager.getAuthMode()).toBe('googleGroups');
    });

    it('does NOT blanket-default to googleGroups when the mode is absent without a group', () => {
      configManager.configCache = {};

      expect(configManager.getAuthMode()).toBeNull();
    });

    it('does NOT blanket-default to googleGroups for a stored blank mode', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: '',
      };

      expect(configManager.getAuthMode()).toBeNull();
    });

    it('does NOT return the removed none mode (resolves to no mode)', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'none',
      };

      expect(configManager.getAuthMode()).toBeNull();
    });

    it('does NOT return googleGroups for an unrecognised stored value without a group', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'foo',
      };

      expect(configManager.getAuthMode()).toBeNull();
    });

    it('treats a stored blank mode as absent, so a non-blank group reads as googleGroups', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: '',
        [ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL]: 'teachers@school.edu',
      };

      expect(configManager.getAuthMode()).toBe('googleGroups');
    });

    it('does NOT apply the leniency to the removed none mode paired with a group', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'none',
        [ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL]: 'teachers@school.edu',
      };

      expect(configManager.getAuthMode()).toBeNull();
    });

    it('does NOT apply the leniency to an unrecognised mode paired with a group', () => {
      configManager.configCache = {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'foo',
        [ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL]: 'teachers@school.edu',
      };

      expect(configManager.getAuthMode()).toBeNull();
    });

    it('never throws across any stored/absent scenario', () => {
      const scenarios = [
        {},
        { [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'googleGroups' },
        { [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'scriptProperties' },
        { [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: '' },
        { [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'none' },
        { [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'foo' },
        {
          [ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL]: 'teachers@school.edu',
        },
        {
          [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'none',
          [ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL]: 'teachers@school.edu',
        },
        {
          [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'foo',
          [ConfigurationManager.CONFIG_KEYS.AUTH_GROUP_EMAIL]: 'teachers@school.edu',
        },
      ];

      for (const cache of scenarios) {
        configManager.configCache = cache;
        expect(() => configManager.getAuthMode()).not.toThrow();
      }
    });
  });

  describe('setAuthMode', () => {
    it('persists the scriptProperties mode and reads it back', () => {
      configManager.setAuthMode('scriptProperties');

      expect(configManager.getAuthMode()).toBe('scriptProperties');
      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'scriptProperties',
      });
    });

    it('persists the googleGroups mode and reads it back', () => {
      configManager.setAuthMode('googleGroups');

      expect(configManager.getAuthMode()).toBe('googleGroups');
      expectPersistedConfig(mocks, {
        [ConfigurationManager.CONFIG_KEYS.AUTH_MODE]: 'googleGroups',
      });
    });

    it('rejects the removed none mode', () => {
      expect(() => configManager.setAuthMode('none')).toThrow();
    });

    it('rejects an invalid auth mode value', () => {
      expect(() => configManager.setAuthMode('foo')).toThrow();
    });
  });
});
