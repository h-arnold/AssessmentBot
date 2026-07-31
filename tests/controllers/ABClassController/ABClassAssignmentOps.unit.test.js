import { describe, expect, it } from 'vitest';

const MODULE_PATH = '../../../src/backend/y_controllers/ABClassController/ABClassAssignmentOps';

describe('ABClassAssignmentOps sub-class', () => {
  it('is available in GREEN phase (module exists)', () => {
    expect(() => require(MODULE_PATH)).not.toThrow();
  });

  it('is exported as a class (GREEN phase)', () => {
    const ABClassAssignmentOps = require(MODULE_PATH);
    expect(typeof ABClassAssignmentOps).toBe('function');
  });

  it('constructs an instance with options (GREEN phase)', () => {
    const ABClassAssignmentOps = require(MODULE_PATH);
    const mockDbManager = {};
    const mockValidation = {};
    const mockPersistence = {};
    const instance = new ABClassAssignmentOps({
      dbManager: mockDbManager,
      validation: mockValidation,
      persistence: mockPersistence,
    });
    expect(instance).toBeInstanceOf(ABClassAssignmentOps);
  });

  describe('methods (GREEN phase)', () => {
    const expectedMethods = [
      '_loadFullAssignmentDocument',
      '_validateAssignmentDocument',
      '_ensureFullDefinition',
      '_getFullAssignmentCollectionName',
      'persistAssignmentRun',
    ];

    expectedMethods.forEach((methodName) => {
      it(`has method ${methodName}`, () => {
        const ABClassAssignmentOps = require(MODULE_PATH);
        const instance = new ABClassAssignmentOps({
          dbManager: {},
          validation: {},
          persistence: {},
        });
        expect(typeof instance[methodName]).toBe('function');
      });
    });
  });

  describe('persistAssignmentRun partial guard', () => {
    it('should throw TypeError when assignmentDefinition.tasks is an array (partial)', () => {
      const ABClassAssignmentOps = require(MODULE_PATH);
      const instance = new ABClassAssignmentOps({
        dbManager: {},
        validation: {},
        persistence: {},
      });

      const abClass = { classId: 'class-1' };
      const assignment = {
        courseId: 'c-1',
        assignmentId: 'a-1',
        assignmentDefinition: { tasks: [] },
      };

      expect(() => instance.persistAssignmentRun(abClass, assignment)).toThrow(TypeError);
    });

    it('should NOT throw partial-guard TypeError when assignmentDefinition.tasks is an object (full)', () => {
      const ABClassAssignmentOps = require(MODULE_PATH);
      const instance = new ABClassAssignmentOps({
        dbManager: {},
        validation: {},
        persistence: {},
      });

      const abClass = { classId: 'class-1' };
      const assignment = {
        courseId: 'c-1',
        assignmentId: 'a-1',
        assignmentDefinition: { tasks: { t1: { taskTitle: 'X' } } },
      };

      let thrown;
      try {
        instance.persistAssignmentRun(abClass, assignment);
      } catch (err) {
        thrown = err;
      }

      // The guard should have passed; if an error is thrown further down the
      // method (due to missing mocks), it must not be the partial-guard TypeError
      if (thrown) {
        const isPartialGuardError =
          thrown instanceof TypeError && thrown.message.includes('partial assignmentDefinition');
        expect(isPartialGuardError).toBe(false);
      }
    });
  });
});
