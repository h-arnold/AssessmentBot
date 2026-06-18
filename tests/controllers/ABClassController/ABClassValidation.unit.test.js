import { describe, expect, it } from 'vitest';

const MODULE_PATH = '../../../src/backend/y_controllers/ABClassController/ABClassValidation';

describe('ABClassValidation sub-class', () => {
  it('is available in GREEN phase (module exists)', () => {
    expect(() => require(MODULE_PATH)).not.toThrow();
  });

  it('is exported as a class (GREEN phase)', () => {
    const ABClassValidation = require(MODULE_PATH);
    expect(typeof ABClassValidation).toBe('function');
  });

  it('constructs an instance without options (GREEN phase)', () => {
    const ABClassValidation = require(MODULE_PATH);
    const instance = new ABClassValidation();
    expect(instance).toBeInstanceOf(ABClassValidation);
  });

  describe('methods (GREEN phase)', () => {
    const expectedMethods = [
      '_validateClassId',
      '_validateDeleteClassId',
      '_isMissingCollectionError',
      '_validateCourseLength',
      '_buildUpdatePatch',
      '_applyPatchToClass',
    ];

    expectedMethods.forEach((methodName) => {
      it(`has method ${methodName}`, () => {
        const ABClassValidation = require(MODULE_PATH);
        const instance = new ABClassValidation();
        expect(typeof instance[methodName]).toBe('function');
      });
    });
  });
});
