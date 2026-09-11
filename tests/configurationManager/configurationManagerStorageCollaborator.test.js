/**
 * Focused contract tests for the storage-collaborator review finding
 * (pre-PR review, configuration/API remediation batch):
 *
 *   1. Blob parsing has a single owner: `getAllConfigurations()` must delegate to
 *      the injected `ConfigurationManagerStorage.readConfig()`, and the locked
 *      write path must read the raw blob through
 *      `ConfigurationManagerStorage.readRawConfigString()` before parsing.
 *   2. `readRawConfigString()` must fail loudly when the host has no Script
 *      Properties handle instead of masking the wiring error as an absent blob.
 *
 * These encode the target contract for `96_ConfigurationManagerStorage.js` and
 * its callers; they are the specification the Implementation phase must satisfy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');
const {
  ConfigurationManagerStorage,
} = require('../../src/backend/ConfigurationManager/96_ConfigurationManagerStorage.js');

const CONFIG_STORE_KEY = ConfigurationManager.CONFIG_STORE_KEY;

/**
 * Builds a ConfigurationManager facade with an injected storage collaborator.
 * @param {Object} storage - Storage collaborator double.
 * @returns {Object} The configured facade instance.
 */
function makeManager(storage) {
  const manager = new ConfigurationManager(true, { storage });
  manager.scriptProperties = {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
  };
  manager._initialized = true;
  return manager;
}

describe('ConfigurationManager storage collaborator ownership', () => {
  beforeEach(() => {
    ConfigurationManager.resetForTests();
  });

  afterEach(() => {
    ConfigurationManager.resetForTests();
    vi.restoreAllMocks();
  });

  describe('configuration blob reads are delegated to the storage collaborator', () => {
    it('parses the initial configuration through the storage collaborator', () => {
      const readConfig = vi.fn(() => ({ apiKey: 'from-storage' }));
      const manager = makeManager({ readConfig });

      const config = manager.getAllConfigurations();

      expect(readConfig).toHaveBeenCalledTimes(1);
      expect(config).toEqual({ apiKey: 'from-storage' });
    });

    it('re-reads the raw blob through the storage collaborator under the lock', () => {
      const readRawConfigString = vi.fn(() => JSON.stringify({ apiKey: 'stored' }));
      const manager = makeManager({ readRawConfigString });

      let observedCurrent;
      manager.writeConfigurationLocked((current) => {
        observedCurrent = current;
        return current;
      });

      expect(readRawConfigString).toHaveBeenCalledTimes(1);
      expect(observedCurrent).toEqual({ apiKey: 'stored' });
    });
  });

  describe('readRawConfigString fails loudly on a missing host wiring', () => {
    it('returns the raw blob from the host Script Properties handle', () => {
      const getProperty = vi.fn(() => '{"apiKey":"x"}');
      const storage = new ConfigurationManagerStorage({
        scriptProperties: { getProperty },
      });

      expect(storage.readRawConfigString()).toBe('{"apiKey":"x"}');
      expect(getProperty).toHaveBeenCalledWith(CONFIG_STORE_KEY);
    });

    it('throws instead of masking a missing Script Properties handle as an absent blob', () => {
      const storage = new ConfigurationManagerStorage({ scriptProperties: null });

      expect(() => storage.readRawConfigString()).toThrow();
    });
  });
});
