// progressTracker.js

/* global ABLogger, GASPropertiesUtils, ProgressTrackerStore */

/**
 * Reads all keyed progress records for the frontend transport.
 *
 * @remarks Progress records are keyed only: `readAll()` lists every `ProgressTracker`-prefixed
 * entry, so a pre-upgrade bare `ProgressTracker` key also reaches the loop. The field-level check
 * below skips any record with an absent or empty `requestId` — which covers that pre-upgrade data —
 * so it never reaches the response; the cleanup sweep deletes the bare key outright.
 * `ProgressTrackerStore.parse()` skips values whose JSON is malformed or which parse to the JSON
 * literal `null`. A parseable partial record with a non-empty `requestId` passes through as-is; this
 * known discrepancy is recorded in the data-shape contract. A failure to read the property store
 * propagates to the apiHandler error boundary.
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
    return (
      String(a.timestamp).localeCompare(String(b.timestamp)) ||
      a.requestId.localeCompare(b.requestId)
    );
  });

  return { tasks };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getProgress_ };
}
