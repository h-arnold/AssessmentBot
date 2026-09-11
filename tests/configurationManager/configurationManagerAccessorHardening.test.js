/**
 * Focused contract tests for the generic configuration-accessor review finding
 * (pre-PR review, configuration/API remediation batch):
 *
 * Generic accessors must reject unvalidated unknown keys and must never read
 * inherited (prototype) properties. Before the fix, `getProperty('toString')`
 * returned `Object.prototype.toString`, and unknown keys were silently accepted.
 *
 * These encode the target contract for `98_ConfigurationManagerClass.js`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConfiguredConfigurationManager } from '../helpers/backendConfigTestHelpers.js';

const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

const UNKNOWN_KEY = 'notAConfigurationKey';

describe('ConfigurationManager generic accessor hardening', () => {
  let configManager;

  beforeEach(() => {
    ({ configManager } = createConfiguredConfigurationManager(vi, ConfigurationManager));
  });

  afterEach(() => {
    ConfigurationManager.resetForTests();
    vi.restoreAllMocks();
  });

  describe('unknown configuration keys are rejected', () => {
    it('rejects an unknown key read', () => {
      expect(() => configManager.getProperty(UNKNOWN_KEY)).toThrow();
    });

    it('rejects an unknown key in the prepared-property validation seam', () => {
      expect(() => configManager.preparePropertyValue(UNKNOWN_KEY, 'value')).toThrow();
    });

    it('rejects an unknown key in the presence check', () => {
      expect(() => configManager.hasProperty(UNKNOWN_KEY)).toThrow();
    });
  });

  describe('inherited configuration values are never exposed', () => {
    it('rejects an inherited Object prototype property name', () => {
      expect(() => configManager.getProperty('toString')).toThrow();
    });

    it('rejects a value inherited from a polluted config cache', () => {
      configManager.configCache = Object.create({ inheritedSecret: 'leaked' });

      expect(() => configManager.getProperty('inheritedSecret')).toThrow();
    });
  });

  describe('valid but absent keys keep their existing semantics', () => {
    it('reports an absent schema-backed key as not present', () => {
      expect(configManager.hasProperty(ConfigurationManager.CONFIG_KEYS.API_KEY)).toBe(false);
    });
  });
});
