import { describe, expect, it } from 'vitest';

const MODULE_PATH = '../../../src/backend/y_controllers/ABClassController/ABClassRoster';

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
});
