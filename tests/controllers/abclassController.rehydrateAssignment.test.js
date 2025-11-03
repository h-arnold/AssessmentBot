/**
 * ABClassController Rehydrate Assignment Tests (RED Phase)
 *
 * Tests validating the rehydration workflow for assignments including:
 * - Reading full assignment from dedicated collection
 * - Reconstructing correct subclass instance via factory pattern
 * - Setting _hydrationLevel marker
 * - Error handling for missing/corrupt data
 *
 * These tests should FAIL initially as rehydrateAssignment() method
 * and supporting infrastructure are not yet implemented.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createSlidesAssignment,
  createSheetsAssignment,
  createTextTask,
  createStudentSubmission,
} from '../helpers/modelFactories.js';
import {
  setupControllerTestMocks,
  cleanupControllerTestMocks,
} from '../helpers/mockFactories.js';

let ABClassController, ABClass, Assignment;
let mockDbManager, mockCollection, mockABLogger;

beforeEach(async () => {
  // Setup controller test mocks
  const mocks = setupControllerTestMocks(vi);
  mockDbManager = mocks.mockDbManager;
  mockCollection = mocks.mockCollection;
  mockABLogger = mocks.mockABLogger;

  // Dynamically import modules after mocks are in place (ESM pattern)
  const [abClassModule, assignmentModule, abClassControllerModule] = await Promise.all([
    import('../../src/AdminSheet/Models/ABClass.js'),
    import('../../src/AdminSheet/AssignmentProcessor/Assignment.js'),
    import('../../src/AdminSheet/y_controllers/ABClassController.js'),
  ]);

  ABClass = abClassModule.ABClass;
  Assignment = assignmentModule.default || assignmentModule;
  ABClassController = abClassControllerModule.default || abClassControllerModule;
});

afterEach(() => {
  cleanupControllerTestMocks();
  vi.restoreAllMocks();
});

describe('ABClassController Rehydrate Assignment', () => {
  describe('rehydrateAssignment()', () => {
    it('reads full assignment document from dedicated collection', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-read', 'Read Test Class');

      const taskDef = createTextTask(0, 'Full content', 'Template');
      const assignment = createSlidesAssignment({
        courseId: 'course-read',
        assignmentId: 'assign-read',
        tasks: { [taskDef.getId()]: taskDef.toJSON() },
      });

      // Add partial assignment to abClass
      const partialJson = assignment.toPartialJSON();
      const partialInstance = Assignment.fromJSON(partialJson);
      abClass.addAssignment(partialInstance);

      // Mock database to return full assignment
      const fullJson = assignment.toJSON();
      mockCollection.findOne.mockReturnValue(fullJson);

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-read');

      // Should read from the correct collection
      expect(mockDbManager.getCollection).toHaveBeenCalledWith(
        expect.stringContaining('assign_full_course-read_assign-read')
      );
      expect(mockCollection.findOne).toHaveBeenCalled();

      // Should return the rehydrated assignment
      expect(rehydrated).toBeDefined();
      expect(rehydrated.assignmentId).toBe('assign-read');
    });

    it('reconstructs correct subclass instance via Assignment.fromJSON()', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-subclass', 'Subclass Test Class');

      const assignment = createSlidesAssignment({
        courseId: 'course-subclass',
        assignmentId: 'assign-subclass',
      });

      // Add partial to abClass
      const partialJson = assignment.toPartialJSON();
      const partialInstance = Assignment.fromJSON(partialJson);
      abClass.addAssignment(partialInstance);

      // Mock database to return full assignment
      const fullJson = assignment.toJSON();
      mockCollection.findOne.mockReturnValue(fullJson);

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-subclass');

      // Should be properly typed instance with methods
      expect(typeof rehydrated.toJSON).toBe('function');
      expect(typeof rehydrated.toPartialJSON).toBe('function');
      expect(rehydrated.documentType).toBe('SLIDES');
    });

    it('sets _hydrationLevel to "full" on rehydrated instance', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-hydration', 'Hydration Test Class');

      const assignment = createSheetsAssignment({
        courseId: 'course-hydration',
        assignmentId: 'assign-hydration',
      });

      // Add partial to abClass
      const partialJson = assignment.toPartialJSON();
      const partialInstance = Assignment.fromJSON(partialJson);
      abClass.addAssignment(partialInstance);

      // Mock database to return full assignment
      const fullJson = assignment.toJSON();
      mockCollection.findOne.mockReturnValue(fullJson);

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-hydration');

      // RED: _hydrationLevel field doesn't exist yet
      expect(rehydrated._hydrationLevel).toBe('full');
    });

    it('replaces partial assignment in abClass.assignments with full version', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-replace-rehydrate', 'Replace Rehydrate Test');

      const assignment1 = createSlidesAssignment({
        courseId: 'course-replace-rehydrate',
        assignmentId: 'assign-1',
      });
      const assignment2 = createSheetsAssignment({
        courseId: 'course-replace-rehydrate',
        assignmentId: 'assign-2',
      });

      // Add partials to abClass
      const partial1 = Assignment.fromJSON(assignment1.toPartialJSON());
      const partial2 = Assignment.fromJSON(assignment2.toPartialJSON());
      abClass.addAssignment(partial1);
      abClass.addAssignment(partial2);

      // Verify partial has null content
      const partialTaskId = Object.keys(partial2.tasks)[0];
      if (partialTaskId) {
        expect(partial2.tasks[partialTaskId].artifacts.reference[0].content).toBeNull();
      }

      // Mock database to return full assignment2
      const fullJson = assignment2.toJSON();
      mockCollection.findOne.mockReturnValue(fullJson);

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-2');

      // Should replace assignment at index 1
      expect(abClass.assignments).toHaveLength(2);
      expect(abClass.assignments[1]).toBe(rehydrated);
      expect(abClass.assignments[1].assignmentId).toBe('assign-2');

      // Should have full content restored (not null)
      const rehydratedTaskId = Object.keys(rehydrated.tasks)[0];
      if (rehydratedTaskId) {
        expect(rehydrated.tasks[rehydratedTaskId].artifacts.reference[0].content).not.toBeNull();
      }
    });

    it('returns the hydrated assignment instance', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-return', 'Return Test Class');

      const assignment = createSlidesAssignment({
        courseId: 'course-return',
        assignmentId: 'assign-return',
      });

      const partialInstance = Assignment.fromJSON(assignment.toPartialJSON());
      abClass.addAssignment(partialInstance);

      const fullJson = assignment.toJSON();
      mockCollection.findOne.mockReturnValue(fullJson);

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-return');

      expect(rehydrated).toBeDefined();
      expect(rehydrated.assignmentId).toBe('assign-return');
      expect(typeof rehydrated.toJSON).toBe('function');
    });

    it('logs rehydration operation via ABLogger', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-log-rehydrate', 'Log Rehydrate Test');

      const assignment = createSlidesAssignment({
        courseId: 'course-log-rehydrate',
        assignmentId: 'assign-log-rehydrate',
      });

      const partialInstance = Assignment.fromJSON(assignment.toPartialJSON());
      abClass.addAssignment(partialInstance);

      const fullJson = assignment.toJSON();
      mockCollection.findOne.mockReturnValue(fullJson);

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      controller.rehydrateAssignment(abClass, 'assign-log-rehydrate');

      // Should log rehydration operation
      expect(mockABLogger.info).toHaveBeenCalled();
    });

    it('restores nested structures (tasks, submissions) with full content', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-nested-rehydrate', 'Nested Rehydrate Test');

      const taskDef = createTextTask(0, 'Heavy reference content', 'Template content');
      const submission = createStudentSubmission({
        studentId: 'student-1',
        assignmentId: 'assign-nested-rehydrate',
        documentId: 'doc-1',
      });
      submission.upsertItemFromExtraction(taskDef, {
        pageId: 'page-1',
        content: 'Heavy student response content',
        metadata: {},
      });

      const assignment = createSlidesAssignment({
        courseId: 'course-nested-rehydrate',
        assignmentId: 'assign-nested-rehydrate',
        tasks: { [taskDef.getId()]: taskDef.toJSON() },
        submissions: [submission.toJSON()],
      });

      const partialInstance = Assignment.fromJSON(assignment.toPartialJSON());
      abClass.addAssignment(partialInstance);

      // Verify partial has null content
      const taskId = taskDef.getId();
      expect(partialInstance.tasks[taskId].artifacts.reference[0].content).toBeNull();

      const fullJson = assignment.toJSON();
      mockCollection.findOne.mockReturnValue(fullJson);

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-nested-rehydrate');

      // Full content should be restored
      expect(rehydrated.tasks[taskId].artifacts.reference[0].content).toBe(
        'Heavy reference content'
      );
      expect(rehydrated.submissions[0].items[taskId].artifact.content).toBe(
        'Heavy student response content'
      );
    });
  });

  describe('Error Handling', () => {
    it('throws clear error when collection is missing', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-missing-collection', 'Missing Collection Test');

      const assignment = createSlidesAssignment({
        courseId: 'course-missing-collection',
        assignmentId: 'assign-missing-collection',
      });

      const partialInstance = Assignment.fromJSON(assignment.toPartialJSON());
      abClass.addAssignment(partialInstance);

      // Mock getCollection to throw
      mockDbManager.getCollection.mockImplementation(() => {
        throw new Error('Collection not found');
      });

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      expect(() => {
        controller.rehydrateAssignment(abClass, 'assign-missing-collection');
      }).toThrow(/collection/i);

      // Should log error
      expect(mockABLogger.error).toHaveBeenCalled();
    });

    it('throws clear error when collection is empty', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-empty-collection', 'Empty Collection Test');

      const assignment = createSlidesAssignment({
        courseId: 'course-empty-collection',
        assignmentId: 'assign-empty-collection',
      });

      const partialInstance = Assignment.fromJSON(assignment.toPartialJSON());
      abClass.addAssignment(partialInstance);

      // Mock findOne to return null (no document found)
      mockCollection.findOne.mockReturnValue(null);

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      expect(() => {
        controller.rehydrateAssignment(abClass, 'assign-empty-collection');
      }).toThrow(/not found|empty|missing/i);

      // Should log error
      expect(mockABLogger.error).toHaveBeenCalled();
    });

    it('throws clear error when data is corrupt', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-corrupt-data', 'Corrupt Data Test');

      const assignment = createSlidesAssignment({
        courseId: 'course-corrupt-data',
        assignmentId: 'assign-corrupt-data',
      });

      const partialInstance = Assignment.fromJSON(assignment.toPartialJSON());
      abClass.addAssignment(partialInstance);

      // Mock findOne to return corrupt data (missing required fields)
      mockCollection.findOne.mockReturnValue({
        courseId: 'course-corrupt-data',
        // assignmentId missing
        // documentType missing
      });

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      expect(() => {
        controller.rehydrateAssignment(abClass, 'assign-corrupt-data');
      }).toThrow(/corrupt|invalid|missing/i);

      // Should log error with details
      expect(mockABLogger.error).toHaveBeenCalled();
    });

    it('provides clear error message when assignmentId not found in abClass', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-not-in-class', 'Not In Class Test');

      // abClass has no assignments

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      expect(() => {
        controller.rehydrateAssignment(abClass, 'nonexistent-assignment');
      }).toThrow(/not found|does not exist/i);
    });

    it('handles null or undefined abClass gracefully', () => {
      const controller = new ABClassController();

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      expect(() => {
        controller.rehydrateAssignment(null, 'assign-null');
      }).toThrow();
    });

    it('handles null or undefined assignmentId gracefully', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-null-id', 'Null ID Test');

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      expect(() => {
        controller.rehydrateAssignment(abClass, null);
      }).toThrow();
    });

    it('handles Assignment.fromJSON failure gracefully', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-fromjson-fail', 'FromJSON Fail Test');

      const assignment = createSlidesAssignment({
        courseId: 'course-fromjson-fail',
        assignmentId: 'assign-fromjson-fail',
      });

      const partialInstance = Assignment.fromJSON(assignment.toPartialJSON());
      abClass.addAssignment(partialInstance);

      // Mock findOne to return data that will cause fromJSON to fail
      mockCollection.findOne.mockReturnValue({
        courseId: 'course-fromjson-fail',
        assignmentId: 'assign-fromjson-fail',
        documentType: 'INVALID_TYPE', // Invalid document type
      });

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      expect(() => {
        controller.rehydrateAssignment(abClass, 'assign-fromjson-fail');
      }).toThrow();

      // Should log error
      expect(mockABLogger.error).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('rehydrates correct subclass for SLIDES assignments', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-slides-rehydrate', 'Slides Rehydrate Test');

      const assignment = createSlidesAssignment({
        courseId: 'course-slides-rehydrate',
        assignmentId: 'assign-slides-rehydrate',
        referenceDocumentId: 'ref-slides',
        templateDocumentId: 'tpl-slides',
      });

      const partialInstance = Assignment.fromJSON(assignment.toPartialJSON());
      abClass.addAssignment(partialInstance);

      const fullJson = assignment.toJSON();
      mockCollection.findOne.mockReturnValue(fullJson);

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-slides-rehydrate');

      expect(rehydrated.documentType).toBe('SLIDES');
      expect(rehydrated.referenceDocumentId).toBe('ref-slides');
      expect(rehydrated.templateDocumentId).toBe('tpl-slides');
    });

    it('rehydrates correct subclass for SHEETS assignments', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-sheets-rehydrate', 'Sheets Rehydrate Test');

      const assignment = createSheetsAssignment({
        courseId: 'course-sheets-rehydrate',
        assignmentId: 'assign-sheets-rehydrate',
        referenceDocumentId: 'ref-sheets',
        templateDocumentId: 'tpl-sheets',
      });

      const partialInstance = Assignment.fromJSON(assignment.toPartialJSON());
      abClass.addAssignment(partialInstance);

      const fullJson = assignment.toJSON();
      mockCollection.findOne.mockReturnValue(fullJson);

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-sheets-rehydrate');

      expect(rehydrated.documentType).toBe('SHEETS');
      expect(rehydrated.referenceDocumentId).toBe('ref-sheets');
      expect(rehydrated.templateDocumentId).toBe('tpl-sheets');
    });

    it('handles multiple rehydrations in sequence', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-multi-rehydrate', 'Multi Rehydrate Test');

      const assignment1 = createSlidesAssignment({
        courseId: 'course-multi-rehydrate',
        assignmentId: 'assign-1',
      });
      const assignment2 = createSheetsAssignment({
        courseId: 'course-multi-rehydrate',
        assignmentId: 'assign-2',
      });

      const partial1 = Assignment.fromJSON(assignment1.toPartialJSON());
      const partial2 = Assignment.fromJSON(assignment2.toPartialJSON());
      abClass.addAssignment(partial1);
      abClass.addAssignment(partial2);

      // Mock database to return full assignments
      mockCollection.findOne
        .mockReturnValueOnce(assignment1.toJSON())
        .mockReturnValueOnce(assignment2.toJSON());

      // RED: Method doesn't exist yet
      expect(typeof controller.rehydrateAssignment).toBe('function');

      const rehydrated1 = controller.rehydrateAssignment(abClass, 'assign-1');
      const rehydrated2 = controller.rehydrateAssignment(abClass, 'assign-2');

      expect(rehydrated1.assignmentId).toBe('assign-1');
      expect(rehydrated1.documentType).toBe('SLIDES');
      expect(rehydrated2.assignmentId).toBe('assign-2');
      expect(rehydrated2.documentType).toBe('SHEETS');

      // Both should be marked as fully hydrated
      expect(rehydrated1._hydrationLevel).toBe('full');
      expect(rehydrated2._hydrationLevel).toBe('full');
    });
  });
});
