import { describe, it, expect } from 'vitest';
import { TaskDefinition } from '../../src/backend/Models/TaskDefinition.js';

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

  describe('pageId fail-fast contract', () => {
    it('constructor throws when pageId is omitted', () => {
      expect(() => new TaskDefinition({ taskTitle: 'No Page' })).toThrow(
        'TaskDefinition requires pageId'
      );
    });

    it('constructor throws when pageId is null', () => {
      expect(() => new TaskDefinition({ taskTitle: 'Null Page', pageId: null })).toThrow(
        'TaskDefinition requires pageId'
      );
    });

    it('fromJSON throws when the stored definition omits pageId', () => {
      expect(() => TaskDefinition.fromJSON({ taskTitle: 'Legacy Stored' })).toThrow(
        'TaskDefinition requires pageId'
      );
    });

    it('fromJSON throws when the stored definition has a null pageId', () => {
      expect(() => TaskDefinition.fromJSON({ taskTitle: 'Legacy Stored', pageId: null })).toThrow(
        'TaskDefinition requires pageId'
      );
    });
  });
});
