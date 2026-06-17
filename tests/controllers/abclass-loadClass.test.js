/**
 * ABClassController.loadClass throw-on-missing tests
 *
 * RED phase: tests for the planned change where loadClass throws when no
 * stored class exists, instead of auto-initialising. Test 1 is RED (fails
 * with current production code); tests 2–5 are regression tests that
 * document unchanged behaviour after the change.
 *
 * See SPEC.md agreed decision 8.
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

const ABClass = ABClassModule.ABClass || ABClassModule;
const Teacher = TeacherModule.Teacher || TeacherModule;
const Student = StudentModule.Student || StudentModule;

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
        : { name: studentObj.getName(), email: studentObj.getEmail(), id: studentObj.getId() },
    ],
    assignments: [{ assignmentId: 'assignment-001', title: 'Essay Draft' }],
    active: true,
    ...overrides,
  };
}

function setupCollectionRouter(classCollection, partialsCollection, classId = 'class-existing') {
  const mockDbManager = {
    getCollection: vi.fn((name) => {
      if (name === 'abclass_partials') {
        return partialsCollection;
      }
      if (name === classId) {
        return classCollection;
      }
      // For unknown classIds, return a fresh mock collection so the controller
      // can proceed to check/throw without router failures.
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
let partialsCollection;
let classroomApiClient;

function loadControllerModule() {
  delete require.cache[require.resolve('../../src/backend/y_controllers/ABClassController')];
  ABClassController = require('../../src/backend/y_controllers/ABClassController');
}

/* ------------------------------------------------------------------ */
/*  Setup / teardown                                                   */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  classCollection = createMockCollection(vi);
  partialsCollection = createMockCollection(vi);

  setupControllerTestMocks(vi);
  setupCollectionRouter(classCollection, partialsCollection);

  globalThis.ABClass = ABClass;
  globalThis.Teacher = Teacher;
  globalThis.Student = Student;
  globalThis.Assignment = {
    fromJSON: vi.fn((json) => ({ ...json })),
  };

  classroomApiClient = {
    fetchCourse: vi.fn(() => ({
      id: 'class-existing',
      name: '10A Computer Science',
      ownerId: 'teacher-existing',
    })),
    fetchTeachers: vi.fn(() => [
      buildTeacher({
        email: 'teacher.existing@example.com',
        userId: 'teacher-existing',
        teacherName: 'Teacher Existing',
      }),
    ]),
    fetchAllStudents: vi.fn(() => [
      buildStudent({
        name: 'Student Existing',
        email: 'student.existing@example.com',
        id: 'student-existing',
      }),
    ]),
  };
  globalThis.ClassroomApiClient = classroomApiClient;

  loadControllerModule();
});

afterEach(() => {
  cleanupControllerTestMocks();
  delete globalThis.ABClass;
  delete globalThis.Teacher;
  delete globalThis.Student;
  delete globalThis.Assignment;
  delete globalThis.ClassroomApiClient;
  delete globalThis.ABClassController;
  delete globalThis.Classroom;
  delete globalThis.DriveApp;
  delete require.cache[require.resolve('../../src/backend/y_controllers/ABClassController')];
  delete require.cache[require.resolve('../../src/backend/y_controllers/AssignmentController.js')];
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ABClassController.loadClass throw-on-missing', () => {
  /* 1. RED test — currently loadClass auto-initialises instead of throwing */
  it('throws an Error when no stored class exists for the given classId', () => {
    const collection = createMockCollection(vi);
    collection.findOne.mockReturnValue(null);
    const router = {
      getCollection: vi.fn().mockReturnValue(null),
    };
    globalThis.DbManager = { getInstance: () => router };

    // Reload controller so it picks up the clean mock
    loadControllerModule();
    const controller = new ABClassController();

    expect(() => controller.loadClass('nonexistent-id')).toThrow(/nonexistent-id/);
    expect(router.getCollection).toHaveBeenCalledWith('nonexistent-id');
  });

  /* 2. Regression — existing-class path still returns an ABClass instance */
  it('returns an ABClass instance when a stored class document exists', () => {
    const existingDoc = buildExistingClassDoc();
    classCollection.findOne.mockReturnValue(existingDoc);
    partialsCollection.findOne.mockReturnValue({ classId: 'class-existing' });

    const controller = new ABClassController();
    const result = controller.loadClass('class-existing');

    expect(result).toBeInstanceOf(ABClass);
    expect(result.classId).toBe('class-existing');
    expect(result.getClassName()).toBe('10A Computer Science');
    expect(classCollection.findOne).toHaveBeenCalledWith({ classId: 'class-existing' });
  });

  /* 3. Regression — ensureDefinitionFromInputs still returns the correct shape
   *    when the class exists. This method calls loadClass internally (via a new
   *    ABClassController instance), so the call chain must be preserved. */
  it('ensureDefinitionFromInputs returns { definition, courseId, abClass } when class exists', () => {
    // Set up the DB to return an existing class document
    const existingDoc = buildExistingClassDoc();
    classCollection.findOne.mockReturnValue(existingDoc);
    partialsCollection.findOne.mockReturnValue({ classId: 'class-existing' });

    // Mock global Classroom API for ensureDefinitionFromInputs
    globalThis.Classroom = {
      Courses: {
        CourseWork: {
          get: vi.fn(() => ({
            title: 'Test Coursework',
            topicId: 'topic-001',
          })),
        },
      },
    };

    // Mock DriveApp for _detectDocumentType MIME checks
    globalThis.DriveApp = {
      getFileById: vi.fn(() => ({
        getMimeType: vi.fn(() => 'application/vnd.google-apps.presentation'),
      })),
    };

    // Mock AssignmentDefinitionController that upsertDefinition returns
    const mockDefinition = {
      definitionKey: 'def-key-001',
      primaryTitle: 'Test Coursework',
      primaryTopicKey: 'topic-001',
      yearGroupKey: 'yg-10',
    };
    // setupControllerTestMocks already set up a mock AssignmentDefinitionController
    // with an ensureDefinition mock. We need to also mock upsertDefinition which
    // ensureDefinitionFromInputs calls via definitionController.upsertDefinition.
    const mockDefController = globalThis.AssignmentDefinitionController;
    mockDefController.prototype.upsertDefinition = vi.fn().mockReturnValue(mockDefinition);

    // Ensure ABClassController is available globally (AssignmentController creates
    // a new ABClassController() instance inside ensureDefinitionFromInputs).
    globalThis.ABClassController = ABClassController;

    // Import AssignmentController after all mocks are in place
    delete require.cache[
      require.resolve('../../src/backend/y_controllers/AssignmentController.js')
    ];
    const AssignmentController = require('../../src/backend/y_controllers/AssignmentController.js');

    const controller = new AssignmentController();
    const result = controller.ensureDefinitionFromInputs({
      assignmentTitle: 'Test Coursework',
      assignmentId: 'assignment-001',
      courseId: 'class-existing',
      documentIds: {
        referenceDocumentId: 'ref-doc-001',
        templateDocumentId: 'tpl-doc-001',
      },
      yearGroupKey: 'yg-10',
    });

    // Assert the return shape
    expect(result).toHaveProperty('definition');
    expect(result).toHaveProperty('courseId', 'class-existing');
    expect(result).toHaveProperty('abClass');
    expect(result.abClass).toBeInstanceOf(ABClass);
    expect(result.abClass.classId).toBe('class-existing');
    expect(result.definition).toEqual(mockDefinition);
  });

  /* 4. Regression — upsertABClass creates a new class when none exists.
   *    This path does NOT go through loadClass, so it must remain unaffected. */
  it('upsertABClass creates a new class when no stored class exists', () => {
    classCollection.findOne.mockReturnValue(null);
    partialsCollection.findOne.mockReturnValue(null);

    const controller = new ABClassController();

    const result = controller.upsertABClass({
      classId: 'class-existing',
      cohortKey: 'coh-2026',
      yearGroupKey: 'yg-10',
      courseLength: 2,
    });

    expect(classroomApiClient.fetchCourse).toHaveBeenCalledWith('class-existing');
    expect(classroomApiClient.fetchTeachers).toHaveBeenCalledWith('class-existing');
    expect(classroomApiClient.fetchAllStudents).toHaveBeenCalledWith('class-existing');
    expect(classCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(classCollection.replaceOne).not.toHaveBeenCalled();
    expect(partialsCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty('classId', 'class-existing');
    expect(result).toHaveProperty('active', true);
  });

  /* 5. Regression — updateABClass throws RangeError when class does not exist.
   *    This path does NOT go through loadClass; it directly checks the collection. */
  it('updateABClass throws RangeError when the class does not exist', () => {
    classCollection.findOne.mockReturnValue(null);
    partialsCollection.findOne.mockReturnValue(null);

    const controller = new ABClassController();

    expect(() =>
      controller.updateABClass({
        classId: 'class-missing',
        cohortKey: 'coh-2028',
        active: false,
      })
    ).toThrow(new RangeError("updateABClass: class 'class-missing' does not exist"));

    expect(classCollection.insertOne).not.toHaveBeenCalled();
    expect(classCollection.updateOne).not.toHaveBeenCalled();
  });
});
