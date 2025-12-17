import { describe, it, expect } from 'vitest';
import { AssignmentDefinition } from '../../src/AdminSheet/Models/AssignmentDefinition.js';

describe('AssignmentDefinition', () => {
  const validParams = {
    primaryTitle: 'Test Assignment',
    primaryTopic: 'Test Topic',
    yearGroup: 10,
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-123',
    templateDocumentId: 'tpl-123',
  };

  it('should construct with valid parameters', () => {
    const def = new AssignmentDefinition(validParams);
    expect(def.primaryTitle).toBe(validParams.primaryTitle);
    expect(def.primaryTopic).toBe(validParams.primaryTopic);
    expect(def.yearGroup).toBe(validParams.yearGroup);
    expect(def.documentType).toBe(validParams.documentType);
    expect(def.definitionKey).toBe('Test Assignment_Test Topic_10');
    expect(def.createdAt).toBeDefined();
    expect(def.updatedAt).toBeDefined();
  });

  it('should throw error if required fields are missing', () => {
    expect(() => new AssignmentDefinition({ ...validParams, primaryTitle: null })).toThrow(
      'Missing required assignment property: primaryTitle'
    );
    expect(() => new AssignmentDefinition({ ...validParams, primaryTopic: null })).toThrow(
      'Missing required assignment property: primaryTopic'
    );
    expect(() => new AssignmentDefinition({ ...validParams, documentType: null })).toThrow(
      'Missing required assignment property: documentType'
    );
  });

  it('should generate correct definitionKey', () => {
    const key1 = AssignmentDefinition.buildDefinitionKey({
      primaryTitle: 'Title',
      primaryTopic: 'Topic',
      yearGroup: 9,
    });
    expect(key1).toBe('Title_Topic_9');

    const key2 = AssignmentDefinition.buildDefinitionKey({
      primaryTitle: 'Title',
      primaryTopic: 'Topic',
      yearGroup: null,
    });
    expect(key2).toBe('Title_Topic_null');
  });

  it('should serialize to JSON correctly', () => {
    const def = new AssignmentDefinition(validParams);
    const json = def.toJSON();
    expect(json.primaryTitle).toBe(validParams.primaryTitle);
    expect(json.definitionKey).toBe('Test Assignment_Test Topic_10');
    expect(json.tasks).toEqual({});
  });

  it('should deserialize from JSON correctly', () => {
    const json = {
      primaryTitle: 'Restored',
      primaryTopic: 'Topic',
      yearGroup: 11,
      documentType: 'SHEETS',
      referenceDocumentId: 'ref-456',
      templateDocumentId: 'tpl-456',
      definitionKey: 'Restored_Topic_11',
      tasks: {
        t1: {
          id: 't1',
          taskTitle: 'Task 1',
          artifacts: { reference: [], template: [] },
        },
      },
    };
    const def = AssignmentDefinition.fromJSON(json);
    expect(def).toBeInstanceOf(AssignmentDefinition);
    expect(def.primaryTitle).toBe('Restored');
    expect(def.tasks.t1).toBeDefined();
  });

  it('should redact artifacts in toPartialJSON', () => {
    const tasks = {
      t1: {
        id: 't1',
        taskTitle: 'Task 1',
        artifacts: {
          reference: [
            {
              id: 'a1',
              uid: 'a1',
              taskId: 't1',
              role: 'reference',
              type: 'TEXT',
              content: 'heavy content',
              contentHash: 'abc',
            },
          ],
          template: [],
        },
      },
    };
    const def = new AssignmentDefinition({ ...validParams, tasks });
    const partial = def.toPartialJSON();

    expect(partial.tasks.t1.artifacts.reference[0].content).toBeNull();
    expect(partial.tasks.t1.artifacts.reference[0].contentHash).toBeNull();
    expect(partial.tasks.t1.artifacts.reference[0].uid).toBe('a1');
  });

  it('should update modified timestamps', async () => {
    const def = new AssignmentDefinition(validParams);
    const originalUpdate = def.updatedAt;

    // Sleep briefly to ensure timestamp change
    await new Promise((resolve) => setTimeout(resolve, 5));

    def.updateModifiedTimestamps({
      referenceLastModified: '2025-01-01T10:00:00Z',
      templateLastModified: '2025-01-01T10:00:00Z',
    });

    expect(def.referenceLastModified).toBe('2025-01-01T10:00:00Z');
    expect(def.templateLastModified).toBe('2025-01-01T10:00:00Z');
    expect(def.updatedAt).not.toBe(originalUpdate);
  });
});
