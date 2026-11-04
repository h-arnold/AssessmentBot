/**
 * Shared fixtures and harness for the ABClassController read suites
 * (`abclassController.readClass.test.js` and
 * `abclassController.readClass.assignments.test.js`).
 *
 * Both suites drive the real controller over a mocked class collection, so the
 * stored-document fixture, the expected read-view projection and the collection
 * router live here once. Each suite keeps its own describes, assertions and
 * file-specific `globalThis` wiring.
 */

const ABClassModule = require('#backend/Models/ABClass.js');
const TeacherModule = require('#backend/Models/Teacher.js');
const StudentModule = require('#backend/Models/Student.js');
const AssignmentModule = require('#backend/AssignmentProcessor/Assignment/index.js');
const AssignmentDefinitionModule = require('#backend/Models/AssignmentDefinition.js');
const ClassNotFoundError = require('#backend/Utils/ErrorTypes/ClassNotFoundError.js');
const { buildTestStudent, buildTestTeacher, createMockCollection } = require('./mockFactories.js');

const ABClass = ABClassModule.ABClass || ABClassModule;
const Teacher = TeacherModule.Teacher || TeacherModule;
const Student = StudentModule.Student || StudentModule;
const Assignment = AssignmentModule.default || AssignmentModule;
const AssignmentDefinition =
  AssignmentDefinitionModule.AssignmentDefinition || AssignmentDefinitionModule;

/**
 * Builds a teacher from the shared Teacher model.
 *
 * @param {Object} [overrides] - Optional field overrides.
 * @returns {Object} Teacher instance.
 */
function buildTeacher(overrides = {}) {
  return buildTestTeacher(Teacher, overrides);
}

/**
 * Builds a student from the shared Student model.
 *
 * @param {Object} [overrides] - Optional field overrides.
 * @returns {Object} Student instance.
 */
function buildStudent(overrides = {}) {
  return buildTestStudent(Student, overrides);
}

/**
 * Returns a plain object matching the shape stored in the DB for an existing class.
 *
 * @param {Object} [overrides] - Optional document field overrides.
 * @returns {Object} The stored class document.
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
 *
 * @param {Object} doc - The stored class document.
 * @returns {Object} The expected read view.
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

/**
 * Installs a DbManager router that serves the class collection for the requested
 * classId and a fresh mock collection for any other name.
 *
 * @param {Object} vi - Vitest vi object for creating mocks.
 * @param {Object} classCollection - Mock for the class-named collection.
 * @param {string} [classId] - Class identity routed to `classCollection`.
 * @returns {Object} The installed mock DbManager.
 */
function setupCollectionRouter(vi, classCollection, classId = 'class-existing') {
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

module.exports = {
  ABClass,
  Teacher,
  Student,
  Assignment,
  AssignmentDefinition,
  ClassNotFoundError,
  buildTeacher,
  buildStudent,
  buildExistingClassDoc,
  buildExpectedReadView,
  setupCollectionRouter,
};
