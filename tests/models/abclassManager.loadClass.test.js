import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { restoreGlobals, saveGlobals } from '../helpers/globalMockManager.js';

const ABClassExport = require('#backend/Models/ABClass.js');
const ABClass = ABClassExport.ABClass || ABClassExport;
const StudentExport = require('#backend/Models/Student.js');
const Student = StudentExport.Student || StudentExport;
const TeacherExport = require('#backend/Models/Teacher.js');
const Teacher = TeacherExport.Teacher || TeacherExport;

describe('ABClassController.loadClass', () => {
  let ABClassController;
  let controller;
  let collectionMock;
  let dbManagerMock;
  let savedGlobals;

  beforeEach(() => {
    savedGlobals = saveGlobals([
      'ABClass',
      'Student',
      'Teacher',
      'ABLogger',
      'DbManager',
      'ClassroomApiClient',
    ]);
    globalThis.ABClass = ABClass;
    globalThis.Student = Student;
    globalThis.Teacher = Teacher;

    const loggerInstance = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };
    globalThis.ABLogger = { getInstance: () => loggerInstance };

    collectionMock = {
      findOne: vi.fn(),
      getMetadata: vi.fn(),
      replaceOne: vi.fn(),
      updateOne: vi.fn(),
      insertOne: vi.fn(),
      save: vi.fn(),
    };

    const partialsCollectionMock = {
      findOne: vi.fn().mockReturnValue(null),
      updateOne: vi.fn(() => ({ matchedCount: 1, modifiedCount: 0, acknowledged: true })),
      replaceOne: vi.fn(),
      insertOne: vi.fn(),
      save: vi.fn(),
    };

    dbManagerMock = {
      getCollection: vi.fn((name) =>
        name === 'abclass_partials' ? partialsCollectionMock : collectionMock
      ),
    };

    globalThis.DbManager = { getInstance: () => dbManagerMock };

    globalThis.ClassroomApiClient = {
      fetchCourseUpdateTime: vi.fn(),
      fetchCourse: vi.fn(),
      fetchTeachers: vi.fn(),
      fetchAllStudents: vi.fn(),
    };

    delete require.cache[require.resolve('#backend/y_controllers/ABClassController/index.js')];
    ABClassController = require('#backend/y_controllers/ABClassController/index.js');
    controller = new ABClassController();
  });

  afterEach(() => {
    restoreGlobals(savedGlobals);
    delete require.cache[require.resolve('#backend/y_controllers/ABClassController/index.js')];
  });

  it('refreshes roster when course update time is newer than collection metadata', () => {
    const storedDoc = {
      _id: 'doc-1',
      classId: 'course-123',
      className: 'Original Name',
      teachers: [{ email: 'old-teacher@example.com', userId: 'old-t1' }],
      students: [{ name: 'Old Student', email: 'old@student.example.com', id: 'old-s1' }],
      assignments: [],
    };

    collectionMock.findOne.mockReturnValue(storedDoc);
    collectionMock.getMetadata.mockReturnValue({
      created: new Date('2023-01-01T00:00:00Z'),
      lastUpdated: new Date('2023-01-10T00:00:00Z'),
      documentCount: 1,
    });

    const refreshedTeacher = new Teacher(
      'updated-teacher@example.com',
      'teacher-123',
      'Teacher Updated'
    );
    const refreshedStudent = new Student('New Student', 'new@student.example.com', 'student-1');

    ClassroomApiClient.fetchCourseUpdateTime.mockReturnValue(new Date('2023-02-01T00:00:00Z'));
    ClassroomApiClient.fetchCourse.mockReturnValue({
      id: 'course-123',
      name: 'Updated Name',
      ownerId: 'owner-999',
    });
    ClassroomApiClient.fetchTeachers.mockReturnValue([refreshedTeacher]);
    ClassroomApiClient.fetchAllStudents.mockReturnValue([refreshedStudent]);

    const abClass = controller.loadClass('course-123');

    // With roster refresh forced in loadClass, we do not consult fetchCourseUpdateTime
    expect(ClassroomApiClient.fetchCourseUpdateTime).not.toHaveBeenCalled();
    expect(ClassroomApiClient.fetchCourse).toHaveBeenCalledWith('course-123');
    expect(ClassroomApiClient.fetchTeachers).toHaveBeenCalledWith('course-123');
    expect(ClassroomApiClient.fetchAllStudents).toHaveBeenCalledWith('course-123');

    expect(abClass.teachers).toHaveLength(1);
    expect(abClass.teachers[0].email).toBe('updated-teacher@example.com');
    expect(abClass.students).toHaveLength(1);
    expect(abClass.students[0].email).toBe('new@student.example.com');
    expect(abClass.classOwner).toBeTruthy();
    expect(abClass.classOwner.userId || abClass.classOwner.getUserId()).toBe('owner-999');
    expect(collectionMock.updateOne).toHaveBeenCalledTimes(1);
    expect(collectionMock.replaceOne).not.toHaveBeenCalled();
    expect(collectionMock.insertOne).not.toHaveBeenCalled();
    expect(collectionMock.save).toHaveBeenCalledTimes(1);

    const [filterArg, updateArg] = collectionMock.updateOne.mock.calls[0];
    expect(filterArg).toEqual({ _id: 'doc-1' });

    expect(updateArg).toHaveProperty('$set');
    const { $set } = updateArg;
    expect($set.className).toBe('Updated Name');
    expect($set).not.toHaveProperty('cohort');
    expect($set).not.toHaveProperty('courseLength');
    expect($set).not.toHaveProperty('yearGroup');

    expect($set.classOwner).toBeInstanceOf(Teacher);
    expect($set.classOwner.userId).toBe('owner-999');

    expect(Array.isArray($set.teachers)).toBe(true);
    expect($set.teachers).toHaveLength(1);
    expect($set.teachers[0].email).toBe('updated-teacher@example.com');

    expect(Array.isArray($set.students)).toBe(true);
    expect($set.students).toHaveLength(1);
    expect($set.students[0].email).toBe('new@student.example.com');
  });

  it('returns stored class when metadata is up to date', () => {
    const storedDoc = {
      classId: 'course-456',
      className: 'Stable Name',
      teachers: [{ email: 'existing@example.com', userId: 't-existing' }],
      students: [
        { name: 'Existing Student', email: 'existing@student.example.com', id: 's-existing' },
      ],
      assignments: [],
    };

    collectionMock.findOne.mockReturnValue(storedDoc);
    collectionMock.getMetadata.mockReturnValue({
      created: new Date('2023-03-01T00:00:00Z'),
      lastUpdated: new Date('2023-03-15T00:00:00Z'),
      documentCount: 1,
    });

    ClassroomApiClient.fetchCourseUpdateTime.mockReturnValue(new Date('2023-03-10T00:00:00Z'));
    ClassroomApiClient.fetchCourse.mockReturnValue({});
    ClassroomApiClient.fetchTeachers.mockReturnValue([]);
    ClassroomApiClient.fetchAllStudents.mockReturnValue([]);

    const abClass = controller.loadClass('course-456');

    // loadClass always refreshes the roster and persists only the roster fields.
    expect(ClassroomApiClient.fetchCourse).toHaveBeenCalledWith('course-456');
    expect(ClassroomApiClient.fetchTeachers).toHaveBeenCalledWith('course-456');
    expect(ClassroomApiClient.fetchAllStudents).toHaveBeenCalledWith('course-456');
    expect(collectionMock.updateOne).toHaveBeenCalledTimes(1);
    expect(collectionMock.replaceOne).not.toHaveBeenCalled();
    expect(collectionMock.insertOne).not.toHaveBeenCalled();
    expect(collectionMock.save).toHaveBeenCalledTimes(1);

    // The refreshed payload uses the empty fetch responses above so the
    // teachers/students arrays should be empty after refresh.
    expect(abClass.teachers).toHaveLength(0);
    expect(abClass.students).toHaveLength(0);
  });

  it('inserts a complete canonical partial when the registry row is missing', () => {
    const source = Object.values(loadBackendModelInputs('small').classesById)[0];
    const storedDoc = {
      ...structuredClone(source),
      classId: 'course-missing-partial',
    };
    const originalAssignments = structuredClone(storedDoc.assignments);
    collectionMock.findOne.mockReturnValue(storedDoc);
    ClassroomApiClient.fetchCourse.mockReturnValue({});
    ClassroomApiClient.fetchTeachers.mockReturnValue([]);
    ClassroomApiClient.fetchAllStudents.mockReturnValue([]);
    const partialCollection = dbManagerMock.getCollection('abclass_partials');

    const loaded = controller.loadClass(storedDoc.classId);

    expect(partialCollection.insertOne).toHaveBeenCalledTimes(1);
    const inserted = partialCollection.insertOne.mock.calls[0][0];
    expect(inserted).toMatchObject({
      classId: storedDoc.classId,
      cohortKey: storedDoc.cohortKey,
      courseLength: storedDoc.courseLength,
      yearGroupKey: storedDoc.yearGroupKey,
      active: storedDoc.active,
      metadata: storedDoc.metadata,
    });
    expect(inserted).not.toHaveProperty('students');
    expect(inserted).not.toHaveProperty('assignments');
    expect(loaded.assignments).toHaveLength(originalAssignments.length);
    expect(loaded.assignments[0].assignmentId).toBe(originalAssignments[0].assignmentId);
    expect(loaded.assignments[0].assignmentDefinition.tasks[0].taskTitle).toBe(
      originalAssignments[0].assignmentDefinition.tasks[0].taskTitle
    );
  });

  it('accepts an existing-row no-op patch using only its stored id and roster fields', () => {
    const source = Object.values(loadBackendModelInputs('small').classesById)[0];
    const storedDoc = {
      ...structuredClone(source),
      classId: 'course-noop-partial',
    };
    const partialCollection = dbManagerMock.getCollection('abclass_partials');
    partialCollection.findOne.mockReturnValue({
      _id: 'stored-partial-id',
      classId: storedDoc.classId,
    });
    collectionMock.findOne.mockReturnValue(storedDoc);
    ClassroomApiClient.fetchCourse.mockReturnValue({});
    ClassroomApiClient.fetchTeachers.mockReturnValue([]);
    ClassroomApiClient.fetchAllStudents.mockReturnValue([]);

    const loaded = controller.loadClass(storedDoc.classId);

    expect(partialCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'stored-partial-id' },
      { $set: { className: storedDoc.className, classOwner: null, teachers: [] } }
    );
    expect(partialCollection.replaceOne).not.toHaveBeenCalled();
    expect(partialCollection.insertOne).not.toHaveBeenCalled();
    expect(loaded.assignments).toHaveLength(storedDoc.assignments.length);
    expect(loaded.assignments[0].assignmentId).toBe(storedDoc.assignments[0].assignmentId);
    expect(loaded.assignments[0].assignmentDefinition.tasks[0].taskTitle).toBe(
      storedDoc.assignments[0].assignmentDefinition.tasks[0].taskTitle
    );
  });

  // No fallback path: schema must support updateOne.
});
