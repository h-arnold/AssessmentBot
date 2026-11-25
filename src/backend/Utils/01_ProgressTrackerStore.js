/**
 * ProgressTrackerStore - keyed User Property access for progress records.
 *
 * Owns key derivation and serialisation so the facade only decides which run
 * is active. Every record lives at `ProgressTracker<requestId>` with the
 * request ID embedded in the stored value, and key derivation requires a
 * non-empty request ID. The bare `ProgressTracker` key is never written here:
 * entries under it are pre-upgrade data that readAll still returns (prefix
 * filter only) so the cleanup sweep can migrate them away. The `parse` helper
 * restores stored values and warns on bad values (invalid JSON or the JSON
 * literal null); its callers keep their own field-level checks.
 *
 * @namespace
 */
const ProgressTrackerStore = {
  /** Key prefix; the request ID is appended directly to derive a record key. */
  KEY_PREFIX: 'ProgressTracker',

  /**
   * Derives the User Property key for a run.
   * @param {string} requestId - Correlation ID for the run. Required.
   * @returns {string} The property key holding the record.
   * @throws {Error} When requestId is absent, empty or not a string.
   */
  keyFor(requestId) {
    if (typeof requestId !== 'string' || requestId.length === 0) {
      throw new Error('ProgressTrackerStore requires a non-empty requestId string.');
    }
    return `${this.KEY_PREFIX}${requestId}`;
  },

  /**
   * Reads and parses a single progress record.
   * @param {GoogleAppsScript.Properties.Properties} properties - User Property store supplied by the facade.
   * @param {string} requestId - Non-empty correlation ID of the run.
   * @returns {Object|null} The parsed record, or null when no value is stored.
   */
  read(properties, requestId) {
    const raw = properties.getProperty(this.keyFor(requestId));
    if (!raw) return null;
    return JSON.parse(raw);
  },

  /**
   * Serialises and writes a progress record, embedding the request ID.
   * @param {GoogleAppsScript.Properties.Properties} properties - User Property store supplied by the facade.
   * @param {string} requestId - Non-empty correlation ID for the run.
   * @param {Object} record - Record fields to persist.
   * @returns {void}
   */
  write(properties, requestId, record) {
    const stored = { ...record, requestId };
    properties.setProperty(this.keyFor(requestId), JSON.stringify(stored));
  },

  /**
   * Deletes a single progress record.
   * @param {GoogleAppsScript.Properties.Properties} properties - User Property store supplied by the facade.
   * @param {string} requestId - Non-empty correlation ID for the run.
   * @returns {void}
   */
  delete(properties, requestId) {
    properties.deleteProperty(this.keyFor(requestId));
  },

  /**
   * Lists raw entries for every property whose key starts with the prefix,
   * including the bare pre-upgrade key. Callers parse each entry with parse()
   * and keep their own field-level checks; this helper only filters keys.
   * @param {GoogleAppsScript.Properties.Properties} properties - User Property store supplied by the facade.
   * @returns {Array<{key: string, value: string}>} Prefix-matching property entries as stored.
   */
  readAll(properties) {
    const allProperties = properties.getProperties();
    const entries = [];
    for (const [key, value] of Object.entries(allProperties)) {
      if (key.startsWith(this.KEY_PREFIX)) {
        entries.push({ key, value });
      }
    }
    return entries;
  },

  /**
   * Parses a stored value into a progress record.
   *
   * Returns null silently when the value is absent (raw is null; no warning
   * is logged). Otherwise, warns once via ABLogger (with the key for
   * context) and returns null when the value is not valid JSON or is the
   * JSON literal null - which JSON.parse parses successfully, so it must
   * not slip through silently. Callers keep their own field-level checks
   * (record shape, requestId presence) and decide how to treat a null result. Unlike read(),
   * which fails loudly on a malformed value read for an active run, this
   * helper supports readAll() consumers sweeping many records, where one
   * corrupt value must not abort the loop.
   *
   * @param {string|null} raw - Raw stored value; null when the key is absent.
   * @param {string} key - Property key, for the warning context.
   * @returns {Object|null} The parsed value, or null when the key is absent, the JSON is malformed or the value is JSON null.
   */
  parse(raw, key) {
    if (raw === null) {
      return null;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      ABLogger.getInstance().warn(
        'Skipping malformed progress record: the stored value is not valid JSON.',
        {
          key,
          error,
        }
      );
      return null;
    }
    if (parsed === null) {
      ABLogger.getInstance().warn(
        'Skipping malformed progress record: the stored value is JSON null.',
        { key }
      );
      return null;
    }
    return parsed;
  },
};

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressTrackerStore;
}
