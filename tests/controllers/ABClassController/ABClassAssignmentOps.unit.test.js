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
      '_replaceAssignmentInClass',
      '_getFullAssignmentCollectionName',
      'persistAssignmentRun',
      'rehydrateAssignment',
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
});
