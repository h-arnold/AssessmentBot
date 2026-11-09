/**
 * ABClassController assignment projection, redaction, and integrity tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskDefinition } from '#backend/Models/TaskDefinition.js';
import {
  ABClass,
  Assignment,
  AssignmentDefinition,
  Student,
  Teacher,
  buildTeacher,
  setupCollectionRouter,
} from '../helpers/abclassReadClassTestHelpers.js';
import {
  cleanupControllerTestMocks,
  createMockCollection,
  setupControllerTestMocks,
} from '../helpers/mockFactories.js';

/* ------------------------------------------------------------------ */
/*  Variables shared across tests                                      */
/* ------------------------------------------------------------------ */

let ABClassController;
let classCollection;

function loadControllerModule() {
  delete require.cache[require.resolve('../../src/backend/y_controllers/ABClassController')];
  ABClassController = require('#backend/y_controllers/ABClassController/index.js');
}

/* ------------------------------------------------------------------ */
/*  Setup / teardown                                                   */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  classCollection = createMockCollection(vi);

  setupControllerTestMocks(vi);
  setupCollectionRouter(vi, classCollection);

  globalThis.ABClass = ABClass;
  globalThis.Teacher = Teacher;
  globalThis.Student = Student;
  globalThis.Assignment = {
    fromJSON: vi.fn((json) => {
      // Create a minimal assignment-like object that matches the shape
      const assignment = { ...json, _hydrationLevel: 'partial' };
      // The class read emit routes through toReadJSON('partial'); a marker-1
      // record delegates to the same payload as its toPartialJSON.
      const serialisePartial = () => {
        const { _hydrationLevel, progressTracker, ...partial } = assignment;
        return partial;
      };
      // Define both serialisers as non-enumerable to match the real prototype
      // behaviour — prevents function properties leaking through serialisation.
      Object.defineProperty(assignment, 'toPartialJSON', {
        value: vi.fn(serialisePartial),
        enumerable: false,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(assignment, 'toReadJSON', {
        value: vi.fn(serialisePartial),
        enumerable: false,
        writable: true,
        configurable: true,
      });
      return assignment;
    }),
  };

  loadControllerModule();
});

afterEach(() => {
  cleanupControllerTestMocks();
  delete globalThis.ABClass;
  delete globalThis.Teacher;
  delete globalThis.Student;
  delete globalThis.Assignment;
  delete require.cache[require.resolve('../../src/backend/y_controllers/ABClassController')];
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ABClassController._toReadView', () => {
  /* 7. _toReadView transforms an ABClass instance into a plain object */
  it('converts an ABClass to a read view plain object', () => {
    const teacherObj = buildTeacher({
      email: 'teacher@school.edu',
      userId: 't-001',
      teacherName: 'Test Teacher',
    });

    const abClass = new ABClass({
      classId: 'class-001',
      className: 'Test Class',
      cohortKey: 'coh-2025',
      courseLength: 2,
      yearGroupKey: 'yg-10',
      classOwner: teacherObj,
      teachers: [teacherObj],
      students: [],
      active: true,
    });

    const controller = new ABClassController();

    // If the method exists, call it; otherwise the test will fail (RED phase)
    const result = controller._toReadView(abClass);

    // Result should be a plain object
    expect(result).toEqual({
      classId: 'class-001',
      className: 'Test Class',
      cohortKey: 'coh-2025',
      courseLength: 2,
      yearGroupKey: 'yg-10',
      classOwner: teacherObj.toJSON(),
      teachers: [teacherObj.toJSON()],
      students: [],
      metadata: null,
      assignments: [],
      active: true,
    });
  });

  /* 8. _toReadView includes assignments as Assignment.toPartialJSON() output */
  it('returns assignments as Assignment.toPartialJSON() output', () => {
    const partialAssignment = {
      courseId: 'class-001',
      assignmentId: 'assignment-001',
      assignmentName: 'Essay Draft',
      dueDate: '2026-01-15T23:59:59Z',
      updatedAt: '2026-01-10T12:00:00Z',
      createdAt: '2026-01-01T09:00:00Z',
      documentType: 'SLIDES',
      submissions: [],
      assessmentContractVersion: 1,
      assignmentDefinitionKey: 'def-key-001',
    };

    const partialPayload = {
      courseId: 'class-001',
      assignmentId: 'assignment-001',
      assignmentName: 'Essay Draft',
      dueDate: '2026-01-15T23:59:59Z',
      updatedAt: '2026-01-10T12:00:00Z',
      createdAt: '2026-01-01T09:00:00Z',
      documentType: 'SLIDES',
      submissions: [],
      assignmentDefinition: { definitionKey: 'def-key-001' },
      assessmentContractVersion: 1,
      _hydrationLevel: 'partial',
      progressTracker: {},
    };

    // Mock assignments with toReadJSON('partial') output (still returns the
    // embedded object; _toReadView replaces it with assignmentDefinitionKey).
    const mockAssignment = {
      courseId: 'class-001',
      assignmentId: 'assignment-001',
      assignmentName: 'Essay Draft',
      dueDate: new Date('2026-01-15T23:59:59Z'),
      updatedAt: new Date('2026-01-10T12:00:00Z'),
      createdAt: new Date('2026-01-01T09:00:00Z'),
      documentType: 'SLIDES',
      submissions: [],
      assignmentDefinition: { definitionKey: 'def-key-001' },
      // Current-format marker: the read view only reassessment-projects legacy
      // (non-marker-1) records.
      assessmentContractVersion: 1,
      _hydrationLevel: 'partial',
      progressTracker: {},
      toPartialJSON: vi.fn().mockReturnValue(partialPayload),
      toReadJSON: vi.fn().mockReturnValue(partialPayload),
    };

    const teacherObj = buildTeacher({
      email: 'teacher@school.edu',
      userId: 't-001',
      teacherName: 'Test Teacher',
    });

    const abClass = new ABClass({
      classId: 'class-001',
      className: 'Test Class',
      cohortKey: 'coh-2025',
      courseLength: 2,
      yearGroupKey: 'yg-10',
      classOwner: teacherObj,
      teachers: [teacherObj],
      students: [],
      assignments: [mockAssignment],
      active: true,
    });

    const controller = new ABClassController();

    const result = controller._toReadView(abClass);

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]).toEqual(partialAssignment);
  });

  /* 9. _toReadView strips _hydrationLevel and progressTracker from assignments */
  it('strips _hydrationLevel and progressTracker from each assignment', () => {
    const partialPayload = {
      courseId: 'class-001',
      assignmentId: 'assignment-001',
      assignmentName: 'Test',
      documentType: 'SLIDES',
      submissions: [],
      assignmentDefinition: { definitionKey: 'def-key-001' },
      assessmentContractVersion: 1,
      _hydrationLevel: 'partial',
      progressTracker: { some: 'data' },
    };
    const mockAssignment = {
      courseId: 'class-001',
      assignmentId: 'assignment-001',
      assignmentName: 'Test',
      documentType: 'SLIDES',
      submissions: [],
      assignmentDefinition: { definitionKey: 'def-key-001' },
      assessmentContractVersion: 1,
      _hydrationLevel: 'partial',
      progressTracker: { some: 'data' },
      toPartialJSON: vi.fn().mockReturnValue(partialPayload),
      toReadJSON: vi.fn().mockReturnValue(partialPayload),
    };

    const abClass = new ABClass({
      classId: 'class-001',
      className: 'Test Class',
      cohortKey: 'coh-2025',
      courseLength: 2,
      yearGroupKey: 'yg-10',
      assignments: [mockAssignment],
    });

    const controller = new ABClassController();

    const result = controller._toReadView(abClass);

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]).not.toHaveProperty('_hydrationLevel');
    expect(result.assignments[0]).not.toHaveProperty('progressTracker');
  });

  /* 10. REGRESSION — _toReadView must call Assignment.toPartialJSON() (not Assignment.toJSON())
   *     on real Assignment instances. Previously the method iterated `json.assignments`
   *     (the result of `abClass.toJSON()`), which is a list of plain objects produced by
   *     `Assignment.toJSON()` with no `toPartialJSON` method. This caused the full
   *     assignment payload — including `tasks`, `referenceDocumentId`, and
   *     `templateDocumentId` at the root — to leak into the API response, violating
   *     the ABClass full-read data shape (`docs/developer/data-shapes/abclass.md`).
   *
   *     The mock used by tests 7–9 lacks `toJSON`, so the bug was masked; this test
   *     uses a real Assignment instance (constructed via `Object.create(Assignment.prototype)`
   *     to avoid the `Classroom.Courses.CourseWork.get` side-effect in the constructor)
   *     to exercise the production code path.
   */
  it('uses Assignment.toPartialJSON() output (not the full toJSON shape) on a real Assignment instance', () => {
    // Full AssignmentDefinition with a populated tasks tree. The toJSON() path would
    // expose this tree at `assignmentDefinition.tasks`; the toPartialJSON() path now
    // carries lightweight {id, taskWeighting} summaries.
    const task1 = new TaskDefinition({ taskTitle: 'Task 1', pageId: 'p1' }, 2);
    const fullDef = new AssignmentDefinition({
      primaryTitle: 'Essay Draft',
      primaryTopic: 'English',
      yearGroupKey: 'year-10',
      yearGroupLabel: 'Year 10',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-doc-001',
      templateDocumentId: 'tpl-doc-001',
      tasks: { [task1.id]: task1 },
    });

    // Construct a real Assignment instance without invoking the constructor
    // (which calls `fetchAssignmentName` and would require a Classroom global mock).
    const realAssignment = Object.create(Assignment.prototype);
    realAssignment.courseId = 'class-001';
    realAssignment.assignmentId = 'assignment-001';
    realAssignment.assignmentName = 'Essay Draft';
    realAssignment.dueDate = new Date('2026-01-15T23:59:59.000Z');
    realAssignment.updatedAt = new Date('2026-01-10T12:00:00.000Z');
    realAssignment.createdAt = new Date('2026-01-01T09:00:00.000Z');
    realAssignment.assignmentDefinition = fullDef;
    realAssignment.submissions = [];
    realAssignment.assessmentContractVersion = 1;
    realAssignment.progressTracker = ProgressTracker.getInstance();
    realAssignment._hydrationLevel = 'partial';

    const teacherObj = buildTeacher();

    const abClass = new ABClass({
      classId: 'class-001',
      className: 'Test Class',
      cohortKey: 'coh-2025',
      courseLength: 2,
      yearGroupKey: 'yg-10',
      classOwner: teacherObj,
      teachers: [teacherObj],
      students: [],
      assignments: [realAssignment],
      active: true,
    });

    const controller = new ABClassController();
    const result = controller._toReadView(abClass);

    // The output must be the Assignment.toPartialJSON() shape, but with the embedded
    // assignmentDefinition replaced by a lightweight assignmentDefinitionKey.
    // The frontend resolves definition detail (primaryTitle, tasks, doc IDs) from its
    // own AssignmentDefinitionPartials registry.
    // Distinguishing signals:
    //   - No `assignmentDefinition` object (replaced with `assignmentDefinitionKey`).
    //   - No `tasks` / `referenceDocumentId` / `templateDocumentId` at the root.
    //   - Defence-in-depth strip removes `_hydrationLevel` and `progressTracker`.
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].documentType).toBe('SLIDES');
    expect(result.assignments[0]).not.toHaveProperty('tasks');
    expect(result.assignments[0]).not.toHaveProperty('referenceDocumentId');
    expect(result.assignments[0]).not.toHaveProperty('templateDocumentId');
    expect(result.assignments[0]).not.toHaveProperty('assignmentDefinition');
    expect(result.assignments[0].assignmentDefinitionKey).toBe(fullDef.definitionKey);
    // Defence-in-depth strip still applies.
    expect(result.assignments[0]).not.toHaveProperty('_hydrationLevel');
    expect(result.assignments[0]).not.toHaveProperty('progressTracker');
  });
});
