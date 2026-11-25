// progressTracker.js

/* global ABLogger, GASPropertiesUtils, ProgressTrackerStore */

/** Sort comparator result for a value that precedes another. */
const SORT_BEFORE = -1;

/**
 * Reads all keyed progress records for the frontend transport.
 *
 * @remarks The legacy unkeyed `ProgressTracker` record is excluded deliberately: it backs call
 * sites with no active run context and carries no `requestId` for the frontend to correlate.
 * Malformed keyed values are logged and skipped so one corrupt entry cannot fail the whole
 * request; a failure to read the property store propagates to the apiHandler error boundary.
 * @returns {{ tasks: Array<Object> }} Keyed records sorted by timestamp, then requestId.
 */
function getProgress_() {
  const properties = GASPropertiesUtils.getUserProperties();
  const entries = ProgressTrackerStore.readAll(properties);
  const tasks = [];

  for (const { key, value } of entries) {
    // parse() warns and returns null for malformed JSON, so a corrupt entry
    // is skipped with one warning instead of failing the whole request.
    const record = ProgressTrackerStore.parse(value, key);
    if (record === null) continue;

    if (
      typeof record !== 'object' ||
      typeof record.requestId !== 'string' ||
      record.requestId.length === 0
    ) {
      ABLogger.getInstance().warn('Skipping keyed progress record with no requestId.', { key });
      continue;
    }

    tasks.push(record);
  }

  tasks.sort((a, b) => {
    if (a.timestamp < b.timestamp) return SORT_BEFORE;
    if (a.timestamp > b.timestamp) return 1;
    if (a.requestId < b.requestId) return SORT_BEFORE;
    if (a.requestId > b.requestId) return 1;
    return 0;
  });

  return { tasks };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getProgress_ };
}
