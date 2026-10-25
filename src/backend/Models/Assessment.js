// Assessment.gs

const ASSESSMENT_ERROR_MESSAGES = {
  acquisition: {
    SOURCE_UNREADABLE: 'The submitted document could not be accessed.',
    UNSUPPORTED_DOCUMENT:
      'The submitted attachment is not a supported document for this assignment.',
  },
  extraction: {
    SOURCE_CONTENT_UNAVAILABLE: 'No source content could be extracted for this task.',
    PARSE_FAILED: 'The submitted work could not be parsed for this task.',
    IMAGE_HYDRATION_FAILED: 'The submitted slide image could not be loaded.',
  },
  assessment: {
    LLM_HTTP_FAILED: 'The assessment service rejected the request.',
    LLM_UNAVAILABLE: 'The assessment service could not complete the request after retries.',
    LLM_INVALID_RESPONSE: 'The assessment service returned an invalid result.',
    LLM_RUN_STOPPED:
      'Assessment stopped because the service credentials or endpoint were rejected.',
    ASSESSMENT_FAILED: 'The extracted work could not be assessed.',
  },
  validation: {
    CORRUPT_RECORD: 'The stored assessment data for this task is invalid. Reassess the assignment.',
    REASSESSMENT_REQUIRED: 'Reassessment required',
  },
};
const MAXIMUM_ASSESSMENT_SCORE = 5;

/** Represents a scored result or an explicit assessment error. */
class Assessment {
  /**
   * Creates an assessment result after validating its score and optional error cause.
   * @param {number|'N'|'E'} score - Numeric mark, not-attempted marker, or error marker.
   * @param {string} reasoning - Explanation accompanying the result.
   * @param {{stage: string, code: string}} [error] - Catalogue cause required for E.
   */
  constructor(score, reasoning, error) {
    const isNumeric =
      typeof score === 'number' &&
      Number.isFinite(score) &&
      score >= 0 &&
      score <= MAXIMUM_ASSESSMENT_SCORE;
    const isOrdinary = score === 'N';
    const failed =
      score === 'E' &&
      typeof reasoning === 'string' &&
      reasoning.trim().length > 0 &&
      error &&
      Assessment.isValidCause(error);
    if (
      (!isNumeric && !isOrdinary && !failed) ||
      typeof reasoning !== 'string' ||
      ((isNumeric || isOrdinary) && error !== undefined)
    )
      throw new Error('Invalid assessment result');
    this.score = score;
    this.reasoning = reasoning;
    if (failed) this.error = { stage: error.stage, code: error.code };
  }

  /**
   * Checks whether an error cause is present in the safe catalogue.
   * @param {unknown} error - Candidate structured error cause.
   * @returns {boolean} Whether the cause is recognised.
   */
  static isValidCause(error) {
    return Boolean(
      error &&
      typeof error === 'object' &&
      !Array.isArray(error) &&
      Object.keys(error).length === Object.keys({ stage: true, code: true }).length &&
      Object.hasOwn(error, 'stage') &&
      Object.hasOwn(error, 'code') &&
      typeof error.stage === 'string' &&
      typeof error.code === 'string' &&
      Object.hasOwn(ASSESSMENT_ERROR_MESSAGES, error.stage) &&
      Object.hasOwn(ASSESSMENT_ERROR_MESSAGES[error.stage], error.code)
    );
  }

  /** Checks whether a raw score is a supported numeric mark or marker.
   * @param {unknown} score - Candidate raw score.
   * @returns {boolean} Whether the score is valid.
   */
  static isValidRawScore(score) {
    return (
      (typeof score === 'number' &&
        Number.isFinite(score) &&
        score >= 0 &&
        score <= MAXIMUM_ASSESSMENT_SCORE) ||
      score === 'N' ||
      score === 'E'
    );
  }

  /** Checks whether a raw assessment entry is a complete valid result.
   * @param {Object} entry - Candidate raw assessment entry.
   * @returns {boolean} Whether the entry has a valid complete shape.
   */
  static isValidRawResult(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    if (
      !Assessment.isValidRawScore(entry.score) ||
      typeof entry.reasoning !== 'string' ||
      (entry.score === 'E' &&
        (entry.reasoning.trim().length === 0 || !Assessment.isValidCause(entry.error)))
    )
      return false;
    if (entry.score === 'E') return true;
    return !Object.hasOwn(entry, 'error');
  }

  /**
   * Creates a failure result using the catalogue's safe reasoning.
   * @param {string} stage - Error stage from the catalogue.
   * @param {string} code - Error code valid for the stage.
   * @returns {Assessment} The constructed error assessment.
   */
  static createError(stage, code) {
    Validate.requireParams({ stage, code }, 'Assessment.createError');
    const reasoning = ASSESSMENT_ERROR_MESSAGES[stage]?.[code];
    if (!reasoning) throw new Error(`Invalid assessment error: ${stage}/${code}`);
    return new Assessment('E', reasoning, { stage, code });
  }

  /** Serialises the assessment, including a detached error cause when present.
   * @returns {{score: number|'N'|'E', reasoning: string, error?: {stage: string, code: string}}} Plain result data.
   */
  toJSON() {
    const result = { score: this.score, reasoning: this.reasoning };
    if (this.error) result.error = { ...this.error };
    return result;
  }

  /** Restores an assessment from its persisted representation.
   * @param {Object} json - Persisted assessment record.
   * @returns {Assessment} The validated assessment.
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') throw new Error('Invalid assessment record');
    return new Assessment(json.score, json.reasoning, json.error);
  }
}

if (typeof module !== 'undefined') module.exports = { Assessment };
