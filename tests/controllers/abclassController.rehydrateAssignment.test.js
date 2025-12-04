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

import { setupControllerTestMocks, cleanupControllerTestMocks } from '../helpers/mockFactories.js';
import {
  createTestFixture,
  setupRehydrationScenario,
  assertMethodExists,
  createMultipleAssignments,
  setupErrorScenario,
} from '../helpers/controllerTestHelpers.js';

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
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-read',
        assignmentId: 'assign-read',
        includeTask: true,
      });

      setupRehydrationScenario({ abClass, assignment, Assignment, mockCollection });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

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
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-subclass',
        assignmentId: 'assign-subclass',
      });

      setupRehydrationScenario({ abClass, assignment, Assignment, mockCollection });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-subclass');

      // Should be properly typed instance with methods
      expect(typeof rehydrated.toJSON).toBe('function');
      expect(typeof rehydrated.toPartialJSON).toBe('function');
      expect(rehydrated.documentType).toBe('SLIDES');
    });

    it('sets _hydrationLevel to "full" on rehydrated instance', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-hydration',
        assignmentId: 'assign-hydration',
        documentType: 'SHEETS',
      });

      setupRehydrationScenario({ abClass, assignment, Assignment, mockCollection });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-hydration');

      // RED: _hydrationLevel field doesn't exist yet
      expect(rehydrated._hydrationLevel).toBe('full');
    });

    it('replaces partial assignment in abClass.assignments with full version', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-replace-rehydrate', 'Replace Rehydrate Test');

      const [assignment1, assignment2] = createMultipleAssignments({
        courseId: 'course-replace-rehydrate',
        count: 2,
        documentType: 'mixed',
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
      assertMethodExists(controller, 'rehydrateAssignment');

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
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-return',
        assignmentId: 'assign-return',
      });

      setupRehydrationScenario({ abClass, assignment, Assignment, mockCollection });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-return');

      expect(rehydrated).toBeDefined();
      expect(rehydrated.assignmentId).toBe('assign-return');
      expect(typeof rehydrated.toJSON).toBe('function');
    });

    it('logs rehydration operation via ABLogger', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-log-rehydrate',
        assignmentId: 'assign-log-rehydrate',
      });

      setupRehydrationScenario({ abClass, assignment, Assignment, mockCollection });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

      controller.rehydrateAssignment(abClass, 'assign-log-rehydrate');

      // Should log rehydration operation
      expect(mockABLogger.info).toHaveBeenCalled();
    });

    it('restores nested structures (tasks, submissions) with full content', () => {
      const controller = new ABClassController();
      const { abClass, assignment, taskDef } = createTestFixture({
        ABClass,
        courseId: 'course-nested-rehydrate',
        assignmentId: 'assign-nested-rehydrate',
        includeTask: true,
        includeSubmission: true,
      });

      const { partialInstance } = setupRehydrationScenario({
        abClass,
        assignment,
        Assignment,
        mockCollection,
      });

      // Verify partial has null content
      const taskId = taskDef.getId();
      expect(partialInstance.tasks[taskId].artifacts.reference[0].content).toBeNull();

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-nested-rehydrate');

      // Full content should be restored
      expect(rehydrated.tasks[taskId].artifacts.reference[0].content).toBe('Reference content');
      expect(rehydrated.submissions[0].items[taskId].artifact.content).not.toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('throws clear error when collection is missing', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-missing-collection',
        assignmentId: 'assign-missing-collection',
      });

      setupRehydrationScenario({ abClass, assignment, Assignment, mockCollection });
      setupErrorScenario(mockCollection, 'missing');

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

      expect(() => {
        controller.rehydrateAssignment(abClass, 'assign-missing-collection');
      }).toThrow(/collection/i);

      // Should log error
      expect(mockABLogger.error).toHaveBeenCalled();
    });

    it('throws clear error when collection is empty', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-empty-collection',
        assignmentId: 'assign-empty-collection',
      });

      setupRehydrationScenario({ abClass, assignment, Assignment, mockCollection });
      setupErrorScenario(mockCollection, 'empty');

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

      expect(() => {
        controller.rehydrateAssignment(abClass, 'assign-empty-collection');
      }).toThrow(/not found|empty|missing/i);

      // Should log error
      expect(mockABLogger.error).toHaveBeenCalled();
    });

    it('throws clear error when data is corrupt', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-corrupt-data',
        assignmentId: 'assign-corrupt-data',
      });

      setupRehydrationScenario({ abClass, assignment, Assignment, mockCollection });
      setupErrorScenario(mockCollection, 'corrupt');

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

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
      assertMethodExists(controller, 'rehydrateAssignment');

      expect(() => {
        controller.rehydrateAssignment(abClass, 'nonexistent-assignment');
      }).toThrow(/not found|does not exist/i);
    });

    it('handles null or undefined abClass gracefully', () => {
      const controller = new ABClassController();

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

      expect(() => {
        controller.rehydrateAssignment(null, 'assign-null');
      }).toThrow();
    });

    it('handles null or undefined assignmentId gracefully', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-null-id', 'Null ID Test');

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

      expect(() => {
        controller.rehydrateAssignment(abClass, null);
      }).toThrow();
    });

    it('handles Assignment.fromJSON failure gracefully', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-fromjson-fail',
        assignmentId: 'assign-fromjson-fail',
      });

      setupRehydrationScenario({ abClass, assignment, Assignment, mockCollection });

      // Mock findOne to return data that will cause fromJSON to fail
      mockCollection.findOne.mockReturnValue({
        courseId: 'course-fromjson-fail',
        assignmentId: 'assign-fromjson-fail',
        documentType: 'INVALID_TYPE', // Invalid document type
      });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

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
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-slides-rehydrate',
        assignmentId: 'assign-slides-rehydrate',
        documentType: 'SLIDES',
      });

      setupRehydrationScenario({ abClass, assignment, Assignment, mockCollection });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-slides-rehydrate');

      expect(rehydrated.documentType).toBe('SLIDES');
      expect(rehydrated.referenceDocumentId).toBeDefined();
      expect(rehydrated.templateDocumentId).toBeDefined();
    });

    it('rehydrates correct subclass for SHEETS assignments', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-sheets-rehydrate',
        assignmentId: 'assign-sheets-rehydrate',
        documentType: 'SHEETS',
      });

      setupRehydrationScenario({ abClass, assignment, Assignment, mockCollection });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'rehydrateAssignment');

      const rehydrated = controller.rehydrateAssignment(abClass, 'assign-sheets-rehydrate');

      expect(rehydrated.documentType).toBe('SHEETS');
      expect(rehydrated.referenceDocumentId).toBeDefined();
      expect(rehydrated.templateDocumentId).toBeDefined();
    });

    it('handles multiple rehydrations in sequence', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-multi-rehydrate', 'Multi Rehydrate Test');

      const [assignment1, assignment2] = createMultipleAssignments({
        courseId: 'course-multi-rehydrate',
        count: 2,
        documentType: 'mixed',
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
      assertMethodExists(controller, 'rehydrateAssignment');

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
