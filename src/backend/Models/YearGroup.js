// YearGroup.js

/* global Validate */

/**
 * Represents a year-group reference record.
 * A year group defines student cohort progression through an academic year.
 */
class YearGroup {
  /**
   * Constructs a YearGroup instance.
   * @param {string} key - Stable key for the year group
   * @param {string} name - The year-group display name
   */
  constructor(key, name) {
    Validate.requireParams({ key, name }, 'YearGroup.constructor');
    this.key = '';
    this.name = '';
    this.setKey(key);
    this.setName(name);
  }

  /**
   * Gets the stable year-group key.
   * @returns {string} Stable key identifier
   */
  getKey() {
    return this.key;
  }

  /**
   * Sets the stable year-group key.
   * @param {string} key - Stable key identifier
   */
  setKey(key) {
    Validate.requireParams({ key }, 'YearGroup.setKey');

    if (!Validate.isNonEmptyString(key)) {
      throw new TypeError('key must be a non-empty string.');
    }

    this.key = key.trim();
  }

  /**
   * Gets the year group display name.
   * @returns {string} The year group name
   */
  getName() {
    return this.name;
  }

  /**
   * Sets the year group display name.
   * @param {string} name - The year-group display name
   */
  setName(name) {
    Validate.requireParams({ name }, 'YearGroup.setName');

    if (!Validate.isNonEmptyString(name)) {
      throw new TypeError('name must be a non-empty string.');
    }

    this.name = name.trim();
  }

  /**
   * Serializes the YearGroup instance to a JSON object.
   * @returns {Object} The JSON representation of the year group
   */
  toJSON() {
    return {
      key: this.key,
      name: this.name,
    };
  }

  /**
   * Deserializes a JSON object to a YearGroup instance.
   * @param {Object} json - The serialised year group object
   * @returns {YearGroup} The YearGroup instance
   */
  static fromJSON(json) {
    Validate.requireParams({ json }, 'YearGroup.fromJSON');

    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new TypeError('json must be an object.');
    }

    return new YearGroup(json.key, json.name);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { YearGroup };
}
