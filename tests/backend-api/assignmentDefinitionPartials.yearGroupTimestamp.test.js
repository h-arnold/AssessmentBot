import { afterEach, beforeEach, describe } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  loadAssignmentDefinitionValidationModule,
  runValidationCases,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';

const yk = 'yearGroupKey';
const yl = 'yearGroupLabel';
const stringMsg = (field) => `${field} must be a string.`;
const nonEmptyMsg = (field) => `${field} must be a non-empty string.`;
const trimmedMsg = (field) => `${field} must already be trimmed.`;
const tsError = 'createdAt must be null or an ISO datetime string.';
const missingError = 'Missing required field: yearGroupKey.';
const nullKeyError = 'yearGroupKey must be a non-null selected reference-data key.';
const providedError = 'yearGroupKey must be a string when provided.';
const unsafeError = 'yearGroupKey contains unsafe characters.';

describe('validateYearGroupKeyedFields_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const testCases = [
    ['valid yearGroupKey and yearGroupLabel', 'year-10', 'Year 10'],
    ['non-string yearGroupKey', 123, 'Year 10', stringMsg(yk), yk],
    ['empty string yearGroupKey', '', 'Year 10', nonEmptyMsg(yk), yk],
    ['whitespace-only yearGroupKey', '   ', 'Year 10', nonEmptyMsg(yk), yk],
    ['untrimmed yearGroupKey', '  year-10', 'Year 10', trimmedMsg(yk), yk],
    ['non-string yearGroupLabel', 'year-10', 123, stringMsg(yl), yl],
    ['empty string yearGroupLabel', 'year-10', '', nonEmptyMsg(yl), yl],
    ['whitespace-only yearGroupLabel', 'year-10', '   ', nonEmptyMsg(yl), yl],
    ['untrimmed yearGroupLabel', 'year-10', '  Year 10', trimmedMsg(yl), yl],
  ].map(([description, yearGroupKey, yearGroupLabel, expectedError, expectedField]) => ({
    description,
    shouldThrow: Boolean(expectedError),
    expectedError,
    expectedField,
    yearGroupKey,
    yearGroupLabel,
    rowIndex: 0,
  }));

  runValidationCases({
    testCases,
    method: 'getAssignmentDefinitionPartials',
    expectDetails: true,
    invoke: ({ yearGroupKey, yearGroupLabel, rowIndex }) => {
      const { validateYearGroupKeyedFields_ } = loadAssignmentDefinitionValidationModule();
      return () => validateYearGroupKeyedFields_(yearGroupKey, yearGroupLabel, rowIndex);
    },
  });
});

describe('validateTimestamp_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const testCases = [
    ['null timestamp is valid', null, 'createdAt', 0],
    ['valid ISO datetime string', '2026-01-05T10:00:00.000Z', 'createdAt', 0],
    ['valid ISO datetime string with offset', '2026-01-05T10:00:00.000+01:00', 'updatedAt', 5],
    ['invalid ISO datetime string', 'not-a-valid-iso-string', 'createdAt', 0, tsError, 'createdAt'],
    ['non-string non-null timestamp', 1234567890, 'createdAt', 0, tsError, 'createdAt'],
    ['empty string timestamp', '', 'createdAt', 0, tsError, 'createdAt'],
    ['date only string', '2026-01-05', 'createdAt', 0, tsError, 'createdAt'],
  ].map(([description, value, fieldName, rowIndex, expectedError, expectedField]) => ({
    description,
    shouldThrow: Boolean(expectedError),
    expectedError,
    expectedField,
    value,
    fieldName,
    rowIndex,
  }));

  runValidationCases({
    testCases,
    method: 'getAssignmentDefinitionPartials',
    expectDetails: true,
    invoke: ({ value, fieldName, rowIndex }) => {
      const { validateTimestamp_ } = loadAssignmentDefinitionValidationModule();
      return () => validateTimestamp_(value, fieldName, rowIndex);
    },
  });
});

describe('validateRequiredYearGroupKey_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const testCases = [
    ['valid yearGroupKey', { yearGroupKey: 'year-10' }],
    ['valid yearGroupKey with extra fields', { yearGroupKey: 'year-10', primaryTitle: 'Test' }],
    ['missing yearGroupKey', {}, missingError, yk],
    ['null yearGroupKey', { yearGroupKey: null }, nullKeyError, yk],
    ['non-string yearGroupKey', { yearGroupKey: 123 }, providedError, yk],
    ['empty string yearGroupKey', { yearGroupKey: '' }, nonEmptyMsg(yk), yk],
    ['whitespace-only yearGroupKey', { yearGroupKey: '   ' }, nonEmptyMsg(yk), yk],
    ['untrimmed yearGroupKey', { yearGroupKey: '  year-10' }, trimmedMsg(yk), yk],
    ['yearGroupKey with forward slash', { yearGroupKey: 'invalid/key' }, unsafeError, yk],
    ['yearGroupKey with control character', { yearGroupKey: 'invalid\x00key' }, unsafeError, yk],
  ].map(([description, parameters, expectedError, expectedField]) => ({
    description,
    shouldThrow: Boolean(expectedError),
    expectedError,
    expectedField,
    parameters,
  }));

  runValidationCases({
    testCases,
    method: 'upsertAssignmentDefinition',
    invoke: ({ parameters }) => {
      const { validateRequiredYearGroupKey_ } = loadAssignmentDefinitionValidationModule();
      return () => validateRequiredYearGroupKey_(parameters);
    },
  });
});
