// Cohort.js

function getValidate() {
  if (typeof Validate !== 'undefined') {
    return Validate;
  }

  if (typeof require !== 'undefined') {
    return require('../Utils/Validate.js').Validate;
  }

  throw new Error('Validate is not available');
}

/**
 * Represents a cohort reference record.
 */
class Cohort {
  /**
   * @param {string} name The cohort display name.
   * @param {boolean} [active] Whether the cohort is active.
   */
  constructor(name, active) {
    getValidate().requireParams({ name }, 'Cohort.constructor');
    this.name = '';
    this.active = true;

    this.setName(name);
    this.setActive(arguments.length < 2 ? true : active);
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
    const validate = getValidate();
    validate.requireParams({ name }, 'Cohort.setName');

    if (!validate.isNonEmptyString(name)) {
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
    const validate = getValidate();
    validate.requireParams({ active }, 'Cohort.setActive');

    if (!validate.isBoolean(active)) {
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
    const validate = getValidate();
    validate.requireParams({ json }, 'Cohort.fromJSON');

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
