import { fail, isRecord } from './invariantGuards.js';
import { quoteKeys, requireItemRecord } from './validationRecordGuards.js';

/**
 * Assessment criterion-map and entry guards for the persistence,
 * full-transport, and class-partial validators.
 *
 * @remarks
 * The owning validators accept different representations of the same
 * canonical assessment contract: full records carry reasoning beside every
 * entry, partial records carry a score alone beside non-E entries, and
 * null-document submissions may only carry acquisition/validation placeholder
 * maps beside null source state. Each guard names its owned rule and the task
 * path it validated so a masked failure cannot satisfy an unrelated marker.
 */

const CRITERIA = ['completeness', 'accuracy', 'spag'];
/**
 * The implemented Assessment error cause catalogue by stage, read verbatim
 * from the backend `Assessment` model (`ASSESSMENT_ERROR_MESSAGES`): twelve
 * exact stage/code pairs.
 */
const CAUSE_CATALOGUE = {
  acquisition: ['SOURCE_UNREADABLE', 'UNSUPPORTED_DOCUMENT'],
  extraction: ['SOURCE_CONTENT_UNAVAILABLE', 'PARSE_FAILED', 'IMAGE_HYDRATION_FAILED'],
  assessment: [
    'LLM_HTTP_FAILED',
    'LLM_UNAVAILABLE',
    'LLM_INVALID_RESPONSE',
    'LLM_RUN_STOPPED',
    'ASSESSMENT_FAILED',
  ],
  validation: ['CORRUPT_RECORD', 'REASSESSMENT_REQUIRED'],
};
/** Cause stages permitted beside a null parent document. */
const NULL_DOCUMENT_STAGES = ['acquisition', 'validation'];
const CAUSE_KEY_COUNT = 2;
const MIN_SCORE = 0;
const MAX_SCORE = 5;

/**
 * Asserts an entry score is a finite 0-5 number, 'N', or 'E'.
 *
 * @param {object} options Entry inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.entry Assessment entry under test.
 * @param {string} options.label Failure-message context.
 * @param {string} options.criterion Criterion name.
 * @param {import('./validationRecordGuards.js').RawRecord} options.cause Cause record.
 * @returns {void}
 */
function assertEntryScore({ entry, label, criterion }) {
  const score = entry.score;
  if (score === 'N' || score === 'E') {
    return;
  }
  const isNumericScore =
    typeof score === 'number' && Number.isFinite(score) && score >= MIN_SCORE && score <= MAX_SCORE;
  if (!isNumericScore) {
    fail(
      `${label} assessment "${criterion}" score must be a finite number between ${MIN_SCORE} and ${MAX_SCORE}, "N", or "E"; received ${JSON.stringify(score)}.`
    );
  }
}

/**
 * Asserts an error cause carries exactly the two required string fields.
 *
 * @param {object} options Entry inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.entry Assessment entry under test.
 * @param {string} options.label Failure-message context.
 * @param {string} options.criterion Criterion name.
 * @param {import('./validationRecordGuards.js').RawRecord} options.cause Cause record.
 * @returns {void}
 */
function assertCauseShape({ cause, label, criterion }) {
  const causeKeys = Object.keys(cause);
  if (
    typeof cause.stage !== 'string' ||
    typeof cause.code !== 'string' ||
    causeKeys.length !== CAUSE_KEY_COUNT ||
    !causeKeys.includes('stage') ||
    !causeKeys.includes('code')
  ) {
    fail(
      `${label} assessment "${criterion}" error cause must carry exactly the string "stage" and "code" cause keys, and every malformed cause must be rejected before the cause pair lookup; received keys ${quoteKeys(
        causeKeys
      )} with types ${typeof cause.stage} and ${typeof cause.code}.`
    );
  }
}

/**
 * Asserts a cause is an exact stage/code pair in the implemented catalogue.
 * @param {object} options Cause inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.cause Cause record.
 * @param {string} options.label Failure-message context.
 * @param {string} options.criterion Criterion name.
 * @returns {void}
 */
function assertCauseCataloguePair({ cause, label, criterion }) {
  const catalogueCodes = CAUSE_CATALOGUE[cause.stage];
  if (catalogueCodes === undefined || !catalogueCodes.includes(cause.code)) {
    fail(
      `${label} assessment "${criterion}" error cause ${cause.stage}/${cause.code} is not an exact stage/code pair of the implemented Assessment error cause catalogue.`
    );
  }
}

/**
 * Asserts an E entry has meaningful reasoning and an exact catalogue cause.
 * @param {object} options Assessment entry inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.entry Assessment entry.
 * @param {string} options.label Failure-message context.
 * @param {string} options.criterion Criterion name.
 * @returns {void}
 */
function assertErrorEntry({ entry, label, criterion }) {
  const reasoning = entry.reasoning;
  if (typeof reasoning !== 'string' || reasoning.trim().length === 0) {
    fail(`${label} assessment "${criterion}" carries no usable reasoning beside its failed score.`);
  }
  const cause = requireItemRecord(entry.error, `${label} assessment "${criterion}" error cause`);
  assertCauseShape({ cause, label, criterion });
  assertCauseCataloguePair({ cause, label, criterion });
}

/**
 * Asserts a null-document item's E entry cause stage is a permitted placeholder.
 *
 * @param {object} options Entry inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.entry Assessment entry under test.
 * @param {string} options.label Failure-message context.
 * @param {string} options.criterion Criterion name.
 * @returns {void}
 */
function assertNullDocumentCauseStage({ entry, label, criterion }) {
  const stage = /** @type {import('./validationRecordGuards.js').RawRecord} */ (entry.error).stage;
  if (NULL_DOCUMENT_STAGES.includes(stage)) {
    return;
  }
  fail(
    `${label} null-document item assessment "${criterion}" error cause stage "${String(stage)}" contradicts the null-document record; only acquisition or validation causes may appear.`
  );
}

/**
 * Asserts partial non-E entries contain only their score.
 * @param {object} options Entry inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.entry Assessment entry.
 * @param {string} options.label Failure-message context.
 * @param {string} options.criterion Criterion name.
 * @returns {void}
 */
function assertPartialEntryShape({ entry, label, criterion }) {
  if ('reasoning' in entry || 'error' in entry) {
    fail(
      `${label} assessment "${criterion}" partial entry must be score-only; it carries reasoning or an error cause beside score ${JSON.stringify(entry.score)}.`
    );
  }
}

/**
 * Asserts full non-E entries include reasoning and no error cause.
 * @param {object} options Entry inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.entry Assessment entry.
 * @param {string} options.label Failure-message context.
 * @param {string} options.criterion Criterion name.
 * @returns {void}
 */
function assertFullEntryShape({ entry, label, criterion }) {
  if ('error' in entry) {
    fail(`${label} assessment "${criterion}" must not carry an error cause beside a non-E score.`);
  }
  if (typeof entry.reasoning !== 'string') {
    fail(
      `${label} assessment "${criterion}" full reasoning must be a string beside every full result, including numeric and "N" entries; received ${JSON.stringify(
        entry.reasoning === undefined ? null : entry.reasoning
      )}.`
    );
  }
}

/**
 * Applies the full or partial non-E entry shape rule.
 * @param {object} options Entry and representation inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.entry Assessment entry.
 * @param {string} options.label Failure-message context.
 * @param {string} options.criterion Criterion name.
 * @param {'full'|'partial'} options.representation Representation under test.
 * @returns {void}
 */
function assertNonFailureEntryShape({ entry, label, criterion, representation }) {
  if (representation === 'partial') {
    assertPartialEntryShape({ entry, label, criterion });
    return;
  }
  assertFullEntryShape({ entry, label, criterion });
}

/**
 * Asserts one criterion's assessment entry conforms to the representation.
 *
 * @param {object} options Entry inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.entry Assessment entry under test.
 * @param {string} options.label Failure-message context.
 * @param {string} options.criterion Criterion name.
 * @param {'full'|'partial'} options.representation Representation under test.
 * @param {boolean} options.nullParent True when the parent submission has no document.
 * @returns {void}
 */
function assertEntryShape({ entry, label, criterion, representation, nullParent }) {
  assertEntryScore({ entry, label, criterion });
  if (entry.score === 'E') {
    assertErrorEntry({ entry, label, criterion });
    if (nullParent) {
      assertNullDocumentCauseStage({ entry, label, criterion });
    }
    return;
  }
  if (nullParent) {
    fail(
      `${label} null-document item assessment "${criterion}" must be an "E" placeholder; received score ${JSON.stringify(entry.score)}.`
    );
  }
  assertNonFailureEntryShape({ entry, label, criterion, representation });
}

/**
 * Asserts a submission item's assessment map contains exactly the three
 * criteria.
 *
 * @param {object} options Item inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.item Submission item record.
 * @param {string} options.label Failure-message context.
 * @returns {void}
 */
function assertAssessmentMapComposition({ item, label }) {
  if (!isRecord(item.assessments)) {
    fail(`${label} assessments must be an object.`);
  }
  const keys = Object.keys(item.assessments);
  if (keys.includes('formulaComparison')) {
    fail(
      `${label} carries the non-Assessment assessment key "formulaComparison"; only the three criteria may appear.`
    );
  }
  const unexpectedKeys = keys.filter((key) => !CRITERIA.includes(key));
  const missingKeys = CRITERIA.filter((criterion) => !keys.includes(criterion));
  if (unexpectedKeys.length > 0 || missingKeys.length > 0) {
    let compositionDetail = '.';
    if (unexpectedKeys.length > 0) {
      compositionDetail = `; unexpected ${quoteKeys(unexpectedKeys)}.`;
    }
    if (missingKeys.length > 0) {
      compositionDetail = `; missing ${quoteKeys(missingKeys)}.`;
    }
    fail(
      `${label} assessment map must contain exactly the three criterion keys${compositionDetail}`
    );
  }
}

/**
 * Asserts one submission item's assessment map is exact and representation-correct.
 *
 * @param {object} options Item inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.item Submission item record.
 * @param {string} options.location Failure-message context (owning assignment/submission).
 * @param {boolean} options.nullParent True when the parent submission has no document.
 * @param {'full'|'partial'} options.representation Representation under test.
 * @returns {void}
 */
export function assertAssessmentMap({ item, location, nullParent, representation }) {
  const label = `${location} task "${String(item.taskId)}"`;
  assertAssessmentMapComposition({ item, label });
  const assessments = /** @type {import('./validationRecordGuards.js').RawRecord} */ (
    item.assessments
  );
  const rankedEntries = [
    ['completeness', assessments.completeness],
    ['accuracy', assessments.accuracy],
    ['spag', assessments.spag],
  ];
  for (const [criterion, entry] of rankedEntries) {
    requireItemRecord(entry, `${label} assessment "${criterion}"`);
    assertEntryShape({
      entry: /** @type {import('./validationRecordGuards.js').RawRecord} */ (entry),
      label,
      criterion: /** @type {string} */ (criterion),
      representation,
      nullParent,
    });
  }
}
