/**
 * Shared setup for the ABClassController persistence suites.
 *
 * The assignment-ops pair and the class-persistence suites all restore the
 * canonical `small` fixture over hermetic per-name collection mocks, so the
 * stores, the owner wiring and the small projection probes live here once.
 * Suites keep their own describes, assertions and file-specific mocks.
 */

import { vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';
import { Teacher } from '#backend/Models/Teacher.js';
import { ABClass } from '#backend/Models/ABClass.js';

const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const ABClassAssignmentOps = require('#backend/y_controllers/ABClassController/ABClassAssignmentOps.js');
const ABClassPersistence = require('#backend/y_controllers/ABClassController/ABClassPersistence.js');
const ABClassValidation = require('#backend/y_controllers/ABClassController/ABClassValidation.js');
const ABLogger = require('#backend/Utils/ABLogger.js');

/** Canonical `small` fixture identities used by the persistence suites. */
export const FIXTURE_ASSIGNMENT_ID = 'assignment-0-1';
export const FIXTURE_CLASS_ID = 'class-0';
export const HEAD_TASK_ID = 'task-1-0';
export const SIBLING_TASK_ID = 'task-1-1';

/**
 * Deep-clones a fixture value so each test owns its mutable copy.
 *
 * @param {*} value - Value to clone.
 * @returns {*} An independent structured clone.
 */
export const clone = (value) => structuredClone(value);

/** Restores the real `Teacher` owner while `ABClass.fromJSON()` hydrates. */
export const TEACHER_GLOBAL = { Teacher: () => Teacher };

/**
 * Hermetic per-name collection mocks recording every operation in call order.
 * `findOne` resolves null so both writes use the insert path.
 *
 * @returns {{ events: string[], collections: Object, getCollection: Function }}
 *   The recording store registry.
 */
export function mockDb() {
  const events = [];
  const collections = {};
  const makeCollection = (name) =>
    Object.fromEntries(
      ['findOne', 'insertOne', 'replaceOne', 'save'].map((op) => [
        op,
        vi.fn(() => {
          events.push(`${name}.${op}`);
          return op === 'findOne' ? null : undefined;
        }),
      ])
    );
  return {
    events,
    collections,
    getCollection: (name) => (collections[name] ??= makeCollection(name)),
  };
}

/**
 * Restores a real canonical small class and wires the persistence owner to
 * hermetic stores.
 *
 * @param {string} classId - Canonical class identity to restore.
 * @returns {{ abClass: Object, db: Object, owner: Object }} The restored class,
 *   its recording stores and the persistence owner over them.
 */
export function buildPreparedRun(classId) {
  const inputs = loadBackendModelInputs('small');
  const abClass = withTemporaryGlobals(TEACHER_GLOBAL, () =>
    ABClass.fromJSON(clone(inputs.classesById[classId]))
  );
  const db = mockDb();
  const owner = new ABClassPersistence({ dbManager: db, validation: {} });
  return { abClass, db, owner };
}

/**
 * Restores a healthy canonical run before each local corruption. Real
 * validation and persistence share the ops owner's hermetic stores, matching
 * facade wiring.
 *
 * @param {Object} [recordOverride] - Full assignment record to restore instead
 *   of the canonical one.
 * @returns {Object} The restored models, collaborators and recording stores.
 */
export function buildCompletedRun(recordOverride) {
  const inputs = loadBackendModelInputs('small');
  const assignment = Assignment.fromJSON(
    recordOverride ?? clone(inputs.assignmentsByKey[FIXTURE_ASSIGNMENT_ID]),
    'full'
  );
  const abClass = withTemporaryGlobals(TEACHER_GLOBAL, () =>
    ABClass.fromJSON(clone(inputs.classesById[FIXTURE_CLASS_ID]))
  );
  const db = mockDb();
  const validation = new ABClassValidation();
  const persistence = new ABClassPersistence({ dbManager: db, validation });
  const ops = new ABClassAssignmentOps({ dbManager: db, validation, persistence });
  return { assignment, abClass, ops, persistence, validation, db };
}

/**
 * Resolves the full assignment collection for the given assignment.
 *
 * @param {Object} db - Recording stores.
 * @param {Object} assignment - Assignment model owning the store identity.
 * @returns {Object} The full assignment collection mock.
 */
export function fullStore(db, assignment) {
  return db.getCollection(`assign_full_${assignment.courseId}_${assignment.assignmentId}`);
}

/**
 * Reads the payload written to the full assignment store.
 *
 * @param {Object} db - Recording stores.
 * @param {Object} assignment - Assignment model owning the store identity.
 * @returns {Object} The first inserted full payload.
 */
export function persistedFullPayload(db, assignment) {
  return fullStore(db, assignment).insertOne.mock.calls[0][0];
}

/**
 * Runs a callback and returns whatever it throws.
 *
 * @param {Function} run - Callback under test.
 * @returns {*} The thrown value, or the callback's result when nothing throws.
 */
export function captureThrown(run) {
  try {
    return run();
  } catch (error) {
    return error;
  }
}

/**
 * Lists the store operations that mutate, excluding reads.
 *
 * @param {Object} db - Recording stores.
 * @returns {string[]} Recorded mutation events in call order.
 */
export function writeEvents(db) {
  return db.events.filter((event) => !event.endsWith('.findOne'));
}

/**
 * Finds the ABLogger.error entry that associates a fault with its failed phase.
 *
 * @param {Array<Array<*>>} errorCalls - Recorded `ABLogger.error` call arguments.
 * @param {*} fault - Original error whose identity must be preserved.
 * @returns {Object | undefined} The matching log metadata, when present.
 */
export function findDiagnosticEntry(errorCalls, fault) {
  return errorCalls
    .map((call) => call[1] ?? {})
    .find(
      (metadata) =>
        metadata.err === fault &&
        Object.hasOwn(metadata, 'failedPhase') &&
        Object.hasOwn(metadata, 'fullWriteCommitted')
    );
}

/**
 * Runs one operation with the ABLogger singleton's error channel spied.
 *
 * @param {Function} run - Operation under test.
 * @returns {{ thrown: *, errorCalls: Array<Array<*>> }} The thrown value and the
 *   recorded error calls.
 */
export function captureRunWithDiagnostics(run) {
  const logger = ABLogger.getInstance();
  const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
  try {
    return { thrown: captureThrown(run), errorCalls: errorSpy.mock.calls };
  } finally {
    errorSpy.mockRestore();
  }
}
