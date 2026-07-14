import { describe, it, expect } from 'vitest';
import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';
import { TaskDefinition } from '../../src/backend/Models/TaskDefinition.js';

describe('AssignmentDefinition', () => {
  // Base valid params for testing
  const baseValidParams = {
    primaryTitle: 'Test Assignment',
    primaryTopic: 'Test Topic',
    yearGroupKey: 'year-group-10',
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-123',
    templateDocumentId: 'tpl-123',
    tasks: [],
  };

  // 1. Constructor rejects yearGroup presence
  describe('Constructor rejects yearGroup presence', () => {
    it('should throw TypeError when yearGroup property is present with numeric value', () => {
      expect(() => {
        const def = new AssignmentDefinition({ ...baseValidParams, yearGroup: 10 });
      }).toThrow(TypeError);
    });

    it('should throw TypeError when yearGroup property is present with null value', () => {
      expect(() => {
        const def = new AssignmentDefinition({ ...baseValidParams, yearGroup: null });
      }).toThrow(TypeError);
    });
  });

  // 2. Constructor validates yearGroupKey type (not presence)
  describe('Constructor validates yearGroupKey type', () => {
    it('should throw TypeError when yearGroupKey is a number', () => {
      expect(() => {
        const def = new AssignmentDefinition({ ...baseValidParams, yearGroupKey: 123 });
      }).toThrow(TypeError);
    });

    it('should accept yearGroupKey as a valid string', () => {
      const def = new AssignmentDefinition({ ...baseValidParams, yearGroupKey: 'valid-key' });
      expect(def.yearGroupKey).toBe('valid-key');
    });
  });

  // 3. fromJSON rejects yearGroup field
  describe('fromJSON rejects yearGroup field', () => {
    it('should throw TypeError when JSON contains yearGroup field with numeric value', () => {
      const json = { ...baseValidParams, yearGroup: 10 };
      expect(() => {
        AssignmentDefinition.fromJSON(json);
      }).toThrow(TypeError);
    });

    it('should throw TypeError when JSON contains yearGroup field with null value', () => {
      const json = { ...baseValidParams, yearGroup: null };
      expect(() => {
        AssignmentDefinition.fromJSON(json);
      }).toThrow(TypeError);
    });
  });

  // 4. fromJSON validates yearGroupKey type
  describe('fromJSON validates yearGroupKey type', () => {
    it('should throw TypeError when yearGroupKey in JSON is a number', () => {
      const json = { ...baseValidParams, yearGroupKey: 123 };
      expect(() => {
        AssignmentDefinition.fromJSON(json);
      }).toThrow(TypeError);
    });

    it('should accept yearGroupKey as a valid string in JSON', () => {
      const json = { ...baseValidParams, yearGroupKey: 'valid-key' };
      const def = AssignmentDefinition.fromJSON(json);
      expect(def.yearGroupKey).toBe('valid-key');
    });
  });

  // 5. assignmentWeighting defaults to 1
  describe('assignmentWeighting defaults to 1', () => {
    it('should default assignmentWeighting to 1 when null is passed', () => {
      const def = new AssignmentDefinition({ ...baseValidParams, assignmentWeighting: null });
      expect(def.assignmentWeighting).toBe(1);
    });

    it('should default assignmentWeighting to 1 when undefined is passed', () => {
      const def = new AssignmentDefinition({ ...baseValidParams, assignmentWeighting: undefined });
      expect(def.assignmentWeighting).toBe(1);
    });

    it('should default assignmentWeighting to 1 when missing from params', () => {
      const def = new AssignmentDefinition(baseValidParams);
      expect(def.assignmentWeighting).toBe(1);
    });

    it('should preserve assignmentWeighting when valid value is provided', () => {
      const def = new AssignmentDefinition({ ...baseValidParams, assignmentWeighting: 5 });
      expect(def.assignmentWeighting).toBe(5);
    });
  });

  // 6. assignmentWeighting range validation
  describe('assignmentWeighting range validation', () => {
    it('should throw RangeError when assignmentWeighting is below 0', () => {
      expect(() => {
        const def = new AssignmentDefinition({ ...baseValidParams, assignmentWeighting: -1 });
      }).toThrow(RangeError);
    });

    it('should throw RangeError when assignmentWeighting is above 10', () => {
      expect(() => {
        const def = new AssignmentDefinition({ ...baseValidParams, assignmentWeighting: 11 });
      }).toThrow(RangeError);
    });

    it('should accept assignmentWeighting of 0', () => {
      const def = new AssignmentDefinition({ ...baseValidParams, assignmentWeighting: 0 });
      expect(def.assignmentWeighting).toBe(0);
    });

    it('should accept assignmentWeighting of 10', () => {
      const def = new AssignmentDefinition({ ...baseValidParams, assignmentWeighting: 10 });
      expect(def.assignmentWeighting).toBe(10);
    });
  });

  // 7. Serialization excludes yearGroup
  describe('Serialization excludes yearGroup', () => {
    it('should not include yearGroup in toJSON output', () => {
      const def = new AssignmentDefinition(baseValidParams);
      const json = def.toJSON();
      expect(json).not.toHaveProperty('yearGroup');
    });

    it('should not include yearGroup in toPartialJSON output', () => {
      const def = new AssignmentDefinition(baseValidParams);
      const partial = def.toPartialJSON();
      expect(partial).not.toHaveProperty('yearGroup');
    });
  });

  // 8. Serialization includes yearGroupKey and yearGroupLabel
  describe('Serialization includes yearGroupKey and yearGroupLabel', () => {
    it('should include yearGroupKey in toJSON output', () => {
      const def = new AssignmentDefinition(baseValidParams);
      const json = def.toJSON();
      expect(json).toHaveProperty('yearGroupKey', 'year-group-10');
    });

    it('should include yearGroupLabel in toJSON output when provided', () => {
      const params = { ...baseValidParams, yearGroupLabel: 'Year 10' };
      const def = new AssignmentDefinition(params);
      const json = def.toJSON();
      expect(json).toHaveProperty('yearGroupLabel', 'Year 10');
    });

    it('should include yearGroupKey in toPartialJSON output', () => {
      const def = new AssignmentDefinition(baseValidParams);
      const partial = def.toPartialJSON();
      expect(partial).toHaveProperty('yearGroupKey', 'year-group-10');
    });

    it('should include yearGroupLabel in toPartialJSON output when provided', () => {
      const params = { ...baseValidParams, yearGroupLabel: 'Year 10' };
      const def = new AssignmentDefinition(params);
      const partial = def.toPartialJSON();
      expect(partial).toHaveProperty('yearGroupLabel', 'Year 10');
    });
  });

  // 9. Schema preservation
  describe('Schema preservation', () => {
    it('should return tasks: [] in toPartialJSON for partial definitions', () => {
      const def = new AssignmentDefinition(baseValidParams);
      const partial = def.toPartialJSON();
      expect(partial.tasks).toEqual([]);
    });

    it('should return tasks object in toJSON for full definitions', () => {
      const tasks = { t1: { taskTitle: 'Task 1' } };
      const def = new AssignmentDefinition({ ...baseValidParams, tasks });
      const json = def.toJSON();
      expect(json.tasks).toBeTypeOf('object');
      expect(json.tasks).not.toBe(null);
    });
  });

  // 10. toPartialJSON tasks as Array<TaskPartial>
  describe('toPartialJSON tasks as Array<TaskPartial>', () => {
    it('should include tasks as array of {id, taskWeighting} when definition has tasks', () => {
      const task1 = new TaskDefinition({ taskTitle: 'Task One' }, 2);
      const task2 = new TaskDefinition({ taskTitle: 'Task Two' });
      const tasks = { [task1.id]: task1, [task2.id]: task2 };
      const def = new AssignmentDefinition({ ...baseValidParams, tasks });
      const partial = def.toPartialJSON();
      expect(partial.tasks).toEqual([
        { taskId: task1.id, taskWeighting: 2, taskTitle: 'Task One' },
        { taskId: task2.id, taskWeighting: 1, taskTitle: 'Task Two' },
      ]);
    });

    it('should return tasks: [] when tasks is empty array', () => {
      const def = new AssignmentDefinition({ ...baseValidParams, tasks: [] });
      const partial = def.toPartialJSON();
      expect(partial.tasks).toEqual([]);
    });

    it('should return tasks: [] when tasks is empty object', () => {
      const def = new AssignmentDefinition({ ...baseValidParams, tasks: {} });
      const partial = def.toPartialJSON();
      expect(partial.tasks).toEqual([]);
    });

    it('should return tasks: [] when tasks is set to undefined on instance', () => {
      const def = new AssignmentDefinition(baseValidParams);
      def.tasks = undefined;
      const partial = def.toPartialJSON();
      expect(partial.tasks).toEqual([]);
    });

    it('should only include id and taskWeighting per task — no extraneous fields', () => {
      const task = new TaskDefinition(
        { taskTitle: 'Extra', pageId: 'p1', taskNotes: 'n', taskMetadata: { k: 'v' } },
        3
      );
      const def = new AssignmentDefinition({ ...baseValidParams, tasks: { [task.id]: task } });
      const partial = def.toPartialJSON();
      expect(partial.tasks[0]).toEqual({ taskId: task.id, taskWeighting: 3, taskTitle: 'Extra' });
      expect(Object.keys(partial.tasks[0]).sort()).toEqual([
        'taskId',
        'taskTitle',
        'taskWeighting',
      ]);
    });

    it('should reflect taskWeighting of 5', () => {
      const task = new TaskDefinition({ taskTitle: 'W5' }, 5);
      const def = new AssignmentDefinition({ ...baseValidParams, tasks: { [task.id]: task } });
      expect(def.toPartialJSON().tasks[0].taskWeighting).toBe(5);
    });

    it('should reflect default taskWeighting of 1', () => {
      const task = new TaskDefinition({ taskTitle: 'Default' });
      const def = new AssignmentDefinition({ ...baseValidParams, tasks: { [task.id]: task } });
      expect(def.toPartialJSON().tasks[0].taskWeighting).toBe(1);
    });
  });

  // 11. buildDefinitionKey parameter renamed
  describe('buildDefinitionKey uses yearGroupKey parameter', () => {
    it('should build definition key using yearGroupKey parameter', () => {
      const key = AssignmentDefinition.buildDefinitionKey({
        primaryTitle: 'Algebra',
        primaryTopic: 'Equations',
        yearGroupKey: 'yg-10',
      });
      expect(key).toBe('Algebra_Equations_yg-10');
    });
  });

  // 12. Model instance has no yearGroup property
  describe('Model instance has no yearGroup property', () => {
    it('should not have yearGroup property on model instance', () => {
      const def = new AssignmentDefinition(baseValidParams);
      expect(def).not.toHaveProperty('yearGroup');
    });

    it('should return undefined when accessing yearGroup on instance', () => {
      const def = new AssignmentDefinition(baseValidParams);
      expect(def.yearGroup).toBeUndefined();
    });
  });

  // 13. fromJSON -> toPartialJSON preserves tasks array on partial definitions
  describe('fromJSON round-trip preserves tasks array on partial definitions', () => {
    it('should preserve tasks array through fromJSON -> toPartialJSON round trip', () => {
      const tasks = [
        { taskId: 't_1', taskWeighting: 1, taskTitle: 'Task 1' },
        { taskId: 't_2', taskWeighting: 2, taskTitle: 'Task 2' },
        { taskId: 't_3', taskWeighting: 3, taskTitle: 'Task 3' },
      ];

      const partialDoc = {
        primaryTitle: 'Algebra foundations',
        primaryTopic: 'Algebra',
        primaryTopicKey: 'topic-algebra',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        alternateTitles: [],
        alternateTopics: [],
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-abc',
        templateDocumentId: 'tpl-abc',
        assignmentWeighting: 1,
        definitionKey: 'Algebra foundations_Algebra_year-group-10',
        tasks,
      };

      const def = AssignmentDefinition.fromJSON(partialDoc);
      const roundTripped = def.toPartialJSON();

      // This assertion MUST fail on the current buggy code because
      // fromJSON nulls the tasks array, producing tasks: [] via toPartialJSON.
      expect(roundTripped.tasks).toEqual(tasks);
    });
  });
});
