import { describe, expect, it } from 'vitest';

const MODULE_PATH = '../../../src/backend/y_controllers/ABClassController/ABClassPersistence';

describe('ABClassPersistence sub-class', () => {
  it('is available in GREEN phase (module exists)', () => {
    expect(() => require(MODULE_PATH)).not.toThrow();
  });

  it('is exported as a class (GREEN phase)', () => {
    const ABClassPersistence = require(MODULE_PATH);
    expect(typeof ABClassPersistence).toBe('function');
  });

  it('constructs an instance with options (GREEN phase)', () => {
    const ABClassPersistence = require(MODULE_PATH);
    const mockDbManager = {};
    const mockValidation = {};
    const instance = new ABClassPersistence({
      dbManager: mockDbManager,
      validation: mockValidation,
    });
    expect(instance).toBeInstanceOf(ABClassPersistence);
  });

  describe('methods (GREEN phase)', () => {
    const expectedMethods = ['persistClassAndPartial', '_upsertClassPartial'];

    expectedMethods.forEach((methodName) => {
      it(`has method ${methodName}`, () => {
        const ABClassPersistence = require(MODULE_PATH);
        const instance = new ABClassPersistence({
          dbManager: {},
          validation: {},
        });
        expect(typeof instance[methodName]).toBe('function');
      });
    });
  });
});
