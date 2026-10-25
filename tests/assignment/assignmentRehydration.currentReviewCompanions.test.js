import { afterEach, describe, expect, it, vi } from 'vitest';
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const {
  StudentSubmissionItem,
} = require('#backend/Models/StudentSubmission/00_StudentSubmissionItem.js');
const BaseTaskArtifact = require('#backend/Models/Artifacts/0_BaseTaskArtifact.js');
import {
  HEAD_TASK_ID,
  SIBLING_TASK_ID,
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
  restoreAssignment,
  expectCorruptRecordPlaceholder,
  expectSiblingIntact,
  storedItemJson,
} from './assignmentRehydrationCurrentSupport.js';
import { Assessment } from '#backend/Models/Assessment.js';

afterEach(() => vi.restoreAllMocks());

describe('CURRENT artefact body/hash pairing', () => {
  const mismatchCases = [
    {
      label: 'numeric body/hash',
      score: 4,
      corrupt: (artifact) => {
        artifact.content = null;
      },
      expected: (artifact) => artifact.contentHash !== null,
    },
    {
      label: 'numeric hash/body',
      score: 4,
      corrupt: (artifact) => {
        artifact.contentHash = null;
      },
      expected: (artifact) => artifact.content !== null,
    },
    {
      label: 'N body/hash',
      score: 'N',
      corrupt: (artifact) => {
        artifact.content = null;
      },
      expected: (artifact) => artifact.contentHash !== null,
    },
    {
      label: 'N hash/body',
      score: 'N',
      corrupt: (artifact) => {
        artifact.contentHash = null;
      },
      expected: (artifact) => artifact.content !== null,
    },
    {
      label: 'assessment E body/hash',
      stage: 'assessment',
      code: 'ASSESSMENT_FAILED',
      corrupt: (artifact) => {
        artifact.content = null;
      },
      expected: (artifact) => artifact.contentHash !== null,
    },
    {
      label: 'assessment E hash/body',
      stage: 'assessment',
      code: 'ASSESSMENT_FAILED',
      corrupt: (artifact) => {
        artifact.contentHash = null;
      },
      expected: (artifact) => artifact.content !== null,
    },
    {
      label: 'extraction E body/hash',
      stage: 'extraction',
      code: 'SOURCE_CONTENT_UNAVAILABLE',
      corrupt: (artifact) => {
        artifact.content = null;
      },
      expected: (artifact) => artifact.contentHash !== null,
    },
    {
      label: 'extraction E hash/body',
      stage: 'extraction',
      code: 'SOURCE_CONTENT_UNAVAILABLE',
      corrupt: (artifact) => {
        artifact.contentHash = null;
      },
      expected: (artifact) => artifact.content !== null,
    },
  ];
  for (const { label, score, stage, code, corrupt, expected } of mismatchCases) {
    it(`rejects mismatched body/hash pair for ${label} without repairing target hash`, () => {
      const record = currentAssignmentJson();
      const item = record.submissions[0].items[HEAD_TASK_ID];
      if (stage) {
        const entry = Assessment.createError(stage, code).toJSON();
        item.assessments = Object.fromEntries(
          ['completeness', 'accuracy', 'spag'].map((criterion) => [
            criterion,
            structuredClone(entry),
          ])
        );
      } else {
        item.assessments = Object.fromEntries(
          ['completeness', 'accuracy', 'spag'].map((criterion) => [
            criterion,
            { score, reasoning: 'Explicit raw result.' },
          ])
        );
      }
      for (const raw of Object.values(item.assessments)) {
        expect(raw.score).toBe(score ?? 'E');
        if (stage) {
          expect(raw.stage).toBeUndefined();
          expect(raw.error).toEqual({ stage, code });
          expect(raw.reasoning).toBe(Assessment.createError(stage, code).toJSON().reasoning);
        } else expect(raw.score).toBe(score);
      }
      corrupt(item.artifact);
      expect(expected(item.artifact)).toBe(true);
      const rawHash = item.artifact.contentHash;
      const sibling = storedItemJson(record, 0, SIBLING_TASK_ID);
      const ensureHash = vi.spyOn(BaseTaskArtifact.prototype, 'ensureHash');
      const result = restoreAssignment(record);
      expectCorruptRecordPlaceholder(result.submissions[0].items[HEAD_TASK_ID]);
      expect(ensureHash.mock.instances.some((artifact) => artifact.taskId === HEAD_TASK_ID)).toBe(
        false
      );
      expectSiblingIntact(result.submissions[0], sibling);
      expect(item.artifact.contentHash).toBe(rawHash);
    });
  }

  it.each([
    ['acquisition', 'SOURCE_UNREADABLE', 2, false],
    ['extraction', 'SOURCE_CONTENT_UNAVAILABLE', 0, true],
    ['validation', 'REASSESSMENT_REQUIRED', 2, false],
  ])(
    'preserves explicit-null %s causes in full mode',
    (stage, code, submissionIndex, extraction) => {
      const record = currentAssignmentJson();
      const item = record.submissions[submissionIndex].items[HEAD_TASK_ID];
      if (extraction) {
        item.artifact.content = null;
        item.artifact.contentHash = null;
      } else {
        expect(record.submissions[submissionIndex].documentId).toBeNull();
        expect(item.artifact.documentId).toBeNull();
        expect(item.artifact.pageId).toBeNull();
      }
      const expectedAssessments = Object.fromEntries(
        ['completeness', 'accuracy', 'spag'].map((criterion) => [
          criterion,
          Assessment.createError(stage, code).toJSON(),
        ])
      );
      item.assessments = structuredClone(expectedAssessments);
      expect(item.assessments).toEqual(expectedAssessments);
      expect(Object.values(item.assessments).map(({ error }) => error)).toEqual(
        Array(3).fill({ stage, code })
      );
      const oracle = storedItemJson(record, submissionIndex, HEAD_TASK_ID);
      const sibling = storedItemJson(record, submissionIndex, SIBLING_TASK_ID);
      const restored = restoreAssignment(record, 'full');
      expect(restored.submissions[submissionIndex].items[HEAD_TASK_ID].toJSON()).toEqual(oracle);
      expect(restored.submissions[submissionIndex].items[HEAD_TASK_ID].assessments).toEqual(
        expectedAssessments
      );
      expectSiblingIntact(restored.submissions[submissionIndex], sibling);
    }
  );

  it('keeps redacted partial artefacts exempt and restores them in partial mode', () => {
    const partial = rawPartialEmbeddedSnapshot(currentAssignmentJson());
    const rawArtifact = structuredClone(partial.submissions[0].items[HEAD_TASK_ID].artifact);
    expect(rawArtifact.content).toBeNull();
    expect(rawArtifact.contentHash).toBeNull();
    const ensureHash = vi.spyOn(BaseTaskArtifact.prototype, 'ensureHash');
    const restored = restoreAssignment(partial, 'partial');
    expect(restored.submissions[0].items[HEAD_TASK_ID].artifact.toJSON()).toEqual(rawArtifact);
    expect(ensureHash.mock.instances.some((artifact) => artifact.taskId === HEAD_TASK_ID)).toBe(
      false
    );
  });
});

describe('CURRENT shared task summaries and timestamp selection', () => {
  it('rejects duplicate partial summary IDs before coverage can collapse', () => {
    const partial = rawPartialEmbeddedSnapshot(currentAssignmentJson());
    const [first, second] = partial.assignmentDefinition.tasks;
    second.taskId = first.taskId;
    expect(partial.assignmentDefinition.tasks.map((task) => task.taskId)).toEqual([
      first.taskId,
      first.taskId,
    ]);
    expect(partial.submissions).toHaveLength(currentAssignmentJson().submissions.length);
    expect(() => restoreAssignment(partial)).toThrow();
  });

  it('rejects duplicate partial summary IDs with no submissions', () => {
    const partial = rawPartialEmbeddedSnapshot(currentAssignmentJson());
    const [first, second] = partial.assignmentDefinition.tasks;
    second.taskId = first.taskId;
    partial.submissions = [];
    expect(partial.submissions).toEqual([]);
    expect(() => restoreAssignment(partial, 'partial')).toThrow();
  });

  it('accepts unique partial summaries with no submissions', () => {
    const partial = rawPartialEmbeddedSnapshot(currentAssignmentJson());
    partial.submissions = [];
    expect(() => restoreAssignment(partial, 'partial')).not.toThrow();
  });

  it('rejects shared task-universe corruption with empty submissions', () => {
    const record = currentAssignmentJson();
    record.submissions = [];
    record.assignmentDefinition.tasks[HEAD_TASK_ID].taskId = SIBLING_TASK_ID;
    expect(Object.keys(record.assignmentDefinition.tasks)).toContain(HEAD_TASK_ID);
    expect(record.assignmentDefinition.tasks[HEAD_TASK_ID].taskId).toBe(SIBLING_TASK_ID);
    expect(record.submissions).toEqual([]);
    expect(() => restoreAssignment(record)).toThrow();
  });

  it('preserves valid stored submission times', () => {
    const record = currentAssignmentJson();
    const submission = record.submissions[0];
    const storedCreatedAt = submission.createdAt;
    const storedUpdatedAt = submission.updatedAt;
    const intact = restoreAssignment(record).toJSON().submissions[0];
    expect(intact.createdAt).toBe(storedCreatedAt);
    expect(intact.updatedAt).toBe(storedUpdatedAt);
  });

  it.each(['missing', 'malformed'])('falls back each %s timestamp independently', (kind) => {
    const record = currentAssignmentJson();
    const submission = record.submissions[0];
    if (kind === 'missing') {
      delete submission.createdAt;
      delete submission.updatedAt;
    } else {
      submission.createdAt = 'malformed';
      submission.updatedAt = 'malformed';
    }
    const first = restoreAssignment(record).toJSON();
    const second = restoreAssignment(record).toJSON();
    expect(first).toEqual(second);
    expect(first.submissions[0].createdAt).toBe(record.createdAt);
    expect(first.submissions[0].updatedAt).toBe(record.updatedAt);
  });

  it('uses createdAt when assignment.updatedAt is null', () => {
    const record = currentAssignmentJson();
    record.updatedAt = null;
    delete record.submissions[0].updatedAt;
    const first = restoreAssignment(record).toJSON();
    const second = restoreAssignment(record).toJSON();
    expect(first).toEqual(second);
    expect(first.submissions[0].createdAt).toBe(record.createdAt);
    expect(first.submissions[0].updatedAt).toBe(record.createdAt);
  });
});

describe('CURRENT serialization failures on model items', () => {
  it('propagates an actual healthy model item serialization fault without retry', () => {
    const materialised = restoreAssignment(currentAssignmentJson());
    const item = materialised.submissions[0].items[HEAD_TASK_ID];
    expect(item).toBeInstanceOf(StudentSubmissionItem);
    const sentinel = new Error('sentinel model serialization failure');
    const toJSON = vi.spyOn(item, 'toJSON').mockImplementation(() => {
      throw sentinel;
    });
    const input = currentAssignmentJson();
    input.submissions[0].items = materialised.submissions[0].items;
    expect(() => Assignment.fromJSON(input)).toThrow(sentinel);
    expect(toJSON).toHaveBeenCalledTimes(1);
  });
});
