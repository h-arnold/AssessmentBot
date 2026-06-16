/**
 * Unit tests for src/backend/z_Api/abclass/abclassValidation.js.
 * Verifies the shared validateParametersObject_ primitive.
 *
 * RED phase: the file src/backend/z_Api/abclass/abclassValidation.js does not
 * yet exist, so the require will fail with MODULE_NOT_FOUND.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The new file does NOT exist yet — this is the RED-phase failure point.
const validationModulePath = '../../src/backend/z_Api/abclass/abclassValidation.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

let abclassValidationModule;

/**
 * Clears the require cache for the validation module so each test gets a fresh instance.
 */
function clearModuleCache() {
  delete require.cache[require.resolve(validationModulePath)];
}

/**
 * Loads the abclassValidation module (RED phase: throws MODULE_NOT_FOUND).
 *
 * @returns {Object} The exported module containing validateParametersObject_.
 */
function loadValidationModule() {
  clearModuleCache();
  return require(validationModulePath);
}

beforeEach(() => {
  // Attempt to load the module. In the RED phase, this will throw MODULE_NOT_FOUND
  // because the file does not exist yet. The try-catch allows tests to verify
  // the specific failure in the first RED test while still permitting the module
  // to be loaded for GREEN-phase test outline.
  try {
    abclassValidationModule = loadValidationModule();
  } catch (err) {
    abclassValidationModule = null;
  }
});

afterEach(() => {
  clearModuleCache();
});

describe('Api/abclassValidation exports (RED will fail here)', () => {
  it('exports validateParametersObject_ in Node test runtime', () => {
    // RED phase: This will fail because the module cannot be found.
    expect(abclassValidationModule).not.toBeNull();
    expect(abclassValidationModule).toEqual(
      expect.objectContaining({
        validateParametersObject_: expect.any(Function),
      })
    );
  });
});

describe('Api/abclassValidation validateParametersObject_ rejection cases', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
    ['a string', 'not-an-object'],
    ['a number', 42],
  ])('rejects %s with ApiValidationError', (_label, params) => {
    expect(abclassValidationModule).not.toBeNull();
    expect(() => abclassValidationModule.validateParametersObject_(params, 'testMethod')).toThrow(
      ApiValidationError
    );
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
    ['a string', 'not-an-object'],
    ['a number', 42],
  ])('includes method and fieldName in the error options for %s', (_label, params) => {
    expect(abclassValidationModule).not.toBeNull();

    let thrownError;
    try {
      abclassValidationModule.validateParametersObject_(params, 'testMethod');
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(ApiValidationError);
    expect(thrownError.message).toBe('params must be an object.');
    expect(thrownError.method).toBe('testMethod');
    expect(thrownError.fieldName).toBe('params');
  });
});

describe('Api/abclassValidation validateParametersObject_ acceptance cases', () => {
  it('accepts a plain empty object', () => {
    expect(abclassValidationModule).not.toBeNull();
    expect(() => abclassValidationModule.validateParametersObject_({}, 'testMethod')).not.toThrow();
  });

  it('accepts a plain object with properties', () => {
    expect(abclassValidationModule).not.toBeNull();
    expect(() =>
      abclassValidationModule.validateParametersObject_(
        { classId: 'class-001', cohortKey: 'coh-2026' },
        'testMethod'
      )
    ).not.toThrow();
  });
});
