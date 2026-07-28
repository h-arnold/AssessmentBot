/**
 * ABClassAssignmentOps Read-Rehydrate Assignment Tests (RED Phase)
 *
 * Tests for the read-only assignment rehydration path that loads and hydrates
 * an assignment without requiring an ABClass instance or triggering a roster
 * refresh.
 *
 * These tests target the ops-level method directly (ABClassAssignmentOps,
 * not the ABClassController facade). They should FAIL initially because
 * readRehydrateAssignment() has not been implemented yet.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupControllerTestMocks, cleanupControllerTestMocks } from '../helpers/mockFactories.js';
import { createSlidesAssignment, createTextTask } from '../helpers/modelFactories.js';

let ABClassAssignmentOps;
let mockDbManager, mockCollection, mockABLogger;

beforeEach(() => {
  const mocks = setupControllerTestMocks(vi);
  mockDbManager = mocks.mockDbManager;
  mockCollection = mocks.mockCollection;
  mockABLogger = mocks.mockABLogger;

  ABClassAssignmentOps = globalThis.ABClassAssignmentOps;
});

afterEach(() => {
  cleanupControllerTestMocks();
  vi.restoreAllMocks();
});

describe('ABClassAssignmentOps.readRehydrateAssignment', () => {
  /** @type {Function} */
  let buildOps;

  /** @type {string} */
  const COURSE_ID = 'course-001';
  /** @type {string} */
  const ASSIGNMENT_ID = 'assign-001';

  beforeEach(() => {
    buildOps = () =>
      new ABClassAssignmentOps({
        dbManager: mockDbManager,
        validation: {},
        persistence: {},
      });
  });

  describe('happy path', () => {
    it('returns hydrated assignment given valid courseId and assignmentId', () => {
      const assignment = createSlidesAssignment({
        courseId: COURSE_ID,
        assignmentId: ASSIGNMENT_ID,
      });
      mockCollection.findOne.mockReturnValue(assignment.toJSON());

      const ops = buildOps();
      const result = ops.readRehydrateAssignment(COURSE_ID, ASSIGNMENT_ID);

      expect(result).toBeDefined();
      expect(result.assignmentId).toBe(ASSIGNMENT_ID);
      expect(typeof result.toJSON).toBe('function');
    });

    it('reads from the correct collection name', () => {
      const assignment = createSlidesAssignment({
        courseId: COURSE_ID,
        assignmentId: ASSIGNMENT_ID,
      });
      mockCollection.findOne.mockReturnValue(assignment.toJSON());

      const ops = buildOps();
      ops.readRehydrateAssignment(COURSE_ID, ASSIGNMENT_ID);

      expect(mockDbManager.getCollection).toHaveBeenCalledWith(
        expect.stringContaining(`assign_full_${COURSE_ID}_${ASSIGNMENT_ID}`)
      );
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        courseId: COURSE_ID,
        assignmentId: ASSIGNMENT_ID,
      });
    });

    it('sets _hydrationLevel to "full" on the returned assignment', () => {
      const assignment = createSlidesAssignment({
        courseId: 'course-hydration',
        assignmentId: 'assign-hydration',
      });
      mockCollection.findOne.mockReturnValue(assignment.toJSON());

      const ops = buildOps();
      const result = ops.readRehydrateAssignment('course-hydration', 'assign-hydration');

      expect(result._hydrationLevel).toBe('full');
    });
  });

  describe('document not found', () => {
    it('throws AssignmentNotFoundError when document is not found', () => {
      mockCollection.findOne.mockReturnValue(null);

      const ops = buildOps();

      let thrown;
      try {
        ops.readRehydrateAssignment(COURSE_ID, ASSIGNMENT_ID);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeDefined();
      expect(thrown).toBeInstanceOf(AssignmentNotFoundError);
      expect(thrown.courseId).toBe(COURSE_ID);
      expect(thrown.assignmentId).toBe(ASSIGNMENT_ID);
      expect(thrown.collectionName).toBe(`assign_full_${COURSE_ID}_${ASSIGNMENT_ID}`);
    });
  });

  describe('corrupt document', () => {
    it('throws an error when document is missing courseId', () => {
      mockCollection.findOne.mockReturnValue({
        assignmentId: 'x',
        assignmentDefinition: {},
      });

      const ops = buildOps();

      expect(() => {
        ops.readRehydrateAssignment('course-missing-id', 'assign-x');
      }).toThrow(/corrupt|invalid/i);
    });

    it('throws an error when document is missing assignmentDefinition', () => {
      mockCollection.findOne.mockReturnValue({
        courseId: 'course-no-def',
        assignmentId: 'assign-no-def',
      });

      const ops = buildOps();

      expect(() => {
        ops.readRehydrateAssignment('course-no-def', 'assign-no-def');
      }).toThrow(/corrupt|invalid/i);
    });
  });

  describe('parameter validation', () => {
    it('throws TypeError with verbatim message when courseId is an empty string', () => {
      const ops = buildOps();

      expect(() => {
        ops.readRehydrateAssignment('', 'assign-001');
      }).toThrowError(
        (err) =>
          err instanceof TypeError &&
          err.message === 'readRehydrateAssignment: expected courseId to be a non-empty string'
      );
    });

    it('throws TypeError with verbatim message when assignmentId is an empty string', () => {
      const ops = buildOps();

      expect(() => {
        ops.readRehydrateAssignment('course-001', '');
      }).toThrowError(
        (err) =>
          err instanceof TypeError &&
          err.message === 'readRehydrateAssignment: expected assignmentId to be a non-empty string'
      );
    });
  });

  describe('definition resolution', () => {
    it('resolves partial definition via AssignmentDefinitionController', () => {
      // Arrange: create an assignment with a task so the partial carries definitionKey + array tasks
      const taskDef = createTextTask(0, 'Reference content', 'Template content');
      const tasks = {};
      tasks[taskDef.getId()] = taskDef.toJSON();

      const assignment = createSlidesAssignment({
        courseId: 'course-def',
        assignmentId: 'assign-def',
        tasks,
      });

      // toPartialJSON() produces tasks as an array (partial wire format)
      const partialDoc = assignment.toPartialJSON();
      mockCollection.findOne.mockReturnValue(partialDoc);

      // Build a full definition that getDefinitionByKey will return (keyed tasks)
      const fullDefinition = assignment.toJSON().assignmentDefinition;

      // Override AssignmentDefinitionController so it resolves the partial definition
      const originalController = globalThis.AssignmentDefinitionController;
      try {
        globalThis.AssignmentDefinitionController = class StubAssignmentDefinitionController {
          getDefinitionByKey() {
            return fullDefinition;
          }
          ensureDefinition = vi.fn();
        };

        const ops = buildOps();
        const result = ops.readRehydrateAssignment('course-def', 'assign-def');

        expect(result.assignmentDefinition.tasks).not.toBeNull();
        expect(typeof result.assignmentDefinition.tasks).toBe('object');
        expect(Array.isArray(result.assignmentDefinition.tasks)).toBe(false);
      } finally {
        globalThis.AssignmentDefinitionController = originalController;
      }
    });
  });

  describe('logging', () => {
    it('calls ABLogger.info on successful rehydration', () => {
      const assignment = createSlidesAssignment({
        courseId: COURSE_ID,
        assignmentId: ASSIGNMENT_ID,
      });
      mockCollection.findOne.mockReturnValue(assignment.toJSON());

      const ops = buildOps();
      ops.readRehydrateAssignment(COURSE_ID, ASSIGNMENT_ID);

      expect(mockABLogger.info).toHaveBeenCalled();
    });

    it('calls ABLogger.error when document is not found', () => {
      mockCollection.findOne.mockReturnValue(null);

      const ops = buildOps();

      expect(() => {
        ops.readRehydrateAssignment('course-log-fail', 'assign-log-fail');
      }).toThrow();

      expect(mockABLogger.error).toHaveBeenCalled();
    });

    it('calls ABLogger.error on corrupt document', () => {
      mockCollection.findOne.mockReturnValue({
        assignmentId: 'x',
        assignmentDefinition: {},
      });

      const ops = buildOps();

      expect(() => {
        ops.readRehydrateAssignment('course-log-corrupt', 'assign-log-corrupt');
      }).toThrow();

      expect(mockABLogger.error).toHaveBeenCalled();
    });
  });
});
