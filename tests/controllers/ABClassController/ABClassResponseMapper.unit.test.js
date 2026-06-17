import { describe, expect, it } from 'vitest';

const MODULE_PATH = '../../../src/backend/y_controllers/ABClassController/ABClassResponseMapper';

describe('ABClassResponseMapper sub-class', () => {
  it('is available in GREEN phase (module exists)', () => {
    expect(() => require(MODULE_PATH)).not.toThrow();
  });

  it('is exported as a class (GREEN phase)', () => {
    const ABClassResponseMapper = require(MODULE_PATH);
    expect(typeof ABClassResponseMapper).toBe('function');
  });

  it('constructs an instance without options (GREEN phase)', () => {
    const ABClassResponseMapper = require(MODULE_PATH);
    const instance = new ABClassResponseMapper();
    expect(instance).toBeInstanceOf(ABClassResponseMapper);
  });

  describe('methods (GREEN phase)', () => {
    const expectedMethods = ['_normaliseClassPartial', '_buildClassSummary', '_toReadView'];

    expectedMethods.forEach((methodName) => {
      it(`has method ${methodName}`, () => {
        const ABClassResponseMapper = require(MODULE_PATH);
        const instance = new ABClassResponseMapper();
        expect(typeof instance[methodName]).toBe('function');
      });
    });
  });
});
