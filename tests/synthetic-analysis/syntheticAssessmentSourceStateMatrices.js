import { describe, expect, it } from 'vitest';

import {
  ASSESSMENT_NULL_SOURCE_RULE,
  assertCauseEntriesReasoning,
  assessmentCauseEntries,
  expectRule,
  NULL_DOCUMENT_RULE,
} from './syntheticAssessmentValidationRules.js';

/**
 * Submission source-state consistency matrices: the null-document acquisition
 * record must not acquire populated source material, and a document-bearing
 * full submission must keep its null source content consistent with its
 * carried error stage.
 *
 * @remarks
 * (1) After a valid null-document control, each row populates exactly one
 * source state field (content or contentHash) and rejects with the
 * null-document rule and the mutated task/field path.
 * (2) A non-null parent document permits null source content only beside
 * extraction or validation placeholders; the assessment-stage combination is
 * a contradictory stored record and is rejected by its owned diagnostic.
 * Valid fully populated numeric baselines keep their separate matrix, and
 * partial bodies are always redacted, so full availability is never required
 * of the partial owner.
 */

/** @typedef {import('./syntheticAssessmentValidationSupport.js').Target} Target */

/**
 * Clears one item's submitted source state to the null-content placeholder.
 *
 * @param {Target} target Owner target with the mutated item.
 */
function applyNullSourceState(target) {
  const artefact = /** @type {Record<string, unknown>} */ (target.item.artifact);
  artefact.content = null;
  artefact.contentHash = null;
}

/**
 * Rows populating exactly one source state field on a valid null-document
 * record.
 *
 * @type {ReadonlyArray<{label: string, field: string, mutate: (target: Target) => void}>}
 */
const POPULATED_SOURCE_ROWS = [
  {
    label: 'a populated source body',
    field: 'content',
    mutate: (target) => {
      const artefact = /** @type {Record<string, unknown>} */ (target.item.artifact);
      artefact.content = 'Source body beneath a null document.';
    },
  },
  {
    label: 'a populated source hash',
    field: 'contentHash',
    mutate: (target) => {
      const artefact = /** @type {Record<string, unknown>} */ (target.item.artifact);
      artefact.contentHash = 'hash-populated-null-document';
    },
  },
];

/**
 * Runs the populated-source corruption matrix for one owning validator.
 *
 * @param {{
 *   describe: string,
 *   subject: () => {validate: () => void, nullDocumentTarget: () => Target},
 * }} config Suite configuration.
 */
export function runPopulatedSourceMatrix(config) {
  describe(config.describe, () => {
    it('accepts the valid null-document acquisition record before any source mutation', () => {
      const subject = config.subject();
      expect(subject.validate).not.toThrow();
    });

    it.each(POPULATED_SOURCE_ROWS)('rejects $label beneath the null document', (row) => {
      const subject = config.subject();
      const target = subject.nullDocumentTarget();
      row.mutate(target);
      expectRule(subject.validate, NULL_DOCUMENT_RULE, [String(target.item.taskId), row.field]);
    });
  });
}

/**
 * Runs the parent-document null-source consistency matrix for one owning
 * validator: permitted extraction/validation placeholders and the rejected
 * assessment-stage combination.
 *
 * @param {{
 *   describe: string,
 *   subject: () => {validate: () => void, healthyDocumentTarget: () => Target},
 * }} config Suite configuration.
 */
export function runParentNullSourceMatrix(config) {
  describe(config.describe, () => {
    it('accepts an extraction placeholder with null source content beside a non-null parent document', () => {
      const subject = config.subject();
      const target = subject.healthyDocumentTarget();
      expect(target.submission.documentId).not.toBeNull();
      applyNullSourceState(target);
      target.item.assessments = assessmentCauseEntries('extraction', 'SOURCE_CONTENT_UNAVAILABLE');
      assertCauseEntriesReasoning(target.item.assessments, 'SOURCE_CONTENT_UNAVAILABLE');
      expect(subject.validate).not.toThrow();
    });

    it('accepts a validation placeholder with null source content beside a non-null parent document', () => {
      const subject = config.subject();
      const target = subject.healthyDocumentTarget();
      expect(target.submission.documentId).not.toBeNull();
      applyNullSourceState(target);
      target.item.assessments = assessmentCauseEntries('validation', 'CORRUPT_RECORD');
      expect(subject.validate).not.toThrow();
    });

    it('rejects an assessment-stage placeholder beside null source content', () => {
      const subject = config.subject();
      const target = subject.healthyDocumentTarget();
      applyNullSourceState(target);
      target.item.assessments = assessmentCauseEntries('assessment', 'ASSESSMENT_FAILED');
      assertCauseEntriesReasoning(target.item.assessments, 'ASSESSMENT_FAILED');
      expectRule(subject.validate, ASSESSMENT_NULL_SOURCE_RULE, [String(target.item.taskId)]);
    });
  });
}
