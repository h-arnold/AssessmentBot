import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupControllerTestMocks,
  createMockCollection,
  setupControllerTestMocks,
} from '../helpers/mockFactories.js';

const ABClassModule = require('../../src/backend/Models/ABClass.js');
const TeacherModule = require('../../src/backend/Models/Teacher.js');
const StudentModule = require('../../src/backend/Models/Student.js');

const ABClass = ABClassModule.ABClass || ABClassModule;
const Teacher = TeacherModule.Teacher || TeacherModule;
const Student = StudentModule.Student || StudentModule;

function buildTeacher({ email, userId, teacherName }) {
  return new Teacher(email, userId, teacherName);
}

function buildStudent({ name, email, id }) {
  return new Student(name, email, id);
}

function buildExistingClassDoc(overrides = {}) {
  return {
    classId: 'class-001',
    className: '10A Computer Science',
    cohort: '2025',
    courseLength: 2,
    yearGroup: 10,
    classOwner: {
      email: 'owner.previous@example.com',
      userId: 'owner-previous',
      teacherName: 'Owner Previous',
    },
    teachers: [
      {
        email: 'teacher.previous@example.com',
        userId: 'teacher-previous',
        teacherName: 'Teacher Previous',
      },
    ],
    students: [
      {
        name: 'Student Previous',
        email: 'student.previous@example.com',
        id: 'student-previous',
      },
    ],
    assignments: [{ assignmentId: 'assignment-001', title: 'Essay Draft' }],
    active: true,
    ...overrides,
  };
}

function buildExpectedSummary(overrides = {}) {
  return {
    classId: 'class-001',
    className: '10A Computer Science',
    cohort: '2026',
    courseLength: 2,
    yearGroup: 10,
    classOwner: {
      email: 'owner.current@example.com',
      userId: 'owner-current',
      teacherName: 'Owner Current',
    },
    teachers: [
      {
        email: 'teacher.current@example.com',
        userId: 'teacher-current',
        teacherName: 'Teacher Current',
      },
    ],
    active: true,
    ...overrides,
  };
}

function setupCollectionRouter(classCollection, partialsCollection, classId = 'class-001') {
  const mockDbManager = {
    getCollection: vi.fn((name) => {
      if (name === 'abclass_partials') {
        return partialsCollection;
      }

      if (name === classId) {
        return classCollection;
      }

      throw new Error(`Unexpected collection requested in test harness: ${name}`);
    }),
  };

  globalThis.DbManager = { getInstance: () => mockDbManager };
  return mockDbManager;
}

let ABClassController;
let classCollection;
let partialsCollection;
let classroomApiClient;

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
      id: 'class-001',
      name: '10A Computer Science',
      ownerId: 'owner-current',
    })),
    fetchTeachers: vi.fn(() => [
      buildTeacher({
        email: 'owner.current@example.com',
        userId: 'owner-current',
        teacherName: 'Owner Current',
      }),
      buildTeacher({
        email: 'teacher.current@example.com',
        userId: 'teacher-current',
        teacherName: 'Teacher Current',
      }),
    ]),
    fetchAllStudents: vi.fn(() => [
      buildStudent({
        name: 'Student One',
        email: 'student.one@example.com',
        id: 'student-001',
      }),
      buildStudent({
        name: 'Student Two',
        email: 'student.two@example.com',
        id: 'student-002',
      }),
    ]),
  };
  globalThis.ClassroomApiClient = classroomApiClient;

  delete require.cache[require.resolve('../../src/backend/y_controllers/ABClassController.js')];
  ABClassController = require('../../src/backend/y_controllers/ABClassController.js');
});

afterEach(() => {
  cleanupControllerTestMocks();
  delete globalThis.ABClass;
  delete globalThis.Teacher;
  delete globalThis.Student;
  delete globalThis.Assignment;
  delete globalThis.ClassroomApiClient;
  delete require.cache[require.resolve('../../src/backend/y_controllers/ABClassController.js')];
  vi.restoreAllMocks();
});

describe('ABClassController upsert and update orchestration', () => {
  it('upsertABClass creates a new class when the class is missing', () => {
    classCollection.findOne.mockReturnValue(null);
    partialsCollection.findOne.mockReturnValue(null);

    const controller = new ABClassController();

    const result = controller.upsertABClass({
      classId: 'class-001',
      cohort: '2026',
      yearGroup: 10,
      courseLength: 2,
    });

    expect(classroomApiClient.fetchCourse).toHaveBeenCalledWith('class-001');
    expect(classroomApiClient.fetchTeachers).toHaveBeenCalledWith('class-001');
    expect(classroomApiClient.fetchAllStudents).toHaveBeenCalledWith('class-001');
    expect(controller.dbManager.getCollection).toHaveBeenCalledWith('class-001');
    expect(controller.dbManager.getCollection).toHaveBeenCalledWith('abclass_partials');
    expect(classCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(classCollection.replaceOne).not.toHaveBeenCalled();
    expect(partialsCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      buildExpectedSummary({
        active: null,
      })
    );
    expect(result).not.toHaveProperty('students');
    expect(result).not.toHaveProperty('assignments');
  });

  it('upsertABClass updates an existing class when the class already exists and preserves assignments', () => {
    classCollection.findOne.mockReturnValue(buildExistingClassDoc());
    partialsCollection.findOne.mockReturnValue({ classId: 'class-001' });

    const controller = new ABClassController();

    const result = controller.upsertABClass({
      classId: 'class-001',
      cohort: '2026',
      yearGroup: 10,
      courseLength: 2,
    });

    expect(classCollection.replaceOne).toHaveBeenCalledTimes(1);
    expect(classCollection.insertOne).not.toHaveBeenCalled();
    expect(controller.dbManager.getCollection).toHaveBeenCalledWith('class-001');
    expect(controller.dbManager.getCollection).toHaveBeenCalledWith('abclass_partials');
    const [, persistedClass] = classCollection.replaceOne.mock.calls[0];
    expect(persistedClass.assignments).toEqual(
      expect.arrayContaining([expect.objectContaining({ assignmentId: 'assignment-001' })])
    );
    expect(result).toEqual(buildExpectedSummary());
  });

  it('upsertABClass hydrates classOwner, teachers, and students from Classroom sources before persisting', () => {
    classCollection.findOne.mockReturnValue(null);
    partialsCollection.findOne.mockReturnValue(null);

    const controller = new ABClassController();

    controller.upsertABClass({
      classId: 'class-001',
      cohort: '2026',
      yearGroup: 10,
      courseLength: 2,
    });

    const insertedClass = classCollection.insertOne.mock.calls[0][0];
    expect(insertedClass.className).toBe('10A Computer Science');
    expect(insertedClass.classOwner.userId || insertedClass.classOwner.getUserId()).toBe(
      'owner-current'
    );
    expect(insertedClass.teachers).toHaveLength(1);
    expect(insertedClass.teachers[0].userId || insertedClass.teachers[0].getUserId()).toBe(
      'teacher-current'
    );
    expect(insertedClass.students).toHaveLength(2);
    expect(insertedClass.students[0].id).toBe('student-001');
  });

  it('updateABClass updates only supplied patch fields using partial update semantics', () => {
    const existingClassDoc = buildExistingClassDoc();
    classCollection.findOne.mockReturnValue(existingClassDoc);
    partialsCollection.findOne.mockReturnValue({ classId: 'class-001' });

    const controller = new ABClassController();

    const result = controller.updateABClass({
      classId: 'class-001',
      cohort: '2027',
      courseLength: 3,
    });

    expect(controller.dbManager.getCollection).toHaveBeenCalledWith('class-001');
    expect(controller.dbManager.getCollection).toHaveBeenCalledWith('abclass_partials');
    expect(classCollection.updateOne).toHaveBeenCalledTimes(1);
    expect(classCollection.insertOne).not.toHaveBeenCalled();
    expect(classCollection.replaceOne).not.toHaveBeenCalled();
    expect(classCollection.updateOne).toHaveBeenCalledWith(
      { classId: 'class-001' },
      {
        $set: {
          cohort: '2027',
          courseLength: 3,
        },
      }
    );
    expect(result).toEqual(
      buildExpectedSummary({
        cohort: '2027',
        courseLength: 3,
        classOwner: existingClassDoc.classOwner,
        teachers: existingClassDoc.teachers,
      })
    );
  });

  it('updateABClass does not alter teachers, students, classOwner, or assignments', () => {
    const existingClassDoc = buildExistingClassDoc();
    classCollection.findOne.mockReturnValue(existingClassDoc);
    partialsCollection.findOne.mockReturnValue({ classId: 'class-001' });

    const controller = new ABClassController();

    const result = controller.updateABClass({
      classId: 'class-001',
      active: false,
    });

    expect(controller.dbManager.getCollection).toHaveBeenCalledWith('class-001');
    expect(controller.dbManager.getCollection).toHaveBeenCalledWith('abclass_partials');
    const [, update] = classCollection.updateOne.mock.calls[0];
    expect(update.$set).not.toHaveProperty('classOwner');
    expect(update.$set).not.toHaveProperty('teachers');
    expect(update.$set).not.toHaveProperty('students');
    expect(update.$set).not.toHaveProperty('assignments');
    expect(partialsCollection.replaceOne).toHaveBeenCalledWith(
      { classId: 'class-001' },
      buildExpectedSummary({
        cohort: '2025',
        courseLength: 2,
        classOwner: existingClassDoc.classOwner,
        teachers: existingClassDoc.teachers,
        active: false,
      })
    );
    expect(result).toEqual(
      buildExpectedSummary({
        cohort: '2025',
        courseLength: 2,
        classOwner: existingClassDoc.classOwner,
        teachers: existingClassDoc.teachers,
        active: false,
      })
    );
    expect(result).not.toHaveProperty('students');
    expect(result).not.toHaveProperty('assignments');
  });

  it('updateABClass throws when the class does not exist rather than creating it', () => {
    classCollection.findOne.mockReturnValue(null);
    partialsCollection.findOne.mockReturnValue(null);

    const controller = new ABClassController();

    expect(() =>
      controller.updateABClass({
        classId: 'class-001',
        cohort: '2028',
        active: null,
      })
    ).toThrow(new RangeError("updateABClass: class 'class-001' does not exist"));

    expect(classroomApiClient.fetchCourse).not.toHaveBeenCalled();
    expect(classCollection.insertOne).not.toHaveBeenCalled();
    expect(classCollection.updateOne).not.toHaveBeenCalled();
    expect(partialsCollection.insertOne).not.toHaveBeenCalled();
  });

  it('updateABClass preserves write-through consistency between the full record and abclass_partials', () => {
    const existingClassDoc = buildExistingClassDoc();
    classCollection.findOne.mockReturnValue(existingClassDoc);
    partialsCollection.findOne.mockReturnValue({ classId: 'class-001' });

    const controller = new ABClassController();

    controller.updateABClass({
      classId: 'class-001',
      cohort: '2029',
      yearGroup: 12,
      courseLength: 4,
      active: false,
    });

    expect(controller.dbManager.getCollection).toHaveBeenCalledWith('class-001');
    expect(controller.dbManager.getCollection).toHaveBeenCalledWith('abclass_partials');
    expect(classCollection.updateOne).toHaveBeenCalledWith(
      { classId: 'class-001' },
      {
        $set: {
          cohort: '2029',
          yearGroup: 12,
          courseLength: 4,
          active: false,
        },
      }
    );
    expect(partialsCollection.replaceOne).toHaveBeenCalledWith(
      { classId: 'class-001' },
      buildExpectedSummary({
        cohort: '2029',
        yearGroup: 12,
        courseLength: 4,
        classOwner: existingClassDoc.classOwner,
        teachers: existingClassDoc.teachers,
        active: false,
      })
    );
  });
});
