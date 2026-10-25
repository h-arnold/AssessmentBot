import { describe, expect, it } from 'vitest';

import {
  createClassTransportBoundary,
  createPersistenceBoundary,
  createFullTransportBoundary,
} from './syntheticAssessmentValidationOwners.js';
import {
  NULL_PARENT_ARTIFACT_ROLE_RULE,
  NULL_PARENT_ARTIFACT_TYPE_RULE,
  NULL_PARENT_FEEDBACK_RULE,
  NULL_PARENT_METADATA_RULE,
  NULL_PARENT_SOURCE_FIELD_RULE,
} from './syntheticAssessmentRedRules.js';
import { expectRule } from './syntheticAssessmentValidationRules.js';

/**
 * Null-parent source strictness regression suite: beneath the null-document
 * placeholder the canonical base/submission artefact must keep every explicit
 * null source key (`content`, `contentHash`) actually present and null, must
 * keep the `metadata` and item `feedback` maps as real empty objects (neither
 * null nor missing), and must keep the pinned placeholder `type`/`role`, so
 * omission of a required full field cannot pass a null-document record.
 *
 * @remarks Each row mutates exactly one null-document item; the accepted
 * canonical baseline control reuses the pinned canonical placeholder shape.
 */

type Target = { item: Record<string, unknown>; submission: Record<string, unknown> };
type Owner = { validate: () => void; nullDocumentTarget: () => Target };

/** Corruption rows for the null-parent placeholder artefact and item. */
const NULL_PARENT_STRICTNESS_ROWS: Array<{
  label: string;
  rule: string;
  tokens?: string[];
  mutate: (target: Target) => void;
}> = [
  {
    label: 'null artefact metadata',
    rule: NULL_PARENT_METADATA_RULE,
    mutate: (target) => {
      (target.item.artifact as Record<string, unknown>).metadata = null;
    },
  },
  {
    label: 'missing artefact metadata',
    rule: NULL_PARENT_METADATA_RULE,
    mutate: (target) => {
      delete (target.item.artifact as Record<string, unknown>).metadata;
    },
  },
  {
    label: 'null item feedback',
    rule: NULL_PARENT_FEEDBACK_RULE,
    mutate: (target) => {
      target.item.feedback = null;
    },
  },
  {
    label: 'missing item feedback',
    rule: NULL_PARENT_FEEDBACK_RULE,
    mutate: (target) => {
      delete target.item.feedback;
    },
  },
  {
    label: 'non-placeholder artefact type',
    rule: NULL_PARENT_ARTIFACT_TYPE_RULE,
    tokens: ['base'],
    mutate: (target) => {
      (target.item.artifact as Record<string, unknown>).type = 'IMAGE';
    },
  },
  {
    label: 'non-placeholder artefact role',
    rule: NULL_PARENT_ARTIFACT_ROLE_RULE,
    tokens: ['reference'],
    mutate: (target) => {
      (target.item.artifact as Record<string, unknown>).role = 'reference';
    },
  },
];

/**
 * Corruption rows for the null-parent placeholder's required explicit-null full
 * source keys. Deleting an artefact content or contentHash key is only asserted
 * on the full-representation owners: the partial redaction owner already
 * rejects undefined content with its own redaction rule, which its suites keep
 * covered.
 */
const NULL_PARENT_SOURCE_FIELD_ROWS: Array<{
  label: string;
  field: string;
  mutate: (target: Target) => void;
}> = [
  {
    label: 'missing artefact content key',
    field: 'content',
    mutate: (target) => {
      delete (target.item.artifact as Record<string, unknown>).content;
    },
  },
  {
    label: 'undefined artefact content',
    field: 'content',
    mutate: (target) => {
      (target.item.artifact as Record<string, unknown>).content = undefined;
    },
  },
  {
    label: 'missing artefact contentHash key',
    field: 'contentHash',
    mutate: (target) => {
      delete (target.item.artifact as Record<string, unknown>).contentHash;
    },
  },
  {
    label: 'undefined artefact contentHash',
    field: 'contentHash',
    mutate: (target) => {
      (target.item.artifact as Record<string, unknown>).contentHash = undefined;
    },
  },
];

/**
 * Runs the null-parent source-strictness matrix for one owning validator.
 *
 * @param {{describe: string, subject: () => Owner, fullRepresentation: boolean}}
 *   config Suite configuration; the field rows run on both full-representation
 *   owners and the empty-object, type, and role rows run on every owner with a
 *   null-document target.
 */
function runNullParentStrictnessMatrix(config: {
  describe: string;
  subject: () => Owner;
  fullRepresentation: boolean;
}): void {
  describe(config.describe, () => {
    it('accepts the canonical null-document base submission artefact', () => {
      const subject = config.subject();
      const target = subject.nullDocumentTarget();
      expect(target.submission.documentId).toBeNull();
      const artefact = target.item.artifact as Record<string, unknown>;
      expect(artefact.type).toBe('base');
      expect(artefact.role).toBe('submission');
      expect(artefact.content).toBeNull();
      expect(artefact.contentHash).toBeNull();
      expect(artefact.metadata).toStrictEqual({});
      expect(target.item.feedback).toStrictEqual({});
      expect(subject.validate).not.toThrow();
    });

    it.each(NULL_PARENT_STRICTNESS_ROWS)('rejects $label beneath the null parent', (row) => {
      const subject = config.subject();
      const target = subject.nullDocumentTarget();
      row.mutate(target);
      expectRule(subject.validate, row.rule, [String(target.item.taskId), ...(row.tokens ?? [])]);
    });

    if (config.fullRepresentation) {
      it.each(NULL_PARENT_SOURCE_FIELD_ROWS)('rejects $label beneath the null parent', (row) => {
        const subject = config.subject();
        const target = subject.nullDocumentTarget();
        row.mutate(target);
        expectRule(subject.validate, NULL_PARENT_SOURCE_FIELD_RULE, [
          String(target.item.taskId),
          row.field,
        ]);
      });
    }
  });
}

runNullParentStrictnessMatrix({
  describe: 'persistence null-parent source boundary',
  subject: createPersistenceBoundary,
  fullRepresentation: true,
});

runNullParentStrictnessMatrix({
  describe: 'full transport null-parent source boundary',
  subject: createFullTransportBoundary,
  fullRepresentation: true,
});

runNullParentStrictnessMatrix({
  describe: 'class partial transport null-parent source boundary',
  subject: () => createClassTransportBoundary('keyed'),
  fullRepresentation: false,
});

runNullParentStrictnessMatrix({
  describe: 'partial-only transport null-parent source boundary',
  subject: () => createClassTransportBoundary('partialOnly'),
  fullRepresentation: false,
});
