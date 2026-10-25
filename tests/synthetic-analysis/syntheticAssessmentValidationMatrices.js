import { describe, expect, it } from 'vitest';

import { CRITERIA, SOURCE_UNREADABLE_REASONING } from './syntheticAssessmentContractSupport.js';
import {
  assessmentCauseEntries,
  canonicalNumericAssessments,
  CAUSE_RULE,
  COVERAGE_RULE,
  CRITERIA_RULE,
  expectRule,
  EXTRA_TASK_RULE,
  FORMULA_COMPARISON_RULE,
  NULL_DOCUMENT_RULE,
  REASONING_RULE,
} from './syntheticAssessmentValidationRules.js';

/**
 * Shared null-document boundary matrix for the synthetic assessment validator
 * suites.
 *
 * @remarks
 * Each rejection row pins one validator rule: the thrown failure must
 * reference the rule marker plus any row-specific target/path tokens, so a
 * probe cannot pass because an unrelated earlier rule fired (for example the
 * existing blanket partial-redaction ban naming only the item). Rows mutate
 * one cloned boundary record only; baseline controls must stay valid inputs.
 * Numeric/N replacement rows are representation-aware: partial entries are
 * score-only and full entries carry their reasoning, matching the agreed
 * partial projection contract.
 */

/**
 * Asserts one null-document item carries the canonical base placeholder state.
 *
 * @param {Record<string, unknown>} item Null-document submission item.
 */
export function expectCanonicalNullDocumentPlaceholder(item) {
  const artefact = /** @type {Record<string, unknown>} */ (item.artifact);
  expect(artefact).toMatchObject({
    role: 'submission',
    type: 'base',
    pageId: null,
    documentId: null,
    content: null,
    contentHash: null,
    metadata: {},
  });
  expect(item.feedback).toStrictEqual({});
  const assessments = /** @type {Record<string, unknown>} */ (item.assessments);
  expect(Object.keys(assessments).sort()).toEqual([...CRITERIA].sort());
  for (const criterion of CRITERIA) {
    const entry = /** @type {Record<string, unknown>} */ (assessments[criterion]);
    expect(entry.score).toBe('E');
    expect(entry.reasoning).toBe(SOURCE_UNREADABLE_REASONING);
    expect(entry.error).toStrictEqual({ stage: 'acquisition', code: 'SOURCE_UNREADABLE' });
  }
}

/** Replaces an item's assessment map with all-three copies of one entry map. */
function overwriteAssessments(item, entryMap) {
  item.assessments = structuredClone(entryMap);
}

/**
 * Builds the representation-correct entry that replaces a canonical E result.
 *
 * @param {'partial'|'full'} representation Owner representation under test.
 * @param {number|'N'|'E'} score Replacement score.
 * @param {string} reasoning Reasoning for full entries only.
 * @returns {Record<string, unknown>} Replacement entry in the correct shape.
 */
function replacementEntry(representation, score, reasoning) {
  if (representation === 'partial') return { score };
  return { score, reasoning };
}

/**
 * Row descriptors for the null-document contradiction boundary.
 *
 * @type {ReadonlyArray<{label: string, rule: string,
 *   mutate: (target: {item: Record<string, unknown>, submission: Record<string, unknown>}, representation: 'partial'|'full') => void,
 *   tokens?: (target: {item: Record<string, unknown>, submission: Record<string, unknown>}) => string[]}>}
 */
export const NULL_DOCUMENT_REJECTION_ROWS = [
  {
    label: 'a numeric result beside the null document',
    rule: NULL_DOCUMENT_RULE,
    mutate: (target, representation) => {
      const canonical = canonicalNumericAssessments();
      target.item.assessments.completeness = replacementEntry(
        representation,
        canonical.completeness.score,
        canonical.completeness.reasoning
      );
    },
  },
  {
    label: 'a not-attempted result beside the null document',
    rule: NULL_DOCUMENT_RULE,
    mutate: (target, representation) => {
      target.item.assessments.accuracy = replacementEntry(representation, 'N', 'Not attempted.');
    },
  },
  {
    label: 'an assessment-stage cause beside the null document',
    rule: NULL_DOCUMENT_RULE,
    mutate: (target) => {
      target.item.assessments.spag.error = { stage: 'assessment', code: 'ASSESSMENT_FAILED' };
    },
  },
  {
    label: 'an extraction-stage cause beside the null document',
    rule: NULL_DOCUMENT_RULE,
    mutate: (target) => {
      target.item.assessments.spag.error = {
        stage: 'extraction',
        code: 'SOURCE_CONTENT_UNAVAILABLE',
      };
    },
  },
  {
    label: 'a missing cause record',
    rule: CAUSE_RULE,
    mutate: (target) => {
      delete target.item.assessments.completeness.error;
    },
    tokens: (target) => [String(target.item.taskId), 'completeness'],
  },
  {
    label: 'an unsupported cause stage',
    rule: CAUSE_RULE,
    mutate: (target) => {
      target.item.assessments.completeness.error.stage = 'no-such-stage';
    },
    tokens: (target) => [String(target.item.taskId), 'completeness'],
  },
  {
    label: 'an unsupported cause code',
    rule: CAUSE_RULE,
    mutate: (target) => {
      target.item.assessments.completeness.error.code = 'NOT_A_CATALOGUE_CODE';
    },
    tokens: (target) => [String(target.item.taskId), 'completeness'],
  },
  {
    label: 'a blank reasoning',
    rule: REASONING_RULE,
    mutate: (target) => {
      target.item.assessments.completeness.reasoning = '   ';
    },
    tokens: (target) => [String(target.item.taskId), 'completeness'],
  },
  {
    label: 'a missing reasoning key',
    rule: REASONING_RULE,
    mutate: (target) => {
      delete target.item.assessments.completeness.reasoning;
    },
    tokens: (target) => [String(target.item.taskId), 'completeness'],
  },
  {
    label: 'an incomplete criterion map',
    rule: CRITERIA_RULE,
    mutate: (target) => {
      delete target.item.assessments.accuracy;
    },
    tokens: (target) => [String(target.item.taskId), 'accuracy'],
  },
  {
    label: 'an extra criterion key',
    rule: CRITERIA_RULE,
    mutate: (target) => {
      target.item.assessments.extra = {
        score: 'E',
        reasoning: 'Reassessment required',
        error: { stage: 'validation', code: 'REASSESSMENT_REQUIRED' },
      };
    },
    tokens: (target) => [String(target.item.taskId), 'extra'],
  },
  {
    label: 'a non-Assessment formulaComparison entry',
    rule: FORMULA_COMPARISON_RULE,
    mutate: (target) => {
      target.item.assessments.formulaComparison = { score: 1 };
    },
    tokens: (target) => [String(target.item.taskId)],
  },
  {
    label: 'an item referencing an unknown task',
    rule: EXTRA_TASK_RULE,
    mutate: (target) => {
      const unknownItem = structuredClone(target.item);
      unknownItem.id = 'ssi-unknown-task-item';
      unknownItem.taskId = 'task-unknown';
      unknownItem.artifact = {
        ...structuredClone(target.item.artifact),
        taskId: 'task-unknown',
        uid: 'uid-unknown-task-item',
      };
      target.submission.items['task-unknown'] = unknownItem;
    },
    tokens: () => ['task-unknown'],
  },
];

/**
 * Runs the shared null-document matrix for one owning validator.
 *
 * @param {{
 *   describe: string,
 *   representation: 'partial'|'full',
 *   subject: () => {validate: () => void, nullDocumentTarget: () => {item: Record<string, unknown>, submission: Record<string, unknown>}},
 *   assertBaseline?: (subject: unknown) => void,
 * }} config Suite configuration: the representation selects the entry shape
 *   the shared replacement rows build for this owner.
 */
export function runNullDocumentMatrix(config) {
  describe(config.describe, () => {
    it('accepts the pinned all-three SOURCE_UNREADABLE acquisition record', () => {
      const subject = config.subject();
      expectCanonicalNullDocumentPlaceholder(subject.nullDocumentTarget().item);
      config.assertBaseline?.(subject);
      expect(subject.validate).not.toThrow();
    });

    it.each(NULL_DOCUMENT_REJECTION_ROWS)('rejects null-document $label', (row) => {
      const subject = config.subject();
      const target = subject.nullDocumentTarget();
      row.mutate(target, config.representation);
      expectRule(subject.validate, row.rule, row.tokens ? row.tokens(target) : []);
    });

    it.each([
      ['REASSESSMENT_REQUIRED', 'validation', 'REASSESSMENT_REQUIRED'],
      ['CORRUPT_RECORD', 'validation', 'CORRUPT_RECORD'],
    ])(
      'accepts all-three validation %s placeholders on the null document',
      (_label, stage, code) => {
        const subject = config.subject();
        overwriteAssessments(
          subject.nullDocumentTarget().item,
          assessmentCauseEntries(stage, code)
        );
        expect(subject.validate).not.toThrow();
      }
    );
  });
}

/**
 * Runs the known-task coverage matrix for one owning validator.
 *
 * @remarks
 * Coverage is required for a submitted document row even when its only item is
 * deleted, so the probe stays unambiguous on the partial-only one-task
 * definition: an empty map there contradicts the non-null parent document, not
 * the legitimate no-submission shape. Deleting a null-document submission's
 * items is pinned separately as accepted genuine no-submission. The generated
 * null-document variant's own item-count parity stays asserted by the
 * canonical variant suite and is deliberately not reused here.
 *
 * @param {{
 *   describe: string,
 *   subject: () => {validate: () => void, nullDocumentTarget: () => {item: Record<string, unknown>, submission: Record<string, unknown>}, healthyDocumentTarget: () => {item: Record<string, unknown>, submission: Record<string, unknown>}},
 * }} config Suite configuration.
 */
export function runKnownTaskCoverageMatrix(config) {
  describe(config.describe, () => {
    it('rejects a document-bearing submission missing its only known task', () => {
      const subject = config.subject();
      const target = subject.healthyDocumentTarget();
      expect(target.submission.documentId).not.toBeNull();
      const deletedTaskId = String(target.item.taskId);
      delete target.submission.items[deletedTaskId];
      expectRule(subject.validate, COVERAGE_RULE, [
        String(target.submission.studentId),
        deletedTaskId,
      ]);
    });

    it('accepts a null-document submission with an empty item map as genuine no-submission', () => {
      const subject = config.subject();
      const target = subject.nullDocumentTarget();
      expect(target.submission.documentId).toBeNull();
      target.submission.items = {};
      expect(subject.validate).not.toThrow();
    });
  });
}
