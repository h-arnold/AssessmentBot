// apiConstants.js

const API_METHODS = Object.freeze({
  getAuthorisationStatus: 'getAuthorisationStatus',
});

const API_ALLOWLIST = Object.freeze({
  [API_METHODS.getAuthorisationStatus]: API_METHODS.getAuthorisationStatus,
});

const ACTIVE_LIMIT = 25;
const MAX_TRACKED_REQUESTS = 30;
const STALE_REQUEST_AGE_MS = 15 * 60 * 1000;
const USER_REQUEST_STORE_KEY = 'AB_USER_REQUEST_STORE';

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    API_METHODS,
    API_ALLOWLIST,
    ACTIVE_LIMIT,
    MAX_TRACKED_REQUESTS,
    STALE_REQUEST_AGE_MS,
    USER_REQUEST_STORE_KEY,
  };
}
