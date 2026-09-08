/**
 * ConfigurationManager default-seeding concern.
 *
 * @remarks
 * Delegated sub-class of the ConfigurationManager facade (ACTION_PLAN.md Section 2).
 * Owns `ensureDefaultConfiguration()`, which seeds default values on first use and
 * is otherwise a no-op once any configuration has been stored. It routes every
 * seed through the facade setters so the writes serialise through the locked write
 * path exactly like ordinary configuration writes.
 *
 * GAS concatenation model: `ConfigurationManagerDefaults` is declared at top level
 * and becomes a global in the concatenated runtime. The guarded `module.exports`
 * block below enables Node/Vitest usage.
 */

/**
 * Default-seeding sub-class for the ConfigurationManager facade.
 * @class ConfigurationManagerDefaults
 */
class ConfigurationManagerDefaults {
  /**
   * Constructs the default-seeding sub-class.
   * @param {Object} host - The owning ConfigurationManager facade instance.
   * @returns {void} No return value.
   */
  constructor(host) {
    this.host = host;
  }

  /**
   * Persists the default backend configuration the first time it is needed.
   * Returns immediately when any configuration has already been stored.
   * @returns {Object} The current configuration cache.
   */
  ensureDefaultConfiguration() {
    const host = this.host;
    const config = host.getAllConfigurations();
    if (Object.keys(config).length > 0) {
      return config;
    }

    host.setBackendAssessorBatchSize(host.getBackendAssessorBatchSize());
    host.setSlidesFetchBatchSize(host.getSlidesFetchBatchSize());
    host.setRevokeAuthTriggerSet(host.getRevokeAuthTriggerSet());
    host.setDaysUntilAuthRevoke(host.getDaysUntilAuthRevoke());
    host.setJsonDbMasterIndexKey(host.getJsonDbMasterIndexKey());
    host.setJsonDbLockTimeoutMs(host.getJsonDbLockTimeoutMs());
    host.setJsonDbLogLevel(host.getJsonDbLogLevel());
    host.setJsonDbBackupOnInitialise(host.getJsonDbBackupOnInitialise());

    return host.configCache;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConfigurationManagerDefaults };
}
