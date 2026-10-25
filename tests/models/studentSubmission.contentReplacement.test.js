import { describe, it, expect } from 'vitest';
import { TaskDefinition } from '#backend/Models/TaskDefinition.js';
const { StudentSubmission } = require('#backend/Models/StudentSubmission/index.js');
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';

describe('StudentSubmission content replacement', () => {
  it('invalidates prior results only when reused item content changes', () => {
    const assignment = Object.values(loadBackendModelInputs('small').assignmentsByKey).find(
      (row) => row.submissions?.length
    );
    const source = assignment.submissions.find((row) =>
      Object.values(row.items ?? {}).some(
        (item) => item.artifact?.type === 'TEXT' && item.artifact.content != null
      )
    );
    const taskId = Object.keys(source.items).find(
      (id) =>
        source.items[id].artifact?.type === 'TEXT' && source.items[id].artifact.content != null
    );
    const td = TaskDefinition.fromJSON(assignment.assignmentDefinition.tasks[taskId]);
    const sub = StudentSubmission.fromJSON({
      ...structuredClone(source),
      assignmentId: assignment.assignmentId,
    });
    const item = sub.getItem(taskId);
    const originalContent = item.artifact.content;
    const originalHash = item.artifact.contentHash;
    item.addAssessment('accuracy', { score: 4, reasoning: 'Good' });
    item.addAssessment('spag', { score: 'N' });
    item.addAssessment('completeness', {
      score: 'E',
      reasoning: 'Unavailable',
      error: { stage: 'extraction', code: 'SOURCE_CONTENT_UNAVAILABLE' },
    });
    item.addFeedback('summary', { text: 'Old feedback' });
    const unchanged = sub.upsertItemFromExtraction(td, { content: ` ${originalContent} ` });
    expect(unchanged).toBe(item);
    expect(item.getAssessment()).toMatchObject({
      accuracy: { score: 4 },
      spag: { score: 'N' },
      completeness: { score: 'E' },
    });
    expect(item.getFeedback('summary')).toEqual({ text: 'Old feedback' });
    expect(item.artifact.contentHash).toBe(originalHash);

    const changed = sub.upsertItemFromExtraction(td, { content: 'Changed answer' });
    expect(changed).toBe(item);
    expect(sub.getItem(taskId)).toBe(item);
    expect(changed.artifact.content).toBe('Changed answer');
    expect(changed.artifact.contentHash).toBe(
      globalThis.Utils.generateHash(JSON.stringify('Changed answer'))
    );
    expect(changed.artifact.contentHash).not.toBe(originalHash);
    expect(item.getAssessment()).toEqual({});
    expect(item.getFeedback()).toEqual({});
    item.addAssessment('accuracy', { score: 3 });
    item.addFeedback('summary', { text: 'Stale' });
    const cleared = sub.upsertItemFromExtraction(td, { content: null });
    expect(cleared).toBe(item);
    expect(cleared.artifact.content).toBeNull();
    expect(cleared.artifact.contentHash).toBeNull();
    expect(cleared.getAssessment()).toEqual({});
    expect(cleared.getFeedback()).toEqual({});
  });
  it('preserves results for canonically unchanged spreadsheet extraction', () => {
    const td = new TaskDefinition({ taskTitle: 'Spreadsheet', pageId: 'sheet-page', index: 0 });
    td.addReferenceArtifact({ type: 'SPREADSHEET', content: [['Reference']] });
    const sub = new StudentSubmission('student', 'assignment', 'document', 'Student');
    const item = sub.upsertItemFromExtraction(td, { content: [['=A1']] });
    item.addAssessment('accuracy', { score: 4, reasoning: 'Correct' });
    item.addFeedback('summary', { text: 'Keep this' });
    const originalHash = item.artifact.contentHash;

    const reused = sub.upsertItemFromExtraction(td, { content: [['= a1']] });

    expect(reused).toBe(item);
    expect(item.artifact.contentHash).toBe(originalHash);
    expect(item.getAssessment()).toMatchObject({
      accuracy: { score: 4, reasoning: 'Correct' },
    });
    expect(item.getFeedback('summary')).toEqual({ text: 'Keep this' });
  });
});
