import { describe, expect, it, vi } from 'vitest';
import { withGlobalMocks } from '../../helpers/globalMockManager.js';

const MODULE_PATH = '../../../src/backend/y_controllers/ABClassController/ABClassRoster';
const { ABClass: RealABClass } = require('../../../src/backend/Models/ABClass');

describe('ABClassRoster sub-class', () => {
  it('is available in GREEN phase (module exists)', () => {
    expect(() => require(MODULE_PATH)).not.toThrow();
  });

  it('is exported as a class (GREEN phase)', () => {
    const ABClassRoster = require(MODULE_PATH);
    expect(typeof ABClassRoster).toBe('function');
  });

  it('constructs an instance with options (GREEN phase)', () => {
    const ABClassRoster = require(MODULE_PATH);
    const mockDbManager = {};
    const mockValidation = {};
    const mockPersistence = {};
    const instance = new ABClassRoster({
      dbManager: mockDbManager,
      validation: mockValidation,
      persistence: mockPersistence,
    });
    expect(instance).toBeInstanceOf(ABClassRoster);
  });

  describe('methods (GREEN phase)', () => {
    const expectedMethods = [
      '_applyCourseMetadata',
      '_applyTeachers',
      '_applyStudents',
      '_buildClassroomRosterUpdatePayload',
      '_refreshRoster',
      '_persistRoster',
      'initialise',
    ];

    expectedMethods.forEach((methodName) => {
      it(`has method ${methodName}`, () => {
        const ABClassRoster = require(MODULE_PATH);
        const instance = new ABClassRoster({
          dbManager: {},
          validation: {},
          persistence: {},
        });
        expect(typeof instance[methodName]).toBe('function');
      });
    });
  });

  it('retains the existing course length when an unsafe update cannot be parsed', () => {
    const ABClassRoster = require(MODULE_PATH);
    class ExistingClassState {
      constructor() {
        this.courseLength = 4;
        this.assignments = [];
      }

      static _parseNullableInt(value, defaultValue) {
        return RealABClass._parseNullableInt(value, defaultValue);
      }

      addAssignment() {}
    }
    const restore = withGlobalMocks({
      ABClass: () => ExistingClassState,
      ClassroomApiClient: () => ({
        fetchCourse: vi.fn(() => ({})),
        fetchTeachers: vi.fn(() => []),
        fetchAllStudents: vi.fn(() => []),
      }),
    }).restore;
    try {
      const roster = new ABClassRoster({ dbManager: {}, validation: {}, persistence: {} });
      const updated = roster.initialise('course-unsafe', {
        courseLength: Number.MAX_SAFE_INTEGER + 1,
      });
      expect(updated.courseLength).toBe(4);

      expect(roster.initialise('course-safe', { courseLength: 6 }).courseLength).toBe(6);
      expect(roster.initialise('course-prefix', { courseLength: '7 years' }).courseLength).toBe(7);
      expect(roster.initialise('course-fractional', { courseLength: 8.5 }).courseLength).toBe(8);
    } finally {
      restore();
    }
  });
});
