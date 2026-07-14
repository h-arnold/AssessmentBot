import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Assignment from '../../src/backend/AssignmentProcessor/Assignment/index.js';
import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';
import { DUMMY_TASK_PARTIALS } from '../helpers/modelFactories.js';

describe('Assignment (legacy alias removal)', () => {
  beforeEach(() => {
    globalThis.Classroom = {
      Courses: {
        CourseWork: {
          get: vi.fn(() => ({
            creationTime: '2026-01-01T00:00:00.000Z',
            title: 'Test Assignment',
          })),
        },
      },
    };
  });

  afterEach(() => {
    delete globalThis.Classroom;
  });
  describe('tasks getter', () => {
    it('should return null for partial definition', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        tasks: [],
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.tasks).toBeUndefined();
    });

    it('should return tasks object for full definition', () => {
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

      const assignment = Assignment.create(fullDef, 'C123', 'A1');

      expect(assignment.tasks).toBeUndefined();
      expect(assignment.getTasks()).toBeTruthy();
      expect(assignment.getTasks().t1).toBeDefined();
    });

    it('should fail fast when accessing Object.keys(assignment.tasks) on partial', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        tasks: [],
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
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        tasks: [],
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
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        tasks: [],
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.referenceDocumentId).toBeUndefined();
    });

    it('should return documentId for full definition', () => {
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

      const assignment = Assignment.create(fullDef, 'C123', 'A1');

      expect(assignment.referenceDocumentId).toBeUndefined();
      expect(assignment.getReferenceDocumentId()).toBe('ref123');
    });
  });

  describe('templateDocumentId getter', () => {
    it('should return null for partial definition', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        tasks: [],
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.templateDocumentId).toBeUndefined();
    });

    it('should return documentId for full definition', () => {
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

      const assignment = Assignment.create(fullDef, 'C123', 'A1');

      expect(assignment.templateDocumentId).toBeUndefined();
      expect(assignment.getTemplateDocumentId()).toBe('tmpl123');
    });
  });

  describe('documentType getter', () => {
    it('should return documentType for partial definition', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        tasks: [],
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.documentType).toBeUndefined();
      expect(assignment.getDocumentType()).toBe('SLIDES');
    });

    it('should return documentType for full definition', () => {
      const fullDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SHEETS',
        referenceDocumentId: 'ref123',
        templateDocumentId: 'tmpl123',
        tasks: {},
      });

      const assignment = Assignment.create(fullDef, 'C123', 'A1');

      expect(assignment.documentType).toBeUndefined();
      expect(assignment.getDocumentType()).toBe('SHEETS');
    });
  });

  describe('getTasks() helper', () => {
    it('should return the tasks array for a partial definition', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        tasks: DUMMY_TASK_PARTIALS,
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.getTasks()).toEqual(DUMMY_TASK_PARTIALS);
    });

    it('should return tasks object for full definition', () => {
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
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        tasks: [],
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.getReferenceDocumentId()).toBe(null);
    });

    it('getTemplateDocumentId() should return null for partial', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        tasks: [],
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.getTemplateDocumentId()).toBe(null);
    });

    it('getDocumentType() should return documentType for partial', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        tasks: [],
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');

      expect(assignment.getDocumentType()).toBe('SLIDES');
    });
  });
});
