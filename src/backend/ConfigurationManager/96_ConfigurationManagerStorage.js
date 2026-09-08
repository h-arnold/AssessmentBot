/**
 * ConfigurationManager storage concern (blob read / serialise / parse).
 *
 * @remarks
 * This is a delegated sub-class of the `ConfigurationManager` facade
 * (ACTION_PLAN.md Section 2, §11 facade pattern). It owns the low-level
 * serialisation primitives: safely parsing the raw `__CONFIG_STORE_KEY__` blob
 * read from Script Properties. Higher-level config-cache management stays on the
 * facade; the locked write path (97_ConfigurationManagerLockedWrite.js) is the
 * only writer and re-reads the raw blob under the script lock.
 *
 * This file follows the GAS concatenation model: `safeParseConfigObject_` and the
 * `ConfigurationManagerStorage` class are declared at top level and become globals
 * in the concatenated runtime. The guarded `module.exports` block below enables
 * Node/Vitest usage and is ignored under GAS.
 */

/**
 * Safely parses a serialised configuration object from JSON.
 * Returns an empty object if parsing fails or input is invalid.
 * @param {string} serialisedConfig - Serialised JSON configuration string.
 * @returns {Object} Parsed configuration object, or empty object on failure.
 */
function safeParseConfigObject_(serialisedConfig) {
  if (serialisedConfig == null || serialisedConfig === '') {
    return {};
  }

  try {
    const parsed = JSON.parse(serialisedConfig);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch (error) {
    ABLogger.getInstance().error('safeParseConfigObject_ failed to parse configuration.', error);
    return {};
  }
}

/**
 * Storage sub-class for the ConfigurationManager facade. Owns blob read/parse.
 * @class ConfigurationManagerStorage
 */
class ConfigurationManagerStorage {
  /**
   * Constructs the storage sub-class.
   * @param {Object} host - The owning ConfigurationManager facade instance.
   * @returns {void} No return value.
   */
  constructor(host) {
    this.host = host;
  }

  /**
   * Reads the raw serialised configuration blob from Script Properties.
   * @returns {string|null} The raw blob string, or null when no value is stored.
   */
  readRawConfigString() {
    const store = this.host.scriptProperties;
    if (!store) {
      return null;
    }
    return store.getProperty(ConfigurationManager.CONFIG_STORE_KEY);
  }

  /**
   * Reads and parses the configuration blob into a plain object.
   * @returns {Object} The parsed configuration object (empty when absent/invalid).
   */
  readConfig() {
    return safeParseConfigObject_(this.readRawConfigString());
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ConfigurationManagerStorage,
    safeParseConfigObject_,
  };
}
