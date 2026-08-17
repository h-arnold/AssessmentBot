/**
 * ABClassAssignmentOps Read-Rehydrate Assignment Tests
 *
 * Tests for the read-only assignment rehydration path that loads and hydrates
 * an assignment without requiring an ABClass instance or triggering a roster
 * refresh.
 *
 * These tests target the ops-level method directly (ABClassAssignmentOps,
 * not the ABClassController facade). readRehydrateAssignment() loads the
 * full assignment document from its dedicated collection, validates and
 * hydrates it, and returns the fully hydrated Assignment instance. Errors
 * propagate to the API boundary for logging.
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

      let thrown;
      try {
        ops.readRehydrateAssignment('', 'assign-001');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(TypeError);
      expect(thrown.message).toBe(
        'readRehydrateAssignment: expected courseId to be a non-empty string'
      );
    });

    it('throws TypeError with verbatim message when assignmentId is an empty string', () => {
      const ops = buildOps();

      let thrown;
      try {
        ops.readRehydrateAssignment('course-001', '');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(TypeError);
      expect(thrown.message).toBe(
        'readRehydrateAssignment: expected assignmentId to be a non-empty string'
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

    it('skips definition resolution when assignmentDefinition has no definitionKey', () => {
      const assignment = createSlidesAssignment({
        courseId: 'course-no-key',
        assignmentId: 'assign-no-key',
      });
      const fullDoc = assignment.toJSON();
      delete fullDoc.assignmentDefinition.definitionKey;
      mockCollection.findOne.mockReturnValue(fullDoc);

      const getDefinitionByKeySpy = vi.fn();
      const originalController = globalThis.AssignmentDefinitionController;
      try {
        globalThis.AssignmentDefinitionController = class StubDefinitionController {
          getDefinitionByKey = getDefinitionByKeySpy;
          ensureDefinition = vi.fn();
        };

        const ops = buildOps();
        const result = ops.readRehydrateAssignment('course-no-key', 'assign-no-key');

        expect(result).toBeDefined();
        expect(getDefinitionByKeySpy).not.toHaveBeenCalled();
        expect(result._hydrationLevel).toBe('full');
      } finally {
        globalThis.AssignmentDefinitionController = originalController;
      }
    });

    it('throws when authoritative definition is also partial (tasks is array)', () => {
      const taskDef = createTextTask(0, 'Reference content', 'Template content');
      const tasks = {};
      tasks[taskDef.getId()] = taskDef.toJSON();

      const assignment = createSlidesAssignment({
        courseId: 'course-partial-def',
        assignmentId: 'assign-partial-def',
        tasks,
      });

      const partialDoc = assignment.toPartialJSON();
      mockCollection.findOne.mockReturnValue(partialDoc);

      const originalController = globalThis.AssignmentDefinitionController;
      try {
        globalThis.AssignmentDefinitionController = class StubDefinitionController {
          getDefinitionByKey() {
            return { tasks: [] };
          }
          ensureDefinition = vi.fn();
        };

        const ops = buildOps();

        expect(() => {
          ops.readRehydrateAssignment('course-partial-def', 'assign-partial-def');
        }).toThrow(/Failed to rehydrate definition/);
      } finally {
        globalThis.AssignmentDefinitionController = originalController;
      }
    });

    it('calls getDefinitionByKey with definitionKey and { form: "full" }', () => {
      const taskDef = createTextTask(0, 'Reference content', 'Template content');
      const tasks = {};
      tasks[taskDef.getId()] = taskDef.toJSON();

      const assignment = createSlidesAssignment({
        courseId: 'course-call-args',
        assignmentId: 'assign-call-args',
        tasks,
      });

      const partialDoc = assignment.toPartialJSON();
      const definitionKey = partialDoc.assignmentDefinition.definitionKey;
      mockCollection.findOne.mockReturnValue(partialDoc);

      const fullDefinition = assignment.toJSON().assignmentDefinition;
      const getDefinitionByKeySpy = vi.fn().mockReturnValue(fullDefinition);

      const originalController = globalThis.AssignmentDefinitionController;
      try {
        globalThis.AssignmentDefinitionController = class StubDefinitionController {
          getDefinitionByKey = getDefinitionByKeySpy;
          ensureDefinition = vi.fn();
        };

        const ops = buildOps();
        ops.readRehydrateAssignment('course-call-args', 'assign-call-args');

        expect(getDefinitionByKeySpy).toHaveBeenCalledWith(definitionKey, { form: 'full' });
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

    it('does not call ABLogger.error when document is not found (error propagates to boundary)', () => {
      mockCollection.findOne.mockReturnValue(null);

      const ops = buildOps();

      expect(() => {
        ops.readRehydrateAssignment('course-log-fail', 'assign-log-fail');
      }).toThrow();

      expect(mockABLogger.error).not.toHaveBeenCalled();
    });

    it('does not call ABLogger.error on corrupt document (error propagates to boundary)', () => {
      mockCollection.findOne.mockReturnValue({
        assignmentId: 'x',
        assignmentDefinition: {},
      });

      const ops = buildOps();

      expect(() => {
        ops.readRehydrateAssignment('course-log-corrupt', 'assign-log-corrupt');
      }).toThrow();

      expect(mockABLogger.error).not.toHaveBeenCalled();
    });
  });
});

describe('ABClassController.readRehydrateAssignment', () => {
  /** @type {import('../../src/backend/y_controllers/ABClassController')} */
  let ABClassController;
  /** @type {InstanceType<import('../../src/backend/y_controllers/ABClassController')>} */
  let controller;

  beforeEach(async () => {
    setupControllerTestMocks(vi);
    const controllerModule = await import('../../src/backend/y_controllers/ABClassController');
    ABClassController = controllerModule.default ?? controllerModule;
    controller = new ABClassController();
  });

  afterEach(() => {
    cleanupControllerTestMocks();
    vi.restoreAllMocks();
  });

  it('delegates readRehydrateAssignment through the facade to _assignmentOps', () => {
    const courseId = 'course-001';
    const assignmentId = 'assign-001';
    const sentinel = { assignmentId, courseId, toJSON: () => ({}) };

    vi.spyOn(controller._assignmentOps, 'readRehydrateAssignment').mockReturnValue(sentinel);

    const result = controller.readRehydrateAssignment(courseId, assignmentId);

    expect(controller._assignmentOps.readRehydrateAssignment).toHaveBeenCalledWith(
      courseId,
      assignmentId
    );
    expect(result).toBe(sentinel);
  });
});
