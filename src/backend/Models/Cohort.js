// Cohort.js

/* global Validate */

const ACADEMIC_YEAR_START_MONTH = 9;

/**
 * Resolves the academic-year start for a given date.
 * @param {Date} [now] - Current date reference.
 * @returns {number} Academic-year start year.
 */
function getCurrentAcademicYearStart(now = new Date()) {
  const month = now.getMonth() + 1;
  return month >= ACADEMIC_YEAR_START_MONTH ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Represents a cohort reference record.
 */
class Cohort {
  /**
   * Constructs a Cohort instance.
   * @param {string} key - Stable key for the cohort
   * @param {string} name - The cohort display name
   * @param {boolean} [active] - Whether the cohort is active (defaults to true)
   * @param {number} [startYear] - Academic year start
   * @param {number} [startMonth] - Academic year start month
   */
  constructor(key, name, active, startYear, startMonth) {
    Validate.requireParams({ key, name }, 'Cohort.constructor');
    this.key = '';
    this.name = '';
    this.active = true;
    this.startYear = getCurrentAcademicYearStart();
    this.startMonth = ACADEMIC_YEAR_START_MONTH;

    this.setKey(key);
    this.setName(name);
    this.setActive(active === undefined ? true : active);
    this.setStartMonth(startMonth === undefined ? ACADEMIC_YEAR_START_MONTH : startMonth);
    this.setStartYear(startYear === undefined ? getCurrentAcademicYearStart() : startYear);
  }

  /**
   * Gets the cohort stable key.
   * @returns {string} Stable key
   */
  getKey() {
    return this.key;
  }

  /**
   * Sets the cohort stable key.
   * @param {string} key - Stable key
   */
  setKey(key) {
    Validate.requireParams({ key }, 'Cohort.setKey');

    this.key = Validate.validateTrimmedNonEmptyString('key', key);
  }

  /**
   * Gets the cohort display name.
   * @returns {string} The cohort name
   */
  getName() {
    return this.name;
  }

  /**
   * Sets the cohort display name.
   * @param {string} name - The cohort display name
   */
  setName(name) {
    Validate.requireParams({ name }, 'Cohort.setName');

    this.name = Validate.validateTrimmedNonEmptyString('name', name);
  }

  /**
   * Gets the cohort active status.
   * @returns {boolean} Whether the cohort is active
   */
  getActive() {
    return this.active;
  }

  /**
   * Sets the cohort active status.
   * @param {boolean} active - Whether the cohort is active
   */
  setActive(active) {
    Validate.requireParams({ active }, 'Cohort.setActive');

    if (!Validate.isBoolean(active)) {
      throw new TypeError('active must be a boolean.');
    }

    this.active = active;
  }

  /**
   * Gets the cohort start year.
   * @returns {number} Academic year start
   */
  getStartYear() {
    return this.startYear;
  }

  /**
   * Sets the cohort start year.
   * @param {number} startYear - Academic year start
   */
  setStartYear(startYear) {
    Validate.requireParams({ startYear }, 'Cohort.setStartYear');

    if (!Number.isInteger(startYear)) {
      throw new TypeError('startYear must be an integer.');
    }

    this.startYear = startYear;
  }

  /**
   * Gets the cohort start month.
   * @returns {number} Academic year start month
   */
  getStartMonth() {
    return this.startMonth;
  }

  /**
   * Sets the cohort start month.
   * @param {number} startMonth - Academic year start month
   */
  setStartMonth(startMonth) {
    Validate.requireParams({ startMonth }, 'Cohort.setStartMonth');

    if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
      throw new TypeError('startMonth must be an integer between 1 and 12.');
    }

    this.startMonth = startMonth;
  }

  /**
   * Serializes the Cohort instance to a JSON object.
   * @returns {Object} The JSON representation of the cohort
   */
  toJSON() {
    return {
      key: this.key,
      name: this.name,
      active: this.active,
      startYear: this.startYear,
      startMonth: this.startMonth,
    };
  }

  /**
   * Deserializes a JSON object to a Cohort instance.
   * @param {Object} json - The serialised cohort object
   * @returns {Cohort} The Cohort instance
   */
  static fromJSON(json) {
    Validate.requireParams({ json }, 'Cohort.fromJSON');

    const cohortJson = Validate.validatePlainObject('json', json);

    const active = Object.hasOwn(cohortJson, 'active') ? cohortJson.active : true;
    const startMonth = Object.hasOwn(cohortJson, 'startMonth')
      ? cohortJson.startMonth
      : ACADEMIC_YEAR_START_MONTH;
    const startYear = Object.hasOwn(cohortJson, 'startYear')
      ? cohortJson.startYear
      : getCurrentAcademicYearStart();

    return new Cohort(cohortJson.key, cohortJson.name, active, startYear, startMonth);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Cohort };
}
