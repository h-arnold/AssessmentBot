/**
 * ABClassController.readClass and _toReadView tests
 *
 * RED phase: tests for the new pure-read methods readClass(classId) and
 * _toReadView(abClass). All tests fail because the methods don't exist yet.
 *
 * See ACTION_PLAN.md §3 and SPEC.md §"Backend changes required" steps 2-3.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupControllerTestMocks,
  createMockCollection,
  setupControllerTestMocks,
} from '../helpers/mockFactories.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ABClassModule = require('../../src/backend/Models/ABClass.js');
const TeacherModule = require('../../src/backend/Models/Teacher.js');
const StudentModule = require('../../src/backend/Models/Student.js');
const AssignmentModule = require('../../src/backend/AssignmentProcessor/Assignment.js');
const AssignmentDefinitionModule = require('../../src/backend/Models/AssignmentDefinition.js');

const ABClass = ABClassModule.ABClass || ABClassModule;
const Teacher = TeacherModule.Teacher || TeacherModule;
const Student = StudentModule.Student || StudentModule;
const Assignment = AssignmentModule.default || AssignmentModule;
const AssignmentDefinition =
  AssignmentDefinitionModule.AssignmentDefinition || AssignmentDefinitionModule;

let ClassNotFoundError;
try {
  ClassNotFoundError = require('../../src/backend/Utils/ErrorTypes/ClassNotFoundError.js');
} catch (e) {
  // RED phase — may not be resolvable yet in all environments
  ClassNotFoundError = class ClassNotFoundError extends Error {
    constructor(message, options) {
      super(message);
      this.name = 'ClassNotFoundError';
      this.courseId = options?.courseId;
    }
  };
}

function buildTeacher({ email, userId, teacherName } = {}) {
  return new Teacher(
    email || 'teacher@school.edu',
    userId || 't-001',
    teacherName || 'Test Teacher'
  );
}

function buildStudent({ name, email, id } = {}) {
  return new Student(name || 'Test Student', email || 'student@school.edu', id || 's-001');
}

/**
 * Returns a plain object matching the shape stored in the DB for an existing class.
 */
function buildExistingClassDoc(overrides = {}) {
  const teacherObj = buildTeacher({
    email: 'teacher.existing@example.com',
    userId: 'teacher-existing',
    teacherName: 'Teacher Existing',
  });
  const studentObj = buildStudent({
    name: 'Student Existing',
    email: 'student.existing@example.com',
    id: 'student-existing',
  });
  return {
    classId: 'class-existing',
    className: '10A Computer Science',
    cohortKey: 'coh-2025',
    courseLength: 2,
    yearGroupKey: 'yg-10',
    classOwner: teacherObj.toJSON
      ? teacherObj.toJSON()
      : {
          email: teacherObj.getEmail(),
          userId: teacherObj.getUserId(),
          teacherName: teacherObj.getName(),
        },
    teachers: [
      teacherObj.toJSON
        ? teacherObj.toJSON()
        : {
            email: teacherObj.getEmail(),
            userId: teacherObj.getUserId(),
            teacherName: teacherObj.getName(),
          },
    ],
    students: [
      studentObj.toJSON
        ? studentObj.toJSON()
        : {
            name: studentObj.getName(),
            email: studentObj.getEmail(),
            id: studentObj.getId(),
          },
    ],
    assignments: [
      {
        courseId: 'class-existing',
        assignmentId: 'assignment-001',
        assignmentName: 'Essay Draft',
        dueDate: '2026-01-15T23:59:59Z',
        lastUpdated: '2026-01-10T12:00:00Z',
        createdAt: '2026-01-01T09:00:00Z',
        documentType: 'SLIDES',
        submissions: [],
        assignmentDefinition: {
          primaryTitle: 'Essay Draft',
          primaryTopicKey: 'topic-english',
          documentType: 'SLIDES',
          referenceDocumentId: 'ref-doc-001',
          templateDocumentId: 'tpl-doc-001',
          assignmentWeighting: null,
          definitionKey: 'def-key-001',
          tasks: null,
          createdAt: '2026-01-01T09:00:00Z',
          updatedAt: '2026-01-01T09:00:00Z',
        },
      },
    ],
    active: true,
    ...overrides,
  };
}

/**
 * Builds the expected read-view shape from an existing class document.
 * Mirrors what _toReadView should produce.
 */
function buildExpectedReadView(doc) {
  return {
    classId: doc.classId,
    className: doc.className,
    cohortKey: doc.cohortKey,
    courseLength: doc.courseLength,
    yearGroupKey: doc.yearGroupKey,
    classOwner: doc.classOwner,
    teachers: doc.teachers,
    students: doc.students,
    assignments: doc.assignments.map((a) => ({
      courseId: a.courseId,
      assignmentId: a.assignmentId,
      assignmentName: a.assignmentName,
      dueDate: a.dueDate,
      lastUpdated: a.lastUpdated,
      createdAt: a.createdAt,
      documentType: a.documentType,
      submissions: a.submissions,
      assignmentDefinition: a.assignmentDefinition,
    })),
    active: doc.active,
  };
}

function setupCollectionRouter(classCollection, classId = 'class-existing') {
  const mockDbManager = {
    getCollection: vi.fn((name) => {
      if (name === classId) {
        return classCollection;
      }
      // For unknown classIds, return a fresh mock so the controller can proceed
      return createMockCollection(vi);
    }),
  };
  globalThis.DbManager = { getInstance: () => mockDbManager };
  return mockDbManager;
}

/* ------------------------------------------------------------------ */
/*  Variables shared across tests                                      */
/* ------------------------------------------------------------------ */

let ABClassController;
let classCollection;

function loadControllerModule() {
  delete require.cache[require.resolve('../../src/backend/y_controllers/ABClassController')];
  ABClassController = require('../../src/backend/y_controllers/ABClassController');
}

/* ------------------------------------------------------------------ */
/*  Setup / teardown                                                   */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  classCollection = createMockCollection(vi);

  setupControllerTestMocks(vi);
  setupCollectionRouter(classCollection);

  globalThis.ABClass = ABClass;
  globalThis.Teacher = Teacher;
  globalThis.Student = Student;
  globalThis.Assignment = {
    fromJSON: vi.fn((json) => {
      // Create a minimal assignment-like object that matches the shape
      const assignment = { ...json, _hydrationLevel: 'partial' };
      // Define toPartialJSON as non-enumerable to match the real prototype
      // behaviour — prevents function properties leaking through serialisation.
      Object.defineProperty(assignment, 'toPartialJSON', {
        value: vi.fn(() => {
          const { _hydrationLevel, progressTracker, ...partial } = assignment;
          return partial;
        }),
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

describe('ABClassController.readClass', () => {
  /* 1. GREEN — readClass exists on the prototype */
  it('is defined on the prototype (GREEN: method now exists)', () => {
    const controller = new ABClassController();
    expect(typeof controller.readClass).toBe('function');
  });

  /* 2. GREEN — _toReadView exists on the prototype */
  it('_toReadView is defined on the prototype (GREEN: method now exists)', () => {
    const controller = new ABClassController();
    expect(typeof controller._toReadView).toBe('function');
  });

  /* 3. readClass throws ClassNotFoundError when collection is missing */
  it('throws ClassNotFoundError when collection lookup returns null', () => {
    const router = {
      getCollection: vi.fn().mockReturnValue(null),
    };
    globalThis.DbManager = { getInstance: () => router };
    loadControllerModule();

    const controller = new ABClassController();

    expect(() => controller.readClass('nonexistent-id')).toThrow(ClassNotFoundError);
    expect(() => controller.readClass('nonexistent-id')).toThrow(/nonexistent-id/);
    expect(router.getCollection).toHaveBeenCalledWith('nonexistent-id');
  });

  /* 4. readClass throws ClassNotFoundError when document is missing */
  it('throws ClassNotFoundError when findOne returns null', () => {
    classCollection.findOne.mockReturnValue(null);

    const controller = new ABClassController();

    expect(() => controller.readClass('class-existing')).toThrow(ClassNotFoundError);
    expect(() => controller.readClass('class-existing')).toThrow(/class-existing/);
    expect(classCollection.findOne).toHaveBeenCalledWith({ classId: 'class-existing' });
  });

  /* 5. readClass returns the read view when a stored class document exists */
  it('returns the read view when a stored class document exists', () => {
    const existingDoc = buildExistingClassDoc();
    classCollection.findOne.mockReturnValue(existingDoc);

    const controller = new ABClassController();

    const result = controller.readClass('class-existing');

    // Must be a plain object, not an ABClass instance
    expect(result).not.toBeInstanceOf(ABClass);
    expect(result).toEqual(buildExpectedReadView(existingDoc));
    expect(classCollection.findOne).toHaveBeenCalledWith({ classId: 'class-existing' });
  });

  /* 6. No write effects — _refreshRoster and _persistRoster are NOT called */
  it('does not call _refreshRoster or _persistRoster', () => {
    const existingDoc = buildExistingClassDoc();
    classCollection.findOne.mockReturnValue(existingDoc);

    const controller = new ABClassController();
    const refreshSpy = vi.spyOn(controller, '_refreshRoster');
    const persistSpy = vi.spyOn(controller, '_persistRoster');

    controller.readClass('class-existing');

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(persistSpy).not.toHaveBeenCalled();
  });
});

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
      lastUpdated: '2026-01-10T12:00:00Z',
      createdAt: '2026-01-01T09:00:00Z',
      documentType: 'SLIDES',
      submissions: [],
      assignmentDefinition: {
        primaryTitle: 'Essay Draft',
        primaryTopicKey: 'topic-english',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-doc-001',
        templateDocumentId: 'tpl-doc-001',
        assignmentWeighting: null,
        definitionKey: 'def-key-001',
        tasks: null,
        createdAt: '2026-01-01T09:00:00Z',
        updatedAt: '2026-01-01T09:00:00Z',
      },
    };

    // Mock assignments with toPartialJSON
    const mockAssignment = {
      courseId: 'class-001',
      assignmentId: 'assignment-001',
      assignmentName: 'Essay Draft',
      dueDate: new Date('2026-01-15T23:59:59Z'),
      lastUpdated: new Date('2026-01-10T12:00:00Z'),
      createdAt: new Date('2026-01-01T09:00:00Z'),
      documentType: 'SLIDES',
      submissions: [],
      assignmentDefinition: {},
      _hydrationLevel: 'partial',
      progressTracker: {},
      toPartialJSON: vi.fn().mockReturnValue(partialAssignment),
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
    const mockAssignment = {
      courseId: 'class-001',
      assignmentId: 'assignment-001',
      assignmentName: 'Test',
      documentType: 'SLIDES',
      submissions: [],
      assignmentDefinition: { tasks: null },
      _hydrationLevel: 'partial',
      progressTracker: { some: 'data' },
      toPartialJSON: vi.fn().mockReturnValue({
        courseId: 'class-001',
        assignmentId: 'assignment-001',
        assignmentName: 'Test',
        documentType: 'SLIDES',
        submissions: [],
        assignmentDefinition: { tasks: null },
      }),
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
   *     SPEC.md decision 4 and `docs/developer/backend/DATA_SHAPES.md` "ABClass full-read".
   *
   *     The mock used by tests 7–9 lacks `toJSON`, so the bug was masked; this test
   *     uses a real Assignment instance (constructed via `Object.create(Assignment.prototype)`
   *     to avoid the `Classroom.Courses.CourseWork.get` side-effect in the constructor)
   *     to exercise the production code path.
   */
  it('uses Assignment.toPartialJSON() output (not the full toJSON shape) on a real Assignment instance', () => {
    // Full AssignmentDefinition with a populated tasks tree. The toJSON() path would
    // expose this tree at `assignmentDefinition.tasks`; the toPartialJSON() path forces
    // it to null.
    const fullDef = new AssignmentDefinition({
      primaryTitle: 'Essay Draft',
      primaryTopic: 'English',
      yearGroupKey: 'year-10',
      yearGroupLabel: 'Year 10',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-doc-001',
      templateDocumentId: 'tpl-doc-001',
      tasks: { t1: { taskTitle: 'Task 1' } },
    });

    // Construct a real Assignment instance without invoking the constructor
    // (which calls `fetchAssignmentName` and would require a Classroom global mock).
    const realAssignment = Object.create(Assignment.prototype);
    realAssignment.courseId = 'class-001';
    realAssignment.assignmentId = 'assignment-001';
    realAssignment.assignmentName = 'Essay Draft';
    realAssignment.dueDate = new Date('2026-01-15T23:59:59.000Z');
    realAssignment.lastUpdated = new Date('2026-01-10T12:00:00.000Z');
    realAssignment.createdAt = new Date('2026-01-01T09:00:00.000Z');
    realAssignment.assignmentDefinition = fullDef;
    realAssignment.submissions = [];
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

    // The fix: each assignment must be Assignment.toPartialJSON() output, not the
    // full Assignment.toJSON() output. Distinguishing signals:
    //   - Partial shape has NO `tasks` field at the root (toJSON exposes it via
    //     _extractFullDefinitionFields).
    //   - Partial shape has NO `referenceDocumentId` / `templateDocumentId` at the root
    //     (toJSON exposes them via _extractFullDefinitionFields; partial embeds them
    //     only inside `assignmentDefinition`).
    //   - Partial shape's `assignmentDefinition.tasks` is `null` (forced by
    //     AssignmentDefinition.toPartialJSON()).
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].documentType).toBe('SLIDES');
    expect(result.assignments[0]).not.toHaveProperty('tasks');
    expect(result.assignments[0]).not.toHaveProperty('referenceDocumentId');
    expect(result.assignments[0]).not.toHaveProperty('templateDocumentId');
    expect(result.assignments[0].assignmentDefinition.tasks).toBeNull();
    // Document IDs survive, but only inside the embedded partial definition.
    expect(result.assignments[0].assignmentDefinition.referenceDocumentId).toBe('ref-doc-001');
    expect(result.assignments[0].assignmentDefinition.templateDocumentId).toBe('tpl-doc-001');
    // Defence-in-depth strip still applies.
    expect(result.assignments[0]).not.toHaveProperty('_hydrationLevel');
    expect(result.assignments[0]).not.toHaveProperty('progressTracker');
  });
});
