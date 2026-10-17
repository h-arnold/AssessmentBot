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
import { createMockCollection, setupControllerTestMocks } from '../helpers/mockFactories.js';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { restoreGlobals, saveGlobals } from '../helpers/globalMockManager.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ABClassModule = require('#backend/Models/ABClass.js');
const TeacherModule = require('#backend/Models/Teacher.js');
const StudentModule = require('#backend/Models/Student.js');

const ABClass = ABClassModule.ABClass || ABClassModule;
const Teacher = TeacherModule.Teacher || TeacherModule;
const Student = StudentModule.Student || StudentModule;

/**
 * Returns a cloned canonical backend class input for an existing class.
 */
function buildExistingClassDoc(overrides = {}) {
  const source = Object.values(loadBackendModelInputs('small').classesById)[0];
  return {
    ...structuredClone(source),
    classId: 'class-existing',
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
let savedGlobals;

function loadControllerModule() {
  delete require.cache[require.resolve('#backend/y_controllers/ABClassController/index.js')];
  ABClassController = require('#backend/y_controllers/ABClassController/index.js');
}

/* ------------------------------------------------------------------ */
/*  Setup / teardown                                                   */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  savedGlobals = saveGlobals([
    'ABClass',
    'Teacher',
    'Student',
    'Assignment',
    'ABClassController',
    'DbManager',
    'ABLogger',
    'ProgressTracker',
    'ConfigurationManager',
    'AssignmentDefinitionController',
    'ClassroomApiClient',
    'Classroom',
    'DriveApp',
  ]);
  classCollection = createMockCollection(vi);
  partialsCollection = createMockCollection(vi);
  partialsCollection.updateOne.mockReturnValue({
    matchedCount: 1,
    modifiedCount: 0,
    acknowledged: true,
  });

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
      new Teacher('teacher.existing@example.com', 'teacher-existing', 'Teacher Existing'),
    ]),
    fetchAllStudents: vi.fn(() => [
      new Student('Student Existing', 'student.existing@example.com', 'student-existing'),
    ]),
  };
  globalThis.ClassroomApiClient = classroomApiClient;

  loadControllerModule();
});

afterEach(() => {
  restoreGlobals(savedGlobals);
  delete require.cache[require.resolve('#backend/y_controllers/ABClassController/index.js')];
  delete require.cache[require.resolve('#backend/y_controllers/AssignmentController.js')];
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
    partialsCollection.findOne.mockReturnValue({
      _id: 'partial-existing',
      classId: 'class-existing',
    });

    const controller = new ABClassController();
    const result = controller.loadClass('class-existing');

    expect(result).toBeInstanceOf(ABClass);
    expect(result.classId).toBe('class-existing');
    expect(result.getClassName()).toBe('10A Computer Science');
    expect(result.assignments).toHaveLength(4);
    expect(result.assignments[0].assignmentId).toBe(existingDoc.assignments[0].assignmentId);
    expect(result.assignments[0].assignmentDefinition.tasks[0].taskTitle).toBe(
      existingDoc.assignments[0].assignmentDefinition.tasks[0].taskTitle
    );
    expect(classCollection.findOne).toHaveBeenCalledWith({ classId: 'class-existing' });
  });

  /* 3. Regression — ensureDefinitionFromInputs still returns the correct shape
   *    when the class exists. This method calls loadClass internally (via a new
   *    ABClassController instance), so the call chain must be preserved. */
  it('ensureDefinitionFromInputs returns { definition, courseId, abClass } when class exists', () => {
    // Set up the DB to return an existing class document
    const existingDoc = buildExistingClassDoc();
    classCollection.findOne.mockReturnValue(existingDoc);
    partialsCollection.findOne.mockReturnValue({
      _id: 'partial-existing',
      classId: 'class-existing',
    });

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
    delete require.cache[require.resolve('#backend/y_controllers/AssignmentController.js')];
    const AssignmentController = require('#backend/y_controllers/AssignmentController.js');

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
    expect(result.abClass.assignments).toHaveLength(4);
    expect(result.abClass.assignments[0].assignmentId).toBe(
      existingDoc.assignments[0].assignmentId
    );
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
