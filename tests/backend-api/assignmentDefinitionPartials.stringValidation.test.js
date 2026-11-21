import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  installAssignmentDefinitionControllerStub,
  loadAssignmentDefinitionValidationModule,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';
const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');

describe('hasControlCharacters_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it.each([
    {
      description: 'string with ASCII control character DEL (127)',
      value: 'test\x7fvalue',
      expected: true,
    },
    {
      description: 'string with ASCII control character NUL (0)',
      value: 'test\x00value',
      expected: true,
    },
    {
      description: 'string with ASCII control character SOH (1)',
      value: 'test\x01value',
      expected: true,
    },
    {
      description: 'string with ASCII control character LF (10)',
      value: 'test\nvalue',
      expected: true,
    },
    {
      description: 'string with ASCII control character CR (13)',
      value: 'test\rvalue',
      expected: true,
    },
    {
      description: 'string with ASCII control character TAB (9)',
      value: 'test\tvalue',
      expected: true,
    },
    {
      description: 'string with ASCII control character BEL (7)',
      value: 'test\x07value',
      expected: true,
    },
    {
      description: 'string with ASCII control character ESC (27)',
      value: 'test\x1bvalue',
      expected: true,
    },
    { description: 'normal alphanumeric string', value: 'testValue123', expected: false },
    { description: 'string with spaces', value: 'test value', expected: false },
    { description: 'string with hyphens', value: 'test-value', expected: false },
    { description: 'string with underscores', value: 'test_value', expected: false },
    { description: 'empty string', value: '', expected: false },
    { description: 'string with forward slash', value: 'test/value', expected: false },
    { description: 'string with backslash', value: 'test\\value', expected: false },
    { description: 'string with dot-dot', value: 'test..value', expected: false },
    { description: 'string with unicode characters', value: 'test值value', expected: false },
    {
      description: 'string with unicode control character U+2028',
      value: 'test\u2028value',
      expected: false,
    },
  ])('returns $expected for $description', ({ value, expected }) => {
    installAssignmentDefinitionControllerStub([]);
    const { hasControlCharacters_ } = loadAssignmentDefinitionValidationModule();
    expect(hasControlCharacters_(value)).toBe(expected);
  });
});

describe('isIsoDateTimeString_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it.each([
    // Valid ISO datetime strings
    {
      description: 'UTC timezone with Z suffix',
      value: '2026-01-05T10:00:00.000Z',
      expected: true,
    },
    {
      description: 'UTC timezone with +00:00 offset',
      value: '2026-01-05T10:00:00.000+00:00',
      expected: true,
    },
    {
      description: 'UTC timezone with -00:00 offset',
      value: '2026-01-05T10:00:00.000-00:00',
      expected: true,
    },
    {
      description: 'positive offset +01:00',
      value: '2026-01-05T10:00:00.000+01:00',
      expected: true,
    },
    {
      description: 'negative offset -05:30',
      value: '2026-01-05T10:00:00.000-05:30',
      expected: true,
    },
    {
      description: 'positive offset +23:59',
      value: '2026-01-05T10:00:00.000+23:59',
      expected: true,
    },
    {
      description: 'negative offset -23:59',
      value: '2026-01-05T10:00:00.000-23:59',
      expected: true,
    },
    { description: 'midnight time', value: '2026-01-05T00:00:00.000Z', expected: true },
    { description: 'end of day time', value: '2026-01-05T23:59:59.999Z', expected: true },
    { description: 'leap year date', value: '2024-02-29T12:00:00.000Z', expected: true },
    { description: 'year 1970', value: '1970-01-01T00:00:00.000Z', expected: true },
    { description: 'year 9999', value: '9999-12-31T23:59:59.999Z', expected: true },
    // Invalid ISO datetime strings
    { description: 'non-string value (number)', value: 1234567890, expected: false },
    { description: 'non-string value (null)', value: null, expected: false },
    { description: 'non-string value (undefined)', value: undefined, expected: false },
    { description: 'non-string value (object)', value: {}, expected: false },
    { description: 'empty string', value: '', expected: false },
    { description: 'date only without time', value: '2026-01-05', expected: false },
    { description: 'time only without date', value: 'T10:00:00.000Z', expected: false },
    { description: 'missing milliseconds', value: '2026-01-05T10:00:00Z', expected: false },
    { description: 'missing seconds', value: '2026-01-05T10:00:00.000', expected: false },
    { description: 'missing timezone', value: '2026-01-05T10:00:00.000', expected: false },
    {
      description: 'invalid timezone format (X)',
      value: '2026-01-05T10:00:00.000X',
      expected: false,
    },
    {
      description: 'invalid timezone format (missing colon)',
      value: '2026-01-05T10:00:00.000+0100',
      expected: false,
    },
    {
      description: 'invalid timezone format (single digit hour)',
      value: '2026-01-05T10:00:00.000+1:00',
      expected: false,
    },
    { description: 'invalid date (month 13)', value: '2026-13-05T10:00:00.000Z', expected: false },
    { description: 'invalid date (day 32)', value: '2026-01-32T10:00:00.000Z', expected: false },
    {
      description: 'invalid date (February 30)',
      value: '2026-02-30T10:00:00.000Z',
      expected: false,
    },
    { description: 'invalid hour (24)', value: '2026-01-05T24:00:00.000Z', expected: false },
    { description: 'invalid minute (60)', value: '2026-01-05T10:60:00.000Z', expected: false },
    { description: 'invalid second (60)', value: '2026-01-05T10:00:60.000Z', expected: false },
    {
      description: 'invalid millisecond (1000)',
      value: '2026-01-05T10:00:00.1000Z',
      expected: false,
    },
    {
      description: 'offset hours exceeds 23',
      value: '2026-01-05T10:00:00.000+24:00',
      expected: false,
    },
    {
      description: 'offset minutes exceeds 59',
      value: '2026-01-05T10:00:00.000+01:60',
      expected: false,
    },
    {
      description: 'offset hours negative exceeds 23',
      value: '2026-01-05T10:00:00.000-24:00',
      expected: false,
    },
    {
      description: 'offset minutes negative exceeds 59',
      value: '2026-01-05T10:00:00.000-01:60',
      expected: false,
    },
    {
      description: 'invalid date (Feb 29 in non-leap year 2026)',
      value: '2026-02-29T12:00:00.000Z',
      expected: false,
    },
  ])('returns $expected for $description', ({ value, expected }) => {
    installAssignmentDefinitionControllerStub([]);
    const { isIsoDateTimeString_ } = loadAssignmentDefinitionValidationModule();
    expect(isIsoDateTimeString_(value)).toBe(expected);
  });
});

describe('validateSafeTrimmedIdentifier_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  let throwValidationError_, validateSafeTrimmedIdentifier_;

  beforeEach(() => {
    installAssignmentDefinitionControllerStub([]);
    const module = loadAssignmentDefinitionValidationModule();
    throwValidationError_ = module.throwValidationError_;
    validateSafeTrimmedIdentifier_ = module.validateSafeTrimmedIdentifier_;
  });

  const baseOptions = {
    typeErrorMessage: 'type error',
    nonEmptyErrorMessage: 'non-empty error',
    trimmedErrorMessage: 'trimmed error',
    unsafeErrorMessage: 'unsafe error',
    fieldNames: { type: 'field', nonEmpty: 'field', trimmed: 'field', unsafe: 'field' },
  };

  it.each([
    {
      description: 'valid string identifier',
      value: 'valid-key',
      shouldThrow: false,
    },
    {
      description: 'valid string with numbers',
      value: 'valid-key-123',
      shouldThrow: false,
    },
    {
      description: 'non-string value (number)',
      value: 123,
      shouldThrow: true,
      expectedError: 'type error',
      expectedField: 'field',
    },
    {
      description: 'non-string value (null)',
      value: null,
      shouldThrow: true,
      expectedError: 'type error',
      expectedField: 'field',
    },
    {
      description: 'non-string value (undefined)',
      value: undefined,
      shouldThrow: true,
      expectedError: 'type error',
      expectedField: 'field',
    },
    {
      description: 'empty string',
      value: '',
      shouldThrow: true,
      expectedError: 'non-empty error',
      expectedField: 'field',
    },
    {
      description: 'whitespace only string',
      value: '   ',
      shouldThrow: true,
      expectedError: 'non-empty error',
      expectedField: 'field',
    },
    {
      description: 'untrimmed string with leading spaces',
      value: '  valid-key',
      shouldThrow: true,
      expectedError: 'trimmed error',
      expectedField: 'field',
    },
    {
      description: 'untrimmed string with trailing spaces',
      value: 'valid-key  ',
      shouldThrow: true,
      expectedError: 'trimmed error',
      expectedField: 'field',
    },
    {
      description: 'string with forward slash',
      value: 'valid/key',
      shouldThrow: true,
      expectedError: 'unsafe error',
      expectedField: 'field',
    },
    {
      description: 'string with backslash',
      value: 'valid\\key',
      shouldThrow: true,
      expectedError: 'unsafe error',
      expectedField: 'field',
    },
    {
      description: 'string with dot-dot',
      value: 'valid..key',
      shouldThrow: true,
      expectedError: 'unsafe error',
      expectedField: 'field',
    },
    {
      description: 'string with control character',
      value: 'valid\x00key',
      shouldThrow: true,
      expectedError: 'unsafe error',
      expectedField: 'field',
    },
    {
      description: 'string with DEL character',
      value: 'valid\x7fkey',
      shouldThrow: true,
      expectedError: 'unsafe error',
      expectedField: 'field',
    },
  ])('handles $description correctly', ({ value, shouldThrow, expectedError, expectedField }) => {
    const options = { ...baseOptions, throwValidationError: throwValidationError_ };

    if (shouldThrow) {
      expect(() => validateSafeTrimmedIdentifier_(value, options)).toThrow(ApiValidationError);
      expect(() => validateSafeTrimmedIdentifier_(value, options)).toThrow(expectedError);
      try {
        validateSafeTrimmedIdentifier_(value, options);
      } catch (err) {
        expect(err.fieldName).toBe(expectedField);
        expect(err.method).toBe('getAssignmentDefinitionPartials');
      }
    } else {
      expect(() => validateSafeTrimmedIdentifier_(value, options)).not.toThrow();
    }
  });
});
