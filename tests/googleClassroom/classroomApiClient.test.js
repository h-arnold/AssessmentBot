import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

if (!globalThis.ProgressTracker) {
  throw new Error('ProgressTracker mock expected from setupGlobals.js');
}

const modulePath = '../../src/backend/GoogleClassroom/ClassroomApiClient.js';

describe('ClassroomApiClient (read-only methods)', () => {
  let ClassroomApiClient;
  let progressTrackerInstance;
  let abLoggerInstance;
  let originalProgressTrackerGetInstance;
  let originalABLogger;
  let originalClassroom;
  let originalTeacher;
  let originalStudent;

  beforeEach(() => {
    originalProgressTrackerGetInstance = globalThis.ProgressTracker.getInstance;
    originalABLogger = globalThis.ABLogger;
    originalClassroom = globalThis.Classroom;
    originalTeacher = globalThis.Teacher;
    originalStudent = globalThis.Student;

    progressTrackerInstance = {
      logAndThrowError: vi.fn((message) => {
        throw new Error(message);
      }),
      logError: vi.fn(),
    };
    globalThis.ProgressTracker.getInstance = vi.fn(() => progressTrackerInstance);

    abLoggerInstance = {
      info: vi.fn(),
      error: vi.fn(),
    };
    globalThis.ABLogger = { getInstance: vi.fn(() => abLoggerInstance) };

    globalThis.Classroom = {
      Courses: {
        list: vi.fn(),
        get: vi.fn(),
        Topics: {
          get: vi.fn(),
        },
        Teachers: {
          list: vi.fn(),
        },
        Students: {
          list: vi.fn(),
        },
      },
    };

    const teacherExport = require('../../src/backend/Models/Teacher.js');
    globalThis.Teacher = teacherExport.Teacher || teacherExport;

    const studentExport = require('../../src/backend/Models/Student.js');
    globalThis.Student = studentExport.Student || studentExport;

    delete require.cache[require.resolve(modulePath)];
    const exported = require(modulePath);
    ClassroomApiClient = exported.ClassroomApiClient || exported;
  });

  afterEach(() => {
    globalThis.ProgressTracker.getInstance = originalProgressTrackerGetInstance;
    globalThis.ABLogger = originalABLogger;
    globalThis.Classroom = originalClassroom;
    globalThis.Teacher = originalTeacher;
    globalThis.Student = originalStudent;
    vi.restoreAllMocks();
  });

  it('does not expose mutating methods', () => {
    expect(ClassroomApiClient.createClassroom).toBeUndefined();
    expect(ClassroomApiClient.updateClassroom).toBeUndefined();
    expect(ClassroomApiClient.inviteTeacher).toBeUndefined();
  });

  it('fetchClassrooms returns active courses', () => {
    const courses = [{ id: 'course-1', name: 'Maths' }];
    globalThis.Classroom.Courses.list.mockReturnValue({ courses });

    const result = ClassroomApiClient.fetchClassrooms();

    expect(globalThis.Classroom.Courses.list).toHaveBeenCalledWith({
      teacherId: 'me',
      courseStates: ['ACTIVE'],
    });
    expect(result).toEqual(courses);
  });

  it('fetchAllActiveClassrooms maps paginated responses', () => {
    globalThis.Classroom.Courses.list
      .mockReturnValueOnce({
        courses: [{ id: 'course-1', name: 'Maths', enrollmentCode: 'A1' }],
        nextPageToken: 'next-page',
      })
      .mockReturnValueOnce({
        courses: [{ id: 'course-2', name: 'English', enrollmentCode: 'B2' }],
      });

    const result = ClassroomApiClient.fetchAllActiveClassrooms();

    expect(globalThis.Classroom.Courses.list).toHaveBeenNthCalledWith(1, {
      pageToken: undefined,
      courseStates: ['ACTIVE'],
    });
    expect(globalThis.Classroom.Courses.list).toHaveBeenNthCalledWith(2, {
      pageToken: 'next-page',
      courseStates: ['ACTIVE'],
    });
    expect(result).toEqual([
      { id: 'course-1', name: 'Maths', enrollmentCode: 'A1' },
      { id: 'course-2', name: 'English', enrollmentCode: 'B2' },
    ]);
    expect(abLoggerInstance.info).toHaveBeenCalledWith('Active classrooms retrieved', {
      count: 2,
    });
  });

  it('fetchAllActiveClassrooms returns [] and logs when Classroom API throws', () => {
    const apiError = new Error('API failure');
    globalThis.Classroom.Courses.list.mockImplementation(() => {
      throw apiError;
    });

    const result = ClassroomApiClient.fetchAllActiveClassrooms();

    expect(result).toEqual([]);
    expect(progressTrackerInstance.logError).toHaveBeenCalledTimes(1);
  });

  it('fetchCourse returns a course when found', () => {
    const course = { id: 'course-123', name: 'Physics' };
    globalThis.Classroom.Courses.get.mockReturnValue(course);

    const result = ClassroomApiClient.fetchCourse('course-123');

    expect(result).toEqual(course);
  });

  it('fetchCourse returns null and logs when lookup fails', () => {
    globalThis.Classroom.Courses.get.mockImplementation(() => {
      throw new Error('Not found');
    });

    const result = ClassroomApiClient.fetchCourse('missing-course');

    expect(result).toBeNull();
    expect(progressTrackerInstance.logError).toHaveBeenCalledTimes(1);
  });

  it('fetchTopicName returns topic name', () => {
    globalThis.Classroom.Courses.Topics.get.mockReturnValue({ name: 'Homework' });

    const result = ClassroomApiClient.fetchTopicName('course-1', 'topic-1');

    expect(result).toBe('Homework');
  });

  it('fetchTopicName throws when required params are missing', () => {
    expect(() => ClassroomApiClient.fetchTopicName('', 'topic-1')).toThrow(
      'courseId and topicId are required to fetch topic name.'
    );
  });

  it('fetchTeachers maps API teachers into Teacher model instances', () => {
    globalThis.Classroom.Courses.Teachers.list.mockReturnValue({
      teachers: [
        {
          profile: {
            id: 'teacher-1',
            emailAddress: 'teacher1@example.com',
            name: { fullName: 'Teacher One' },
          },
        },
      ],
    });

    const result = ClassroomApiClient.fetchTeachers('course-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(globalThis.Teacher);
    expect(result[0].email).toBe('teacher1@example.com');
    expect(result[0].teacherName).toBe('Teacher One');
    expect(result[0].userId).toBe('teacher-1');
  });

  it('fetchAllStudents maps paginated API responses into Student model instances', () => {
    globalThis.Classroom.Courses.Students.list
      .mockReturnValueOnce({
        students: [
          {
            profile: {
              id: 'student-1',
              name: { fullName: 'Student One' },
              emailAddress: 'student1@example.com',
            },
          },
        ],
        nextPageToken: 'next',
      })
      .mockReturnValueOnce({
        students: [
          {
            profile: {
              id: 'student-2',
              name: { fullName: 'Student Two' },
              emailAddress: 'student2@example.com',
            },
          },
        ],
      });

    const result = ClassroomApiClient.fetchAllStudents('course-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(globalThis.Student);
    expect(result[0].name).toBe('Student One');
    expect(result[1].id).toBe('student-2');
  });
});

describe('ClassroomApiClient.fetchCourseUpdateTime', () => {
  let ClassroomApiClient;
  let abLoggerErrorSpy;
  let originalABLogger;
  let originalClassroom;

  beforeEach(() => {
    originalABLogger = globalThis.ABLogger;
    originalClassroom = globalThis.Classroom;

    const abLoggerInstance = {
      error: vi.fn(),
    };
    const getInstanceSpy = vi.fn(() => abLoggerInstance);
    globalThis.ABLogger = { getInstance: getInstanceSpy };
    abLoggerErrorSpy = abLoggerInstance.error;

    globalThis.Classroom = {
      Courses: {
        get: vi.fn(),
      },
    };

    delete require.cache[require.resolve(modulePath)];
    const exported = require(modulePath);
    ClassroomApiClient = exported.ClassroomApiClient || exported;
  });

  afterEach(() => {
    globalThis.Classroom = originalClassroom;
    globalThis.ABLogger = originalABLogger;
    vi.restoreAllMocks();
  });

  it('returns a Date when updateTime is present and valid', () => {
    const updateTime = '2023-10-01T12:30:45.123Z';
    globalThis.Classroom.Courses.get.mockReturnValue({ updateTime });

    const result = ClassroomApiClient.fetchCourseUpdateTime('course-123');

    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(updateTime);
    expect(abLoggerErrorSpy).not.toHaveBeenCalled();
  });

  it('returns null and logs error when updateTime is missing', () => {
    globalThis.Classroom.Courses.get.mockReturnValue({});

    const result = ClassroomApiClient.fetchCourseUpdateTime('course-456');

    expect(result).toBeNull();
    expect(abLoggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(abLoggerErrorSpy).toHaveBeenCalledWith('Course updateTime not present', {
      courseId: 'course-456',
    });
  });

  it('returns null and logs error when updateTime is invalid', () => {
    const invalidTimestamp = 'not-a-valid-timestamp';
    globalThis.Classroom.Courses.get.mockReturnValue({ updateTime: invalidTimestamp });

    const result = ClassroomApiClient.fetchCourseUpdateTime('course-789');

    expect(result).toBeNull();
    expect(abLoggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(abLoggerErrorSpy).toHaveBeenCalledWith('Invalid course updateTime format', {
      courseId: 'course-789',
      updateTime: invalidTimestamp,
    });
  });

  it('returns null and logs error when Classroom API throws', () => {
    const apiError = new Error('API failure');
    globalThis.Classroom.Courses.get.mockImplementation(() => {
      throw apiError;
    });

    const result = ClassroomApiClient.fetchCourseUpdateTime('course-999');

    expect(result).toBeNull();
    expect(abLoggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(abLoggerErrorSpy).toHaveBeenCalledWith('Failed to fetch course updateTime', {
      courseId: 'course-999',
      error: apiError.message,
    });
  });
});
