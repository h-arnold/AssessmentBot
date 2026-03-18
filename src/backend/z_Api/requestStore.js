// requestStore.js

/* global PropertiesService, ABLogger, Validate */

let maxTrackedRequests;
let userRequestStoreKey;

if (typeof module !== 'undefined' && module.exports) {
  ({
    MAX_TRACKED_REQUESTS: maxTrackedRequests,
    USER_REQUEST_STORE_KEY: userRequestStoreKey,
  } = require('./apiConstants.js'));
} else {
  // In GAS, these are loaded as global constants from apiConstants.js.
  maxTrackedRequests = MAX_TRACKED_REQUESTS;
  userRequestStoreKey = USER_REQUEST_STORE_KEY;
}

/**
 * Returns a new started-request record. Pure factory — does not read or write properties.
 * Used to track when a request was initiated.
 *
 * @param {string} requestId - Unique identifier for this request.
 * @param {string} method - API method name that was invoked.
 * @returns {Object} Started record with requestId, method, status, and timestamp.
 * @throws {Error} Throws if requestId or method validation fails.
 */
function createStartedRecord(requestId, method) {
  Validate.requireParams({ requestId, method }, 'createStartedRecord');
  return {
    requestId,
    method,
    status: 'started',
    startedAtMs: Date.now(),
  };
}

/**
 * Loads the request store from user properties.
 * Returns an empty object if the property is absent, unparseable, or not a plain object.
 * Logs warnings if the stored value is invalid or unparseable.
 *
 * @returns {Object} Request store object mapping requestId to record. May be empty.
 */
function loadStore() {
  const raw = PropertiesService.getUserProperties().getProperty(userRequestStoreKey);

  if (raw === null) {
    return {};
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    ABLogger.getInstance().warn('Failed to parse user request store — resetting to empty.', error);
    return {};
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    ABLogger.getInstance().warn(
      'User request store contained unexpected value type — resetting to empty.',
      parsed
    );
    return {};
  }

  return parsed;
}

/**
 * Persists the request store to user properties as a JSON string.
 *
 * @param {Object} store - The request store object to persist.
 * @throws {Error} Throws if store validation fails or persistence fails.
 */
function saveStore(store) {
  Validate.requireParams({ store }, 'saveStore');
  PropertiesService.getUserProperties().setProperty(userRequestStoreKey, JSON.stringify(store));
}

/**
 * Marks a request as successful in the store.
 * Records the completion timestamp as the current time.
 * Mutates and returns the store.
 *
 * @param {Object} store - The request store object.
 * @param {string} requestId - The request ID to mark as successful.
 * @returns {Object} The mutated store object.
 * @throws {Error} Throws if store or requestId validation fails.
 */
function markSuccess(store, requestId) {
  Validate.requireParams({ store, requestId }, 'markSuccess');
  store[requestId].status = 'success';
  store[requestId].finishedAtMs = Date.now();
  return store;
}

/**
 * Marks a request as failed in the store.
 * Records the completion timestamp and error message for diagnostics.
 * Mutates and returns the store.
 *
 * @param {Object} store - The request store object.
 * @param {string} requestId - The request ID to mark as failed.
 * @param {string} errorMessage - The error message to store.
 * @returns {Object} The mutated store object.
 * @throws {Error} Throws if store, requestId, or errorMessage validation fails.
 */
function markError(store, requestId, errorMessage) {
  Validate.requireParams({ store, requestId, errorMessage }, 'markError');
  store[requestId].status = 'error';
  store[requestId].finishedAtMs = Date.now();
  store[requestId].errorMessage = errorMessage;
  return store;
}

/**
 * Removes stale started entries from the store.
 * An entry is considered stale when its status is 'started' and its startedAtMs is older than the given threshold.
 * Completed entries (success or error) are never removed by this function.
 * Mutates and returns the store.
 *
 * @param {Object} store - The request store object.
 * @param {number} stalenessThresholdMs - Age in milliseconds beyond which a started entry is stale.
 * @returns {Object} The mutated store object.
 * @throws {Error} Throws if store or stalenessThresholdMs validation fails.
 */
function pruneStaleEntries(store, stalenessThresholdMs) {
  Validate.requireParams({ store, stalenessThresholdMs }, 'pruneStaleEntries');
  const cutoffMs = Date.now() - stalenessThresholdMs;
  for (const [id, entry] of Object.entries(store)) {
    if (entry.status === 'started' && entry.startedAtMs < cutoffMs) {
      delete store[id];
    }
  }
  return store;
}

/**
 * Compacts the request store by removing oldest completed entries when the store exceeds MAX_TRACKED_REQUESTS.
 * Active (started) entries are always preserved to ensure ongoing requests are not lost.
 * Completed entries are sorted by start time, with oldest entries removed first.
 * Mutates and returns the store.
 *
 * @param {Object} store - The request store object.
 * @returns {Object} The mutated store object, potentially reduced in size.
 * @throws {Error} Throws if store validation fails.
 */
function compactStore(store) {
  Validate.requireParams({ store }, 'compactStore');
  if (Object.keys(store).length <= maxTrackedRequests) {
    return store;
  }

  const active = [];
  const completed = [];

  for (const entry of Object.values(store)) {
    if (entry.status === 'started') {
      active.push(entry);
    } else {
      completed.push(entry);
    }
  }

  // Sort ascending by startedAtMs so the oldest completed entries are dropped first.
  completed.sort((a, b) => a.startedAtMs - b.startedAtMs);

  while (active.length + completed.length > maxTrackedRequests && completed.length > 0) {
    completed.shift();
  }

  const compacted = {};
  for (const entry of active) {
    compacted[entry.requestId] = entry;
  }
  for (const entry of completed) {
    compacted[entry.requestId] = entry;
  }

  return compacted;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createStartedRecord,
    loadStore,
    saveStore,
    markSuccess,
    markError,
    compactStore,
    pruneStaleEntries,
  };
}
