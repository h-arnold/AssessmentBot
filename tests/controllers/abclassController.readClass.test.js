/**
 * ABClassController.readClass and _toReadView tests
 *
 * RED phase: tests for the new pure-read methods readClass(classId) and
 * _toReadView(abClass). All tests fail because the methods don't exist yet.
 *
 * See ACTION_PLAN.md §3 and SPEC.md §"Backend changes required" steps 2-3.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskDefinition } from '#backend/Models/TaskDefinition.js';
import {
  buildTestTeacher,
  buildTestStudent,
  cleanupControllerTestMocks,
  createMockCollection,
  setupControllerTestMocks,
} from '../helpers/mockFactories.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ABClassModule = require('#backend/Models/ABClass.js');
const TeacherModule = require('#backend/Models/Teacher.js');
const StudentModule = require('#backend/Models/Student.js');
const AssignmentModule = require('#backend/AssignmentProcessor/Assignment/index.js');
const AssignmentDefinitionModule = require('#backend/Models/AssignmentDefinition.js');

const ABClass = ABClassModule.ABClass || ABClassModule;
const Teacher = TeacherModule.Teacher || TeacherModule;
const Student = StudentModule.Student || StudentModule;
const Assignment = AssignmentModule.default || AssignmentModule;
const AssignmentDefinition =
  AssignmentDefinitionModule.AssignmentDefinition || AssignmentDefinitionModule;

let ClassNotFoundError;
try {
  ClassNotFoundError = require('#backend/Utils/ErrorTypes/ClassNotFoundError.js');
} catch (e) {
  // RED phase — may not be resolvable yet in all environments
  if (e.code !== 'MODULE_NOT_FOUND') throw e;
  ClassNotFoundError = class ClassNotFoundError extends Error {
    constructor(message, options) {
      super(message);
      this.name = 'ClassNotFoundError';
      this.courseId = options?.courseId;
    }
  };
}

function buildTeacher(overrides = {}) {
  return buildTestTeacher(Teacher, overrides);
}

function buildStudent(overrides = {}) {
  return buildTestStudent(Student, overrides);
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
        updatedAt: '2026-01-10T12:00:00Z',
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
    metadata: null,
    assignments: doc.assignments.map((a) => ({
      courseId: a.courseId,
      assignmentId: a.assignmentId,
      assignmentName: a.assignmentName,
      dueDate: a.dueDate,
      updatedAt: a.updatedAt,
      createdAt: a.createdAt,
      documentType: a.documentType,
      submissions: a.submissions,
      assignmentDefinitionKey: a.assignmentDefinition?.definitionKey ?? null,
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
  ABClassController = require('#backend/y_controllers/ABClassController/index.js');
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
