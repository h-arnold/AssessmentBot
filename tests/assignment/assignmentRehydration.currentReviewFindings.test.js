import { afterEach, describe, expect, it, vi } from 'vitest';
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const { StudentSubmissionItem } = require('#backend/Models/StudentSubmission/index.js');
import {
  HEAD_TASK_ID,
  SIBLING_TASK_ID,
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
  restoreAssignment,
  expectCorruptRecordPlaceholder,
  expectSiblingIntact,
  storedItemJson,
  focusDocumentSubmission,
} from './assignmentRehydrationCurrentSupport.js';

afterEach(() => vi.restoreAllMocks());

describe('CURRENT raw artefact validation', () => {
  const invalid = [
    [
      'task association',
      (item) => {
        item.artifact.taskId = 'different-task';
      },
    ],
    [
      'unknown type',
      (item) => {
        item.artifact.type = 'BOGUS';
      },
    ],
    [
      'wrong role',
      (item) => {
        item.artifact.role = 'reference';
      },
    ],
    [
      'invalid TEXT body',
      (item) => {
        item.artifact.content = { bad: true };
      },
    ],
    [
      'missing document id',
      (item) => {
        delete item.artifact.documentId;
      },
    ],
    [
      'missing page id',
      (item) => {
        delete item.artifact.pageId;
      },
    ],
  ];
  it.each(invalid)('rejects %s before construction and preserves sibling', (_label, mutate) => {
    const record = currentAssignmentJson();
    focusDocumentSubmission(record);
    const bad = record.submissions[0].items[HEAD_TASK_ID];
    mutate(bad);
    const sibling = storedItemJson(record, 0, SIBLING_TASK_ID);
    const spy = vi.spyOn(StudentSubmissionItem, 'fromJSON');
    const restored = restoreAssignment(record);
    expectCorruptRecordPlaceholder(restored.submissions[0].items[HEAD_TASK_ID]);
    expect(spy.mock.calls.some(([raw]) => raw.taskId === HEAD_TASK_ID)).toBe(false);
    expectSiblingIntact(restored.submissions[0], sibling);
  });

  it('rejects malformed partial TEXT', () => {
    const partial = rawPartialEmbeddedSnapshot(currentAssignmentJson());
    partial.submissions[0].items[HEAD_TASK_ID].artifact.content = { bad: true };
    const sibling = storedItemJson(partial, 0, SIBLING_TASK_ID);
    const restored = restoreAssignment(partial, 'partial');
    expectCorruptRecordPlaceholder(restored.submissions[0].items[HEAD_TASK_ID]);
    expectSiblingIntact(restored.submissions[0], sibling);
  });

  it.each([
    [
      'task association',
      (artifact) => {
        artifact.taskId = 'different-task';
      },
    ],
    [
      'wrong role',
      (artifact) => {
        artifact.role = 'reference';
      },
    ],
    [
      'unknown type',
      (artifact) => {
        artifact.type = 'BOGUS';
      },
    ],
  ])('rejects partial artefact corruption: %s', (_label, mutate) => {
    const partial = rawPartialEmbeddedSnapshot(currentAssignmentJson());
    const inputItem = partial.submissions[0].items[HEAD_TASK_ID];
    mutate(inputItem.artifact);
    expect(inputItem.artifact.content).toBeNull();
    expect(inputItem.artifact.contentHash).toBeNull();
    const sibling = storedItemJson(partial, 0, SIBLING_TASK_ID);
    const restored = restoreAssignment(partial, 'partial');
    expectCorruptRecordPlaceholder(restored.submissions[0].items[HEAD_TASK_ID]);
    expectSiblingIntact(restored.submissions[0], sibling);
  });

  it('preserves numeric results for an unmutated partial control', () => {
    const partial = rawPartialEmbeddedSnapshot(currentAssignmentJson());
    const restored = restoreAssignment(partial, 'partial');
    expect(restored.submissions[0].items[HEAD_TASK_ID].assessments.completeness.score).toBeTypeOf(
      'number'
    );
    expect(
      restored.submissions[0].items[SIBLING_TASK_ID].assessments.completeness.score
    ).toBeTypeOf('number');
  });
});

describe('CURRENT shared dataset integrity', () => {
  it.each([
    [
      'map key disagreement',
      (r) => {
        r.assignmentDefinition.tasks[HEAD_TASK_ID].taskId = SIBLING_TASK_ID;
      },
    ],
    [
      'duplicate partial IDs',
      (r) => {
        const p = rawPartialEmbeddedSnapshot(r);
        p.assignmentDefinition.tasks[1].taskId = p.assignmentDefinition.tasks[0].taskId;
        return p;
      },
    ],
    [
      'blank root identity',
      (r) => {
        r.courseId = '   ';
      },
    ],
    [
      'non-array submissions',
      (r) => {
        r.submissions = {};
      },
    ],
  ])('rejects %s', (_name, mutate) => {
    const record = currentAssignmentJson();
    const input = mutate(record) || record;
    expect(() => restoreAssignment(input)).toThrow();
  });
  it('checks shared definition identities even with no submissions', () => {
    const record = currentAssignmentJson();
    record.submissions = [];
    record.assignmentDefinition.tasks[HEAD_TASK_ID].taskId = SIBLING_TASK_ID;
    expect(() => restoreAssignment(record)).toThrow();
  });

  it('rejects duplicate partial summary IDs with no submissions', () => {
    const record = rawPartialEmbeddedSnapshot(currentAssignmentJson());
    record.submissions = [];
    record.assignmentDefinition.tasks[1].taskId = record.assignmentDefinition.tasks[0].taskId;
    expect(record.submissions).toEqual([]);
    expect(record.assignmentDefinition.tasks.map(({ taskId }) => taskId)).toEqual([
      HEAD_TASK_ID,
      HEAD_TASK_ID,
    ]);
    expect(() => restoreAssignment(record, 'partial')).toThrow();

    const healthy = rawPartialEmbeddedSnapshot(currentAssignmentJson());
    healthy.submissions = [];
    expect(healthy.assignmentDefinition.tasks.map(({ taskId }) => taskId)).toEqual([
      HEAD_TASK_ID,
      SIBLING_TASK_ID,
    ]);
    expect(() => restoreAssignment(healthy, 'partial')).not.toThrow();
  });
});

describe('CURRENT deterministic timestamps and model input', () => {
  it.each(['missing', 'malformed'])(
    'uses stored assignment timestamps for %s submission timestamps',
    (kind) => {
      const record = currentAssignmentJson();
      const submission = record.submissions[0];
      if (kind === 'missing') {
        delete submission.createdAt;
        delete submission.updatedAt;
      } else {
        submission.createdAt = 'not-a-date';
        submission.updatedAt = 'not-a-date';
      }
      const first = restoreAssignment(record).toJSON();
      const second = restoreAssignment(record).toJSON();
      expect(first).toEqual(second);
      expect(first.submissions[0].createdAt).toBe(record.createdAt);
    }
  );

  it('accepts already materialised healthy submission item instances', () => {
    const raw = currentAssignmentJson();
    const materialised = restoreAssignment(raw).toJSON();
    const record = currentAssignmentJson();
    record.submissions[0].items = restoreAssignment(raw).submissions[0].items;
    const result = Assignment.fromJSON(record);
    expect(result.submissions[0].items[HEAD_TASK_ID].assessments).toEqual(
      materialised.submissions[0].items[HEAD_TASK_ID].assessments
    );
    expect(result.submissions[0].items[HEAD_TASK_ID].assessments.completeness.score).toBeTypeOf(
      'number'
    );
  });
});
