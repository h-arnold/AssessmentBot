/**
 * ProgressTrackerStore - keyed User Property access for progress records.
 *
 * Owns key derivation and serialisation so the facade only decides which run
 * is active. A missing request ID selects the legacy unkeyed record. This
 * module does not inspect malformed values: aggregation and cleanup own that
 * decision.
 *
 * @namespace
 */
const ProgressTrackerStore = {
  /** Prefix and legacy key name: keyed records append the request ID directly. */
  LEGACY_KEY: 'ProgressTracker',

  /**
   * Derives the User Property key for a run.
   * @param {string|null|undefined} requestId - Correlation ID for the run, or absent for the legacy record.
   * @returns {string} The property key holding the record.
   */
  keyFor(requestId) {
    if (!requestId) return this.LEGACY_KEY;
    return `${this.LEGACY_KEY}${requestId}`;
  },

  /**
   * Reads and parses a single progress record.
   * @param {GoogleAppsScript.Properties.Properties} properties - User Property store supplied by the facade.
   * @param {string|null|undefined} requestId - Correlation ID for the run, or absent for the legacy record.
   * @returns {Object|null} The parsed record, or null when no value is stored.
   */
  read(properties, requestId) {
    const raw = properties.getProperty(this.keyFor(requestId));
    if (!raw) return null;
    return JSON.parse(raw);
  },

  /**
   * Serialises and writes a progress record. Keyed records always carry their request ID.
   * @param {GoogleAppsScript.Properties.Properties} properties - User Property store supplied by the facade.
   * @param {string|null|undefined} requestId - Correlation ID for the run, or absent for the legacy record.
   * @param {Object} record - Record fields to persist.
   * @returns {void}
   */
  write(properties, requestId, record) {
    const stored = requestId ? { ...record, requestId } : record;
    properties.setProperty(this.keyFor(requestId), JSON.stringify(stored));
  },

  /**
   * Deletes a single progress record.
   * @param {GoogleAppsScript.Properties.Properties} properties - User Property store supplied by the facade.
   * @param {string|null|undefined} requestId - Correlation ID for the run, or absent for the legacy record.
   * @returns {void}
   */
  delete(properties, requestId) {
    properties.deleteProperty(this.keyFor(requestId));
  },

  /**
   * Lists raw values for all keyed records, excluding the legacy unkeyed record.
   * Callers own parsing and malformed-record handling; this helper only filters keys.
   * @param {GoogleAppsScript.Properties.Properties} properties - User Property store supplied by the facade.
   * @returns {Array<{key: string, value: string}>} Keyed property entries as stored.
   */
  readAll(properties) {
    const allProperties = properties.getProperties();
    const entries = [];
    for (const [key, value] of Object.entries(allProperties)) {
      if (key.startsWith(this.LEGACY_KEY) && key !== this.LEGACY_KEY) {
        entries.push({ key, value });
      }
    }
    return entries;
  },
};

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressTrackerStore;
}
