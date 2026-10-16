const ABCLASS_METADATA_METRICS = ['completeness', 'accuracy', 'spag', 'overall'];
const ABCLASS_METADATA_MAX_SCORE = 5;
const ABCLASS_METADATA_MAX_RECENT_ASSIGNMENTS = 3;

/**
 * Authoritative validation and ownership boundary for ABClass assessment snapshots.
 * Runtime references to Validate and the error class are resolved only when methods
 * run, matching the concatenated Google Apps Script load model.
 */
class ABClassMetadata {
  /**
   * Owns a defensive, validated metadata snapshot. Only omitted arguments default to null.
   *
   * @param {Object|null} [value] - Explicit metadata value; explicit undefined is invalid.
   * @throws {ABClassMetadataValidationError} When the supplied value is invalid.
   */
  constructor(value) {
    if (arguments.length === 0) {
      this._value = null;
      return;
    }
    ABClassMetadata.validateMetadata(value, 'metadata');
    this._value = ABClassMetadata._copyMetadata(value);
  }

  /**
   * Revalidates owned state and returns an independently owned plain snapshot or null.
   * @returns {Object|null} A defensive metadata copy.
   */
  toJSON() {
    ABClassMetadata.validateMetadata(this._value, 'metadata');
    return ABClassMetadata._copyMetadata(this._value);
  }

  /**
   * Throws the typed metadata-domain error.
   * @param {string} message - Validation failure description.
   * @param {string} path - Location of the invalid value.
   * @private
   */
  static _fail(message, path) {
    throw new ABClassMetadataValidationError(message, path);
  }

  /**
   * Requires an ordinary exact record with all required own properties.
   * @param {*} value - Candidate record.
   * @param {string} context - Error path prefix.
   * @param {string[]} requiredKeys - Exact permitted property names.
   * @private
   */
  static _checkRecord(value, context, requiredKeys) {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      ABClassMetadata._fail('must be a plain record', context);
    }

    for (const key of requiredKeys) {
      if (!Object.hasOwn(value, key)) ABClassMetadata._fail('is required', `${context}.${key}`);
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !requiredKeys.includes(key)) {
        ABClassMetadata._fail(
          'contains an unexpected field',
          typeof key === 'string' ? `${context}.${key}` : context
        );
      }
    }
  }

  /**
   * Validates the four score properties on a record already checked for shape.
   * @param {Object} scores - Score values.
   * @param {string} context - Error path prefix.
   * @private
   */
  static _validateScoreFields(scores, context) {
    for (const metric of ABCLASS_METADATA_METRICS) {
      ABClassMetadata.validateAverageScore(scores[metric], `${context}.${metric}`);
    }
  }

  /**
   * Enforces the exact finite 0–5 numeric or N/E/excluded score union.
   * @param {*} value - Score to validate.
   * @param {string} [context='metadata'] - Field path used in validation errors.
   */
  static validateAverageScore(value, context = 'metadata') {
    if (
      (typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= ABCLASS_METADATA_MAX_SCORE) ||
      value === 'N' ||
      value === 'E' ||
      value === 'excluded'
    )
      return;
    ABClassMetadata._fail('must be a finite score from 0 to 5 or an allowed marker', context);
  }

  /**
   * Validates exactly the four required average score fields.
   * @param {*} scores - Score record to validate.
   * @param {string} [context='metadata'] - Field path used in validation errors.
   */
  static validateAverageScores(scores, context = 'metadata') {
    const metrics = ABCLASS_METADATA_METRICS;
    ABClassMetadata._checkRecord(scores, context, metrics);
    ABClassMetadata._validateScoreFields(scores, context);
  }

  /**
   * Validates class averages and delegates the extracted score fields to the shared validator.
   * @param {*} value - Class-average record.
   * @param {string} [context='metadata.classAverages'] - Error path prefix.
   */
  static validateClassAverages(value, context = 'metadata.classAverages') {
    const metrics = ABCLASS_METADATA_METRICS;
    ABClassMetadata._checkRecord(value, context, [...metrics, 'updatedAt']);
    const scores = {};
    for (const metric of metrics) scores[metric] = value[metric];
    ABClassMetadata.validateAverageScores(scores, context);
    ABClassMetadata._validateTimestamp(value.updatedAt, `${context}.updatedAt`);
  }

  /**
   * Validates one complete recent-assignment summary.
   * @param {*} value - Recent-assignment record.
   * @param {string} [context='metadata.recentAssignments[0]'] - Error path prefix.
   */
  static validateRecentAssignment(value, context = 'metadata.recentAssignments[0]') {
    const keys = ['assignmentId', 'assignmentDefinitionKey', 'averages', 'updatedAt'];
    ABClassMetadata._checkRecord(value, context, keys);
    for (const key of ['assignmentId', 'assignmentDefinitionKey']) {
      const identifier = value[key];
      if (
        typeof identifier !== 'string' ||
        identifier.length === 0 ||
        identifier.trim() !== identifier
      ) {
        ABClassMetadata._fail('must be a non-empty, already-trimmed string', `${context}.${key}`);
      }
    }
    ABClassMetadata.validateAverageScores(value.averages, `${context}.averages`);
    ABClassMetadata._validateTimestamp(value.updatedAt, `${context}.updatedAt`);
  }

  /**
   * Validates nullable metadata, complete shape, dense recent entries and newest-first ordering.
   * @param {*} value - Metadata snapshot or null.
   * @param {string} [context='metadata'] - Error path prefix.
   */
  static validateMetadata(value, context = 'metadata') {
    if (value === null) return;
    ABClassMetadata._checkRecord(value, context, ['classAverages', 'recentAssignments']);
    ABClassMetadata.validateClassAverages(value.classAverages, `${context}.classAverages`);
    const entries = value.recentAssignments;
    if (!Array.isArray(entries) || entries.length > ABCLASS_METADATA_MAX_RECENT_ASSIGNMENTS) {
      ABClassMetadata._fail(
        'must be an array containing zero to three entries',
        `${context}.recentAssignments`
      );
    }
    const validArrayKeys = new Set([
      'length',
      ...Array.from({ length: entries.length }, (_, i) => String(i)),
    ]);
    for (const key of Reflect.ownKeys(entries)) {
      if (typeof key !== 'string' || !validArrayKeys.has(key)) {
        ABClassMetadata._fail(
          'contains an unexpected array property',
          `${context}.recentAssignments`
        );
      }
    }
    const assignmentIds = new Set();
    let previousTimestamp = null;
    for (let index = 0; index < entries.length; index += 1) {
      if (!Object.hasOwn(entries, index)) {
        ABClassMetadata._fail(
          'must not contain sparse entries',
          `${context}.recentAssignments[${index}]`
        );
      }
      const entry = entries[index];
      const entryPath = `${context}.recentAssignments[${index}]`;
      ABClassMetadata.validateRecentAssignment(entry, entryPath);
      if (assignmentIds.has(entry.assignmentId)) {
        ABClassMetadata._fail(
          'must be unique within recentAssignments',
          `${entryPath}.assignmentId`
        );
      }
      assignmentIds.add(entry.assignmentId);
      if (previousTimestamp !== null && entry.updatedAt > previousTimestamp) {
        ABClassMetadata._fail(
          'must be ordered by non-increasing updatedAt',
          `${entryPath}.updatedAt`
        );
      }
      previousTimestamp = entry.updatedAt;
    }
  }

  /**
   * Enforces the canonical timestamp predicate and reports its field path.
   * @param {*} value - Timestamp candidate.
   * @param {string} context - Error path.
   * @private
   */
  static _validateTimestamp(value, context) {
    if (!Validate.isCanonicalUtcDateTime(value)) {
      ABClassMetadata._fail('must be a canonical UTC datetime', context);
    }
  }

  /**
   * Copies only the canonical fields into plain, independently owned objects.
   * @param {Object|null} value - Previously validated metadata.
   * @returns {Object|null} A plain defensive copy.
   * @private
   */
  static _copyMetadata(value) {
    if (value === null) return null;
    const recentAssignments = [];
    for (let index = 0; index < value.recentAssignments.length; index += 1) {
      const entry = value.recentAssignments[index];
      recentAssignments.push({
        assignmentId: entry.assignmentId,
        assignmentDefinitionKey: entry.assignmentDefinitionKey,
        averages: {
          completeness: entry.averages.completeness,
          accuracy: entry.averages.accuracy,
          spag: entry.averages.spag,
          overall: entry.averages.overall,
        },
        updatedAt: entry.updatedAt,
      });
    }
    return {
      classAverages: {
        completeness: value.classAverages.completeness,
        accuracy: value.classAverages.accuracy,
        spag: value.classAverages.spag,
        overall: value.classAverages.overall,
        updatedAt: value.classAverages.updatedAt,
      },
      recentAssignments,
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ABClassMetadata };
}
