import { afterEach, beforeEach, describe } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  installAssignmentDefinitionControllerStub,
  loadAssignmentDefinitionValidationModule,
  runBinaryCases,
  runValidationCases,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';

describe('hasControlCharacters_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const testCases = [
    ['string with ASCII control character DEL (127)', 'test\x7fvalue', true],
    ['string with ASCII control character NUL (0)', 'test\x00value', true],
    ['string with ASCII control character SOH (1)', 'test\x01value', true],
    ['string with ASCII control character LF (10)', 'test\nvalue', true],
    ['string with ASCII control character CR (13)', 'test\rvalue', true],
    ['string with ASCII control character TAB (9)', 'test\tvalue', true],
    ['string with ASCII control character BEL (7)', 'test\x07value', true],
    ['string with ASCII control character ESC (27)', 'test\x1bvalue', true],
    ['normal alphanumeric string', 'testValue123', false],
    ['string with spaces', 'test value', false],
    ['string with hyphens', 'test-value', false],
    ['string with underscores', 'test_value', false],
    ['empty string', '', false],
    ['string with forward slash', 'test/value', false],
    ['string with backslash', 'test\\value', false],
    ['string with dot-dot', 'test..value', false],
    ['string with unicode characters', 'test值value', false],
    ['string with unicode control character U+2028', 'test\u2028value', false],
  ].map(([description, value, expected]) => ({ description, value, expected }));

  runBinaryCases({
    testCases,
    setup: () => installAssignmentDefinitionControllerStub([]),
    invoke: (value) => loadAssignmentDefinitionValidationModule().hasControlCharacters_(value),
  });
});

describe('isIsoDateTimeString_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const testCases = [
    // Valid ISO datetime strings
    ['UTC timezone with Z suffix', '2026-01-05T10:00:00.000Z', true],
    ['UTC timezone with +00:00 offset', '2026-01-05T10:00:00.000+00:00', true],
    ['UTC timezone with -00:00 offset', '2026-01-05T10:00:00.000-00:00', true],
    ['positive offset +01:00', '2026-01-05T10:00:00.000+01:00', true],
    ['negative offset -05:30', '2026-01-05T10:00:00.000-05:30', true],
    ['positive offset +23:59', '2026-01-05T10:00:00.000+23:59', true],
    ['negative offset -23:59', '2026-01-05T10:00:00.000-23:59', true],
    ['midnight time', '2026-01-05T00:00:00.000Z', true],
    ['end of day time', '2026-01-05T23:59:59.999Z', true],
    ['leap year date', '2024-02-29T12:00:00.000Z', true],
    ['year 1970', '1970-01-01T00:00:00.000Z', true],
    ['year 9999', '9999-12-31T23:59:59.999Z', true],
    // Invalid ISO datetime strings
    ['non-string value (number)', 1234567890, false],
    ['non-string value (null)', null, false],
    ['non-string value (undefined)', undefined, false],
    ['non-string value (object)', {}, false],
    ['empty string', '', false],
    ['date only without time', '2026-01-05', false],
    ['time only without date', 'T10:00:00.000Z', false],
    ['missing milliseconds', '2026-01-05T10:00:00Z', false],
    ['missing seconds', '2026-01-05T10:00:00.000', false],
    ['missing timezone', '2026-01-05T10:00:00.000', false],
    ['invalid timezone format (X)', '2026-01-05T10:00:00.000X', false],
    ['invalid timezone format (missing colon)', '2026-01-05T10:00:00.000+0100', false],
    ['invalid timezone format (single digit hour)', '2026-01-05T10:00:00.000+1:00', false],
    ['invalid date (month 13)', '2026-13-05T10:00:00.000Z', false],
    ['invalid date (day 32)', '2026-01-32T10:00:00.000Z', false],
    ['invalid date (February 30)', '2026-02-30T10:00:00.000Z', false],
    ['invalid hour (24)', '2026-01-05T24:00:00.000Z', false],
    ['invalid minute (60)', '2026-01-05T10:60:00.000Z', false],
    ['invalid second (60)', '2026-01-05T10:00:60.000Z', false],
    ['invalid millisecond (1000)', '2026-01-05T10:00:00.1000Z', false],
    ['offset hours exceeds 23', '2026-01-05T10:00:00.000+24:00', false],
    ['offset minutes exceeds 59', '2026-01-05T10:00:00.000+01:60', false],
    ['offset hours negative exceeds 23', '2026-01-05T10:00:00.000-24:00', false],
    ['offset minutes negative exceeds 59', '2026-01-05T10:00:00.000-01:60', false],
    ['invalid date (Feb 29 in non-leap year 2026)', '2026-02-29T12:00:00.000Z', false],
  ].map(([description, value, expected]) => ({ description, value, expected }));

  runBinaryCases({
    testCases,
    setup: () => installAssignmentDefinitionControllerStub([]),
    invoke: (value) => loadAssignmentDefinitionValidationModule().isIsoDateTimeString_(value),
  });
});

describe('validateSafeTrimmedIdentifier_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const baseOptions = {
    typeErrorMessage: 'type error',
    nonEmptyErrorMessage: 'non-empty error',
    trimmedErrorMessage: 'trimmed error',
    unsafeErrorMessage: 'unsafe error',
    fieldNames: { type: 'field', nonEmpty: 'field', trimmed: 'field', unsafe: 'field' },
  };

  const testCases = [
    ['valid string identifier', 'valid-key', false],
    ['valid string with numbers', 'valid-key-123', false],
    ['non-string value (number)', 123, true, 'type error', 'field'],
    ['non-string value (null)', null, true, 'type error', 'field'],
    ['non-string value (undefined)', undefined, true, 'type error', 'field'],
    ['empty string', '', true, 'non-empty error', 'field'],
    ['whitespace only string', '   ', true, 'non-empty error', 'field'],
    ['untrimmed string with leading spaces', '  valid-key', true, 'trimmed error', 'field'],
    ['untrimmed string with trailing spaces', 'valid-key  ', true, 'trimmed error', 'field'],
    ['string with forward slash', 'valid/key', true, 'unsafe error', 'field'],
    ['string with backslash', 'valid\\key', true, 'unsafe error', 'field'],
    ['string with dot-dot', 'valid..key', true, 'unsafe error', 'field'],
    ['string with control character', 'valid\x00key', true, 'unsafe error', 'field'],
    ['string with DEL character', 'valid\x7fkey', true, 'unsafe error', 'field'],
  ].map(([description, value, shouldThrow, expectedError, expectedField]) => ({
    description,
    value,
    shouldThrow,
    expectedError,
    expectedField,
  }));

  runValidationCases({
    testCases,
    method: 'getAssignmentDefinitionPartials',
    invoke: (params) => {
      const module = loadAssignmentDefinitionValidationModule();
      return () =>
        module.validateSafeTrimmedIdentifier_(params.value, {
          ...baseOptions,
          throwValidationError: module.throwValidationError_,
        });
    },
  });
});
