// AssignmentTopic.js

/* global Validate */

/**
 * Represents an assignment-topic reference record.
 * An assignment topic defines categorisation for assessment tasks and can be
 * associated with multiple year groups.
 *
 * @remarks This model supports multi-year-group association via yearGroupKeys,
 * allowing a topic to belong to multiple year groups.
 */
class AssignmentTopic {
  /**
   * Constructs an AssignmentTopic instance.
   * @param {string} key - Stable key for the assignment topic
   * @param {string} name - The assignment-topic display name
   * @param {string[]} yearGroupKeys - Array of year-group keys this topic applies to
   */
  constructor(key, name, yearGroupKeys) {
    Validate.requireParams({ key, name, yearGroupKeys }, 'AssignmentTopic.constructor');
    this.key = '';
    this.name = '';
    this.yearGroupKeys = [];

    this.setKey(key);
    this.setName(name);
    this.setYearGroupKeys(yearGroupKeys);
  }

  /**
   * Gets the stable assignment-topic key.
   * @returns {string} Stable key identifier
   */
  getKey() {
    return this.key;
  }

  /**
   * Sets the stable assignment-topic key.
   * @param {string} key - Stable key identifier
   */
  setKey(key) {
    Validate.requireParams({ key }, 'AssignmentTopic.setKey');

    this.key = Validate.validateTrimmedNonEmptyString('key', key);
  }

  /**
   * Gets the assignment-topic display name.
   * @returns {string} The assignment-topic name
   */
  getName() {
    return this.name;
  }

  /**
   * Sets the assignment-topic display name.
   * @param {string} name - The assignment-topic display name
   */
  setName(name) {
    Validate.requireParams({ name }, 'AssignmentTopic.setName');

    this.name = Validate.validateTrimmedNonEmptyString('name', name);
  }

  /**
   * Gets the year-group keys this topic applies to.
   * @returns {string[]} Array of year-group keys
   */
  getYearGroupKeys() {
    return this.yearGroupKeys;
  }

  /**
   * Sets the year-group keys this topic applies to.
   * @param {string[]} yearGroupKeys - Array of year-group keys
   */
  setYearGroupKeys(yearGroupKeys) {
    Validate.requireParams({ yearGroupKeys }, 'AssignmentTopic.setYearGroupKeys');

    if (!Array.isArray(yearGroupKeys)) {
      throw new TypeError('yearGroupKeys must be an array.');
    }

    this.yearGroupKeys = [];

    for (const [index, yearGroupKey] of yearGroupKeys.entries()) {
      this.yearGroupKeys.push(
        Validate.validateTrimmedNonEmptyString(`yearGroupKeys[${index}]`, yearGroupKey)
      );
    }
  }

  /**
   * Serializes the AssignmentTopic instance to a JSON object.
   * @returns {Object} The JSON representation of the assignment topic
   */
  toJSON() {
    return {
      key: this.key,
      name: this.name,
      yearGroupKeys: this.yearGroupKeys,
    };
  }

  /**
   * Deserializes a JSON object to an AssignmentTopic instance.
   * @param {Object} json - The serialised assignment-topic object
   * @returns {AssignmentTopic} The AssignmentTopic instance
   */
  static fromJSON(json) {
    Validate.requireParams({ json }, 'AssignmentTopic.fromJSON');

    const topicJson = Validate.validatePlainObject('json', json);

    return new AssignmentTopic(topicJson.key, topicJson.name, topicJson.yearGroupKeys);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { AssignmentTopic };
}
