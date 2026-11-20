const ABCLASS_METADATA_MAX_SCORE = 5;
const ABCLASS_METADATA_MAX_RECENT_ASSIGNMENTS = 3;
const BASELINE_AVERAGES_FIELD = 'baselineAverages';
const ALL_TASK_STANDINGS_FIELD = 'allTaskStandings';
const BASELINE_STANDINGS_FIELD = 'baselineStandings';
const NEW_METADATA_FIELDS = [
  BASELINE_AVERAGES_FIELD,
  ALL_TASK_STANDINGS_FIELD,
  BASELINE_STANDINGS_FIELD,
];

/**
 * Authoritative validation and ownership boundary for ABClass assessment snapshots.
 * Runtime references to Validate, Assessment, ABClassMetadataStandings and the error class
 * are resolved only when methods run, matching the concatenated Google Apps Script load
 * model: this file sorts before `Models/Assessment.js` and `Models/ABClassMetadataStandings.js`.
 *
 * @remarks The legacy two-field shape is accepted on reads without backfill so stored
 * snapshots stay readable; reads emit the current five-field shape with null placeholders in
 * memory and never write stored bytes.
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
   * Returns the four metadata metrics: the canonical criteria plus the weighted
   * overall score. Derived at call time because this file loads before
   * `Models/Assessment.js` in the concatenated script.
   * @returns {string[]} Metric names in validation order.
   * @private
   */
  static _metrics() {
    return [...Assessment.CRITERIA, 'overall'];
  }

  /**
   * Requires an ordinary exact record with all required own properties.
   * @param {*} value - Candidate record.
   * @param {string} context - Error path prefix.
   * @param {string[]} requiredKeys - Required property names.
   * @param {string[]} [optionalKeys=[]] - Additional permitted property names.
   * @private
   */
  static _checkRecord(value, context, requiredKeys, optionalKeys = []) {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      ABClassMetadata._fail('must be a plain record', context);
    }

    const permittedKeys = new Set(requiredKeys);
    for (const key of optionalKeys) permittedKeys.add(key);
    for (const key of requiredKeys) {
      if (!Object.hasOwn(value, key)) ABClassMetadata._fail('is required', `${context}.${key}`);
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !permittedKeys.has(key)) {
        ABClassMetadata._fail(
          'contains an unexpected field',
          typeof key === 'string' ? `${context}.${key}` : context
        );
      }
    }
  }

  /**
   * Rejects extra own array properties on an already checked dense-index array.
   * Owned here so the facade and the nested standings helper share one array strictness rule.
   * @param {Array} value - Array to inspect.
   * @param {string} context - Error path prefix for the array.
   * @returns {void}
   * @private
   */
  static _checkArrayKeys(value, context) {
    const validKeys = new Set([
      'length',
      ...Array.from({ length: value.length }, (_, index) => String(index)),
    ]);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !validKeys.has(key)) {
        ABClassMetadata._fail('contains an unexpected array property', context);
      }
    }
  }

  /**
   * Rejects a sparse slot at one array index, preserving the caller's validation order.
   * @param {Array} value - Array to inspect.
   * @param {number} index - Index to check.
   * @param {string} context - Error path prefix for the array.
   * @returns {void}
   * @private
   */
  static _assertDenseIndex(value, index, context) {
    if (!Object.hasOwn(value, index)) {
      ABClassMetadata._fail('must not contain sparse entries', `${context}[${index}]`);
    }
  }

  /**
   * Validates the four score properties on a record already checked for shape.
   * @param {Object} scores - Score values.
   * @param {string} context - Error path prefix.
   * @private
   */
  static _validateScoreFields(scores, context) {
    for (const metric of ABClassMetadata._metrics()) {
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
    const metrics = ABClassMetadata._metrics();
    ABClassMetadata._checkRecord(scores, context, metrics);
    ABClassMetadata._validateScoreFields(scores, context);
  }

  /**
   * Validates class averages and delegates the extracted score fields to the shared validator.
   * @param {*} value - Class-average record.
   * @param {string} [context='metadata.classAverages'] - Error path prefix.
   */
  static validateClassAverages(value, context = 'metadata.classAverages') {
    const metrics = ABClassMetadata._metrics();
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
   * Validates nullable metadata, legacy or current shape, dense recent entries and ordering.
   * The three new fields may be omitted (legacy shape), explicitly null or present with a
   * valid value; a present undefined is rejected.
   * @param {*} value - Metadata snapshot or null.
   * @param {string} [context='metadata'] - Error path prefix.
   */
  static validateMetadata(value, context = 'metadata') {
    if (value === null) return;
    ABClassMetadata._checkRecord(
      value,
      context,
      ['classAverages', 'recentAssignments'],
      NEW_METADATA_FIELDS
    );
    ABClassMetadata.validateClassAverages(value.classAverages, `${context}.classAverages`);
    const entries = value.recentAssignments;
    if (!Array.isArray(entries) || entries.length > ABCLASS_METADATA_MAX_RECENT_ASSIGNMENTS) {
      ABClassMetadata._fail(
        'must be an array containing zero to three entries',
        `${context}.recentAssignments`
      );
    }
    ABClassMetadata._checkArrayKeys(entries, `${context}.recentAssignments`);
    const assignmentIds = new Set();
    let previousTimestamp = null;
    for (let index = 0; index < entries.length; index += 1) {
      ABClassMetadata._assertDenseIndex(entries, index, `${context}.recentAssignments`);
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
    ABClassMetadata._validateNewFields(value, context, entries.length);
  }

  /**
   * Validates the three optional current-shape fields once the base shape is known valid.
   * Nested rules are owned by the sibling ABClassMetadataStandings module; references stay
   * inside this method body to respect the concatenated GAS load order.
   * @param {Object} value - Previously validated metadata base shape.
   * @param {string} context - Error path prefix.
   * @param {number} recentCount - Number of recent assignments each score array must match.
   * @returns {void}
   * @private
   */
  static _validateNewFields(value, context, recentCount) {
    for (const field of NEW_METADATA_FIELDS) {
      if (!Object.hasOwn(value, field)) continue;
      const nested = value[field];
      if (nested === undefined) {
        ABClassMetadata._fail('must not be undefined', `${context}.${field}`);
      } else if (nested !== null) {
        if (field === BASELINE_AVERAGES_FIELD) {
          ABClassMetadataStandings.validateBaselineAverages(nested, `${context}.${field}`);
        } else {
          ABClassMetadataStandings.validateStandings(nested, `${context}.${field}`, recentCount);
        }
      }
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
   * Copies the canonical five-field shape into plain, independently owned objects.
   * Omitted legacy fields become null placeholders; nested validators and copy helpers live
   * in the sibling ABClassMetadataStandings module and are referenced at call time only.
   * @param {Object|null} value - Previously validated metadata.
   * @returns {Object|null} A plain defensive copy.
   * @private
   */
  static _copyMetadata(value) {
    if (value === null) return null;
    const recentAssignments = Array.from(value.recentAssignments, (entry) => {
      return {
        assignmentId: entry.assignmentId,
        assignmentDefinitionKey: entry.assignmentDefinitionKey,
        averages: {
          completeness: entry.averages.completeness,
          accuracy: entry.averages.accuracy,
          spag: entry.averages.spag,
          overall: entry.averages.overall,
        },
        updatedAt: entry.updatedAt,
      };
    });
    const copy = {
      classAverages: {
        completeness: value.classAverages.completeness,
        accuracy: value.classAverages.accuracy,
        spag: value.classAverages.spag,
        overall: value.classAverages.overall,
        updatedAt: value.classAverages.updatedAt,
      },
      recentAssignments,
    };
    for (const field of NEW_METADATA_FIELDS) {
      const nested = Object.hasOwn(value, field) ? value[field] : null;
      if (nested === null) {
        copy[field] = null;
      } else if (field === BASELINE_AVERAGES_FIELD) {
        copy[field] = ABClassMetadataStandings.copyBaselineAverages(nested);
      } else {
        copy[field] = ABClassMetadataStandings.copyStandings(nested);
      }
    }
    return copy;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ABClassMetadata };
}
