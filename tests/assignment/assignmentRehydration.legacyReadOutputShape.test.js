/**
 * Prepared legacy read-output shape and deterministic identities.
 *
 * The retired projector manufactured detached placeholder submissions with
 * reassessment uids and sanitised source ids. Read preparation instead restores
 * the stored items through the existing model serialisers, so valid items keep
 * their stored artifact identities and only corrupt or missing items materialise
 * the deterministic CORRUPT_RECORD placeholder ids. Nullable names are retained
 * and stored source ids pass through as stored: preparation invents nothing.
 */
import { describe, expect, it } from 'vitest';
import {
  corruptRecordAssessments,
  healthyFullRecord,
  prepare,
  restoreLegacy,
} from './assignmentLegacyReadPreparationSupport.js';

const HEAD_TASK_ID = 'task-1-0';
const SIBLING_TASK_ID = 'task-1-1';
const DOCUMENT_SUBMISSION_INDEX = 3;

/** Expected deterministic item id for the corrupt placeholder of one task. */
function expectedPlaceholderItemId(taskId, studentId) {
  const uid = `${taskId}-${studentId}-na-0`;
  return `ssi_${Utils.generateHash(`${taskId}::${uid}`).slice(0, 16)}`;
}

describe('prepared legacy read output shape', () => {
  it('keeps stored item ids and artifact uids deterministic across calls', () => {
    const record = healthyFullRecord();
    const source = record.submissions[DOCUMENT_SUBMISSION_INDEX];
    const restored = restoreLegacy(record);

    const prepared = prepare(restored, 'full');
    const again = prepare(restored, 'full');
    const submission = prepared.find((entry) => entry.studentId === source.studentId);
    const againSubmission = again.find((entry) => entry.studentId === source.studentId);

    for (const [taskId, storedItem] of Object.entries(source.items)) {
      const item = submission.items[taskId];
      // Valid items keep their stored identity: the model preserves a stored
      // item id and artifact uid instead of deriving fresh ones.
      expect(item.id).toBe(storedItem.id);
      expect(againSubmission.items[taskId].id).toBe(item.id);
      expect(item.artifact.uid).toBe(storedItem.artifact.uid);
      expect(item.taskId).toBe(taskId);
    }
  });

  it('materialises corrupt placeholders with deterministic task/student derived ids', () => {
    const record = healthyFullRecord();
    const submission = record.submissions[DOCUMENT_SUBMISSION_INDEX];
    const studentId = submission.studentId;
    submission.items[HEAD_TASK_ID].assessments = { broken: true };

    const prepared = prepare(restoreLegacy(record), 'full');
    const item = prepared.find((entry) => entry.studentId === studentId).items[HEAD_TASK_ID];

    expect(item.assessments).toEqual(corruptRecordAssessments());
    expect(item.artifact.uid).toBe(`${HEAD_TASK_ID}-${studentId}-na-0`);
    expect(item.id).toBe(expectedPlaceholderItemId(HEAD_TASK_ID, studentId));
    expect(item.artifact.content).toBeNull();
    expect(item.artifact.contentHash).toBeNull();
    expect(item.artifact.metadata).toEqual({});
    expect(item.artifact.role).toBe('submission');
    expect(item.artifact.type).toBe('base');
    expect(item.feedback).toEqual({});
  });

  it('retains nullable student names on prepared submissions', () => {
    const record = healthyFullRecord();
    const source = record.submissions[DOCUMENT_SUBMISSION_INDEX];
    source.studentName = null;

    const prepared = prepare(restoreLegacy(record), 'full');
    const submission = prepared.find((entry) => entry.studentId === source.studentId);

    expect(submission.studentName).toBeNull();
  });

  it('passes stored source ids through as stored, without sanitisation or invention', () => {
    const record = healthyFullRecord();
    const source = record.submissions[DOCUMENT_SUBMISSION_INDEX];
    source.documentId = '../stored-as-is';
    source.items[HEAD_TASK_ID].artifact.documentId = '../stored-as-is';
    source.items[HEAD_TASK_ID].artifact.pageId = 'page-id-retained';
    source.items[SIBLING_TASK_ID].artifact.pageId = null;

    const prepared = prepare(restoreLegacy(record), 'full');
    const submission = prepared.find((entry) => entry.studentId === source.studentId);

    // Source-id shape is an extraction-boundary concern; preparation neither
    // sanitises stored ids nor invents replacements for missing ones.
    expect(submission.documentId).toBe('../stored-as-is');
    expect(submission.items[HEAD_TASK_ID].artifact.documentId).toBe('../stored-as-is');
    expect(submission.items[HEAD_TASK_ID].artifact.pageId).toBe('page-id-retained');
    expect(submission.items[SIBLING_TASK_ID].artifact.pageId).toBeNull();
  });
});
