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
      },
    });

    const result = getGoogleClassroomAssignments_({ classId: 'course-001' });

    expect(result).toEqual([{ assignmentId: 'a1', title: 'Essay' }]);
  });

  it('returns an empty array when the course has no assignments', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => []),
      },
    });

    const result = getGoogleClassroomAssignments_({ classId: '123' });

    expect(result).toEqual([]);
  });

  it('throws ApiValidationError when classId is missing from params', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => []),
      },
    });

    expect(() => getGoogleClassroomAssignments_({})).toThrow(ApiValidationError);
  });

  it('throws ApiValidationError when classId is an empty string', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => []),
      },
    });

    expect(() => getGoogleClassroomAssignments_({ classId: '' })).toThrow(ApiValidationError);
  });

  it('throws ApiValidationError when classId contains a forward slash', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => []),
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
      },
    });

    expect(() => getGoogleClassroomAssignments_(params)).toThrow(ApiValidationError);
  });

  it('throws ApiValidationError when a Classroom row is missing id', () => {
    const { getGoogleClassroomAssignments_ } = loadGoogleClassroomAssignmentsModuleWithGlobals({
      classroomApiClient: {
        fetchCourseWork: vi.fn(() => [{ title: 'Essay', updateTime: '2024-01-01T00:00:00.000Z' }]),
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
      },
    });

    expect(() => getGoogleClassroomAssignments_({ classId: 'course-001' })).toThrow('API failure');
  });
});
