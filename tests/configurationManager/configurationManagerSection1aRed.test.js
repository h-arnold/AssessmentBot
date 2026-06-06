/**
 * RED-phase tests for ConfigurationManager documentProperties removal.
 *
 * These tests are expected to FAIL because the production code still:
 * 1. Initialises `documentProperties` in ensureInitialized()
 * 2. Checks `documentProperties` key count in maybeDeserializeProperties()
 *
 * Production changes required (in 98_ConfigurationManagerClass.js):
 * - Remove `this.documentProperties` field and its lazy initialisation
 * - ensureInitialized() should not reference documentProperties
 * - maybeDeserializeProperties() should check only scriptProperties key count
 * - JSDoc: remove @property {Object} documentProperties
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupGlobalGASMocks } from '../helpers/mockFactories.js';

const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

describe('ConfigurationManager Section 1a red contract — documentProperties removal', () => {
  let mocks;

  /**
   * Creates a pristine ConfigurationManager instance with scriptProperties
   * set but NOT documentProperties, simulating the post-change state where
   * documentProperties is neither set in the constructor nor in ensureInitialized().
   */
  function createFreshManager() {
    ConfigurationManager.resetForTests();
    const manager = new ConfigurationManager(true);
    manager.scriptProperties = mocks.PropertiesService.scriptProperties;
    manager._initialized = false;
    manager.configCache = null;
    return manager;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = setupGlobalGASMocks(vi, { mockConsole: true });
    ConfigurationManager.resetForTests();
  });

  describe('documentProperties removal', () => {
    it('ensureInitialized does not initialise documentProperties', () => {
      const config = createFreshManager();

      // documentProperties starts as undefined
      expect(config.documentProperties).toBeUndefined();

      config.ensureInitialized();

      // After the change, ensureInitialized should not touch documentProperties.
      expect(config.documentProperties).toBeUndefined();
    });

    it('maybeDeserializeProperties does not check documentProperties key count', () => {
      const config = createFreshManager();

      // Set up: scriptProperties has NO keys, documentProperties HAS keys
      mocks.PropertiesService.scriptProperties.getKeys.mockReturnValue([]);
      mocks.PropertiesService.documentProperties.getKeys.mockReturnValue(['some-key']);
      config.scriptProperties = mocks.PropertiesService.scriptProperties;
      config.documentProperties = mocks.PropertiesService.documentProperties;

      config.maybeDeserializeProperties();

      // RED: current code returns early because hasDocument is truthy.
      // After the change, only scriptProperties is checked, so the method
      // should continue and construct PropertiesCloner when script keys are empty.
      // This assertion FAILS now (PropertiesCloner is NOT called because
      // the early return happens before reaching the PropertiesCloner branch).
      expect(mocks.PropertiesCloner).toHaveBeenCalledTimes(1);
    });
  });

  describe('get/set regression', () => {
    it('getProperty still works after removing documentProperties initialisation', () => {
      const config = createFreshManager();

      // Manually set up scriptProperties with data to bypass deserialisation
      mocks.PropertiesService.scriptProperties.getProperty.mockReturnValue(
        JSON.stringify({
          [ConfigurationManager.CONFIG_KEYS.API_KEY]: 'sk-test-key',
        })
      );
      config._initialized = false;

      const result = config.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY);

      // Should still read from scriptProperties
      expect(result).toBe('sk-test-key');
      expect(mocks.PropertiesService.scriptProperties.getProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_STORE_KEY
      );
    });

    it('setProperty still persists to scriptProperties after removing documentProperties', () => {
      const config = createFreshManager();
      config.configCache = {};

      config.setProperty(ConfigurationManager.CONFIG_KEYS.API_KEY, 'sk-new-key');

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_STORE_KEY,
        expect.stringContaining('sk-new-key')
      );
      expect(config.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY)).toBe('sk-new-key');
    });
  });
});
