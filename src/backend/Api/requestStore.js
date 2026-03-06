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
 * Persists the request store to user properties.
 */
function saveStore(store) {
  Validate.requireParams({ store }, 'saveStore');
  PropertiesService.getUserProperties().setProperty(userRequestStoreKey, JSON.stringify(store));
}

/**
 * Marks a request as successful, recording the completion timestamp.
 * Mutates and returns the store.
 */
function markSuccess(store, requestId) {
  Validate.requireParams({ store, requestId }, 'markSuccess');
  store[requestId].status = 'success';
  store[requestId].finishedAtMs = Date.now();
  return store;
}

/**
 * Marks a request as failed, recording the completion timestamp and error message.
 * Mutates and returns the store.
 */
function markError(store, requestId, errorMessage) {
  Validate.requireParams({ store, requestId, errorMessage }, 'markError');
  store[requestId].status = 'error';
  store[requestId].finishedAtMs = Date.now();
  store[requestId].errorMessage = errorMessage;
  return store;
}

/**
 * Removes the oldest completed entries when the store exceeds MAX_TRACKED_REQUESTS.
 * Active (started) entries are always preserved.
 * Returns the compacted store.
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
  };
}
