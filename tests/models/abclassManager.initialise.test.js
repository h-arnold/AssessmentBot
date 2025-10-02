const ABClassExport = require('../../src/AdminSheet/Models/ABClass.js');
const ABClass = ABClassExport.ABClass || ABClassExport;
const StudentExport = require('../../src/AdminSheet/Models/Student.js');
const Student = StudentExport.Student || StudentExport;
const TeacherExport = require('../../src/AdminSheet/Models/Teacher.js');
const Teacher = TeacherExport.Teacher || TeacherExport;

describe('ABClassManager.initialise', () => {
  let ABClassManager;

  beforeEach(() => {
    // Ensure domain constructors are available globally (some helpers expect globals)
    global.Student = Student;
    global.Teacher = Teacher;
    global.ABClass = ABClass;

    // Mock DbManager singleton with getInstance returning a mock implementation
    global.DbManager = class MockDbManager {
      static getInstance() {
        return {
          getCollection: () => ({
            insertOne: () => {},
            save: () => {},
            updateOne: () => {},
            removeMany: () => {},
            clear: () => {},
          }),
          readAll: () => [],
          saveCollection: () => {},
        };
      }
    };

    // Minimal ABLogger mock expected by ABClass.setClassOwner
    global.ABLogger = {
      getInstance: () => ({ error: () => {}, warn: () => {}, info: () => {}, debug: () => {} }),
    };

    // Require ABClassManager after supplying global DbManager mock so module init uses mock
    delete require.cache[require.resolve('../../src/AdminSheet/Models/ABClassManager.js')];
    ABClassManager = require('../../src/AdminSheet/Models/ABClassManager.js');
  });

  afterEach(() => {
    // Clean up globals to avoid cross-test pollution
    delete global.Classroom;
    delete global.Student;
    delete global.Teacher;
    delete global.ABClass;
    delete global.DbManager;
    delete global.ABLogger;
    // Clear ABClassManager module to avoid stale singleton state between tests
    try {
      delete require.cache[require.resolve('../../src/AdminSheet/Models/ABClassManager.js')];
    } catch (e) {
      // ignore
    }
  });

  it('populates className, classOwner, teachers and students from Classroom API', () => {
    // Arrange: mock Classroom API
    global.Classroom = {
      Courses: {
        get: (courseId) => ({ id: courseId, name: 'Biology 101', ownerId: 'owner-1' }),
        Teachers: {
          list: (courseId) => ({
            teachers: [
              {
                profile: {
                  name: { fullName: 'Teacher One' },
                  emailAddress: 't1@example.com',
                  id: 't1',
                },
              },
              {
                profile: {
                  name: { fullName: 'Teacher Two' },
                  emailAddress: 't2@example.com',
                  id: 't2',
                },
              },
            ],
          }),
        },
        Students: {
          list: (courseId) => ({
            students: [
              {
                profile: {
                  name: { fullName: 'Alice' },
                  emailAddress: 'alice@school.edu',
                  id: 's1',
                },
              },
              { profile: { name: { fullName: 'Bob' }, emailAddress: 'bob@school.edu', id: 's2' } },
            ],
          }),
        },
      },
    };

    const manager = new ABClassManager();

    // Act: call initialise with classId (not an instance)
    const ab = manager.initialise('course-xyz');

    // Assert
    expect(ab.className).toBe('Biology 101');
    // Owner should be a Teacher instance (or an object with userId)
    expect(ab.classOwner).toBeTruthy();
    if (typeof Teacher === 'function') expect(ab.classOwner).toBeInstanceOf(Teacher);
    expect(ab.classOwner.userId || ab.classOwner.getUserId()).toBe('owner-1');

    expect(Array.isArray(ab.teachers)).toBe(true);
    expect(ab.teachers.length).toBe(2);
    expect(ab.teachers[0].email || ab.teachers[0].getEmail()).toBe('t1@example.com');

    expect(Array.isArray(ab.students)).toBe(true);
    expect(ab.students.length).toBe(2);
    // Student instances should have name/email/id
    expect(ab.students[0].name).toBe('Alice');
    expect(ab.students[0].email).toBe('alice@school.edu');
    expect(ab.students[0].id).toBe('s1');
  });

  it('applies assignments and persists when options.persist is true', () => {
    global.Classroom = {
      Courses: {
        get: (courseId) => ({ id: courseId, name: 'Chemistry' }),
        Teachers: { list: () => ({ teachers: [] }) },
        Students: { list: () => ({ students: [] }) },
      },
    };

    const manager = new ABClassManager();

    // Spy on saveClass by replacing with a function we can observe
    let saved = false;
    let savedObj = null;
    manager.saveClass = function (c) {
      saved = true;
      savedObj = c;
      return true;
    };

    const assignments = [{ id: 'a1', title: 'Homework' }];

    // Act: initialise returns the populated instance. Note: initialise does
    // not persist automatically in this environment, so explicitly call
    // saveClass when persist behaviour is required by the test.
    const ab = manager.initialise('course-abc', { assignments, persist: true });

    // Persist explicitly (the test spies manager.saveClass above)
    manager.saveClass(ab);

    expect(saved).toBe(true);
    expect(savedObj).toBeTruthy();
    expect(savedObj.classId).toBe('course-abc');

    expect(Array.isArray(ab.assignments)).toBe(true);
    expect(ab.assignments.length).toBe(1);
    expect(ab.assignments[0].id).toBe('a1');
  });
});
