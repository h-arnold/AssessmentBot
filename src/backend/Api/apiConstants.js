// apiConstants.js

const API_METHODS = Object.freeze({
  getAuthorisationStatus: 'getAuthorisationStatus',
  getABClassPartials: 'getABClassPartials',
  getCohorts: 'getCohorts',
  createCohort: 'createCohort',
  updateCohort: 'updateCohort',
  deleteCohort: 'deleteCohort',
  getYearGroups: 'getYearGroups',
  createYearGroup: 'createYearGroup',
  updateYearGroup: 'updateYearGroup',
  deleteYearGroup: 'deleteYearGroup',
});

const API_ALLOWLIST = Object.freeze({
  [API_METHODS.getAuthorisationStatus]: API_METHODS.getAuthorisationStatus,
  [API_METHODS.getABClassPartials]: API_METHODS.getABClassPartials,
  [API_METHODS.getCohorts]: API_METHODS.getCohorts,
  [API_METHODS.createCohort]: API_METHODS.createCohort,
  [API_METHODS.updateCohort]: API_METHODS.updateCohort,
  [API_METHODS.deleteCohort]: API_METHODS.deleteCohort,
  [API_METHODS.getYearGroups]: API_METHODS.getYearGroups,
  [API_METHODS.createYearGroup]: API_METHODS.createYearGroup,
  [API_METHODS.updateYearGroup]: API_METHODS.updateYearGroup,
  [API_METHODS.deleteYearGroup]: API_METHODS.deleteYearGroup,
});

const ACTIVE_REQUEST_STALE_MINUTES = 15;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

const ACTIVE_LIMIT = 25;
const MAX_TRACKED_REQUESTS = 30;
const STALE_REQUEST_AGE_MS = ACTIVE_REQUEST_STALE_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;
const USER_REQUEST_STORE_KEY = 'AB_USER_REQUEST_STORE';

const LOCK_TIMEOUT_MS = 1000;
const LOCK_WAIT_WARN_THRESHOLD_MS = 300;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    API_METHODS,
    API_ALLOWLIST,
    ACTIVE_LIMIT,
    MAX_TRACKED_REQUESTS,
    STALE_REQUEST_AGE_MS,
    USER_REQUEST_STORE_KEY,
    LOCK_TIMEOUT_MS,
    LOCK_WAIT_WARN_THRESHOLD_MS,
  };
}
