/**
 * ABClassController Persist Assignment Tests (RED Phase)
 *
 * Tests validating the persistence workflow for assignments including:
 * - Full assignment serialization to dedicated collection
 * - Partial summary generation and storage in ABClass
 * - Database interactions and error handling
 *
 * These tests should FAIL initially as persistAssignmentRun() method
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
import {
  createTestFixture,
  assertMethodExists,
  createMultipleAssignments,
  verifyDatabaseWrite,
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

describe('ABClassController Persist Assignment', () => {
  describe('_getFullAssignmentCollectionName() Helper', () => {
    it('returns consistent collection name pattern for full assignments', () => {
      const controller = new ABClassController();

      // RED: Method doesn't exist yet
      assertMethodExists(controller, '_getFullAssignmentCollectionName');

      const collectionName = controller._getFullAssignmentCollectionName('course-1', 'assign-1');

      expect(collectionName).toBe('assign_full_course-1_assign-1');
    });

    it('generates unique collection names for different course/assignment pairs', () => {
      const controller = new ABClassController();

      // RED: Method doesn't exist yet
      assertMethodExists(controller, '_getFullAssignmentCollectionName');

      const name1 = controller._getFullAssignmentCollectionName('course-1', 'assign-1');
      const name2 = controller._getFullAssignmentCollectionName('course-1', 'assign-2');
      const name3 = controller._getFullAssignmentCollectionName('course-2', 'assign-1');

      expect(name1).not.toBe(name2);
      expect(name1).not.toBe(name3);
      expect(name2).not.toBe(name3);
    });

    it('handles special characters in courseId and assignmentId', () => {
      const controller = new ABClassController();

      // RED: Method doesn't exist yet
      assertMethodExists(controller, '_getFullAssignmentCollectionName');

      const collectionName = controller._getFullAssignmentCollectionName(
        'course_with-chars.123',
        'assign-with_chars.456'
      );

      expect(collectionName).toContain('course_with-chars.123');
      expect(collectionName).toContain('assign-with_chars.456');
    });
  });

  describe('persistAssignmentRun()', () => {
    it('serializes assignment to full payload and writes to dedicated collection', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-persist',
        assignmentId: 'assign-persist',
        includeTask: true,
      });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      controller.persistAssignmentRun(abClass, assignment);

      // Verify full assignment was written to collection
      expect(mockDbManager.getCollection).toHaveBeenCalledWith(
        expect.stringContaining('assign_full_course-persist_assign-persist')
      );

      // Verify database write occurred
      const { writeOccurred, payload } = verifyDatabaseWrite(mockCollection);
      expect(writeOccurred).toBe(true);

      if (payload) {
        expect(payload.courseId).toBe('course-persist');
        expect(payload.assignmentId).toBe('assign-persist');
        expect(payload.tasks).toBeDefined();
      }
    });

    it('generates partial summary via toPartialJSON()', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-partial',
        assignmentId: 'assign-partial',
        includeTask: true,
        includeSubmission: true,
      });

      // Mock toPartialJSON to track invocation
      const toPartialJSONSpy = vi.spyOn(assignment, 'toPartialJSON');

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      controller.persistAssignmentRun(abClass, assignment);

      // Should call toPartialJSON to generate summary
      expect(toPartialJSONSpy).toHaveBeenCalled();
    });

    it('reconstructs partial instance via Assignment.fromJSON()', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-recon',
        assignmentId: 'assign-recon',
      });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      controller.persistAssignmentRun(abClass, assignment);

      // After persistence, the assignment in abClass.assignments should be a partial instance
      expect(abClass.assignments).toHaveLength(1);

      const partialAssignment = abClass.assignments[0];
      expect(partialAssignment.courseId).toBe('course-recon');
      expect(partialAssignment.assignmentId).toBe('assign-recon');
      expect(typeof partialAssignment.toJSON).toBe('function');
    });

    it('uses findAssignmentIndex to replace assignment in abClass.assignments', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-replace', 'Replace Test Class');

      const [assignment1, assignment2, assignment3] = createMultipleAssignments({
        courseId: 'course-replace',
        count: 3,
        documentType: 'mixed',
      });

      abClass.addAssignment(assignment1);
      abClass.addAssignment(assignment2);
      abClass.addAssignment(assignment3);

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      // Persist assignment2 (should replace it at index 1)
      controller.persistAssignmentRun(abClass, assignment2);

      // Should still have 3 assignments
      expect(abClass.assignments).toHaveLength(3);

      // Assignment at index 1 should be replaced with partial version
      const replacedAssignment = abClass.assignments[1];
      expect(replacedAssignment.assignmentId).toBe('assign-2');
    });

    it('calls saveClass to persist updated ABClass with partial assignment', () => {
      const controller = new ABClassController();

      // Mock saveClass method
      const saveClassSpy = vi.spyOn(controller, 'saveClass').mockImplementation(() => {});

      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-save',
        assignmentId: 'assign-save',
      });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      controller.persistAssignmentRun(abClass, assignment);

      // Should call saveClass to persist the updated ABClass document
      expect(saveClassSpy).toHaveBeenCalledWith(abClass);
    });

    it('logs all persistence operations via ABLogger', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-log',
        assignmentId: 'assign-log',
      });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      controller.persistAssignmentRun(abClass, assignment);

      // Should log operations
      expect(mockABLogger.info).toHaveBeenCalled();
    });

    it('preserves full hydration in memory while storing partial summary', () => {
      const controller = new ABClassController();
      const { abClass, assignment, taskDef } = createTestFixture({
        ABClass,
        courseId: 'course-hydrate',
        assignmentId: 'assign-hydrate',
        includeTask: true,
      });

      // Verify assignment starts fully hydrated
      const originalTaskContent = assignment.tasks[taskDef.getId()].artifacts.reference[0].content;
      expect(originalTaskContent).toBe('Reference content');

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      controller.persistAssignmentRun(abClass, assignment);

      // The original assignment instance should remain unchanged
      expect(assignment.tasks[taskDef.getId()].artifacts.reference[0].content).toBe(
        'Reference content'
      );
    });

    it('handles database write errors gracefully', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-error',
        assignmentId: 'assign-error',
      });

      // Mock database error
      mockCollection.replaceOne.mockImplementation(() => {
        throw new Error('Database write failed');
      });
      mockCollection.insertOne.mockImplementation(() => {
        throw new Error('Database write failed');
      });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      // Should throw or log error appropriately
      expect(() => {
        controller.persistAssignmentRun(abClass, assignment);
      }).toThrow();

      // Should log error via ABLogger
      expect(mockABLogger.error).toHaveBeenCalled();
    });

    it('supports both replaceOne and insertOne patterns for persistence', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-upsert',
        assignmentId: 'assign-upsert',
      });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      controller.persistAssignmentRun(abClass, assignment);

      // Verify write occurred using either pattern
      const { writeOccurred } = verifyDatabaseWrite(mockCollection);
      expect(writeOccurred).toBe(true);
    });

    it('persists correct documentType in full assignment collection', () => {
      const controller = new ABClassController();
      const { abClass, assignment } = createTestFixture({
        ABClass,
        courseId: 'course-doctype',
        assignmentId: 'assign-doctype',
        documentType: 'SHEETS',
      });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      controller.persistAssignmentRun(abClass, assignment);

      // Verify correct documentType in payload
      const { payload } = verifyDatabaseWrite(mockCollection);
      expect(payload).toBeDefined();
      expect(payload.documentType).toBe('SHEETS');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles null or undefined abClass gracefully', () => {
      const controller = new ABClassController();
      const { assignment } = createTestFixture({
        ABClass,
        courseId: 'course-null',
        assignmentId: 'assign-null',
      });

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      expect(() => {
        controller.persistAssignmentRun(null, assignment);
      }).toThrow();
    });

    it('handles null or undefined assignment gracefully', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-null-assign', 'Null Assignment Test');

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      expect(() => {
        controller.persistAssignmentRun(abClass, null);
      }).toThrow();
    });

    it('handles assignment not initially in abClass.assignments (adds it)', () => {
      const controller = new ABClassController();
      const abClass = new ABClass('course-new', 'New Assignment Test');

      const { assignment } = createTestFixture({
        ABClass,
        courseId: 'course-new',
        assignmentId: 'assign-new',
      });

      // Assignment is not yet in abClass.assignments
      expect(abClass.assignments).toHaveLength(0);

      // RED: Method doesn't exist yet
      assertMethodExists(controller, 'persistAssignmentRun');

      controller.persistAssignmentRun(abClass, assignment);

      // Should add the assignment (as partial) to abClass.assignments
      expect(abClass.assignments).toHaveLength(1);
      expect(abClass.assignments[0].assignmentId).toBe('assign-new');
    });
  });
});
