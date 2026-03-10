// Cohort.js

/* global Validate */

const CONSTRUCTOR_ARG_COUNT_WITH_ACTIVE = 2;

/**
 * Represents a cohort reference record.
 */
class Cohort {
  /**
   * @param {string} name The cohort display name.
   * @param {boolean} [active] Whether the cohort is active.
   */
  constructor(name, active) {
    Validate.requireParams({ name }, 'Cohort.constructor');
    this.name = '';
    this.active = true;

    this.setName(name);
    this.setActive(arguments.length < CONSTRUCTOR_ARG_COUNT_WITH_ACTIVE ? true : active);
  }

  /**
   * @returns {string}
   */
  getName() {
    return this.name;
  }

  /**
   * @param {string} name The cohort display name.
   */
  setName(name) {
    Validate.requireParams({ name }, 'Cohort.setName');

    if (!Validate.isNonEmptyString(name)) {
      throw new TypeError('name must be a non-empty string.');
    }

    this.name = name.trim();
  }

  /**
   * @returns {boolean}
   */
  getActive() {
    return this.active;
  }

  /**
   * @param {boolean} active Whether the cohort is active.
   */
  setActive(active) {
    Validate.requireParams({ active }, 'Cohort.setActive');

    if (!Validate.isBoolean(active)) {
      throw new TypeError('active must be a boolean.');
    }

    this.active = active;
  }

  /**
   * @returns {{name: string, active: boolean}}
   */
  toJSON() {
    return {
      name: this.name,
      active: this.active,
    };
  }

  /**
   * @param {{name: string, active?: boolean}} json The serialised cohort.
   * @returns {Cohort}
   */
  static fromJSON(json) {
    Validate.requireParams({ json }, 'Cohort.fromJSON');

    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new TypeError('json must be an object.');
    }

    const active = Object.prototype.hasOwnProperty.call(json, 'active') ? json.active : true;
    return new Cohort(json.name, active);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Cohort };
}
