import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  installAssignmentDefinitionControllerStub,
  loadAssignmentDefinitionValidationModule,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';
const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');

describe('validateReadParameters_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it.each([
    {
      description: 'valid parameters with definitionKey',
      parameters: { definitionKey: 'valid-key' },
      shouldThrow: false,
    },
    {
      description: 'null parameters',
      parameters: null,
      shouldThrow: true,
      expectedError: 'params must be an object.',
      expectedField: 'params',
    },
    {
      description: 'undefined parameters',
      parameters: undefined,
      shouldThrow: true,
      expectedError: 'params must be an object.',
      expectedField: 'params',
    },
    {
      description: 'string parameters',
      parameters: 'not-an-object',
      shouldThrow: true,
      expectedError: 'params must be an object.',
      expectedField: 'params',
    },
    {
      description: 'number parameters',
      parameters: 123,
      shouldThrow: true,
      expectedError: 'params must be an object.',
      expectedField: 'params',
    },
    {
      description: 'array parameters',
      parameters: ['not', 'an', 'object'],
      shouldThrow: true,
      expectedError: 'params must be an object.',
      expectedField: 'params',
    },
    {
      description: 'object without definitionKey',
      parameters: { otherField: 'value' },
      shouldThrow: true,
      expectedError: 'Missing required field: definitionKey.',
      expectedField: 'definitionKey',
    },
    {
      description: 'object with null definitionKey',
      parameters: { definitionKey: null },
      shouldThrow: true,
      expectedError: 'definitionKey must be a string.',
      expectedField: 'definitionKey',
    },
    {
      description: 'object with undefined definitionKey',
      parameters: { definitionKey: undefined },
      shouldThrow: true,
      expectedError: 'definitionKey must be a string.',
      expectedField: 'definitionKey',
    },
    {
      description: 'object with empty string definitionKey',
      parameters: { definitionKey: '' },
      shouldThrow: true,
      expectedError: 'definitionKey must be a non-empty string.',
      expectedField: 'definitionKey',
    },
    {
      description: 'object with whitespace-only definitionKey',
      parameters: { definitionKey: '   ' },
      shouldThrow: true,
      expectedError: 'definitionKey must be a non-empty string.',
      expectedField: 'definitionKey',
    },
    {
      description: 'object with untrimmed definitionKey (leading spaces)',
      parameters: { definitionKey: '  valid-key' },
      shouldThrow: true,
      expectedError: 'definitionKey must already be trimmed.',
      expectedField: 'definitionKey',
    },
    {
      description: 'object with untrimmed definitionKey (trailing spaces)',
      parameters: { definitionKey: 'valid-key  ' },
      shouldThrow: true,
      expectedError: 'definitionKey must already be trimmed.',
      expectedField: 'definitionKey',
    },
    {
      description: 'object with definitionKey containing forward slash',
      parameters: { definitionKey: 'invalid/key' },
      shouldThrow: true,
      expectedError: 'definitionKey contains unsafe characters.',
      expectedField: 'definitionKey',
    },
    {
      description: 'object with definitionKey containing backslash',
      parameters: { definitionKey: 'invalid\\key' },
      shouldThrow: true,
      expectedError: 'definitionKey contains unsafe characters.',
      expectedField: 'definitionKey',
    },
    {
      description: 'object with definitionKey containing dot-dot',
      parameters: { definitionKey: 'invalid..key' },
      shouldThrow: true,
      expectedError: 'definitionKey contains unsafe characters.',
      expectedField: 'definitionKey',
    },
    {
      description: 'object with definitionKey containing control character',
      parameters: { definitionKey: 'invalid\x00key' },
      shouldThrow: true,
      expectedError: 'definitionKey contains unsafe characters.',
      expectedField: 'definitionKey',
    },
    {
      description: 'object with valid definitionKey and extra fields',
      parameters: { definitionKey: 'valid-key', extraField: 'value' },
      shouldThrow: false,
    },
  ])(
    'handles $description correctly',
    ({ parameters, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validateReadParameters_ } = loadAssignmentDefinitionValidationModule();

      if (shouldThrow) {
        expect(() => validateReadParameters_(parameters)).toThrow(ApiValidationError);
        expect(() => validateReadParameters_(parameters)).toThrow(expectedError);
        try {
          validateReadParameters_(parameters);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('getAssignmentDefinition');
        }
      } else {
        const result = validateReadParameters_(parameters);
        expect(result).toBe(parameters.definitionKey);
        expect(() => validateReadParameters_(parameters)).not.toThrow();
      }
    }
  );
});

describe('validateDefinitionKey_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it.each([
    {
      description: 'valid definitionKey string',
      definitionKey: 'valid-key',
      rowIndex: 0,
      shouldThrow: false,
    },
    {
      description: 'valid definitionKey with numbers',
      definitionKey: 'valid-key-123',
      rowIndex: 5,
      shouldThrow: false,
    },
    {
      description: 'non-string definitionKey (number)',
      definitionKey: 123,
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'definitionKey must be a string.',
      expectedField: 'definitionKey',
    },
    {
      description: 'non-string definitionKey (null)',
      definitionKey: null,
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'definitionKey must be a string.',
      expectedField: 'definitionKey',
    },
    {
      description: 'non-string definitionKey (undefined)',
      definitionKey: undefined,
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'definitionKey must be a string.',
      expectedField: 'definitionKey',
    },
    {
      description: 'empty string definitionKey',
      definitionKey: '',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'definitionKey must be a non-empty string.',
      expectedField: 'definitionKey',
    },
    {
      description: 'whitespace-only definitionKey',
      definitionKey: '   ',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'definitionKey must be a non-empty string.',
      expectedField: 'definitionKey',
    },
    {
      description: 'untrimmed definitionKey (leading spaces)',
      definitionKey: '  valid-key',
      rowIndex: 10,
      shouldThrow: true,
      expectedError: 'definitionKey must already be trimmed.',
      expectedField: 'definitionKey',
    },
    {
      description: 'untrimmed definitionKey (trailing spaces)',
      definitionKey: 'valid-key  ',
      rowIndex: 10,
      shouldThrow: true,
      expectedError: 'definitionKey must already be trimmed.',
      expectedField: 'definitionKey',
    },
  ])(
    'handles $description correctly',
    ({ definitionKey, rowIndex, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validateDefinitionKey_ } = loadAssignmentDefinitionValidationModule();

      if (shouldThrow) {
        expect(() => validateDefinitionKey_(definitionKey, rowIndex)).toThrow(ApiValidationError);
        expect(() => validateDefinitionKey_(definitionKey, rowIndex)).toThrow(expectedError);
        try {
          validateDefinitionKey_(definitionKey, rowIndex);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('getAssignmentDefinitionPartials');
          expect(err.details).toBe(`rowIndex=${rowIndex}`);
        }
      } else {
        expect(() => validateDefinitionKey_(definitionKey, rowIndex)).not.toThrow();
      }
    }
  );
});

describe('validatePrimaryTopicKey_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it.each([
    {
      description: 'valid primaryTopicKey string',
      primaryTopicKey: 'valid-topic-key',
      rowIndex: 0,
      shouldThrow: false,
    },
    {
      description: 'non-string primaryTopicKey (number)',
      primaryTopicKey: 123,
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'primaryTopicKey must be a string.',
      expectedField: 'primaryTopicKey',
    },
    {
      description: 'non-string primaryTopicKey (null)',
      primaryTopicKey: null,
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'primaryTopicKey must be a string.',
      expectedField: 'primaryTopicKey',
    },
    {
      description: 'empty string primaryTopicKey',
      primaryTopicKey: '',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'primaryTopicKey must be a non-empty string.',
      expectedField: 'primaryTopicKey',
    },
    {
      description: 'whitespace-only primaryTopicKey',
      primaryTopicKey: '   ',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'primaryTopicKey must be a non-empty string.',
      expectedField: 'primaryTopicKey',
    },
    {
      description: 'untrimmed primaryTopicKey (leading spaces)',
      primaryTopicKey: '  valid-topic-key',
      rowIndex: 5,
      shouldThrow: true,
      expectedError: 'primaryTopicKey must already be trimmed.',
      expectedField: 'primaryTopicKey',
    },
    {
      description: 'untrimmed primaryTopicKey (trailing spaces)',
      primaryTopicKey: 'valid-topic-key  ',
      rowIndex: 5,
      shouldThrow: true,
      expectedError: 'primaryTopicKey must already be trimmed.',
      expectedField: 'primaryTopicKey',
    },
  ])(
    'handles $description correctly',
    ({ primaryTopicKey, rowIndex, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validatePrimaryTopicKey_ } = loadAssignmentDefinitionValidationModule();

      if (shouldThrow) {
        expect(() => validatePrimaryTopicKey_(primaryTopicKey, rowIndex)).toThrow(
          ApiValidationError
        );
        expect(() => validatePrimaryTopicKey_(primaryTopicKey, rowIndex)).toThrow(expectedError);
        try {
          validatePrimaryTopicKey_(primaryTopicKey, rowIndex);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('getAssignmentDefinitionPartials');
          expect(err.details).toBe(`rowIndex=${rowIndex}`);
        }
      } else {
        expect(() => validatePrimaryTopicKey_(primaryTopicKey, rowIndex)).not.toThrow();
      }
    }
  );
});
