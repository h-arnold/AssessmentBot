import { describe, expect, it } from 'vitest';
import { ABClass } from '../../../src/backend/Models/ABClass.js';

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

  it('requires safe positive course-length integers while accepting the safe upper boundary', () => {
    const ABClassValidation = require(MODULE_PATH);
    const validation = new ABClassValidation();
    expect(validation._validateCourseLength(Number.MAX_SAFE_INTEGER, 'updateABClass')).toBe(
      Number.MAX_SAFE_INTEGER
    );
    for (const value of [Number.MAX_SAFE_INTEGER + 1, 1e21]) {
      expect(() => validation._validateCourseLength(value, 'updateABClass')).toThrow(TypeError);
    }
    expect(() => validation._validateCourseLength(3.9, 'updateABClass')).toThrow(TypeError);
    expect(() => validation._validateCourseLength(0, 'updateABClass')).toThrow(TypeError);
    expect(ABClass._parseNullableInt('3years', 1)).toBe(3);
  });
});
