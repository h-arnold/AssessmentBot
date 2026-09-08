/**
 * ConfigurationManager locked write path and freshness detection.
 *
 * @remarks
 * Delegated sub-class of the ConfigurationManager facade (ACTION_PLAN.md Section 2).
 * Implements `writeConfigurationLocked(mutator)` — the single serialisation point
 * for ALL configuration writes — and `isFreshInstall()`.
 *
 * Lock sharing: this uses the SAME script-wide `LockService.getScriptLock()` that
 * the vendored JsonDbApp `DbLockService` uses. GAS script locks are NOT reentrant;
 * a caller must never invoke a configuration write while a DB operation already
 * holds the script lock. This is caller discipline and is intentionally NOT detected
 * here (per SPEC.md decision 12 and ACTION_PLAN.md Section 2).
 *
 * Under the lock the current blob is re-read from RAW storage (never the in-memory
 * cache), the mutator produces the next config, the 8KB cap is enforced, and a
 * single write commits the result. Contention yields a retriable validation error
 * envelope, never a silent drop; no configuration write may run while a DB operation
 * holds the script lock.
 *
 * GAS concatenation model: `ConfigurationManagerLockedWrite` is declared at top level
 * and becomes a global in the concatenated runtime. The guarded `module.exports`
 * block below enables Node/Vitest usage.
 */

/**
 * Lock acquisition timeout for the configuration write lock, in milliseconds.
 * Mirrors the existing JsonDbApp lock-timeout convention (30 seconds).
 * @type {number}
 */
const CONFIG_LOCK_TIMEOUT_MS = 30000;

/**
 * Locked-write and freshness sub-class for the ConfigurationManager facade.
 * @class ConfigurationManagerLockedWrite
 */
class ConfigurationManagerLockedWrite {
  /**
   * Constructs the locked-write sub-class.
   * @param {Object} host - The owning ConfigurationManager facade instance.
   * @returns {void} No return value.
   */
  constructor(host) {
    this.host = host;
  }

  /**
   * Serialises a configuration mutation through the script-wide lock.
   * Under the lock the current blob is re-read from RAW storage (never the in-memory
   * cache), the mutator produces the next config, the 8KB cap is enforced, and a
   * single write commits the result.
   * @param {function(Object):Object} mutator - `(currentConfig) => nextConfig`.
   * @returns {void}
   * @throws {Error} `CONFIG_LOCK_CONTENTION` (retriable) on lock contention;
   *   `CONFIG_BLOB_TOO_LARGE` (non-retriable) when the serialised blob exceeds the cap.
   */
  writeConfigurationLocked(mutator) {
    const host = this.host;
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(CONFIG_LOCK_TIMEOUT_MS);
    } catch {
      ABLogger.getInstance().warn(
        'ConfigurationManager: script lock contention during configuration write.',
        { code: 'CONFIG_LOCK_CONTENTION' }
      );
      const contention = new Error(
        'Configuration write could not acquire the script lock within the timeout.'
      );
      contention.code = 'CONFIG_LOCK_CONTENTION';
      contention.retriable = true;
      throw contention;
    }

    try {
      const raw = host.scriptProperties.getProperty(ConfigurationManager.CONFIG_STORE_KEY);
      const current = safeParseConfigObject_(raw);
      const next = mutator(current);
      const serialised = JSON.stringify(next);
      if (serialised.length > MAX_CONFIG_BLOB_BYTES) {
        const capError = new Error('Configuration blob exceeds the 8KB cap and was not written.');
        capError.code = 'CONFIG_BLOB_TOO_LARGE';
        capError.retriable = false;
        throw capError;
      }
      try {
        host.scriptProperties.setProperty(ConfigurationManager.CONFIG_STORE_KEY, serialised);
      } catch (persistError) {
        ABLogger.getInstance().error('ConfigurationManager: Failed to persist configuration.', {
          cause: persistError,
        });
        throw persistError;
      }
      host.configCache = { ...host.configCache, ...next };
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Detects a genuinely fresh install.
   * Lets initialisation run first, then reads RAW Script Properties for
   * `__CONFIG_STORE_KEY__` absence (never the forgiving config cache).
   * @returns {boolean} True only when the key is absent from raw storage.
   */
  isFreshInstall() {
    const host = this.host;
    host.ensureInitialized();
    const raw = host.scriptProperties.getProperty(ConfigurationManager.CONFIG_STORE_KEY);
    return raw == null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConfigurationManagerLockedWrite };
}
