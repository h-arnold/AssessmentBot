import { expect } from 'vitest';

import { CRITERIA, SOURCE_UNREADABLE_REASONING } from './syntheticAssessmentContractSupport.js';

/**
 * Rule-marker expectations and catalogue result builders shared by the
 * synthetic assessment validator suites.
 *
 * @remarks
 * Each rejection row pins one validator rule: the thrown failure must
 * reference the rule marker, so a probe cannot pass because an unrelated
 * earlier rule fired. Rule markers are not a copy of a future message; they
 * name the owned boundary the masked failure must report.
 */

/** The failure must report the null-document source contradiction. */
export const NULL_DOCUMENT_RULE = 'null-document';
/** The failure must report the malformed error cause. */
export const CAUSE_RULE = 'cause';
/** The failure must report the malformed E reasoning. */
export const REASONING_RULE = 'reasoning';
/** The failure must report the completed criterion map rule. */
export const CRITERIA_RULE = 'criterion';
/** The failure must report missing known-task coverage. */
export const COVERAGE_RULE = 'known task';
/** The existing declared-task rule rejects items referencing unknown tasks. */
export const EXTRA_TASK_RULE = 'not declared by definition';
/** The SPEC-named non-Assessment formulaComparison key stays rejected. */
export const FORMULA_COMPARISON_RULE = 'formulaComparison';
/** The failure must report the full artefact content rule. */
export const CONTENT_RULE = 'content';
/** The failure must report the full artefact contentHash rule. */
export const HASH_RULE = 'contentHash';
/** The failure must reference the raw SPREADSHEET representation rule. */
export const SPREADSHEET_RULE = 'SPREADSHEET';
/** The failure must reference the usable raw IMAGE body rule. */
export const IMAGE_RULE = 'image';
/**
 * The failure must report null full source content beside an assessment-stage E
 * placeholder, which the completed full contract treats as a contradictory
 * stored record rather than an accepted assessment-only error.
 */
export const ASSESSMENT_NULL_SOURCE_RULE = 'assessment-stage';

/**
 * Captures the thrown failure and asserts the owned rule marker plus any
 * required target/path tokens.
 *
 * @param {() => void} validate Validator under test.
 * @param {string} rule Rule marker the diagnostic must reference.
 * @param {string[]} tokens Additional discriminating tokens (mutated item or
 *   criterion path). A generic marker alone can never satisfy an expectation:
 *   for example the existing blanket partial-redaction message names only the
 *   item, neither the mutated criterion nor the non-blank requirement, so it
 *   cannot green the malformed-E-reasoning rows.
 */
export function expectRule(validate, rule, tokens) {
  let failure = null;
  try {
    validate();
  } catch (error) {
    failure = error;
  }
  expect(failure, `expected validator rule ${rule}`).toBeInstanceOf(Error);
  if (!(failure instanceof Error)) return;
  for (const token of [rule, ...tokens]) {
    expect(failure.message, `expected rule "${rule}" to reference "${token}"`).toContain(token);
  }
}

const CORRUPT_RECORD_REASONING =
  'The stored assessment data for this task is invalid. Reassess the assignment.';
const REASSESSMENT_REQUIRED_REASONING = 'Reassessment required';
const SOURCE_CONTENT_UNAVAILABLE_REASONING = 'No source content could be extracted for this task.';
const ASSESSMENT_FAILED_REASONING = 'The extracted work could not be assessed.';

/** Exact catalogue reasoning strings pinned by the backend Assessment owner. */
const CATALOGUE_REASONING = {
  SOURCE_UNREADABLE: SOURCE_UNREADABLE_REASONING,
  CORRUPT_RECORD: CORRUPT_RECORD_REASONING,
  REASSESSMENT_REQUIRED: REASSESSMENT_REQUIRED_REASONING,
  SOURCE_CONTENT_UNAVAILABLE: SOURCE_CONTENT_UNAVAILABLE_REASONING,
  ASSESSMENT_FAILED: ASSESSMENT_FAILED_REASONING,
};

/**
 * Builds a full all-three E entry map for one catalogue cause.
 *
 * @param {'acquisition'|'extraction'|'assessment'|'validation'} stage Cause stage.
 * @param {'SOURCE_UNREADABLE'|'CORRUPT_RECORD'|'REASSESSMENT_REQUIRED'|
 *   'SOURCE_CONTENT_UNAVAILABLE'|'ASSESSMENT_FAILED'} code Cause code.
 * @returns {Record<string, {score: 'E', reasoning: string, error: object}>} Detached entries.
 */
export function assessmentCauseEntries(stage, code) {
  const reasoning = CATALOGUE_REASONING[code];
  if (typeof reasoning !== 'string' || reasoning.length === 0) {
    throw new Error(`missing catalogue reasoning for cause code ${code}`);
  }
  const entry = {
    score: 'E',
    reasoning: CATALOGUE_REASONING[code],
    error: { stage, code },
  };
  return Object.fromEntries(CRITERIA.map((criterion) => [criterion, structuredClone(entry)]));
}

/**
 * Asserts each E entry carries the exact catalogue reasoning for the cause
 * code, before the owning validator is invoked.
 *
 * @param {Record<string, {score: 'E', reasoning: string, error: object}>} entries
 *   Cause entry map from {@link assessmentCauseEntries}.
 * @param {'SOURCE_UNREADABLE'|'CORRUPT_RECORD'|'REASSESSMENT_REQUIRED'|
 *   'SOURCE_CONTENT_UNAVAILABLE'|'ASSESSMENT_FAILED'} code Cause code.
 * @returns {void}
 */
export function assertCauseEntriesReasoning(entries, code) {
  const expected = CATALOGUE_REASONING[code];
  if (typeof expected !== 'string' || expected.length === 0) {
    throw new Error(`missing catalogue reasoning for cause code ${code}`);
  }
  for (const [criterion, entry] of Object.entries(entries)) {
    expect(entry.reasoning, `E reasoning of ${criterion} beside cause ${code}`).toBe(expected);
  }
}

/** Canonical complete numeric map used by every valid document submission. */
const CANONICAL_NUMERIC_ASSESSMENTS = Object.freeze({
  completeness: Object.freeze({
    score: 4,
    reasoning: 'Canonical synthetic completeness evidence.',
  }),
  accuracy: Object.freeze({
    score: 5,
    reasoning: 'Canonical synthetic accuracy evidence.',
  }),
  spag: Object.freeze({
    score: 3,
    reasoning: 'Canonical synthetic SPaG evidence.',
  }),
});

/** @returns {Record<string, {score: number, reasoning: string}>} Detached numeric map. */
export function canonicalNumericAssessments() {
  return structuredClone(CANONICAL_NUMERIC_ASSESSMENTS);
}
