import { describe, it, expect } from 'vitest';
import { TaskDefinition } from '../src/AdminSheet/Models/TaskDefinition.js';
import { StudentSubmission } from '../src/AdminSheet/Models/StudentSubmission.js';

describe('StudentSubmission', () => {
  it('upserts items and round-trips JSON', () => {
    const td = new TaskDefinition({ taskTitle: 'Short Answer', pageId: 'p2', index: 1 });
    td.addReferenceArtifact({ type: 'text', content: 'Reference' });
    td.addTemplateArtifact({ type: 'text', content: '' });
    const sub = new StudentSubmission('stu1', 'assign1', 'doc1');
    sub.upsertItemFromExtraction(td, { content: ' Student response ' });
    const item = sub.getItem(td.getId());
    expect(item.artifact.content).toBe('Student response');
    const restored = StudentSubmission.fromJSON(sub.toJSON());
    expect(restored.getItem(td.getId()).artifact.content).toBe('Student response');
  });
});
