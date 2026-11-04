import { describe, expect, it } from 'vitest';

import {
  createClassTransportBoundary,
  createPersistenceBoundary,
  createFullTransportBoundary,
} from './syntheticAssessmentValidationOwners.js';
import { CAUSE_RULE, expectRule } from './syntheticAssessmentValidationRules.js';

/**
 * Cause shape strictness regression suite: the cause pair lookup must inspect
 * the actual cause record, so an identical catalogue pair presented as
 * non-string stage/code discriminants, or with keys beyond `stage` and `code`,
 * is rejected rather than silently coerced by `String(...)` into a catalogue
 * hit. The twelve exact pair acceptance rows and the null-parent stage
 * restriction stay covered by the separate catalogue and null-document suites.
 */

type Cause = Record<string, unknown>;
type Target = { item: Record<string, unknown>; submission: Record<string, unknown> };
type Owner = { validate: () => void; healthyDocumentTarget: () => Target };

/** Malformed cause rows the validators must reject on a healthy document item. */
const CAUSE_SHAPE_ROWS: Array<{ label: string; error: Cause }> = [
  {
    label: 'array stage',
    error: { stage: ['assessment'], code: 'ASSESSMENT_FAILED' },
  },
  {
    label: 'null stage',
    error: { stage: null, code: 'ASSESSMENT_FAILED' },
  },
  {
    label: 'object stage',
    error: { stage: { name: 'assessment' }, code: 'ASSESSMENT_FAILED' },
  },
  {
    label: 'numeric stage',
    error: { stage: 7, code: 'ASSESSMENT_FAILED' },
  },
  {
    label: 'array code',
    error: { stage: 'assessment', code: ['ASSESSMENT_FAILED'] },
  },
  {
    label: 'null code',
    error: { stage: 'assessment', code: null },
  },
  {
    label: 'object code',
    error: { stage: 'assessment', code: { value: 'ASSESSMENT_FAILED' } },
  },
  {
    label: 'numeric code',
    error: { stage: 'assessment', code: 7 },
  },
  {
    label: 'extra cause key',
    error: { stage: 'assessment', code: 'ASSESSMENT_FAILED', detail: 'context' },
  },
];

/**
 * Replaces every criterion entry of one document item with an E placeholder
 * carrying the row's caused error shape.
 *
 * @param {Target} target Healthy document item target.
 * @param {Cause} error Malformed error cause under test.
 */
function applyCauseError(target: Target, error: Cause): void {
  const assessments = target.item.assessments as Record<string, Record<string, unknown>>;
  for (const criterion of ['completeness', 'accuracy', 'spag']) {
    assessments[criterion] = { score: 'E', reasoning: 'test', error: structuredClone(error) };
  }
}

/**
 * Runs the malformed-cause-shape matrix for one owning validator context.
 *
 * @param {{describe: string, subject: () => Owner}} config Suite configuration.
 */
function runCauseShapeMatrix(config: { describe: string; subject: () => Owner }): void {
  describe(config.describe, () => {
    it('accepts the healthy document item before any cause replacement', () => {
      const subject = config.subject();
      expect(subject.validate).not.toThrow();
    });

    it.each(CAUSE_SHAPE_ROWS)('rejects the cause with $label', ({ error }) => {
      const subject = config.subject();
      const target = subject.healthyDocumentTarget();
      applyCauseError(target, error);
      expectRule(subject.validate, CAUSE_RULE, [String(target.item.taskId)]);
    });
  });
}

runCauseShapeMatrix({
  describe: 'persistence cause-shape boundary',
  subject: createPersistenceBoundary,
});

runCauseShapeMatrix({
  describe: 'full transport cause-shape boundary',
  subject: createFullTransportBoundary,
});

runCauseShapeMatrix({
  describe: 'class partial transport cause-shape boundary',
  subject: () => createClassTransportBoundary('keyed'),
});
