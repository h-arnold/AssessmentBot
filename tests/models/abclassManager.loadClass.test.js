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
      debugUi: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
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
});
