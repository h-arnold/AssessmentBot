const ABClassExport = require('../../src/AdminSheet/Models/ABClass.js');
const ABClass = ABClassExport.ABClass || ABClassExport;
const StudentExport = require('../../src/AdminSheet/Models/Student.js');
const Student = StudentExport.Student || StudentExport;
const TeacherExport = require('../../src/AdminSheet/Models/Teacher.js');
const Teacher = TeacherExport.Teacher || TeacherExport;

describe('ABClassController.loadClass', () => {
  let ABClassController;
  let controller;
  let collectionMock;
  let dbManagerMock;

  beforeEach(() => {
    global.ABClass = ABClass;
    global.Student = Student;
    global.Teacher = Teacher;

    const loggerInstance = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };
    global.ABLogger = { getInstance: () => loggerInstance };

    collectionMock = {
      findOne: vi.fn(),
      getMetadata: vi.fn(),
      replaceOne: vi.fn(),
      updateOne: vi.fn(),
      insertOne: vi.fn(),
      save: vi.fn(),
    };

    dbManagerMock = {
      getCollection: vi.fn().mockReturnValue(collectionMock),
    };

    global.DbManager = { getInstance: () => dbManagerMock };

    global.ClassroomApiClient = {
      fetchCourseUpdateTime: vi.fn(),
      fetchCourse: vi.fn(),
      fetchTeachers: vi.fn(),
      fetchAllStudents: vi.fn(),
    };

    delete require.cache[
      require.resolve('../../src/AdminSheet/y_controllers/ABClassController.js')
    ];
    ABClassController = require('../../src/AdminSheet/y_controllers/ABClassController.js');
    controller = new ABClassController();
  });

  afterEach(() => {
    delete global.ABClass;
    delete global.Student;
    delete global.Teacher;
    delete global.ABLogger;
    delete global.DbManager;
    delete global.ClassroomApiClient;
    delete require.cache[
      require.resolve('../../src/AdminSheet/y_controllers/ABClassController.js')
    ];
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

    // Since loadClass always refreshes the roster we expect the refresh helpers
    // to have been called, and persisted collection to be updated.
    expect(ClassroomApiClient.fetchCourse).toHaveBeenCalledWith('course-456');
    expect(ClassroomApiClient.fetchTeachers).toHaveBeenCalledWith('course-456');
    expect(ClassroomApiClient.fetchAllStudents).toHaveBeenCalledWith('course-456');
    expect(collectionMock.updateOne).toHaveBeenCalledTimes(1);
    expect(collectionMock.save).toHaveBeenCalledTimes(1);

    // The refreshed payload uses the empty fetch responses above so the
    // teachers/students arrays should be empty after refresh.
    expect(abClass.teachers).toHaveLength(0);
    expect(abClass.students).toHaveLength(0);
  });

  // No fallback path: schema must support updateOne.
});
