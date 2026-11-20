const ABCLASS_METADATA_MAX_STANDINGS = 3;

/**
 * Nested baseline-average and standings validators for ABClass assessment metadata.
 *
 * @remarks These validators live in a sibling module so the ABClassMetadata facade stays
 * under the 500-line backend lint gate. Score, record and timestamp rules stay owned by
 * ABClassMetadata and are reused through its static methods. Every reference to
 * ABClassMetadata is resolved inside a method body: the builder concatenates backend files
 * by filename, so ABClassMetadata.js loads before this file and no module-load-time reference
 * is safe.
 */
const ABClassMetadataStandings = {
  /**
   * Validates a baseline averages snapshot: the four scores plus a canonical timestamp.
   * @param {*} value - Candidate baseline averages record.
   * @param {string} context - Error path prefix.
   * @returns {void}
   */
  validateBaselineAverages(value, context) {
    const metrics = ABClassMetadata._metrics();
    ABClassMetadata._checkRecord(value, context, [...metrics, 'updatedAt']);
    const scores = {};
    for (const metric of metrics) scores[metric] = value[metric];
    ABClassMetadata.validateAverageScores(scores, context);
    ABClassMetadata._validateTimestamp(value.updatedAt, `${context}.updatedAt`);
  },

  /**
   * Validates one standings object with exactly a top and a bottom list.
   * @param {*} value - Candidate standings record.
   * @param {string} context - Error path prefix.
   * @param {number} recentCount - Number of recent assignments each score array must match.
   * @returns {void}
   */
  validateStandings(value, context, recentCount) {
    ABClassMetadata._checkRecord(value, context, ['top', 'bottom']);
    ABClassMetadataStandings.validateStandingList(value.top, `${context}.top`, recentCount);
    ABClassMetadataStandings.validateStandingList(value.bottom, `${context}.bottom`, recentCount);
  },

  /**
   * Validates a dense zero-to-three list of complete standing entries.
   * @param {*} value - Candidate standing list.
   * @param {string} context - Error path prefix.
   * @param {number} recentCount - Number of recent assignments each score array must match.
   * @returns {void}
   */
  validateStandingList(value, context, recentCount) {
    if (!Array.isArray(value) || value.length > ABCLASS_METADATA_MAX_STANDINGS) {
      ABClassMetadata._fail('must be an array containing zero to three entries', context);
    }
    ABClassMetadata._checkArrayKeys(value, context);
    for (let index = 0; index < value.length; index += 1) {
      ABClassMetadata._assertDenseIndex(value, index, context);
      ABClassMetadataStandings.validateStandingEntry(
        value[index],
        `${context}[${index}]`,
        recentCount
      );
    }
  },

  /**
   * Validates one student standing: trimmed identity, score set and aligned recent scores.
   * @param {*} value - Candidate standing entry.
   * @param {string} context - Error path prefix.
   * @param {number} recentCount - Number of recent assignments each score array must match.
   * @returns {void}
   */
  validateStandingEntry(value, context, recentCount) {
    ABClassMetadata._checkRecord(value, context, [
      'studentId',
      'studentName',
      'scores',
      'recentAssignmentScores',
    ]);
    ABClassMetadataStandings._validateIdentifier(value.studentId, `${context}.studentId`);
    ABClassMetadataStandings._validateIdentifier(value.studentName, `${context}.studentName`);
    ABClassMetadata.validateAverageScores(value.scores, `${context}.scores`);
    ABClassMetadataStandings.validateRecentAssignmentScores(
      value.recentAssignmentScores,
      `${context}.recentAssignmentScores`,
      recentCount
    );
  },

  /**
   * Validates a dense score array aligned one-to-one with the recent assignments.
   * @param {*} value - Candidate recent-assignment score list.
   * @param {string} context - Error path prefix.
   * @param {number} recentCount - Required number of score sets.
   * @returns {void}
   */
  validateRecentAssignmentScores(value, context, recentCount) {
    if (!Array.isArray(value) || value.length > ABCLASS_METADATA_MAX_STANDINGS) {
      ABClassMetadata._fail('must be an array containing zero to three entries', context);
    }
    if (value.length !== recentCount) {
      ABClassMetadata._fail('must contain one score set per recent assignment', context);
    }
    ABClassMetadata._checkArrayKeys(value, context);
    for (let index = 0; index < value.length; index += 1) {
      ABClassMetadata._assertDenseIndex(value, index, context);
      ABClassMetadata.validateAverageScores(value[index], `${context}[${index}]`);
    }
  },

  /**
   * Requires a non-empty, already-trimmed string identifier.
   * @param {*} value - Candidate identifier.
   * @param {string} context - Error path prefix.
   * @returns {void}
   * @private
   */
  _validateIdentifier(value, context) {
    if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
      ABClassMetadata._fail('must be a non-empty, already-trimmed string', context);
    }
  },

  /**
   * Copies a validated baseline averages snapshot into a detached plain record.
   * @param {Object} value - Validated baseline averages.
   * @returns {Object} An independently owned baseline averages record.
   */
  copyBaselineAverages(value) {
    const metrics = ABClassMetadata._metrics();
    const copy = {};
    for (const metric of metrics) copy[metric] = value[metric];
    copy.updatedAt = value.updatedAt;
    return copy;
  },

  /**
   * Copies a validated standings object into detached top and bottom arrays.
   * @param {Object} value - Validated standings object.
   * @returns {Object} An independently owned standings record.
   */
  copyStandings(value) {
    return {
      top: Array.from(value.top, (entry) => ABClassMetadataStandings.copyStandingEntry(entry)),
      bottom: Array.from(value.bottom, (entry) =>
        ABClassMetadataStandings.copyStandingEntry(entry)
      ),
    };
  },

  /**
   * Copies one validated standing entry into detached objects and arrays.
   * @param {Object} value - Validated standing entry.
   * @returns {Object} An independently owned standing entry.
   * @private
   */
  copyStandingEntry(value) {
    return {
      studentId: value.studentId,
      studentName: value.studentName,
      scores: ABClassMetadataStandings.copyScoreSet(value.scores),
      recentAssignmentScores: Array.from(value.recentAssignmentScores, (scores) =>
        ABClassMetadataStandings.copyScoreSet(scores)
      ),
    };
  },

  /**
   * Copies a validated four-score set into a detached plain record.
   * @param {Object} value - Validated score set.
   * @returns {Object} An independently owned score set.
   * @private
   */
  copyScoreSet(value) {
    const metrics = ABClassMetadata._metrics();
    const copy = {};
    for (const metric of metrics) copy[metric] = value[metric];
    return copy;
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ABClassMetadataStandings };
}
