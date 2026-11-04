import { describe, expect, it, vi } from 'vitest';
import { TaskDefinition } from '#backend/Models/TaskDefinition.js';
const {
  StudentSubmission,
  StudentSubmissionItem,
} = require('#backend/Models/StudentSubmission/index.js');
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';

function canonicalInput() {
  const assignment = Object.values(loadBackendModelInputs('small').assignmentsByKey).find((row) =>
    row.submissions?.some((submission) => Object.keys(submission.items ?? {}).length)
  );
  const source = assignment.submissions.find(
    (submission) => Object.keys(submission.items ?? {}).length
  );
  const taskId = Object.keys(source.items)[0];
  return {
    assignment,
    raw: structuredClone(source),
    taskId,
    itemJson: structuredClone(source.items[taskId]),
  };
}

describe('StudentSubmission fallback branches', () => {
  it('uses contentHash identity when an artifact has no usable UID', () => {
    const { itemJson, taskId } = canonicalInput();
    const item = StudentSubmissionItem.fromJSON(itemJson, 'full');
    vi.spyOn(item.artifact, 'getUid').mockReturnValue(null);

    const expected = `ssi_${Utils.generateHash(`${taskId}::${item.artifact.contentHash}`).slice(0, 16)}`;
    const restored = new StudentSubmissionItem({ taskId, artifact: item.artifact });
    expect(restored.id).toBe(expected);
  });

  it('uses an empty identity fallback for a null contentHash', () => {
    const { itemJson, taskId } = canonicalInput();
    const item = StudentSubmissionItem.fromJSON(itemJson, 'full');
    vi.spyOn(item.artifact, 'getUid').mockReturnValue(null);
    item.artifact.contentHash = null;

    const restored = new StudentSubmissionItem({ taskId, artifact: item.artifact });
    expect(restored.id).toBe(`ssi_${Utils.generateHash(`${taskId}::`).slice(0, 16)}`);
  });

  it('returns null for missing assessments and feedback', () => {
    const { itemJson, taskId } = canonicalInput();
    const item = StudentSubmissionItem.fromJSON(itemJson, 'full');
    item.assessments = null;
    item.feedback = null;

    expect(item.getAssessment()).toBeNull();
    expect(item.getFeedback()).toBeNull();
  });

  it('does not erase existing metadata when an extraction supplies null', () => {
    const { assignment, raw, taskId } = canonicalInput();
    const submission = StudentSubmission.fromJSON({
      ...raw,
      assignmentId: assignment.assignmentId,
    });
    const task = TaskDefinition.fromJSON(assignment.assignmentDefinition.tasks[taskId]);
    const item = submission.getItem(taskId);
    item.artifact.metadata = { retained: true };

    submission.upsertItemFromExtraction(task, { metadata: null });

    expect(item.artifact.metadata).toEqual({ retained: true });
  });

  it('creates extraction identity with null document and page identifiers', () => {
    const { assignment, taskId } = canonicalInput();
    const task = TaskDefinition.fromJSON(assignment.assignmentDefinition.tasks[taskId]);
    task.pageId = null;
    const submission = new StudentSubmission('student', assignment.assignmentId, null);

    const item = submission.upsertItemFromExtraction(task, {
      pageId: null,
      documentId: null,
      content: 'answer',
    });

    expect(item.artifact.documentId).toBeNull();
    expect(item.artifact.pageId).toBeNull();
    expect(item.artifact.getUid()).toContain('-na-0');
  });

  it('rejects primitive item containers during restoration', () => {
    const { assignment, raw } = canonicalInput();
    const malformed = { ...raw, assignmentId: assignment.assignmentId, items: 'invalid' };

    expect(StudentSubmission.validateRaw(malformed, 'full')).toBe(false);
    expect(() => StudentSubmission.fromJSON(malformed, 'full')).toThrow(
      'Invalid StudentSubmission JSON'
    );
  });
});
