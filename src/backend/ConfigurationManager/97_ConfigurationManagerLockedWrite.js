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
 * Computes the UTF-8 encoded byte length of a string.
 *
 * Uses a code-point walk rather than `string.length` so the 8KB cap measures the
 * bytes Script Properties actually stores, not UTF-16 code units. Portable across
 * the GAS V8 runtime and Node (no `Buffer`/`TextEncoder` dependency).
 *
 * @param {string} value - The string to measure.
 * @returns {number} The UTF-8 encoded byte length.
 */
function utf8ByteLength_(value) {
  // UTF-8 encoding bounds per RFC 3629, expressed as inclusive code-point maxima.
  const singleByteMaxCodePoint = 127;
  const twoByteMaxCodePoint = 2047;
  const threeByteMaxCodePoint = 65535;
  const singleByteLength = 1;
  const twoByteLength = 2;
  const threeByteLength = 3;
  const fourByteLength = 4;
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index);
    if (codePoint <= singleByteMaxCodePoint) {
      bytes += singleByteLength;
    } else if (codePoint <= twoByteMaxCodePoint) {
      bytes += twoByteLength;
    } else if (codePoint <= threeByteMaxCodePoint) {
      bytes += threeByteLength;
    } else {
      bytes += fourByteLength;
      // Astral code points occupy a surrogate pair; skip the trailing code unit.
      index += 1;
    }
  }
  return bytes;
}

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
    } catch (lockError) {
      ABLogger.getInstance().warn(
        'ConfigurationManager: script lock contention during configuration write.',
        { code: 'CONFIG_LOCK_CONTENTION', cause: lockError }
      );
      const contention = new Error(
        'Configuration write could not acquire the script lock within the timeout.'
      );
      contention.code = 'CONFIG_LOCK_CONTENTION';
      contention.retriable = true;
      // Preserve the original waitLock failure as typed context for diagnostics.
      contention.cause = lockError;
      throw contention;
    }

    try {
      const raw = host._storage.readRawConfigString();
      const current = safeParseConfigObject_(raw);
      const next = mutator(current);
      const serialised = JSON.stringify(next);
      if (utf8ByteLength_(serialised) > MAX_CONFIG_BLOB_BYTES) {
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
      // `next` is the authoritative post-lock state derived from the fresh raw
      // re-read; replacing (not merging) mirrors the stored blob exactly and
      // cannot resurrect keys deleted by a concurrent mutation.
      host.configCache = next;
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Detects a genuinely fresh install.
   * Lets initialisation run first, then reads RAW Script Properties for
   * `__CONFIG_STORE_KEY__` absence (never the forgiving config cache) — unless a
   * populated in-memory cache already proves a stored blob exists, in which case
   * the raw PropertiesService round-trip is skipped.
   * @returns {boolean} True only when the key is absent from raw storage.
   */
  isFreshInstall() {
    const host = this.host;
    host.ensureInitialized();
    // A populated cache (at least one own key) can only have been derived from a
    // present, non-empty stored blob, so the install cannot be fresh. An empty
    // cache (`null` or `{}`) does not prove absence, so the RAW probe still runs.
    if (host.configCache && Object.keys(host.configCache).length > 0) {
      return false;
    }
    const raw = host.scriptProperties.getProperty(ConfigurationManager.CONFIG_STORE_KEY);
    return raw == null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConfigurationManagerLockedWrite };
}
