import { afterEach, describe, expect, it, vi } from 'vitest';

const googleClassroomAssignmentsModulePath =
  '../../src/backend/z_Api/googleClassroomAssignments.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');
const originalClassroomApiClient = globalThis.ClassroomApiClient;

function clearGoogleClassroomAssignmentsModuleCache() {
  delete require.cache[require.resolve(googleClassroomAssignmentsModulePath)];
}

function loadGoogleClassroomAssignmentsModuleWithGlobals({ classroomApiClient } = {}) {
  clearGoogleClassroomAssignmentsModuleCache();
  globalThis.ClassroomApiClient = classroomApiClient;
  return require(googleClassroomAssignmentsModulePath);
}

afterEach(() => {
  clearGoogleClassroomAssignmentsModuleCache();
  if (originalClassroomApiClient === undefined) {
    delete globalThis.ClassroomApiClient;
  } else {
    globalThis.ClassroomApiClient = originalClassroomApiClient;
  }
  vi.restoreAllMocks();
});

describe('Api/googleClassroomAssignments exports', () => {
  it('exports getGoogleClassroomAssignments_ in Node test runtime', () => {
    const googleClassroomAssignmentsModule = require('../../src/backend/z_Api/googleClassroomAssignments.js');

    expect(googleClassroomAssignmentsModule).toEqual(
      expect.objectContaining({
        getGoogleClassroomAssignments_: expect.any(Function),
      })
    );
  });
});

describe('Api/getGoogleClassroomAssignments direct handler', () => {
  it('returns mapped assignment list for a valid classId, excluding updateTime', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => [
          {
            id: 'a1',
            title: 'Essay',
            updateTime: '2024-01-01T00:00:00.000Z',
          },
        ]),
        fetchTopicName: vi.fn(),
      },
    });

    const result = getGoogleClassroomAssignments_({ classId: 'course-001' });

    expect(result).toEqual([
      { assignmentId: 'a1', title: 'Essay', topicId: null, topicName: null },
    ]);
  });

  it('returns an empty array when the course has no assignments', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => []),
        fetchTopicName: vi.fn(),
      },
    });

    const result = getGoogleClassroomAssignments_({ classId: '123' });

    expect(result).toEqual([]);
  });

  it('throws ApiValidationError when classId is missing from params', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => []),
        fetchTopicName: vi.fn(),
      },
    });

    expect(() => getGoogleClassroomAssignments_({})).toThrow(ApiValidationError);
  });

  it('throws ApiValidationError when classId is an empty string', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => []),
        fetchTopicName: vi.fn(),
      },
    });

    expect(() => getGoogleClassroomAssignments_({ classId: '' })).toThrow(ApiValidationError);
  });

  it('throws ApiValidationError when classId contains a forward slash', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => []),
        fetchTopicName: vi.fn(),
      },
    });

    expect(() => getGoogleClassroomAssignments_({ classId: 'foo/bar' })).toThrow(
      ApiValidationError
    );
  });

  it('throws ApiValidationError when classId contains double dot traversal', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => []),
        fetchTopicName: vi.fn(),
      },
    });

    expect(() => getGoogleClassroomAssignments_({ classId: 'foo..bar' })).toThrow(
      ApiValidationError
    );
  });

  it.each([
    ['an array', []],
    ['null', null],
    ['a string', 'not-an-object'],
  ])('throws ApiValidationError when params is %s', (_label, params) => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => []),
        fetchTopicName: vi.fn(),
      },
    });

    expect(() => getGoogleClassroomAssignments_(params)).toThrow(ApiValidationError);
  });

  it('throws ApiValidationError when a Classroom row is missing id', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => [{ title: 'Essay', updateTime: '2024-01-01T00:00:00.000Z' }]),
        fetchTopicName: vi.fn(),
      },
    });

    expect(() => getGoogleClassroomAssignments_({ classId: 'course-001' })).toThrow(
      ApiValidationError
    );
  });

  it('throws ApiValidationError when a Classroom row is missing title', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => [{ id: 'a1', updateTime: '2024-01-01T00:00:00.000Z' }]),
        fetchTopicName: vi.fn(),
      },
    });

    expect(() => getGoogleClassroomAssignments_({ classId: 'course-001' })).toThrow(
      ApiValidationError
    );
  });

  it('propagates errors thrown by ClassroomApiClient.fetchCourseWork', () => {
    const apiFailure = new Error('API failure');
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => {
          throw apiFailure;
        }),
        fetchTopicName: vi.fn(),
      },
    });

    expect(() => getGoogleClassroomAssignments_({ classId: 'course-001' })).toThrow('API failure');
  });

  describe('topicName resolution', () => {
    it('returns resolved topicName when topicId is non-null', () => {
      const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
        classroomApiClient: {
          fetchCourseWork: vi.fn(() => [
            {
              id: 'a1',
              title: 'Essay',
              topicId: 'topic-1',
              updateTime: '2024-01-01T00:00:00.000Z',
            },
          ]),
          fetchTopicName: vi.fn(() => 'Algebra'),
        },
      });

      const result = getGoogleClassroomAssignments_({ classId: 'course-001' });

      expect(result).toEqual([
        { assignmentId: 'a1', title: 'Essay', topicId: 'topic-1', topicName: 'Algebra' },
      ]);
    });

    it('returns topicName as null when topicId is null', () => {
      const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
        classroomApiClient: {
          fetchCourseWork: vi.fn(() => [
            {
              id: 'a1',
              title: 'Essay',
              topicId: null,
              updateTime: '2024-01-01T00:00:00.000Z',
            },
          ]),
          fetchTopicName: vi.fn(),
        },
      });

      const result = getGoogleClassroomAssignments_({ classId: 'course-001' });

      expect(result).toEqual([
        { assignmentId: 'a1', title: 'Essay', topicId: null, topicName: null },
      ]);
    });

    it('calls fetchTopicName only for non-null topicId values', () => {
      const fetchTopicName = vi.fn((_classId, topicId) => `Topic-${topicId}`);
      const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
        classroomApiClient: {
          fetchCourseWork: vi.fn(() => [
            {
              id: 'a1',
              title: 'Has Topic',
              topicId: 'topic-1',
              updateTime: '2024-01-01T00:00:00.000Z',
            },
            { id: 'a2', title: 'No Topic', topicId: null, updateTime: '2024-01-01T00:00:00.000Z' },
            {
              id: 'a3',
              title: 'Also Has Topic',
              topicId: 'topic-2',
              updateTime: '2024-01-01T00:00:00.000Z',
            },
          ]),
          fetchTopicName,
        },
      });

      const result = getGoogleClassroomAssignments_({ classId: 'course-001' });

      expect(fetchTopicName).toHaveBeenCalledTimes(2);
      expect(fetchTopicName).toHaveBeenCalledWith('course-001', 'topic-1');
      expect(fetchTopicName).toHaveBeenCalledWith('course-001', 'topic-2');
      expect(result).toHaveLength(3);
      expect(result[0].topicName).toBe('Topic-topic-1');
      expect(result[1].topicName).toBeNull();
      expect(result[2].topicName).toBe('Topic-topic-2');
    });

    it('sets topicName to null when fetchTopicName returns null', () => {
      const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
        classroomApiClient: {
          fetchCourseWork: vi.fn(() => [
            {
              id: 'a1',
              title: 'Essay',
              topicId: 'topic-1',
              updateTime: '2024-01-01T00:00:00.000Z',
            },
          ]),
          fetchTopicName: vi.fn(() => null),
        },
      });

      const result = getGoogleClassroomAssignments_({ classId: 'course-001' });

      expect(result).toEqual([
        { assignmentId: 'a1', title: 'Essay', topicId: 'topic-1', topicName: null },
      ]);
    });

    it('propagates errors thrown by fetchTopicName (fail-fast)', () => {
      const topicError = new Error('Topic fetch failure');
      const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
        classroomApiClient: {
          fetchCourseWork: vi.fn(() => [
            {
              id: 'a1',
              title: 'Essay',
              topicId: 'topic-1',
              updateTime: '2024-01-01T00:00:00.000Z',
            },
          ]),
          fetchTopicName: vi.fn(() => {
            throw topicError;
          }),
        },
      });

      expect(() => getGoogleClassroomAssignments_({ classId: 'course-001' })).toThrow(
        'Topic fetch failure'
      );
    });

    it('malformed record validation still applies when topicId is present', () => {
      const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
        classroomApiClient: {
          fetchCourseWork: vi.fn(() => [
            {
              title: 'Missing Id',
              topicId: 'topic-1',
              updateTime: '2024-01-01T00:00:00.000Z',
            },
          ]),
          fetchTopicName: vi.fn(),
        },
      });

      expect(() => getGoogleClassroomAssignments_({ classId: 'course-001' })).toThrow(
        ApiValidationError
      );
    });

    it('response shape includes all four fields (assignmentId, title, topicId, topicName)', () => {
      const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
        classroomApiClient: {
          fetchCourseWork: vi.fn(() => [
            {
              id: 'a1',
              title: 'Essay',
              topicId: 'topic-1',
              updateTime: '2024-01-01T00:00:00.000Z',
            },
          ]),
          fetchTopicName: vi.fn(() => 'Algebra'),
        },
      });

      const result = getGoogleClassroomAssignments_({ classId: 'course-001' });

      expect(result).toHaveLength(1);
      expect(Object.keys(result[0]).sort()).toEqual(
        ['assignmentId', 'title', 'topicId', 'topicName'].sort()
      );
    });
  });
});
