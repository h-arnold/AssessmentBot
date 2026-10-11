/**
 * Artifact and task-shape tests for the `assignmentAssessment` Zod schemas.
 *
 * Split out of `assignmentAssessment.zod.spec.ts` so each suite stays under
 * the line budget. Retained sibling coverage: request, assignment, submission
 * and assessment cases remain in `assignmentAssessment.zod.spec.ts`.
 *
 * Accepting cases are derived from the canonical submission artifact and task
 * definition carried by `validFullAssignment`, so the schemas are exercised
 * against realistic transport shapes. Boundary overrides (null content, null
 * contentHash, null index), the nullable artifact source IDs, and the
 * unsupported `SPREADSHEET` / `base` bodies the corpus never emits stay local
 * on top of that canonical base; rejecting cases stay deliberately invalid and
 * local.
 */

import { describe, expect, it } from 'vitest';
import {
  AssignmentFullSchema,
  BaseTaskArtifactSchema,
  TaskDefinitionSchema,
} from './assignmentAssessment.zod';
import { validFullAssignment } from '../../test/assignmentAssessment/assignmentAssessment.zod.fixtures';

/** Canonical submission artifact carrying a realistic TEXT body. */
const CANONICAL_TEXT_ARTIFACT = Object.values(validFullAssignment.submissions[0].items)[0].artifact;

/** Canonical task definition carried by the embedded assignment definition. */
const CANONICAL_TASK_DEFINITION = Object.values(validFullAssignment.assignmentDefinition.tasks)[0];

/** Artifact types that share the common `pageId` / `documentId` fields. */
const SUPPORTED_ARTIFACT_TYPES = ['TEXT', 'TABLE', 'IMAGE', 'SPREADSHEET', 'base'] as const;

describe('assignmentAssessment.zod schemas', () => {
  describe('BaseTaskArtifactSchema', () => {
    it('accepts a valid artifact with all string fields and contentHash: null', () => {
      const validArtifact = { ...CANONICAL_TEXT_ARTIFACT, content: null, contentHash: null };
      expect(BaseTaskArtifactSchema.parse(validArtifact)).toEqual(validArtifact);
    });

    it('rejects an artifact missing taskId', () => {
      expect(() =>
        BaseTaskArtifactSchema.parse({
          role: 'reference',
          pageId: 'page-1',
          documentId: 'doc-ref',
          uid: 'uid-1',
          type: 'TEXT',
          content: null,
          contentHash: null,
          metadata: {},
        })
      ).toThrow();
    });

    it('rejects an artifact with contentHash as a number', () => {
      expect(() =>
        BaseTaskArtifactSchema.parse({
          taskId: 'task-1',
          role: 'reference',
          pageId: 'page-1',
          documentId: 'doc-ref',
          uid: 'uid-1',
          type: 'TEXT',
          content: null,
          contentHash: 123,
          metadata: {},
        })
      ).toThrow();
    });

    it('accepts a TEXT artifact with string content', () => {
      expect(BaseTaskArtifactSchema.parse(CANONICAL_TEXT_ARTIFACT)).toEqual(
        CANONICAL_TEXT_ARTIFACT
      );
    });

    it('accepts a TEXT artifact with null content', () => {
      const artifact = { ...CANONICAL_TEXT_ARTIFACT, content: null };
      expect(BaseTaskArtifactSchema.parse(artifact)).toEqual(artifact);
    });

    it('accepts a SPREADSHEET artifact with 2D array content', () => {
      const artifact = {
        ...CANONICAL_TEXT_ARTIFACT,
        type: 'SPREADSHEET',
        content: [
          ['a', 1, null],
          ['b', 1, null],
        ],
      };
      expect(BaseTaskArtifactSchema.parse(artifact)).toEqual(artifact);
    });

    it('accepts a SPREADSHEET artifact with null content', () => {
      const artifact = { ...CANONICAL_TEXT_ARTIFACT, type: 'SPREADSHEET', content: null };
      expect(BaseTaskArtifactSchema.parse(artifact)).toEqual(artifact);
    });

    it('accepts a base artifact with unknown content', () => {
      const artifact = {
        ...CANONICAL_TEXT_ARTIFACT,
        type: 'base',
        content: { arbitrary: 'object' },
      };
      expect(BaseTaskArtifactSchema.parse(artifact)).toEqual(artifact);
    });

    it('rejects a SPREADSHEET artifact with string content', () => {
      expect(() =>
        BaseTaskArtifactSchema.parse({
          ...CANONICAL_TEXT_ARTIFACT,
          type: 'SPREADSHEET',
          content: 'string instead of 2D array',
        })
      ).toThrow();
    });

    it('rejects an artifact with an unrecognised type', () => {
      expect(() =>
        BaseTaskArtifactSchema.parse({
          ...CANONICAL_TEXT_ARTIFACT,
          type: 'BOGUS',
        })
      ).toThrow();
    });
  });

  describe('BaseTaskArtifactSchema source-ID nullability', () => {
    it.each(SUPPORTED_ARTIFACT_TYPES)(
      'accepts null pageId and documentId on a %s artifact',
      (type) => {
        const artifact = {
          ...CANONICAL_TEXT_ARTIFACT,
          type,
          content: null,
          pageId: null,
          documentId: null,
        };
        expect(BaseTaskArtifactSchema.parse(artifact)).toEqual(artifact);
      }
    );

    it('accepts the canonical full assignment with every artifact source ID nulled', () => {
      const payload = structuredClone(validFullAssignment);
      for (const submission of payload.submissions) {
        for (const item of Object.values(submission.items)) {
          item.artifact.pageId = null;
          item.artifact.documentId = null;
        }
      }
      for (const task of Object.values(payload.assignmentDefinition.tasks)) {
        for (const artifact of [...task.artifacts.reference, ...task.artifacts.template]) {
          artifact.pageId = null;
          artifact.documentId = null;
        }
      }

      expect(() => AssignmentFullSchema.parse(payload)).not.toThrow();
    });

    it('rejects an artifact missing pageId', () => {
      expect(() =>
        BaseTaskArtifactSchema.parse({
          taskId: 'task-1',
          role: 'submission',
          documentId: 'doc-1',
          uid: 'uid-1',
          type: 'TEXT',
          content: null,
          contentHash: null,
          metadata: {},
        })
      ).toThrow();
    });

    it('rejects an artifact missing documentId', () => {
      expect(() =>
        BaseTaskArtifactSchema.parse({
          taskId: 'task-1',
          role: 'submission',
          pageId: 'page-1',
          uid: 'uid-1',
          type: 'TEXT',
          content: null,
          contentHash: null,
          metadata: {},
        })
      ).toThrow();
    });

    it('rejects a pageId that is a number', () => {
      expect(() =>
        BaseTaskArtifactSchema.parse({ ...CANONICAL_TEXT_ARTIFACT, pageId: 42 })
      ).toThrow();
    });

    it('rejects a documentId that is an object', () => {
      expect(() =>
        BaseTaskArtifactSchema.parse({
          ...CANONICAL_TEXT_ARTIFACT,
          documentId: { id: 'doc-1' },
        })
      ).toThrow();
    });
  });

  describe('TaskDefinitionSchema', () => {
    it('accepts a valid definition with taskWeighting: 1, index: null, taskNotes: null', () => {
      const validDefinition = { ...CANONICAL_TASK_DEFINITION, index: null };
      expect(TaskDefinitionSchema.parse(validDefinition)).toEqual(validDefinition);
    });

    it('rejects a definition with taskWeighting as a string', () => {
      expect(() =>
        TaskDefinitionSchema.parse({
          ...CANONICAL_TASK_DEFINITION,
          taskWeighting: 'heavy',
        })
      ).toThrow();
    });

    it('rejects a definition with index as a string', () => {
      expect(() =>
        TaskDefinitionSchema.parse({
          ...CANONICAL_TASK_DEFINITION,
          index: 'first',
        })
      ).toThrow();
    });
  });
});
