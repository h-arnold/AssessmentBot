import { afterEach, describe, expect, it, vi } from 'vitest';

const googleClassroomsModulePath = '../../src/backend/z_Api/googleClassrooms.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');
const originalClassroomApiClient = globalThis.ClassroomApiClient;

function clearGoogleClassroomsModuleCache() {
  delete require.cache[require.resolve(googleClassroomsModulePath)];
}

function loadGoogleClassroomsModuleWithGlobals({ classroomApiClient } = {}) {
  clearGoogleClassroomsModuleCache();
  globalThis.ClassroomApiClient = classroomApiClient;
  return require(googleClassroomsModulePath);
}

afterEach(() => {
  clearGoogleClassroomsModuleCache();
  if (originalClassroomApiClient === undefined) {
    delete globalThis.ClassroomApiClient;
  } else {
    globalThis.ClassroomApiClient = originalClassroomApiClient;
  }
  vi.restoreAllMocks();
});

describe('Api/googleClassrooms exports', () => {
  it('exports getGoogleClassrooms in Node test runtime', () => {
    const googleClassroomsModule = require('../../src/backend/z_Api/googleClassrooms.js');

    expect(googleClassroomsModule).toEqual(
      expect.objectContaining({
        getGoogleClassrooms: expect.any(Function),
      })
    );
  });
});

describe('Api/getGoogleClassrooms direct handler', () => {
  it('delegates to ClassroomApiClient.fetchAllActiveClassrooms and leaves params unused', () => {
    const fetchAllActiveClassrooms = vi.fn(() => []);
    const { getGoogleClassrooms } = loadGoogleClassroomsModuleWithGlobals({
      classroomApiClient: { fetchAllActiveClassrooms },
    });

    getGoogleClassrooms({ includeArchived: true });

    expect(fetchAllActiveClassrooms).toHaveBeenCalledTimes(1);
    expect(fetchAllActiveClassrooms).toHaveBeenCalledWith();
  });

  it('maps Classroom records from id and name to classId and className', () => {
    const { getGoogleClassrooms } = loadGoogleClassroomsModuleWithGlobals({
      classroomApiClient: {
        fetchAllActiveClassrooms: vi.fn(() => [{ id: 'course-001', name: '10A Computer Science' }]),
      },
    });

    const result = getGoogleClassrooms();

    expect(result).toEqual([{ classId: 'course-001', className: '10A Computer Science' }]);
  });

  it('strips non-contract fields such as enrollmentCode from classroom summaries', () => {
    const { getGoogleClassrooms } = loadGoogleClassroomsModuleWithGlobals({
      classroomApiClient: {
        fetchAllActiveClassrooms: vi.fn(() => [
          {
            id: 'course-001',
            name: '10A Computer Science',
            enrollmentCode: 'ABC123',
            teachers: [{ name: 'Teacher One' }],
            students: [{ name: 'Student One' }],
            classOwner: 'teacher-001',
          },
        ]),
      },
    });

    const result = getGoogleClassrooms();

    expect(result).toEqual([{ classId: 'course-001', className: '10A Computer Science' }]);
    expect(result[0]).not.toHaveProperty('enrollmentCode');
    expect(result[0]).not.toHaveProperty('teachers');
    expect(result[0]).not.toHaveProperty('students');
    expect(result[0]).not.toHaveProperty('classOwner');
  });

  it('returns an empty array when the classroom client returns no classrooms', () => {
    const { getGoogleClassrooms } = loadGoogleClassroomsModuleWithGlobals({
      classroomApiClient: { fetchAllActiveClassrooms: vi.fn(() => []) },
    });

    const result = getGoogleClassrooms();

    expect(result).toEqual([]);
  });

  it('throws ApiValidationError when a classroom record is malformed and not an object', () => {
    const { getGoogleClassrooms } = loadGoogleClassroomsModuleWithGlobals({
      classroomApiClient: { fetchAllActiveClassrooms: vi.fn(() => [null]) },
    });

    expect(() => getGoogleClassrooms()).toThrow(ApiValidationError);
  });

  it.each([
    ['id', { name: '10A Computer Science' }],
    ['name', { id: 'course-001' }],
  ])('throws ApiValidationError when a classroom record is missing %s', (_fieldName, record) => {
    const { getGoogleClassrooms } = loadGoogleClassroomsModuleWithGlobals({
      classroomApiClient: { fetchAllActiveClassrooms: vi.fn(() => [record]) },
    });

    expect(() => getGoogleClassrooms()).toThrow(ApiValidationError);
  });
});
