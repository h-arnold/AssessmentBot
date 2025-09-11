import { describe, it, expect } from 'vitest';
import { TaskDefinition } from '../src/AdminSheet/Models/TaskDefinition.js';

describe('TaskDefinition', () => {
  it('adds reference & template artifacts and validates', () => {
    const td = new TaskDefinition({ taskTitle: 'Word Bank', pageId: 'p1', index: 0 });
    td.addReferenceArtifact({ type: 'text', content: 'Ref' });
    td.addTemplateArtifact({ type: 'text', content: '' });
    const { ok, errors } = td.validate();
    expect(ok).toBe(true);
    expect(errors.length).toBe(0);
    const json = td.toJSON();
    const restored = TaskDefinition.fromJSON(json);
    expect(restored.getPrimaryReference().content).toBe('Ref');
  });
});
