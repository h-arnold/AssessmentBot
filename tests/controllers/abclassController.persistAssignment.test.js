/**
 * ABClassController Persist Assignment Tests
 *
 * Validates the persistence workflow for assignments against genuine completed
 * canonical `small` models (marker-1 full assignment with terminal results and
 * its owning class with canonical sibling assignments):
 * - Full assignment serialization to its dedicated collection
 * - Partial summary generation and storage in ABClass
 * - Database interactions and error handling
 * - Connected three-store persistence and fault matrices
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanupControllerTestMocks } from '../helpers/mockFactories.js';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withTemporaryGlobals } from '../helpers/globalMockManager.js';
import { Teacher } from '#backend/Models/Teacher.js';
import {
  assertMethodExists,
  verifyDatabaseWrite,
  setupAssignmentControllerTest,
} from '../helpers/controllerTestHelpers.js';

let ABClassController, ABClass, Assignment;
let mockDbManager, mockCollection, mockABLogger;

beforeEach(async () => {
  const ctx = await setupAssignmentControllerTest(vi);
  ABClass = ctx.ABClass;
  Assignment = ctx.Assignment;
  ABClassController = ctx.ABClassController;
  mockDbManager = ctx.mockDbManager;
  mockCollection = ctx.mockCollection;
  mockABLogger = ctx.mockABLogger;
});

afterEach(() => {
  cleanupControllerTestMocks();
  vi.restoreAllMocks();
});

// Canonical completed-run identities for the successful-persistence fixtures.
const CANONICAL_ASSIGNMENT_ID = 'assignment-0-1';
const CANONICAL_TASK_ID = 'task-1-0';

/**
 * Restores a genuine completed canonical `small` run for the successful
 * persistence characterisations: a marker-1 full assignment (terminal
 * results, real content/hashes) plus its owning class with canonical
 * embedded siblings. Replaces the former legacy/in-flight local factories.
 */
function createCanonicalPersistFixture() {
  const inputs = loadBackendModelInputs('small');
  const record = structuredClone(inputs.assignmentsByKey[CANONICAL_ASSIGNMENT_ID]);
  const restored = withTemporaryGlobals({ Teacher: () => Teacher }, () => ({
    abClass: ABClass.fromJSON(structuredClone(inputs.classesById[record.courseId])),
    assignment: Assignment.fromJSON(record, 'full'),
  }));
  const controller = new ABClassController();
  assertMethodExists(controller, 'persistAssignmentRun');
  return { ...restored, controller };
}

describe('ABClassController Persist Assignment', () => {
  describe('_getFullAssignmentCollectionName() Helper', () => {
    it('returns consistent collection name pattern for full assignments', () => {
      const controller = new ABClassController();

      assertMethodExists(controller, '_getFullAssignmentCollectionName');

      const collectionName = controller._getFullAssignmentCollectionName('course-1', 'assign-1');

      expect(collectionName).toBe('assign_full_course-1_assign-1');
    });

    it('generates unique collection names for different course/assignment pairs', () => {
      const controller = new ABClassController();

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
      const { controller, abClass, assignment } = createCanonicalPersistFixture();

      controller.persistAssignmentRun(abClass, assignment);

      // Verify full assignment was written to collection
      expect(mockDbManager.getCollection).toHaveBeenCalledWith(
        expect.stringContaining(`assign_full_${assignment.courseId}_${assignment.assignmentId}`)
      );

      // Verify database write occurred
      const { writeOccurred, payload } = verifyDatabaseWrite(mockCollection);
      expect(writeOccurred).toBe(true);

      if (payload) {
        expect(payload.courseId).toBe(assignment.courseId);
        expect(payload.assignmentId).toBe(assignment.assignmentId);
        expect(payload.tasks).toBeDefined();
      }
    });

    it('generates partial summary via toPartialJSON()', () => {
      const { controller, abClass, assignment } = createCanonicalPersistFixture();

      // Track partial-summary projection on the completed canonical model
      const toPartialJSONSpy = vi.spyOn(assignment, 'toPartialJSON');

      controller.persistAssignmentRun(abClass, assignment);

      // Should call toPartialJSON to generate summary
      expect(toPartialJSONSpy).toHaveBeenCalled();
    });

    it('reconstructs partial instance via Assignment.fromJSON()', () => {
      const { controller, abClass, assignment } = createCanonicalPersistFixture();

      controller.persistAssignmentRun(abClass, assignment);

      // After persistence, the embedded entry is a partial instance of the
      // canonical model among its unchanged canonical siblings
      expect(abClass.assignments).toHaveLength(4);

      const partialAssignment = abClass.assignments.find(
        (entry) => entry.assignmentId === assignment.assignmentId
      );
      expect(partialAssignment.courseId).toBe(assignment.courseId);
      expect(partialAssignment.assignmentId).toBe(assignment.assignmentId);
      expect(typeof partialAssignment.toJSON).toBe('function');
    });

    it('uses findAssignmentIndex to replace assignment in abClass.assignments', () => {
      const { controller, abClass, assignment } = createCanonicalPersistFixture();

      assertMethodExists(controller, 'persistAssignmentRun');

      const countBefore = abClass.assignments.length;
      const indexBefore = abClass.findAssignmentIndex(
        (entry) => entry.assignmentId === assignment.assignmentId
      );

      controller.persistAssignmentRun(abClass, assignment);

      // Replace in place: the selected assignment keeps its position and no
      // duplicate entry is appended
      expect(abClass.assignments).toHaveLength(countBefore);
      expect(abClass.assignments[indexBefore].assignmentId).toBe(assignment.assignmentId);
    });

    it('calls saveClass to persist updated ABClass with partial assignment', () => {
      const { controller, abClass, assignment } = createCanonicalPersistFixture();

      const saveClassSpy = vi.spyOn(controller, 'saveClass').mockImplementation(() => {});
      const persistAssignmentRunSpy = vi.spyOn(controller._assignmentOps, 'persistAssignmentRun');

      assertMethodExists(controller, 'persistAssignmentRun');

      controller.persistAssignmentRun(abClass, assignment);

      expect(saveClassSpy).toHaveBeenCalledWith(
        abClass,
        persistAssignmentRunSpy.mock.results[0].value
      );
      expect(persistAssignmentRunSpy).toHaveBeenCalledTimes(1);
      expect(saveClassSpy).toHaveBeenCalledTimes(1);
      expect(saveClassSpy.mock.calls[0][1]).toBe(persistAssignmentRunSpy.mock.results[0].value);
    });

    it('logs all persistence operations via ABLogger', () => {
      const { controller, abClass, assignment } = createCanonicalPersistFixture();

      controller.persistAssignmentRun(abClass, assignment);

      expect(mockABLogger.info).toHaveBeenCalled();
    });

    it('preserves full hydration in memory while storing partial summary', () => {
      const { controller, abClass, assignment } = createCanonicalPersistFixture();

      // The completed canonical model starts fully hydrated with real content
      const originalTaskContent =
        assignment.getTasks()[CANONICAL_TASK_ID].artifacts.reference[0].content;
      expect(typeof originalTaskContent).toBe('string');
      expect(originalTaskContent.length).toBeGreaterThan(0);

      assertMethodExists(controller, 'persistAssignmentRun');

      controller.persistAssignmentRun(abClass, assignment);

      // The original assignment instance should remain unchanged
      expect(assignment.getTasks()[CANONICAL_TASK_ID].artifacts.reference[0].content).toBe(
        originalTaskContent
      );
    });

    it('sets hydration markers on full and partial instances', () => {
      const { controller, abClass, assignment } = createCanonicalPersistFixture();

      controller.persistAssignmentRun(abClass, assignment);

      const embedded = abClass.assignments.find(
        (entry) => entry.assignmentId === assignment.assignmentId
      );
      expect(assignment._hydrationLevel).toBe('full');
      expect(embedded._hydrationLevel).toBe('partial');
    });

    it('handles database write errors gracefully', () => {
      const { controller, abClass, assignment } = createCanonicalPersistFixture();

      // Mock database error
      mockCollection.replaceOne.mockImplementation(() => {
        throw new Error('Database write failed');
      });
      mockCollection.insertOne.mockImplementation(() => {
        throw new Error('Database write failed');
      });

      assertMethodExists(controller, 'persistAssignmentRun');

      // Should throw or log error appropriately
      expect(() => {
        controller.persistAssignmentRun(abClass, assignment);
      }).toThrow();

      // Should log error via ABLogger
      expect(mockABLogger.error).toHaveBeenCalled();
    });

    it('supports both replaceOne and insertOne patterns for persistence', () => {
      const { controller, abClass, assignment } = createCanonicalPersistFixture();

      controller.persistAssignmentRun(abClass, assignment);

      // Verify write occurred using either pattern
      const { writeOccurred } = verifyDatabaseWrite(mockCollection);
      expect(writeOccurred).toBe(true);
    });

    it('persists correct documentType in full assignment collection', () => {
      const { controller, abClass, assignment } = createCanonicalPersistFixture();

      controller.persistAssignmentRun(abClass, assignment);

      // Verify correct documentType in payload (canonical assignment-0-1 is SHEETS)
      const { payload } = verifyDatabaseWrite(mockCollection);
      expect(payload).toBeDefined();
      expect(payload.documentType).toBe('SHEETS');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles null or undefined abClass gracefully', () => {
      const { controller, assignment } = createCanonicalPersistFixture();

      assertMethodExists(controller, 'persistAssignmentRun');

      expect(() => {
        controller.persistAssignmentRun(null, assignment);
      }).toThrow();
    });

    it('handles null or undefined assignment gracefully', () => {
      const controller = new ABClassController();
      const abClass = new ABClass({
        classId: 'course-null-assign',
        className: 'Null Assignment Test',
      });

      assertMethodExists(controller, 'persistAssignmentRun');

      expect(() => {
        controller.persistAssignmentRun(abClass, null);
      }).toThrow();
    });

    it('handles assignment not initially in abClass.assignments (adds it)', () => {
      const { assignment } = createCanonicalPersistFixture();
      const controller = new ABClassController();
      const abClass = new ABClass({ classId: 'course-new', className: 'New Assignment Test' });

      // Assignment is not yet in abClass.assignments
      expect(abClass.assignments).toHaveLength(0);

      assertMethodExists(controller, 'persistAssignmentRun');

      controller.persistAssignmentRun(abClass, assignment);

      // Should add the assignment (as partial) to abClass.assignments
      expect(abClass.assignments).toHaveLength(1);
      expect(abClass.assignments[0].assignmentId).toBe(assignment.assignmentId);
    });

    it('throws when abClass.classId is not a non-empty string', () => {
      const { assignment } = createCanonicalPersistFixture();
      const controller = new ABClassController();

      expect(() => {
        controller.persistAssignmentRun(
          { classId: '   ', assignments: [], findAssignmentIndex: () => -1 },
          assignment
        );
      }).toThrow('persistAssignmentRun: expected abClass.classId to be a non-empty string');
    });
  });
});

describe('ABClassController persistAssignmentRun connected three-store persistence', () => {
  const fullName = (assignment) => `assign_full_${assignment.courseId}_${assignment.assignmentId}`;
  const stores = (flow) => [fullName(flow.assignment), flow.abClass.classId, 'abclass_partials'];
  const captureThrown = (run) => {
    try {
      return run();
    } catch (error) {
      return error;
    }
  };

  function buildConnectedRun({ replace = false } = {}) {
    const inputs = loadBackendModelInputs('small');
    const record = structuredClone(inputs.assignmentsByKey['assignment-0-1']);
    const restored = withTemporaryGlobals({ Teacher: () => Teacher }, () => ({
      assignment: Assignment.fromJSON(record, 'full'),
      abClass: ABClass.fromJSON(structuredClone(inputs.classesById['class-0'])),
    }));
    if (replace) mockCollection.findOne.mockReturnValue({});
    return { ...restored, controller: new ABClassController() };
  }

  /**
   * Internal developer-diagnostic log contract for the persistAssignmentRun
   * failure boundary, asserted at the existing ABLogger.error seam. When the
   * run fails (projection or storage fault), at least one ABLogger.error
   * entry must associate, on the same entry:
   * - `err`: the original thrown fault object by identity (the existing
   *   `err:` metadata convention of the current persist failure logs);
   * - `failedPhase`: exactly one phase value from PERSIST_FAILURE_PHASES —
   *   never a string naming several stores;
   * - `fullWriteCommitted`: boolean — false unless the full assignment
   *   store save had already succeeded (true only for class-store and
   *   class-partials-store failures).
   * These are structured log-metadata fields per the canonical ABLogger
   * conventions, not public API or production function names. Documented in
   * .opencode/scratchpad/section8-red-r1-repair.md.
   */
  const PERSIST_FAILURE_PHASES = {
    fullAssignmentProjection: 'full-assignment-projection',
    embeddedPartialProjection: 'embedded-partial-projection',
    prospectiveClassProjection: 'prospective-class-projection',
    classPartialsProjection: 'class-partials-projection',
    fullAssignmentStore: 'full-assignment-store',
    classStore: 'class-store',
    classPartialsStore: 'class-partials-store',
  };
  const STORE_PHASES = [
    PERSIST_FAILURE_PHASES.fullAssignmentStore,
    PERSIST_FAILURE_PHASES.classStore,
    PERSIST_FAILURE_PHASES.classPartialsStore,
  ];
  const findDiagnosticEntry = (errorCalls, fault) =>
    errorCalls
      .map((call) => call[1] ?? {})
      .filter((metadata) => metadata.err === fault)
      .find(
        (metadata) =>
          Object.hasOwn(metadata, 'failedPhase') && Object.hasOwn(metadata, 'fullWriteCommitted')
      );
  const expectPersistFailureDiagnostics = (errorCalls, fault, failedPhase, fullWriteCommitted) => {
    const entry = findDiagnosticEntry(errorCalls, fault);
    expect(
      entry,
      'expected an ABLogger.error entry associating the original fault (err) with failedPhase and fullWriteCommitted on the same entry'
    ).toBeDefined();
    expect(entry.err).toBe(fault);
    expect(entry.failedPhase).toBe(failedPhase);
    expect(entry.fullWriteCommitted).toBe(fullWriteCommitted);
  };

  it('prepares all four projections before the first mutation', () => {
    const flow = buildConnectedRun({ replace: true });
    const spies = [flow.assignment, flow.abClass].flatMap((owner) =>
      ['toJSON', 'toPartialJSON'].map((method) => vi.spyOn(owner, method))
    );
    flow.controller.persistAssignmentRun(flow.abClass, flow.assignment);
    const firstMutation = Math.min(
      ...['insertOne', 'replaceOne', 'save'].flatMap(
        (op) => mockCollection[op].mock.invocationCallOrder
      )
    );
    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.invocationCallOrder[0]).toBeLessThan(firstMutation);
    }
    expect(mockDbManager.getCollection.mock.calls.map((call) => call[0])).toEqual(stores(flow));
  });

  it.each([
    [
      'full assignment projection',
      'assignment',
      'toJSON',
      PERSIST_FAILURE_PHASES.fullAssignmentProjection,
    ],
    [
      'class partial projection',
      'abClass',
      'toPartialJSON',
      PERSIST_FAILURE_PHASES.classPartialsProjection,
    ],
  ])('yields zero writes anywhere when the %s fails', (_label, owner, method, failedPhase) => {
    const flow = buildConnectedRun({ replace: true });
    const fault = new Error(`${_label} failed`);
    const run = () => flow.controller.persistAssignmentRun(flow.abClass, flow.assignment);
    vi.spyOn(flow[owner], method).mockImplementation(() => {
      throw fault;
    });
    expect(captureThrown(run)).toBe(fault);
    for (const op of ['insertOne', 'replaceOne', 'save'])
      expect(mockCollection[op]).not.toHaveBeenCalled();
    expectPersistFailureDiagnostics(mockABLogger.error.mock.calls, fault, failedPhase, false);
  });

  it('replaces only the selected assignment, leaving every sibling byte-identical', () => {
    const flow = buildConnectedRun({ replace: true });
    const selectedId = flow.assignment.assignmentId;
    const notSelected = (entry) => entry.assignmentId !== selectedId;
    const siblingsBefore = flow.abClass.toJSON().assignments.filter(notSelected);
    flow.controller.persistAssignmentRun(flow.abClass, flow.assignment);
    const classPayload = mockCollection.replaceOne.mock.calls[1][1];
    expect(classPayload.assignments.filter(notSelected)).toEqual(siblingsBefore);
    expect(classPayload.metadata).toEqual(flow.abClass.metadata);
  });

  const selectedOf = (flow) =>
    flow.abClass.assignments.find((entry) => entry.assignmentId === flow.assignment.assignmentId);

  it.each([
    ['full assignment store write', 'replace', 0, 'replaceOne'],
    ['full assignment store write', 'insert', 0, 'insertOne'],
    ['full assignment store save', 'replace', 0, 'save'],
    ['class store write', 'replace', 1, 'replaceOne'],
    ['class store write', 'insert', 1, 'insertOne'],
    ['class store save', 'replace', 1, 'save'],
    ['class partials write', 'replace', 2, 'replaceOne'],
    ['class partials write', 'insert', 2, 'insertOne'],
    ['class partials save', 'replace', 2, 'save'],
  ])(
    'escapes a %s fault (%s path, store %s) with no later writes or false completion',
    (label, mode, storeIndex, op) => {
      const flow = buildConnectedRun({ replace: mode === 'replace' });
      const fault = new Error(`storage fault ${storeIndex}-${op}`);
      const embedded = selectedOf(flow);
      const run = () => flow.controller.persistAssignmentRun(flow.abClass, flow.assignment);
      for (let i = 0; i < storeIndex; i++) mockCollection[op].mockImplementationOnce(() => {});
      mockCollection[op].mockImplementationOnce(() => {
        throw fault;
      });
      expect(captureThrown(run)).toBe(fault);
      const mutationOp = mode === 'replace' ? 'replaceOne' : 'insertOne';
      expect(mockCollection[mutationOp]).toHaveBeenCalledTimes(storeIndex + 1);
      expect(mockCollection.save).toHaveBeenCalledTimes(storeIndex + (op === 'save' ? 1 : 0));
      const otherOp = mutationOp === 'replaceOne' ? 'insertOne' : 'replaceOne';
      expect(mockCollection[otherOp]).not.toHaveBeenCalled();
      const accessedStores = mockDbManager.getCollection.mock.calls.map((call) => call[0]);
      expect(accessedStores).toEqual(stores(flow).slice(0, storeIndex + 1));
      expectPersistFailureDiagnostics(
        mockABLogger.error.mock.calls,
        fault,
        STORE_PHASES[storeIndex],
        storeIndex > 0
      );
      if (storeIndex === 0) expect(selectedOf(flow)).toBe(embedded);
    }
  );
});
