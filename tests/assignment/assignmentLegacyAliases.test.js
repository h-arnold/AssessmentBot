import { describe, it, expect } from 'vitest';
import Assignment from '../../src/AdminSheet/AssignmentProcessor/Assignment.js';
import { AssignmentDefinition } from '../../src/AdminSheet/Models/AssignmentDefinition.js';

describe('Assignment Legacy Aliases with Null Values', () => {
  describe('tasks getter', () => {
    it('should return null for partial definition', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        tasks: null,
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.tasks).toBe(null);
    });

    it('should return tasks object for full definition', () => {
      const fullDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref123',
        templateDocumentId: 'tmpl123',
        tasks: { t1: { taskTitle: 'Task 1' } },
      });

      const assignment = Assignment.create(fullDef, 'C123', 'A1');

      expect(assignment.tasks).toBeTruthy();
      expect(assignment.tasks.t1).toBeDefined();
    });

    it('should fail fast when accessing Object.keys(assignment.tasks) on partial', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        tasks: null,
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(() => {
        Object.keys(assignment.tasks);
      }).toThrow();
    });

    it('should fail fast when accessing Object.values(assignment.tasks) on partial', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        tasks: null,
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(() => {
        Object.values(assignment.tasks);
      }).toThrow();
    });
  });

  describe('referenceDocumentId getter', () => {
    it('should return null for partial definition', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        tasks: null,
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.referenceDocumentId).toBe(null);
    });

    it('should return documentId for full definition', () => {
      const fullDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref123',
        templateDocumentId: 'tmpl123',
        tasks: {},
      });

      const assignment = Assignment.create(fullDef, 'C123', 'A1');

      expect(assignment.referenceDocumentId).toBe('ref123');
    });
  });

  describe('templateDocumentId getter', () => {
    it('should return null for partial definition', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        tasks: null,
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.templateDocumentId).toBe(null);
    });

    it('should return documentId for full definition', () => {
      const fullDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref123',
        templateDocumentId: 'tmpl123',
        tasks: {},
      });

      const assignment = Assignment.create(fullDef, 'C123', 'A1');

      expect(assignment.templateDocumentId).toBe('tmpl123');
    });
  });

  describe('documentType getter', () => {
    it('should return documentType for partial definition', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        tasks: null,
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.documentType).toBe('SLIDES');
    });

    it('should return documentType for full definition', () => {
      const fullDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SHEETS',
        referenceDocumentId: 'ref123',
        templateDocumentId: 'tmpl123',
        tasks: {},
      });

      const assignment = Assignment.create(fullDef, 'C123', 'A1');

      expect(assignment.documentType).toBe('SHEETS');
    });
  });

  describe('getTasks() helper', () => {
    it('should return null for partial definition', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        tasks: null,
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.getTasks()).toBe(null);
    });

    it('should return tasks object for full definition', () => {
      const fullDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref123',
        templateDocumentId: 'tmpl123',
        tasks: { t1: { taskTitle: 'Task 1' } },
      });

      const assignment = Assignment.create(fullDef, 'C123', 'A1');

      expect(assignment.getTasks()).toBeTruthy();
      expect(assignment.getTasks().t1).toBeDefined();
    });
  });

  describe('Legacy getters', () => {
    it('getReferenceDocumentId() should return null for partial', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        tasks: null,
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.getReferenceDocumentId()).toBe(null);
    });

    it('getTemplateDocumentId() should return null for partial', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        tasks: null,
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.getTemplateDocumentId()).toBe(null);
    });

    it('getDocumentType() should return documentType for partial', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        tasks: null,
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.getDocumentType()).toBe('SLIDES');
    });
  });
});
