// YearGroup.js

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
 * Represents a year-group reference record.
 */
class YearGroup {
  /**
   * @param {string} name The year-group display name.
   */
  constructor(name) {
    getValidate().requireParams({ name }, 'YearGroup.constructor');
    this.name = '';
    this.setName(name);
  }

  /**
   * @returns {string}
   */
  getName() {
    return this.name;
  }

  /**
   * @param {string} name The year-group display name.
   */
  setName(name) {
    const validate = getValidate();
    validate.requireParams({ name }, 'YearGroup.setName');

    if (!validate.isNonEmptyString(name)) {
      throw new TypeError('name must be a non-empty string.');
    }

    this.name = name.trim();
  }

  /**
   * @returns {{name: string}}
   */
  toJSON() {
    return {
      name: this.name,
    };
  }

  /**
   * @param {{name: string}} json The serialised year group.
   * @returns {YearGroup}
   */
  static fromJSON(json) {
    const validate = getValidate();
    validate.requireParams({ json }, 'YearGroup.fromJSON');

    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new TypeError('json must be an object.');
    }

    return new YearGroup(json.name);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { YearGroup };
}
