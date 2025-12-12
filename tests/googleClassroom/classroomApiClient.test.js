import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

if (!globalThis.ProgressTracker) {
  throw new Error('ProgressTracker mock expected from setupGlobals.js');
}

const modulePath = '../../src/AdminSheet/GoogleClassroom/ClassroomApiClient.js';

describe('ClassroomApiClient.fetchCourseUpdateTime', () => {
  let ClassroomApiClient;
  let abLoggerErrorSpy;

  beforeEach(() => {
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
    delete globalThis.Classroom;
    delete globalThis.ABLogger;
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
