/**
 * Legacy read preparation: healthy data preservation and output forms.
 *
 * A restored legacy assignment is prepared into an independent read result.
 * Valid numeric/N items keep their score, reasoning, content/hash, feedback and
 * source IDs; an explicitly valid E stays E; the `partial` output form redacts
 * artefact bodies through the existing submission serialiser.
 */
const AssignmentLegacyRead = require('#backend/AssignmentProcessor/Assignment/02_AssignmentLegacyRead.js');
const {
  StudentSubmissionItem,
} = require('#backend/Models/StudentSubmission/00_StudentSubmissionItem.js');

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  corruptRecordAssessments,
  embeddedTaskIds,
  healthyFullRecord,
  mixedFullRecord,
  prepare,
  restoredWithDefinitionShape,
} from './assignmentLegacyReadPreparationSupport.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const HEALTHY_HEAD_TASK_ID = 'task-1-0';

function submissionById(result, studentId) {
  return result.find((submission) => submission.studentId === studentId);
}

describe('legacy read preparation healthy preservation', () => {
  it('keeps numeric and N scores, reasoning, content and feedback on the full form', () => {
    const record = healthyFullRecord();
    const source = record.submissions[0];
    const prepared = prepare(restoredWithDefinitionShape(record, 'full'), 'full');

    const expectedIds = record.submissions.map((submission) => submission.studentId).sort();
    expect(prepared.map((submission) => submission.studentId).sort()).toEqual(expectedIds);

    const preparedSubmission = submissionById(prepared, source.studentId);
    expect(preparedSubmission.assignmentId).toBe(record.assignmentId);
    expect(preparedSubmission.documentId).toBe(source.documentId);
    expect(preparedSubmission.studentName).toBe(source.studentName);

    for (const [taskId, storedItem] of Object.entries(source.items)) {
      const preparedItem = preparedSubmission.items[taskId];
      expect(preparedItem.artifact.content).toBe(storedItem.artifact.content);
      expect(preparedItem.artifact.contentHash).toBe(storedItem.artifact.contentHash);
      expect(preparedItem.artifact.documentId).toBe(storedItem.artifact.documentId);
      expect(preparedItem.artifact.pageId).toBe(storedItem.artifact.pageId);
      expect(preparedItem.assessments).toEqual(storedItem.assessments);
      for (const criterion of ['completeness', 'accuracy', 'spag']) {
        expect(preparedItem.assessments[criterion].reasoning).toBe(
          storedItem.assessments[criterion].reasoning
        );
      }
      expect(preparedItem.feedback).toEqual(storedItem.feedback);
    }
    // The canonical N marker survives without coercion to a number or E.
    expect(preparedSubmission.items[HEALTHY_HEAD_TASK_ID].assessments.spag.score).toBe('N');
    expect(preparedSubmission.items[HEALTHY_HEAD_TASK_ID].assessments.completeness.score).toBe(0);
  });

  it('redacts artefact bodies and numeric reasoning on the partial form only', () => {
    const record = healthyFullRecord();
    const source = record.submissions[0];
    const full = prepare(restoredWithDefinitionShape(record, 'full'), 'full');
    const partial = prepare(restoredWithDefinitionShape(record, 'full'), 'partial');

    const fullItem = submissionById(full, source.studentId).items[HEALTHY_HEAD_TASK_ID];
    const partialItem = submissionById(partial, source.studentId).items[HEALTHY_HEAD_TASK_ID];
    expect(fullItem.artifact.content).not.toBeNull();
    expect(partialItem.artifact.content).toBeNull();
    expect(partialItem.artifact.contentHash).toBeNull();
    expect(partialItem.assessments.completeness).toEqual({ score: 0 });
    expect(partialItem.feedback).toEqual(source.items[HEALTHY_HEAD_TASK_ID].feedback);
  });

  it('retains an explicitly valid E entry without re-labelling it', () => {
    const record = mixedFullRecord();
    const eSubmission = record.submissions[1];
    const prepared = prepare(restoredWithDefinitionShape(record, 'full'), 'full');
    const preparedSubmission = submissionById(prepared, eSubmission.studentId);

    for (const storedItem of Object.values(eSubmission.items)) {
      expect(storedItem.assessments.completeness.score).toBe('E');
      expect(storedItem.assessments.completeness.error).toEqual({
        stage: 'assessment',
        code: 'ASSESSMENT_FAILED',
      });
    }
    for (const [taskId, storedItem] of Object.entries(eSubmission.items)) {
      expect(preparedSubmission.items[taskId].assessments).toEqual(storedItem.assessments);
      expect(preparedSubmission.items[taskId].assessments).not.toEqual(corruptRecordAssessments());
    }
  });

  it('prepares mixed numeric and E submissions for the medium selection independently', () => {
    const record = mixedFullRecord();
    const prepared = prepare(restoredWithDefinitionShape(record, 'full'), 'full');
    expect(prepared).toHaveLength(record.submissions.length);
    const numeric = submissionById(prepared, record.submissions[0].studentId);
    const error = submissionById(prepared, record.submissions[1].studentId);
    expect(numeric.items['task-2-0'].assessments.spag.score).toBe('N');
    expect(error.items['task-2-0'].assessments.completeness.score).toBe('E');
    expect(error.items['task-2-0'].assessments.completeness.error).toEqual({
      stage: 'assessment',
      code: 'ASSESSMENT_FAILED',
    });
  });

  it('covers every embedded task on each prepared submission in both output forms', () => {
    const record = healthyFullRecord();
    const taskIds = [...embeddedTaskIds(restoredWithDefinitionShape(record, 'full'))].sort();
    expect(taskIds.length).toBeGreaterThan(0);
    for (const form of ['full', 'partial']) {
      const prepared = prepare(restoredWithDefinitionShape(record, 'full'), form);
      for (const submission of prepared) {
        expect(Object.keys(submission.items).sort()).toEqual(taskIds);
      }
    }
  });
});

describe('legacy read preparation isolation from saved state', () => {
  it('keeps persistence output and the input record unchanged after mutating the read result', () => {
    const record = healthyFullRecord();
    const before = structuredClone(record);
    const restored = restoredWithDefinitionShape(record, 'full');
    const persistenceBefore = restored.toJSON();
    const persistenceSnapshot = structuredClone(persistenceBefore);

    const prepared = prepare(restored, 'full');
    const target = prepared[0].items[HEALTHY_HEAD_TASK_ID];
    target.assessments.completeness.score = 99;
    target.assessments.completeness.reasoning = 'mutated after preparation';
    target.feedback = { mutated: true };

    // The prepared result is independent of both the restored model and the input.
    expect(prepared[0].items[HEALTHY_HEAD_TASK_ID].assessments.completeness.score).toBe(99);
    expect(restored.toJSON()).toEqual(persistenceBefore);
    expect(restored.toJSON()).toEqual(persistenceSnapshot);
    expect(record).toEqual(before);
  });
});

describe('legacy read preparation timestamps', () => {
  it('uses valid saved submission times and never the clock', () => {
    const record = healthyFullRecord();
    const source = record.submissions[0];
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
    const first = prepare(restoredWithDefinitionShape(record, 'full'), 'full');
    vi.setSystemTime(new Date('2040-01-01T00:00:00.000Z'));
    const second = prepare(restoredWithDefinitionShape(record, 'full'), 'full');

    const preparedSubmission = submissionById(first, source.studentId);
    expect(preparedSubmission.createdAt).toBe(source.createdAt);
    expect(preparedSubmission.updatedAt).toBe(source.updatedAt);
    expect(preparedSubmission.createdAt).not.toBe(new Date().toISOString());
    expect(first).toEqual(second);
  });

  it('falls back to assignment times, using createdAt when updatedAt is null', () => {
    const record = healthyFullRecord();
    record.updatedAt = null;
    const source = record.submissions[0];
    source.createdAt = null;
    source.updatedAt = 'not-a-timestamp';
    const prepared = prepare(restoredWithDefinitionShape(record, 'full'), 'full');
    const preparedSubmission = submissionById(prepared, source.studentId);
    expect(preparedSubmission.createdAt).toBe(record.createdAt);
    expect(preparedSubmission.updatedAt).toBe(record.createdAt);
  });
});

describe('legacy read preparation raw stored item precedence', () => {
  const STORED_DATE = new Date('2022-05-06T07:08:09.000Z');

  it('keeps a stored raw item record as a deep-copied, date-converted, independently owned entry', () => {
    const record = healthyFullRecord();
    const stored = record.submissions[0];
    const storedItem = stored.items[HEALTHY_HEAD_TASK_ID];
    // A stored shape the model serialiser never emits: an extra raw field and a
    // live Date inside the feedback map.
    storedItem.legacyNote = 'raw-stored-shape';
    storedItem.feedback.reviewedAt = STORED_DATE;
    const before = structuredClone(record);

    const isolated = new AssignmentLegacyRead()._selectStoredItems(stored);
    const isolatedItem = isolated.items[HEALTHY_HEAD_TASK_ID];

    // The raw record flows through as-is rather than through the model serialiser.
    expect(isolatedItem).not.toBeInstanceOf(StudentSubmissionItem);
    expect(isolatedItem.legacyNote).toBe('raw-stored-shape');
    expect(isolatedItem.feedback.reviewedAt).toBe('2022-05-06T07:08:09.000Z');
    // The carrier holds independent copies, not the stored references.
    expect(isolated.items).not.toBe(stored.items);
    expect(isolatedItem).not.toBe(storedItem);
    // Mutating the isolated entry leaves the stored record untouched.
    isolatedItem.legacyNote = 'mutated';
    isolatedItem.feedback.reviewedAt = 'mutated';
    isolatedItem.artifact.content = 'mutated';
    expect(record).toEqual(before);
  });

  it('emerges a live Date inside a stored item as an ISO string in the prepared read result', () => {
    const record = healthyFullRecord();
    // A document-bearing submission keeps non-empty feedback healthy on the full form.
    const source = record.submissions.find((submission) => submission.documentId != null);
    source.items[HEALTHY_HEAD_TASK_ID].feedback.reviewedAt = STORED_DATE;

    const prepared = prepare(restoredWithDefinitionShape(record, 'full'), 'full');
    const preparedItem = submissionById(prepared, source.studentId).items[HEALTHY_HEAD_TASK_ID];
    expect(preparedItem.feedback.reviewedAt).toBe('2022-05-06T07:08:09.000Z');
    // The stored record keeps its live Date; conversion happened on the isolated copy.
    expect(source.items[HEALTHY_HEAD_TASK_ID].feedback.reviewedAt).toBeInstanceOf(Date);
  });
});
