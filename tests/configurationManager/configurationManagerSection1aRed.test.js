/**
 * Regression tests for the completed ConfigurationManager documentProperties removal.
 *
 * The production code (98_ConfigurationManagerClass.js) no longer supports
 * documentProperties:
 * - `this.documentProperties` is absent from the constructor and ensureInitialized().
 * - ensureInitialized() lazily acquires only the scriptProperties handle, then sets
 *   `_initialized` and optionally freezes.
 *
 * These tests lock in that behaviour so a regression which reintroduces
 * documentProperties would fail. The get/set regression block confirms configuration
 * reads and writes still operate against scriptProperties after the removal.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupGlobalGASMocks } from '../helpers/mockFactories.js';

const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

describe('ConfigurationManager documentProperties removal regression', () => {
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

      config.setProperty(
        ConfigurationManager.CONFIG_KEYS.API_KEY,
        'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-3'
      );

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledWith(
        ConfigurationManager.CONFIG_STORE_KEY,
        expect.stringContaining('abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-3')
      );
      expect(config.getProperty(ConfigurationManager.CONFIG_KEYS.API_KEY)).toBe(
        'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-3'
      );
    });
  });
});
