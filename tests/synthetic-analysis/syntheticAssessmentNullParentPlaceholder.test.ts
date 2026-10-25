import { describe, expect, it } from 'vitest';

import {
  createClassTransportBoundary,
  createPersistenceBoundary,
  createFullTransportBoundary,
} from './syntheticAssessmentValidationOwners.js';
import {
  NULL_PARENT_FEEDBACK_RULE,
  NULL_PARENT_METADATA_RULE,
} from './syntheticAssessmentRedRules.js';
import { expectRule } from './syntheticAssessmentValidationRules.js';

/**
 * Null-parent placeholder strictness regression suite: beneath the valid
 * acquisition/null-document placeholder the artefact metadata map and the item
 * feedback map must stay empty, so neither may be populated while the source
 * state stays null. Each row mutates exactly one null-document item and the
 * valid empty baseline is the canonical control.
 */

type Target = { item: Record<string, unknown>; submission: Record<string, unknown> };
/** Corruption rows for the null-parent placeholder's empty auxiliary maps. */
const NULL_PARENT_CORRUPTION_ROWS: Array<{
  label: string;
  rule: string;
  mutate: (target: Target) => void;
}> = [
  {
    label: 'populated artefact metadata',
    rule: NULL_PARENT_METADATA_RULE,
    mutate: (target) => {
      const artefact = target.item.artifact as Record<string, unknown>;
      artefact.metadata = { className: 'Stale class metadata' };
    },
  },
  {
    label: 'populated item feedback',
    rule: NULL_PARENT_FEEDBACK_RULE,
    mutate: (target) => {
      target.item.feedback = { cellReference: { type: 'cellReference', createdAt: 'stale' } };
    },
  },
];

/**
 * Runs the null-parent placeholder corruption matrix for one owner factory.
 *
 * @param {{
 *   describe: string,
 *   subject: () => {validate: () => void, nullDocumentTarget: () => Target},
 * }} config Suite configuration.
 */
function runNullParentCorruptionMatrix(config: {
  describe: string;
  subject: () => { validate: () => void; nullDocumentTarget: () => Target };
}) {
  describe(config.describe, () => {
    it('accepts the valid null-document placeholder with empty metadata and feedback', () => {
      const subject = config.subject();
      const target = subject.nullDocumentTarget();
      expect(target.submission.documentId).toBeNull();
      const artefact = target.item.artifact as Record<string, unknown>;
      expect(artefact.metadata).toStrictEqual({});
      expect(target.item.feedback).toStrictEqual({});
      expect(subject.validate).not.toThrow();
    });

    it.each(NULL_PARENT_CORRUPTION_ROWS)(
      'rejects $label beneath the null parent',
      ({ rule, mutate }) => {
        const subject = config.subject();
        const target = subject.nullDocumentTarget();
        mutate(target);
        expectRule(subject.validate, rule, [String(target.item.taskId)]);
      }
    );
  });
}

runNullParentCorruptionMatrix({
  describe: 'persistence null-parent placeholder boundary',
  subject: createPersistenceBoundary,
});

runNullParentCorruptionMatrix({
  describe: 'full transport null-parent placeholder boundary',
  subject: createFullTransportBoundary,
});

runNullParentCorruptionMatrix({
  describe: 'class partial transport null-parent placeholder boundary',
  subject: () => createClassTransportBoundary('keyed'),
});

runNullParentCorruptionMatrix({
  describe: 'partial-only transport null-parent placeholder boundary',
  subject: () => createClassTransportBoundary('partialOnly'),
});
