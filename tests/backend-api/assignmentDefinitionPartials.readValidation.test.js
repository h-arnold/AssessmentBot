import { afterEach, beforeEach, describe, expect } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  loadAssignmentDefinitionValidationModule,
  runValidationCases,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';

// Error code -> [expectedError, expectedField] for each validation message family.
const READ_ERRORS = {
  params: ['params must be an object.', 'params'],
  missing: ['Missing required field: definitionKey.', 'definitionKey'],
  string: ['definitionKey must be a string.', 'definitionKey'],
  nonEmpty: ['definitionKey must be a non-empty string.', 'definitionKey'],
  trimmed: ['definitionKey must already be trimmed.', 'definitionKey'],
  unsafe: ['definitionKey contains unsafe characters.', 'definitionKey'],
};

const TOPIC_ERRORS = {
  string: ['primaryTopicKey must be a string.', 'primaryTopicKey'],
  nonEmpty: ['primaryTopicKey must be a non-empty string.', 'primaryTopicKey'],
  trimmed: ['primaryTopicKey must already be trimmed.', 'primaryTopicKey'],
};

const makeCase = (description, params, error, errors) => {
  if (!error) return { description, shouldThrow: false, ...params };
  const [expectedError, expectedField] = errors[error];
  return { description, shouldThrow: true, expectedError, expectedField, ...params };
};

const readCase = (description, parameters, error) =>
  makeCase(description, { parameters }, error, READ_ERRORS);

const keyCase = (description, definitionKey, rowIndex, error) =>
  makeCase(description, { definitionKey, rowIndex }, error, READ_ERRORS);

const topicCase = (description, primaryTopicKey, rowIndex, error) =>
  makeCase(description, { primaryTopicKey, rowIndex }, error, TOPIC_ERRORS);

describe('validateReadParameters_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const testCases = [
    readCase('valid parameters with definitionKey', { definitionKey: 'valid-key' }),
    readCase('null parameters', null, 'params'),
    readCase('undefined parameters', undefined, 'params'),
    readCase('string parameters', 'not-an-object', 'params'),
    readCase('number parameters', 123, 'params'),
    readCase('array parameters', ['not', 'an', 'object'], 'params'),
    readCase('object without definitionKey', { otherField: 'value' }, 'missing'),
    readCase('object with null definitionKey', { definitionKey: null }, 'string'),
    readCase('object with undefined definitionKey', { definitionKey: undefined }, 'string'),
    readCase('object with empty string definitionKey', { definitionKey: '' }, 'nonEmpty'),
    readCase('object with whitespace-only definitionKey', { definitionKey: '   ' }, 'nonEmpty'),
    readCase(
      'object with untrimmed definitionKey (leading spaces)',
      { definitionKey: '  valid-key' },
      'trimmed'
    ),
    readCase(
      'object with untrimmed definitionKey (trailing spaces)',
      { definitionKey: 'valid-key  ' },
      'trimmed'
    ),
    readCase(
      'object with definitionKey containing forward slash',
      { definitionKey: 'invalid/key' },
      'unsafe'
    ),
    readCase(
      'object with definitionKey containing backslash',
      { definitionKey: 'invalid\\key' },
      'unsafe'
    ),
    readCase(
      'object with definitionKey containing dot-dot',
      { definitionKey: 'invalid..key' },
      'unsafe'
    ),
    readCase(
      'object with definitionKey containing control character',
      { definitionKey: 'invalid\x00key' },
      'unsafe'
    ),
    readCase('object with valid definitionKey and extra fields', {
      definitionKey: 'valid-key',
      extraField: 'value',
    }),
  ];

  runValidationCases({
    testCases,
    invoke: (params) => {
      const { validateReadParameters_ } = loadAssignmentDefinitionValidationModule();
      return () => validateReadParameters_(params.parameters);
    },
    method: 'getAssignmentDefinition',
    onSuccess: (result, params) => expect(result).toBe(params.parameters.definitionKey),
  });
});

describe('validateDefinitionKey_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const testCases = [
    keyCase('valid definitionKey string', 'valid-key', 0),
    keyCase('valid definitionKey with numbers', 'valid-key-123', 5),
    keyCase('non-string definitionKey (number)', 123, 0, 'string'),
    keyCase('non-string definitionKey (null)', null, 0, 'string'),
    keyCase('non-string definitionKey (undefined)', undefined, 0, 'string'),
    keyCase('empty string definitionKey', '', 0, 'nonEmpty'),
    keyCase('whitespace-only definitionKey', '   ', 0, 'nonEmpty'),
    keyCase('untrimmed definitionKey (leading spaces)', '  valid-key', 10, 'trimmed'),
    keyCase('untrimmed definitionKey (trailing spaces)', 'valid-key  ', 10, 'trimmed'),
  ];

  runValidationCases({
    testCases,
    invoke: (params) => {
      const { validateDefinitionKey_ } = loadAssignmentDefinitionValidationModule();
      return () => validateDefinitionKey_(params.definitionKey, params.rowIndex);
    },
    method: 'getAssignmentDefinitionPartials',
    expectDetails: true,
  });
});

describe('validatePrimaryTopicKey_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const testCases = [
    topicCase('valid primaryTopicKey string', 'valid-topic-key', 0),
    topicCase('non-string primaryTopicKey (number)', 123, 0, 'string'),
    topicCase('non-string primaryTopicKey (null)', null, 0, 'string'),
    topicCase('empty string primaryTopicKey', '', 0, 'nonEmpty'),
    topicCase('whitespace-only primaryTopicKey', '   ', 0, 'nonEmpty'),
    topicCase('untrimmed primaryTopicKey (leading spaces)', '  valid-topic-key', 5, 'trimmed'),
    topicCase('untrimmed primaryTopicKey (trailing spaces)', 'valid-topic-key  ', 5, 'trimmed'),
  ];

  runValidationCases({
    testCases,
    invoke: (params) => {
      const { validatePrimaryTopicKey_ } = loadAssignmentDefinitionValidationModule();
      return () => validatePrimaryTopicKey_(params.primaryTopicKey, params.rowIndex);
    },
    method: 'getAssignmentDefinitionPartials',
    expectDetails: true,
  });
});
