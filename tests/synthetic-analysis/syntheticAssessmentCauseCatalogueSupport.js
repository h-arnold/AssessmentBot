import { describe, expect, it } from 'vitest';

import { CRITERIA } from './syntheticAssessmentContractSupport.js';
import { expectRule } from './syntheticAssessmentValidationRules.js';

/**
 * The implemented Assessment cause catalogue, and the shared catalogue
 * compliance runner for the synthetic assessment validator owners.
 *
 * @remarks
 * The stage/code pairs are read verbatim from
 * `src/backend/Models/Assessment.js` (`ASSESSMENT_ERROR_MESSAGES`): twelve
 * codes across four stages with their exact safe reasoning strings. The runner
 * accepts every catalogue pair on a healthy document item and rejects the
 * wrong-pair sample rows, so a probe can never pass by pairing an arbitrary
 * stage with any known code. Catalogue uses stay on document-bearing targets so
 * the null-parent acquisition/validation restriction (covered by the separate
 * null-document matrix) is respected.
 */

/** @type {ReadonlyArray<['acquisition'|'extraction'|'assessment'|'validation', string]>} */
const CAUSE_CATALOGUE = [
  ['acquisition', 'SOURCE_UNREADABLE'],
  ['acquisition', 'UNSUPPORTED_DOCUMENT'],
  ['extraction', 'SOURCE_CONTENT_UNAVAILABLE'],
  ['extraction', 'PARSE_FAILED'],
  ['extraction', 'IMAGE_HYDRATION_FAILED'],
  ['assessment', 'LLM_HTTP_FAILED'],
  ['assessment', 'LLM_UNAVAILABLE'],
  ['assessment', 'LLM_INVALID_RESPONSE'],
  ['assessment', 'LLM_RUN_STOPPED'],
  ['assessment', 'ASSESSMENT_FAILED'],
  ['validation', 'CORRUPT_RECORD'],
  ['validation', 'REASSESSMENT_REQUIRED'],
];

/** Exact catalogue reasoning strings from the backend Assessment owner. */
const CATALOGUE_REASONING = {
  SOURCE_UNREADABLE: 'The submitted document could not be accessed.',
  UNSUPPORTED_DOCUMENT: 'The submitted attachment is not a supported document for this assignment.',
  SOURCE_CONTENT_UNAVAILABLE: 'No source content could be extracted for this task.',
  PARSE_FAILED: 'The submitted work could not be parsed for this task.',
  IMAGE_HYDRATION_FAILED: 'The submitted slide image could not be loaded.',
  LLM_HTTP_FAILED: 'The assessment service rejected the request.',
  LLM_UNAVAILABLE: 'The assessment service could not complete the request after retries.',
  LLM_INVALID_RESPONSE: 'The assessment service returned an invalid result.',
  LLM_RUN_STOPPED: 'Assessment stopped because the service credentials or endpoint were rejected.',
  ASSESSMENT_FAILED: 'The extracted work could not be assessed.',
  CORRUPT_RECORD: 'The stored assessment data for this task is invalid. Reassess the assignment.',
  REASSESSMENT_REQUIRED: 'Reassessment required',
};

/** Wrong stage/code pairings the catalogue validation must reject. */
const WRONG_PAIR_ROWS = [
  ['acquisition', 'ASSESSMENT_FAILED'],
  ['acquisition', 'CORRUPT_RECORD'],
  ['extraction', 'LLM_HTTP_FAILED'],
  ['extraction', 'SOURCE_UNREADABLE'],
  ['assessment', 'PARSE_FAILED'],
  ['assessment', 'SOURCE_UNREADABLE'],
  ['validation', 'UNSUPPORTED_DOCUMENT'],
];

/**
 * Builds a full all-three E entry map for one catalogue cause, keeping the
 * exact stage reasoning of the backend catalogue beside every entry.
 *
 * @param {'acquisition'|'extraction'|'assessment'|'validation'} stage Cause stage.
 * @param {string} code Cause code from {@link CAUSE_CATALOGUE}.
 * @returns {Record<string, {score: 'E', reasoning: string, error: object}>} Detached entries.
 */
export function catalogueCauseEntries(stage, code) {
  const reasoning = CATALOGUE_REASONING[code];
  if (typeof reasoning !== 'string' || reasoning.length === 0) {
    throw new Error(`missing catalogue reasoning for cause code ${code}`);
  }
  const entry = { score: 'E', reasoning, error: { stage, code } };
  return Object.fromEntries(CRITERIA.map((criterion) => [criterion, structuredClone(entry)]));
}

/**
 * Runs the catalogue compliance matrix for one owning validator.
 *
 * @param {{
 *   describe: string,
 *   subject: () => {validate: () => void, healthyDocumentTarget: () => {item: Record<string, unknown>, submission: Record<string, unknown>}},
 * }} config Suite configuration.
 */
export function runCauseCatalogueMatrix(config) {
  describe(config.describe, () => {
    it('accepts a healthy document item before any cause replacement', () => {
      const subject = config.subject();
      expect(subject.healthyDocumentTarget().submission.documentId).not.toBeNull();
      expect(subject.validate).not.toThrow();
    });

    it.each(CAUSE_CATALOGUE)(
      'accepts the catalogue cause %s/%s on a healthy document item',
      (stage, code) => {
        const subject = config.subject();
        const target = subject.healthyDocumentTarget();
        target.item.assessments = catalogueCauseEntries(stage, code);
        expect(subject.validate).not.toThrow();
      }
    );

    it.each(WRONG_PAIR_ROWS)(
      'rejects the uncatalogued cause pair %s/%s on a healthy document item',
      (stage, code) => {
        const subject = config.subject();
        const target = subject.healthyDocumentTarget();
        expect(CAUSE_CATALOGUE).not.toContainEqual([stage, code]);
        target.item.assessments = catalogueCauseEntries(stage, code);
        expectRule(subject.validate, 'catalogue', [
          String(target.item.taskId),
          String(stage),
          String(code),
        ]);
      }
    );
  });
}
