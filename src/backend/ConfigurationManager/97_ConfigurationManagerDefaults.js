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

/* global ConfigurationManager */

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
   * @remarks Stages the complete default configuration and commits it through
   *   ONE `writeConfigurationLocked` mutation, mirroring the atomic settings-save
   *   pattern, rather than performing one serial full-blob write per field.
   * @returns {Object} The current configuration cache.
   */
  ensureDefaultConfiguration() {
    const host = this.host;
    const config = host.getAllConfigurations();
    if (Object.keys(config).length > 0) {
      return config;
    }

    const configKeys = ConfigurationManager.CONFIG_KEYS;
    const seedEntries = [
      [configKeys.BACKEND_ASSESSOR_BATCH_SIZE, host.getBackendAssessorBatchSize()],
      [configKeys.SLIDES_FETCH_BATCH_SIZE, host.getSlidesFetchBatchSize()],
      [configKeys.REVOKE_AUTH_TRIGGER_SET, host.getRevokeAuthTriggerSet()],
      [configKeys.DAYS_UNTIL_AUTH_REVOKE, host.getDaysUntilAuthRevoke()],
      [configKeys.JSON_DB_MASTER_INDEX_KEY, host.getJsonDbMasterIndexKey()],
      [configKeys.JSON_DB_LOCK_TIMEOUT_MS, host.getJsonDbLockTimeoutMs()],
      [configKeys.JSON_DB_LOG_LEVEL, host.getJsonDbLogLevel()],
      [configKeys.JSON_DB_BACKUP_ON_INITIALISE, host.getJsonDbBackupOnInitialise()],
    ];
    const patch = Object.fromEntries(
      seedEntries.map(([key, value]) => [key, host.preparePropertyValue(key, value)])
    );

    host.writeConfigurationLocked((current) => ({ ...current, ...patch }));

    return host.configCache;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConfigurationManagerDefaults };
}
