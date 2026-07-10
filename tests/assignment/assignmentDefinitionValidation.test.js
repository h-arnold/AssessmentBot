import { describe, it, expect } from 'vitest';
import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';

describe('AssignmentDefinition Validation', () => {
  describe('Partial Definition Validation', () => {
    it('should validate a partial definition with tasks: null', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        tasks: null,
      });

      expect(partialDef.tasks).toBe(null);
      expect(partialDef.primaryTitle).toBe('Essay 1');
      expect(partialDef.primaryTopic).toBe('English');
      expect(partialDef.yearGroupKey).toBe('year-group-10');
      expect(partialDef.yearGroupLabel).toBe('Year 10');
    });

    it('should fail validation if trying to create full definition without doc IDs', () => {
      // When tasks: {} (not null), it's treated as full definition and requires doc IDs
      expect(() => {
        new AssignmentDefinition({
          primaryTitle: 'Essay 1',
          primaryTopic: 'English',
          yearGroupKey: 'year-group-10',
          yearGroupLabel: 'Year 10',
          documentType: 'SLIDES',
          tasks: {}, // Full definition marker
          // Missing referenceDocumentId and templateDocumentId
        });
      }).toThrow('Missing required assignment property: referenceDocumentId');
    });

    it('should fail validation if partial definition is missing primaryTitle', () => {
      expect(() => {
        new AssignmentDefinition({
          primaryTopic: 'English',
          yearGroupKey: 'year-group-10',
          yearGroupLabel: 'Year 10',
          tasks: null,
        });
      }).toThrow('Missing required assignment property: primaryTitle');
    });

    it('should fail validation if partial definition is missing primaryTopic', () => {
      expect(() => {
        new AssignmentDefinition({
          primaryTitle: 'Essay 1',
          yearGroupKey: 'year-group-10',
          yearGroupLabel: 'Year 10',
          tasks: null,
        });
      }).toThrow('Missing required assignment property: primaryTopic');
    });

    it('should allow partial definition with valid yearGroupKey', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES', // Required for partial definitions (routing)
        tasks: null,
      });

      expect(partialDef.yearGroupKey).toBe('year-group-10');
      expect(partialDef.yearGroupLabel).toBe('Year 10');
    });

    it('should fail validation if yearGroupKey is not a string', () => {
      expect(() => {
        new AssignmentDefinition({
          primaryTitle: 'Essay 1',
          primaryTopic: 'English',
          yearGroupKey: 10,
          tasks: null,
        });
      }).toThrow('yearGroupKey must be a string');
    });
  });

  describe('Full Definition Validation', () => {
    it('should validate a full definition with tasks object', () => {
      const fullDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref123',
        templateDocumentId: 'tmpl123',
        tasks: {},
      });

      expect(fullDef.tasks).toEqual({});
      expect(fullDef.documentType).toBe('SLIDES');
      expect(fullDef.referenceDocumentId).toBe('ref123');
      expect(fullDef.templateDocumentId).toBe('tmpl123');
      expect(fullDef.yearGroupKey).toBe('year-group-10');
      expect(fullDef.yearGroupLabel).toBe('Year 10');
    });

    it('should allow full definition with doc IDs and tasks: null (validates as partial)', () => {
      // When tasks: null, it's validated as partial (doc IDs are allowed but not required)
      const def = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref123', // Will be preserved but not validated
        templateDocumentId: 'tmpl123', // Will be preserved but not validated
        tasks: null,
      });

      expect(def.tasks).toBe(null);
      expect(def.referenceDocumentId).toBe('ref123');
      expect(def.templateDocumentId).toBe('tmpl123');
      expect(def.yearGroupKey).toBe('year-group-10');
      expect(def.yearGroupLabel).toBe('Year 10');
    });

    it('should fail validation if full definition is missing documentType', () => {
      expect(() => {
        new AssignmentDefinition({
          primaryTitle: 'Essay 1',
          primaryTopic: 'English',
          yearGroupKey: 'year-group-10',
          yearGroupLabel: 'Year 10',
          referenceDocumentId: 'ref123',
          templateDocumentId: 'tmpl123',
          tasks: {},
        });
      }).toThrow('Missing required assignment property: documentType');
    });

    it('should fail validation if full definition is missing referenceDocumentId', () => {
      expect(() => {
        new AssignmentDefinition({
          primaryTitle: 'Essay 1',
          primaryTopic: 'English',
          yearGroupKey: 'year-group-10',
          yearGroupLabel: 'Year 10',
          documentType: 'SLIDES',
          templateDocumentId: 'tmpl123',
          tasks: {},
        });
      }).toThrow('Missing required assignment property: referenceDocumentId');
    });

    it('should fail validation if full definition is missing templateDocumentId', () => {
      expect(() => {
        new AssignmentDefinition({
          primaryTitle: 'Essay 1',
          primaryTopic: 'English',
          yearGroupKey: 'year-group-10',
          yearGroupLabel: 'Year 10',
          documentType: 'SLIDES',
          referenceDocumentId: 'ref123',
          tasks: {},
        });
      }).toThrow('Missing required assignment property: templateDocumentId');
    });
  });

  describe('fromJSON with Partial Data', () => {
    it('should reconstruct partial definition with tasks: null', () => {
      const partialJson = {
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        assignmentWeighting: null,
        definitionKey: 'Essay 1_English_year-group-10',
        tasks: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const def = AssignmentDefinition.fromJSON(partialJson);

      expect(def.tasks).toBe(null);
      expect(def.referenceDocumentId).toBe(null);
      expect(def.templateDocumentId).toBe(null);
      expect(def.documentType).toBe('SLIDES');
      expect(def.yearGroupKey).toBe('year-group-10');
      expect(def.yearGroupLabel).toBe('Year 10');
    });

    it('should preserve explicit null for missing fields (except documentType which is required)', () => {
      expect(() => {
        AssignmentDefinition.fromJSON({
          primaryTitle: 'Essay 1',
          primaryTopic: 'English',
          yearGroupKey: 'year-group-10',
          yearGroupLabel: 'Year 10',
          tasks: null,
          // Missing documentType - should fail validation
        });
      }).toThrow('Missing required assignment property: documentType');
    });
  });

  describe('toPartialJSON', () => {
    it('should emit tasks: [] for partial definitions', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref123',
        templateDocumentId: 'tmpl123',
        tasks: null,
      });

      const json = partialDef.toPartialJSON();

      expect(json.tasks).toEqual([]);
      expect(json.referenceDocumentId).toBe('ref123');
      expect(json.templateDocumentId).toBe('tmpl123');
      expect(json.documentType).toBe('SLIDES');
      expect(json.yearGroupKey).toBe('year-group-10');
      expect(json.yearGroupLabel).toBe('Year 10');
    });

    it('should emit tasks as array of {taskId, taskWeighting, taskTitle} for full definitions when serialized as partial', () => {
      const fullDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref123',
        templateDocumentId: 'tmpl123',
        tasks: { t1: { taskTitle: 'Task 1' } },
      });

      const json = fullDef.toPartialJSON();

      // The partial now carries lightweight {taskId, taskWeighting, taskTitle} summaries from each task
      expect(Array.isArray(json.tasks)).toBe(true);
      expect(json.tasks.length).toBe(1);
      expect(json.tasks[0]).toHaveProperty('taskId');
      expect(json.tasks[0]).toHaveProperty('taskWeighting');
      expect(json.tasks[0]).toHaveProperty('taskTitle');
      expect(json.referenceDocumentId).toBe('ref123');
      expect(json.templateDocumentId).toBe('tmpl123');
      expect(json.yearGroupKey).toBe('year-group-10');
      expect(json.yearGroupLabel).toBe('Year 10');
    });
  });

  describe('Round-trip Serialization', () => {
    it('should maintain tasks: null through round-trip', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        tasks: null,
      });

      const json = partialDef.toPartialJSON();
      const restored = AssignmentDefinition.fromJSON(json);

      expect(restored.tasks).toBe(null);
      expect(restored.referenceDocumentId).toBe(null);
      expect(restored.templateDocumentId).toBe(null);
      expect(restored.yearGroupKey).toBe('year-group-10');
      expect(restored.yearGroupLabel).toBe('Year 10');
    });
  });
});
