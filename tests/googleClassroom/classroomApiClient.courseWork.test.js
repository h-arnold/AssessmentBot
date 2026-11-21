import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  assertProgressTrackerMockAvailable,
  createClassroomApiClientHarness,
} from './classroomApiClientTestHelpers.js';

assertProgressTrackerMockAvailable();

describe('ClassroomApiClient.fetchCourseWork', () => {
  const harness = createClassroomApiClientHarness({
    classroomFactory: () => ({
      Courses: {
        CourseWork: {
          list: vi.fn(),
        },
      },
    }),
    installProgressTracker: true,
    withInfoLogger: true,
  });

  let ClassroomApiClient;
  let abLoggerInstance;

  beforeEach(() => {
    ClassroomApiClient = harness.ClassroomApiClient;
    abLoggerInstance = harness.abLoggerInstance;
  });

  it('fetchCourseWork returns sorted assignments for a course with multiple assignments', () => {
    const courseId = 'course-1';
    const olderDate = '2020-09-30T10:00:00.000Z';
    const newerDate = '2023-10-01T12:30:45.123Z';
    const middleDate = '2022-01-15T08:00:00.000Z';
    const olderCreated = '2020-09-29T10:00:00.000Z';
    const newerCreated = '2023-09-30T12:30:45.123Z';
    const middleCreated = '2022-01-14T08:00:00.000Z';

    globalThis.Classroom.Courses.CourseWork.list.mockReturnValue({
      courseWork: [
        { id: 'cw-1', title: 'Assignment A', updateTime: olderDate, creationTime: olderCreated },
        { id: 'cw-2', title: 'Assignment B', updateTime: newerDate, creationTime: newerCreated },
        { id: 'cw-3', title: 'Assignment C', updateTime: middleDate, creationTime: middleCreated },
      ],
    });

    const result = ClassroomApiClient.fetchCourseWork(courseId);

    expect(globalThis.Classroom.Courses.CourseWork.list).toHaveBeenCalledWith(courseId);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      id: 'cw-2',
      title: 'Assignment B',
      updateTime: newerDate,
      creationTime: newerCreated,
      topicId: null,
    });
    expect(result[1]).toEqual({
      id: 'cw-3',
      title: 'Assignment C',
      updateTime: middleDate,
      creationTime: middleCreated,
      topicId: null,
    });
    expect(result[2]).toEqual({
      id: 'cw-1',
      title: 'Assignment A',
      updateTime: olderDate,
      creationTime: olderCreated,
      topicId: null,
    });
    expect(abLoggerInstance.info).toHaveBeenCalledWith('Fetched coursework for course.', {
      courseId,
      count: 3,
    });
  });

  it('fetchCourseWork returns empty array for a course with no assignments', () => {
    const courseId = 'course-2';

    globalThis.Classroom.Courses.CourseWork.list.mockReturnValue({});

    const result = ClassroomApiClient.fetchCourseWork(courseId);

    expect(result).toEqual([]);
    expect(abLoggerInstance.info).toHaveBeenCalledWith('Fetched coursework for course.', {
      courseId,
      count: 0,
    });
  });

  it('fetchCourseWork throws when Classroom.Courses.CourseWork.list throws', () => {
    const courseId = 'course-3';
    const apiError = new Error('API failure');

    globalThis.Classroom.Courses.CourseWork.list.mockImplementation(() => {
      throw apiError;
    });

    expect(() => ClassroomApiClient.fetchCourseWork(courseId)).toThrow();
    expect(abLoggerInstance.error).toHaveBeenCalledTimes(1);
    expect(abLoggerInstance.error).toHaveBeenCalledWith(
      'Failed to fetch coursework for course.',
      expect.objectContaining({
        courseId,
        error: apiError.message,
      })
    );
  });

  it('fetchCourseWork paginates correctly when nextPageToken is present', () => {
    const courseId = 'course-4';
    const page1Assignments = [
      {
        id: 'cw-a',
        title: 'Page 1 Assignment',
        updateTime: '2023-01-01T00:00:00.000Z',
        creationTime: '2023-01-01T00:00:00.000Z',
      },
    ];
    const page2Assignments = [
      {
        id: 'cw-b',
        title: 'Page 2 Assignment',
        updateTime: '2023-06-01T00:00:00.000Z',
        creationTime: '2023-06-01T00:00:00.000Z',
      },
    ];

    globalThis.Classroom.Courses.CourseWork.list
      .mockReturnValueOnce({
        courseWork: page1Assignments,
        nextPageToken: 'next-page-token',
      })
      .mockReturnValueOnce({
        courseWork: page2Assignments,
      });

    const result = ClassroomApiClient.fetchCourseWork(courseId);

    expect(globalThis.Classroom.Courses.CourseWork.list).toHaveBeenCalledTimes(2);
    expect(globalThis.Classroom.Courses.CourseWork.list).toHaveBeenNthCalledWith(1, courseId);
    expect(globalThis.Classroom.Courses.CourseWork.list).toHaveBeenNthCalledWith(2, courseId, {
      pageToken: 'next-page-token',
    });
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      {
        id: 'cw-b',
        title: 'Page 2 Assignment',
        updateTime: '2023-06-01T00:00:00.000Z',
        creationTime: '2023-06-01T00:00:00.000Z',
        topicId: null,
      },
      {
        id: 'cw-a',
        title: 'Page 1 Assignment',
        updateTime: '2023-01-01T00:00:00.000Z',
        creationTime: '2023-01-01T00:00:00.000Z',
        topicId: null,
      },
    ]);
    expect(abLoggerInstance.info).toHaveBeenCalledWith('Fetched coursework for course.', {
      courseId,
      count: 2,
    });
  });

  it('fetchCourseWork includes topicId when present on the Classroom API response', () => {
    const courseId = 'course-5';
    const updateDate = '2023-10-01T12:30:45.123Z';

    globalThis.Classroom.Courses.CourseWork.list.mockReturnValue({
      courseWork: [
        {
          id: 'cw-1',
          title: 'Assignment A',
          updateTime: updateDate,
          creationTime: updateDate,
          topicId: 'topic-1',
        },
      ],
    });

    const result = ClassroomApiClient.fetchCourseWork(courseId);

    expect(result[0]).toEqual({
      id: 'cw-1',
      title: 'Assignment A',
      updateTime: updateDate,
      creationTime: updateDate,
      topicId: 'topic-1',
    });
  });

  it('fetchCourseWork returns topicId: null when cw.topicId is undefined or null', () => {
    const courseId = 'course-6';
    const updateDate = '2023-10-01T12:30:45.123Z';

    globalThis.Classroom.Courses.CourseWork.list.mockReturnValue({
      courseWork: [
        { id: 'cw-1', title: 'Undefined Topic', updateTime: updateDate, creationTime: updateDate },
        {
          id: 'cw-2',
          title: 'Null Topic',
          updateTime: updateDate,
          creationTime: updateDate,
          topicId: null,
        },
      ],
    });

    const result = ClassroomApiClient.fetchCourseWork(courseId);

    expect(result[0].topicId).toBeNull();
    expect(result[1].topicId).toBeNull();
  });
});
