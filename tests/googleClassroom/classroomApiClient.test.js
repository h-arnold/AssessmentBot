import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  assertProgressTrackerMockAvailable,
  createClassroomApiClientHarness,
} from './classroomApiClientTestHelpers.js';

assertProgressTrackerMockAvailable();

describe('ClassroomApiClient (read-only methods)', () => {
  const harness = createClassroomApiClientHarness({
    classroomFactory: () => ({
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
    }),
    installProgressTracker: true,
    installTeacherAndStudent: true,
    withInfoLogger: true,
  });

  let ClassroomApiClient;
  let progressTrackerInstance;
  let abLoggerInstance;

  beforeEach(() => {
    ClassroomApiClient = harness.ClassroomApiClient;
    progressTrackerInstance = harness.progressTrackerInstance;
    abLoggerInstance = harness.abLoggerInstance;
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
