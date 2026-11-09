/**
 * Legacy read preparation: validation mode, non-array roots and rejections.
 *
 * The validation mode is derived from the embedded definition representation
 * (array tasks select partial validation; a keyed task map selects full
 * validation), independent of the requested output form. A present non-array
 * submissions root bypasses preparation. Identity and association faults still
 * reject loudly rather than being relabelled E.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  corruptRecordAssessments,
  healthyFullRecord,
  partialSnapshot,
  prepare,
  restoreLegacy,
} from './assignmentLegacyReadPreparationSupport.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';

const Rehydration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');
const CurrentRestoration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentCurrentRestoration.js');
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');

const HEAD_TASK_ID = 'task-1-0';
const DOCUMENT_SUBMISSION_INDEX = 3;

/** Restores a single document submission record without the sibling task. */
function documentSubmissionWithoutSibling() {
  const record = healthyFullRecord();
  record.submissions = [record.submissions[DOCUMENT_SUBMISSION_INDEX]];
  Reflect.deleteProperty(record.submissions[0].items, 'task-1-1');
  return record;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('legacy read preparation validation mode from definition representation', () => {
  it('accepts a numeric item under a keyed full definition on both output forms', () => {
    const record = documentSubmissionWithoutSibling();
    for (const form of ['full', 'partial']) {
      const prepared = prepare(restoreLegacy(record), form);
      expect(prepared[0].items[HEAD_TASK_ID].assessments.completeness.score).toBe(3);
      expect(prepared[0].items[HEAD_TASK_ID].assessments).not.toEqual(corruptRecordAssessments());
    }
  });

  it('rejects a redacted body under a full definition as contradictory, regardless of output form', () => {
    const full = documentSubmissionWithoutSibling();
    const redacted = partialSnapshot(full);
    // Keep the full keyed definition but use the redacted stored bodies.
    redacted.assignmentDefinition = structuredClone(full.assignmentDefinition);
    expect(Object.hasOwn(redacted, 'tasks')).toBe(false);
    const restored = restoreLegacy(redacted);
    expect(Array.isArray(restored.assignmentDefinition.tasks)).toBe(false);
    expect(restored.submissions[0].items[HEAD_TASK_ID].artifact.content).toBeNull();
    expect(restored.submissions[0].items[HEAD_TASK_ID].assessments.completeness.reasoning).toBe(
      undefined
    );

    for (const form of ['full', 'partial']) {
      const prepared = prepare(restoreLegacy(redacted), form);
      expect(prepared[0].items[HEAD_TASK_ID].assessments).toEqual(corruptRecordAssessments());
    }
  });

  it('validates a redacted partial body under an array definition as partial', () => {
    const record = healthyFullRecord();
    const source = record.submissions[0];
    const prepared = prepare(restoreLegacy(partialSnapshot(record)), 'partial');
    const preparedSubmission = prepared.find(
      (submission) => submission.studentId === source.studentId
    );
    expect(preparedSubmission.items[HEAD_TASK_ID].assessments.completeness.score).toBe(0);
    expect(preparedSubmission.items[HEAD_TASK_ID].assessments.spag.score).toBe('N');
    expect(preparedSubmission.items[HEAD_TASK_ID].artifact.content).toBeNull();
  });

  it('uses the resolved full definition task list for the full output form', () => {
    // A class-embedded stored definition carries a stale subset summary; the full
    // read path resolves it to the full keyed map before preparation. The full
    // output form must use the resolved task list, not the stored summary.
    const record = healthyFullRecord();
    const summarySource = partialSnapshot(record);
    const fullTaskIds = Object.keys(record.assignmentDefinition.tasks).sort();
    expect(fullTaskIds.length).toBeGreaterThan(1);
    summarySource.assignmentDefinition.tasks = summarySource.assignmentDefinition.tasks.slice(0, 1);
    const summaryIds = summarySource.assignmentDefinition.tasks.map((task) => task.taskId);
    expect(summaryIds).not.toEqual(fullTaskIds);

    const partial = restoreLegacy(summarySource);
    expect(Array.isArray(partial.assignmentDefinition.tasks)).toBe(true);
    const resolvedRecord = {
      ...record,
      submissions: [],
      assignmentDefinition: structuredClone(record.assignmentDefinition),
    };
    partial.assignmentDefinition = Assignment.fromJSON(resolvedRecord).assignmentDefinition;
    expect(Array.isArray(partial.assignmentDefinition.tasks)).toBe(false);

    const prepared = prepare(partial, 'full');
    for (const submission of prepared) {
      expect(Object.keys(submission.items).sort()).toEqual(fullTaskIds);
    }
    expect(prepared.length).toBe(record.submissions.length);
  });
});

describe('legacy read preparation non-array submissions root', () => {
  it.each([
    ['an object', () => ({ legacyStudent: { studentId: 'legacy-student' } })],
    ['null', () => null],
    ['a string', () => 'not-an-array'],
  ])('bypasses preparation and reports the bypass for %s', (_label, buildRoot) => {
    const record = healthyFullRecord();
    const root = buildRoot();
    record.submissions = root;
    const restored = restoreLegacy(record);

    const rosterFetch = vi.fn(() => {
      throw new Error('preparation must not fetch a roster');
    });
    const collectionAccess = vi.fn(() => {
      throw new Error('preparation must not access storage');
    });
    const before = structuredClone(restored.submissions);

    const result = withTemporaryGlobals(
      {
        Classroom: { Courses: { Students: { list: rosterFetch } } },
        DbManager: { getInstance: () => ({ getCollection: collectionAccess }) },
      },
      () => prepare(restored, 'full')
    );

    expect(result).toBeNull();
    expect(rosterFetch).not.toHaveBeenCalled();
    expect(collectionAccess).not.toHaveBeenCalled();
    expect(restored.submissions).toEqual(before);
    // Persistence still emits the preserved value.
    expect(restored.toJSON().submissions).toEqual(root);
  });
});

describe('legacy read preparation rejections and fault propagation', () => {
  it.each([
    [
      'a missing student identity',
      (record) => Reflect.deleteProperty(record.submissions[0], 'studentId'),
    ],
    ['a blank student identity', (record) => (record.submissions[0].studentId = '   ')],
    ['a conflicting parent assignment', (record) => (record.submissions[0].assignmentId = 'other')],
  ])('rejects %s loudly', (_label, corrupt) => {
    const record = healthyFullRecord();
    corrupt(record);
    const restored = restoreLegacy(record);
    expect(Rehydration.prepareLegacyReadSubmissions).toEqual(expect.any(Function));
    expect(() => Rehydration.prepareLegacyReadSubmissions(restored, 'full')).toThrow(
      /student|assignment|identity|submission|trust/i
    );
  });

  it('rejects an item associated with an unknown task', () => {
    const record = healthyFullRecord();
    record.submissions[0].items['task-unknown'] = structuredClone(
      record.submissions[0].items[HEAD_TASK_ID]
    );
    record.submissions[0].items['task-unknown'].taskId = 'task-unknown';
    const restored = restoreLegacy(record);
    expect(() => Rehydration.prepareLegacyReadSubmissions(restored, 'full')).toThrow(
      /task|unknown/i
    );
  });

  it('propagates an injected restoration fault instead of relabelling it E', () => {
    const record = healthyFullRecord();
    const restored = restoreLegacy(record);
    const sentinel = new Error('injected restoration fault');
    const fault = vi
      .spyOn(CurrentRestoration, '_rehydrateCurrentSubmission')
      .mockImplementation(() => {
        throw sentinel;
      });

    let thrown;
    try {
      Rehydration.prepareLegacyReadSubmissions(restored, 'full');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(sentinel);
    fault.mockRestore();
  });

  it('rejects an unsupported output form without weakening validation', () => {
    const record = healthyFullRecord();
    const restored = restoreLegacy(record);
    expect(() => Rehydration.prepareLegacyReadSubmissions(restored, 'sideways')).toThrow(
      /form|mode/i
    );
  });
});
