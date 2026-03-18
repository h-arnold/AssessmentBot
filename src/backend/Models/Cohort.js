// Cohort.js

/* global Validate */

const CONSTRUCTOR_ARG_COUNT_WITH_ACTIVE = 2;

/**
 * Represents a cohort reference record.
 */
class Cohort {
  /**
   * Constructs a Cohort instance.
   * @param {string} name - The cohort display name
   * @param {boolean} [active] - Whether the cohort is active (defaults to true)
   */
  constructor(name, active) {
    Validate.requireParams({ name }, 'Cohort.constructor');
    this.name = '';
    this.active = true;

    this.setName(name);
    this.setActive(arguments.length < CONSTRUCTOR_ARG_COUNT_WITH_ACTIVE ? true : active);
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

    if (!Validate.isNonEmptyString(name)) {
      throw new TypeError('name must be a non-empty string.');
    }

    this.name = name.trim();
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
   * Serializes the Cohort instance to a JSON object.
   * @returns {Object} The JSON representation of the cohort
   */
  toJSON() {
    return {
      name: this.name,
      active: this.active,
    };
  }

  /**
   * Deserializes a JSON object to a Cohort instance.
   * @param {Object} json - The serialised cohort object
   * @returns {Cohort} The Cohort instance
   */
  static fromJSON(json) {
    Validate.requireParams({ json }, 'Cohort.fromJSON');

    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new TypeError('json must be an object.');
    }

    const active = Object.hasOwn(json, 'active') ? json.active : true;
    return new Cohort(json.name, active);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Cohort };
}
