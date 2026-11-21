import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  installAssignmentDefinitionControllerStub,
  loadAssignmentDefinitionValidationModule,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';
const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');

describe('validateYearGroupKeyedFields_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it.each([
    {
      description: 'valid yearGroupKey and yearGroupLabel',
      yearGroupKey: 'year-10',
      yearGroupLabel: 'Year 10',
      rowIndex: 0,
      shouldThrow: false,
    },
    {
      description: 'non-string yearGroupKey',
      yearGroupKey: 123,
      yearGroupLabel: 'Year 10',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a string.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'empty string yearGroupKey',
      yearGroupKey: '',
      yearGroupLabel: 'Year 10',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a non-empty string.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'whitespace-only yearGroupKey',
      yearGroupKey: '   ',
      yearGroupLabel: 'Year 10',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a non-empty string.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'untrimmed yearGroupKey',
      yearGroupKey: '  year-10',
      yearGroupLabel: 'Year 10',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'yearGroupKey must already be trimmed.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'non-string yearGroupLabel',
      yearGroupKey: 'year-10',
      yearGroupLabel: 123,
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'yearGroupLabel must be a string.',
      expectedField: 'yearGroupLabel',
    },
    {
      description: 'empty string yearGroupLabel',
      yearGroupKey: 'year-10',
      yearGroupLabel: '',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'yearGroupLabel must be a non-empty string.',
      expectedField: 'yearGroupLabel',
    },
    {
      description: 'whitespace-only yearGroupLabel',
      yearGroupKey: 'year-10',
      yearGroupLabel: '   ',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'yearGroupLabel must be a non-empty string.',
      expectedField: 'yearGroupLabel',
    },
    {
      description: 'untrimmed yearGroupLabel',
      yearGroupKey: 'year-10',
      yearGroupLabel: '  Year 10',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'yearGroupLabel must already be trimmed.',
      expectedField: 'yearGroupLabel',
    },
  ])(
    'handles $description correctly',
    ({ yearGroupKey, yearGroupLabel, rowIndex, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validateYearGroupKeyedFields_ } = loadAssignmentDefinitionValidationModule();

      if (shouldThrow) {
        expect(() => validateYearGroupKeyedFields_(yearGroupKey, yearGroupLabel, rowIndex)).toThrow(
          ApiValidationError
        );
        expect(() => validateYearGroupKeyedFields_(yearGroupKey, yearGroupLabel, rowIndex)).toThrow(
          expectedError
        );
        try {
          validateYearGroupKeyedFields_(yearGroupKey, yearGroupLabel, rowIndex);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('getAssignmentDefinitionPartials');
          expect(err.details).toBe(`rowIndex=${rowIndex}`);
        }
      } else {
        expect(() =>
          validateYearGroupKeyedFields_(yearGroupKey, yearGroupLabel, rowIndex)
        ).not.toThrow();
      }
    }
  );
});

describe('validateTimestamp_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it.each([
    {
      description: 'null timestamp is valid',
      value: null,
      fieldName: 'createdAt',
      rowIndex: 0,
      shouldThrow: false,
    },
    {
      description: 'valid ISO datetime string',
      value: '2026-01-05T10:00:00.000Z',
      fieldName: 'createdAt',
      rowIndex: 0,
      shouldThrow: false,
    },
    {
      description: 'valid ISO datetime string with offset',
      value: '2026-01-05T10:00:00.000+01:00',
      fieldName: 'updatedAt',
      rowIndex: 5,
      shouldThrow: false,
    },
    {
      description: 'invalid ISO datetime string',
      value: 'not-a-valid-iso-string',
      fieldName: 'createdAt',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'createdAt must be null or an ISO datetime string.',
      expectedField: 'createdAt',
    },
    {
      description: 'non-string non-null timestamp',
      value: 1234567890,
      fieldName: 'createdAt',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'createdAt must be null or an ISO datetime string.',
      expectedField: 'createdAt',
    },
    {
      description: 'empty string timestamp',
      value: '',
      fieldName: 'createdAt',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'createdAt must be null or an ISO datetime string.',
      expectedField: 'createdAt',
    },
    {
      description: 'date only string',
      value: '2026-01-05',
      fieldName: 'createdAt',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'createdAt must be null or an ISO datetime string.',
      expectedField: 'createdAt',
    },
  ])(
    'handles $description correctly',
    ({ value, fieldName, rowIndex, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validateTimestamp_ } = loadAssignmentDefinitionValidationModule();

      if (shouldThrow) {
        expect(() => validateTimestamp_(value, fieldName, rowIndex)).toThrow(ApiValidationError);
        expect(() => validateTimestamp_(value, fieldName, rowIndex)).toThrow(expectedError);
        try {
          validateTimestamp_(value, fieldName, rowIndex);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('getAssignmentDefinitionPartials');
          expect(err.details).toBe(`rowIndex=${rowIndex}`);
        }
      } else {
        expect(() => validateTimestamp_(value, fieldName, rowIndex)).not.toThrow();
      }
    }
  );
});

describe('validateRequiredYearGroupKey_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it.each([
    {
      description: 'valid yearGroupKey',
      parameters: { yearGroupKey: 'year-10' },
      shouldThrow: false,
    },
    {
      description: 'valid yearGroupKey with extra fields',
      parameters: { yearGroupKey: 'year-10', primaryTitle: 'Test' },
      shouldThrow: false,
    },
    {
      description: 'missing yearGroupKey',
      parameters: {},
      shouldThrow: true,
      expectedError: 'Missing required field: yearGroupKey.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'null yearGroupKey',
      parameters: { yearGroupKey: null },
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a non-null selected reference-data key.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'non-string yearGroupKey',
      parameters: { yearGroupKey: 123 },
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a string when provided.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'empty string yearGroupKey',
      parameters: { yearGroupKey: '' },
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a non-empty string.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'whitespace-only yearGroupKey',
      parameters: { yearGroupKey: '   ' },
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a non-empty string.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'untrimmed yearGroupKey',
      parameters: { yearGroupKey: '  year-10' },
      shouldThrow: true,
      expectedError: 'yearGroupKey must already be trimmed.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'yearGroupKey with forward slash',
      parameters: { yearGroupKey: 'invalid/key' },
      shouldThrow: true,
      expectedError: 'yearGroupKey contains unsafe characters.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'yearGroupKey with control character',
      parameters: { yearGroupKey: 'invalid\x00key' },
      shouldThrow: true,
      expectedError: 'yearGroupKey contains unsafe characters.',
      expectedField: 'yearGroupKey',
    },
  ])(
    'handles $description correctly',
    ({ parameters, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validateRequiredYearGroupKey_ } = loadAssignmentDefinitionValidationModule();

      if (shouldThrow) {
        expect(() => validateRequiredYearGroupKey_(parameters)).toThrow(ApiValidationError);
        expect(() => validateRequiredYearGroupKey_(parameters)).toThrow(expectedError);
        try {
          validateRequiredYearGroupKey_(parameters);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('upsertAssignmentDefinition');
        }
      } else {
        expect(() => validateRequiredYearGroupKey_(parameters)).not.toThrow();
      }
    }
  );
});
