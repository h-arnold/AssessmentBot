import { describe, it, expect } from 'vitest';
import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';

describe('AssignmentDefinition - Section 1 Model Changes', () => {
  // Base valid params for testing
  const baseValidParams = {
    primaryTitle: 'Test Assignment',
    primaryTopic: 'Test Topic',
    yearGroupKey: 'year-group-10',
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-123',
    templateDocumentId: 'tpl-123',
  };

  // 1. Constructor rejects yearGroup presence
  describe('Constructor rejects yearGroup presence', () => {
    it('should throw TypeError when yearGroup property is present with numeric value', () => {
      expect(() => {
        new AssignmentDefinition({ ...baseValidParams, yearGroup: 10 });
      }).toThrow(TypeError);
    });

    it('should throw TypeError when yearGroup property is present with null value', () => {
      expect(() => {
        new AssignmentDefinition({ ...baseValidParams, yearGroup: null });
      }).toThrow(TypeError);
    });
  });

  // 2. Constructor validates yearGroupKey type (not presence)
  describe('Constructor validates yearGroupKey type', () => {
    it('should throw TypeError when yearGroupKey is a number', () => {
      expect(() => {
        new AssignmentDefinition({ ...baseValidParams, yearGroupKey: 123 });
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
        new AssignmentDefinition({ ...baseValidParams, assignmentWeighting: -1 });
      }).toThrow(RangeError);
    });

    it('should throw RangeError when assignmentWeighting is above 10', () => {
      expect(() => {
        new AssignmentDefinition({ ...baseValidParams, assignmentWeighting: 11 });
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
    it('should return tasks: null in toPartialJSON for partial definitions', () => {
      const def = new AssignmentDefinition(baseValidParams);
      const partial = def.toPartialJSON();
      expect(partial.tasks).toBe(null);
    });

    it('should return tasks object in toJSON for full definitions', () => {
      const tasks = { t1: { taskTitle: 'Task 1' } };
      const def = new AssignmentDefinition({ ...baseValidParams, tasks });
      const json = def.toJSON();
      expect(json.tasks).toBeTypeOf('object');
      expect(json.tasks).not.toBe(null);
    });
  });

  // 10. buildDefinitionKey parameter renamed
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

  // 11. Model instance has no yearGroup property
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
});
