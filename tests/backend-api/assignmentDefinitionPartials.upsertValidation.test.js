import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  installAssignmentDefinitionControllerStub,
  loadAssignmentDefinitionValidationModule,
  VALID_GOOGLE_URLS,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';
const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');

describe('validateUpsertParameters_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const buildValidUpsertParams = (overrides = {}) => ({
    primaryTitle: 'Test Assignment',
    primaryTopicKey: 'test-topic',
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    yearGroupKey: 'year-10',
    ...overrides,
  });

  it.each([
    {
      description: 'valid upsert parameters',
      parameters: buildValidUpsertParams(),
      shouldThrow: false,
    },
    {
      description: 'valid upsert parameters with definitionKey',
      parameters: buildValidUpsertParams({ definitionKey: 'test-key' }),
      shouldThrow: false,
    },
    {
      description: 'valid upsert parameters with taskWeightings',
      parameters: buildValidUpsertParams({
        taskWeightings: [{ taskId: 'task-1', taskWeighting: 1 }],
      }),
      shouldThrow: false,
    },
    {
      description: 'valid upsert parameters with assignmentWeighting',
      parameters: buildValidUpsertParams({ assignmentWeighting: 5 }),
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
      description: 'array parameters',
      parameters: ['not', 'an', 'object'],
      shouldThrow: true,
      expectedError: 'params must be an object.',
      expectedField: 'params',
    },
    {
      description: 'non-string primaryTitle',
      parameters: buildValidUpsertParams({ primaryTitle: 123 }),
      shouldThrow: true,
      expectedError: 'primaryTitle must be a string.',
      expectedField: 'primaryTitle',
    },
    {
      description: 'primaryTopicKey with forward slash',
      parameters: buildValidUpsertParams({ primaryTopicKey: 'invalid/key' }),
      shouldThrow: true,
      expectedError: 'primaryTopicKey contains unsafe characters.',
      expectedField: 'primaryTopicKey',
    },
    {
      description: 'non-string referenceDocumentId',
      parameters: buildValidUpsertParams({ referenceDocumentId: 123 }),
      shouldThrow: true,
      expectedError: 'referenceDocumentId must be a string.',
      expectedField: 'referenceDocumentId',
    },
    {
      description: 'non-string templateDocumentId',
      parameters: buildValidUpsertParams({ templateDocumentId: 123 }),
      shouldThrow: true,
      expectedError: 'templateDocumentId must be a string.',
      expectedField: 'templateDocumentId',
    },
    {
      description: 'non-string yearGroupKey',
      parameters: buildValidUpsertParams({ yearGroupKey: 123 }),
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a string when provided.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'null yearGroupKey',
      parameters: buildValidUpsertParams({ yearGroupKey: null }),
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a non-null selected reference-data key.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'invalid definitionKey (non-string)',
      parameters: buildValidUpsertParams({ definitionKey: 123 }),
      shouldThrow: true,
      expectedError: 'definitionKey must be a string when provided.',
      expectedField: 'definitionKey',
    },
    {
      description: 'invalid definitionKey (empty string)',
      parameters: buildValidUpsertParams({ definitionKey: '' }),
      shouldThrow: true,
      expectedError: 'definitionKey must be a non-empty string.',
      expectedField: 'definitionKey',
    },
    {
      description: 'invalid definitionKey (untrimmed)',
      parameters: buildValidUpsertParams({ definitionKey: '  test-key' }),
      shouldThrow: true,
      expectedError: 'definitionKey must already be trimmed.',
      expectedField: 'definitionKey',
    },
    {
      description: 'invalid taskWeightings (non-array)',
      parameters: buildValidUpsertParams({ taskWeightings: 'not-an-array' }),
      shouldThrow: true,
      expectedError: 'taskWeightings must be an array when provided.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'invalid taskWeightings entry (missing taskId)',
      parameters: buildValidUpsertParams({ taskWeightings: [{ taskWeighting: 1 }] }),
      shouldThrow: true,
      expectedError: 'taskWeightings entries must include taskId.',
      expectedField: 'taskWeightings[0].taskId',
    },
    {
      description: 'missing required field: primaryTitle',
      parameters: {
        primaryTopicKey: 'test-topic',
        referenceDocumentId: 'ref-001',
        templateDocumentId: 'tpl-001',
        yearGroupKey: 'year-10',
      },
      shouldThrow: true,
      expectedError: 'Missing required field: primaryTitle.',
      expectedField: 'primaryTitle',
    },
    {
      description: 'missing required field: referenceDocumentId',
      parameters: {
        primaryTitle: 'Test',
        primaryTopicKey: 'test-topic',
        templateDocumentId: 'tpl-001',
        yearGroupKey: 'year-10',
      },
      shouldThrow: true,
      expectedError: 'Missing required field: referenceDocumentId.',
      expectedField: 'referenceDocumentId',
    },
  ])(
    'handles $description correctly',
    ({ parameters, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validateUpsertParameters_ } = loadAssignmentDefinitionValidationModule();

      if (shouldThrow) {
        expect(() => validateUpsertParameters_(parameters)).toThrow(ApiValidationError);
        expect(() => validateUpsertParameters_(parameters)).toThrow(expectedError);
        try {
          validateUpsertParameters_(parameters);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('upsertAssignmentDefinition');
        }
      } else {
        expect(() => validateUpsertParameters_(parameters)).not.toThrow();
      }
    }
  );

  it('delegates to validateWizardUpsertParameters_ when document URLs are present', () => {
    installAssignmentDefinitionControllerStub([]);
    const { validateUpsertParameters_ } = loadAssignmentDefinitionValidationModule();

    const urlParams = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentUrl: VALID_GOOGLE_URLS.SLIDES.basic,
      templateDocumentUrl:
        'https://docs.google.com/presentation/d/2aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
      yearGroupKey: 'year-10',
    };

    expect(() => validateUpsertParameters_(urlParams)).not.toThrow();
  });
});

describe('validateWizardUpsertParameters_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const buildValidWizardParams = (overrides = {}) => ({
    primaryTitle: 'Test Assignment',
    primaryTopicKey: 'test-topic',
    referenceDocumentUrl: VALID_GOOGLE_URLS.SLIDES.basic,
    templateDocumentUrl: 'https://docs.google.com/presentation/d/2aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
    yearGroupKey: 'year-10',
    ...overrides,
  });

  it.each([
    {
      description: 'valid wizard upsert parameters',
      parameters: buildValidWizardParams(),
      shouldThrow: false,
    },
    {
      description: 'valid wizard parameters with definitionKey',
      parameters: buildValidWizardParams({ definitionKey: 'test-key' }),
      shouldThrow: false,
    },
    {
      description: 'non-string primaryTitle',
      parameters: buildValidWizardParams({ primaryTitle: 123 }),
      shouldThrow: true,
      expectedError: 'primaryTitle must be a string.',
      expectedField: 'primaryTitle',
    },
    {
      description: 'primaryTopicKey with control character',
      parameters: buildValidWizardParams({ primaryTopicKey: 'invalid\x00key' }),
      shouldThrow: true,
      expectedError: 'primaryTopicKey contains unsafe characters.',
      expectedField: 'primaryTopicKey',
    },
    {
      description: 'invalid referenceDocumentUrl (non-string)',
      parameters: buildValidWizardParams({ referenceDocumentUrl: 123 }),
      shouldThrow: true,
      expectedError: 'referenceDocumentUrl must be a non-empty string URL.',
      expectedField: 'referenceDocumentUrl',
    },
    {
      description: 'invalid referenceDocumentUrl (empty string)',
      parameters: buildValidWizardParams({ referenceDocumentUrl: '' }),
      shouldThrow: true,
      expectedError: 'referenceDocumentUrl must be a non-empty string URL.',
      expectedField: 'referenceDocumentUrl',
    },
    {
      description: 'invalid referenceDocumentUrl (not a valid URL)',
      parameters: buildValidWizardParams({ referenceDocumentUrl: 'not-a-valid-url' }),
      shouldThrow: true,
      expectedError: 'referenceDocumentUrl must be a valid URL.',
      expectedField: 'referenceDocumentUrl',
    },
    {
      description: 'invalid templateDocumentUrl',
      parameters: buildValidWizardParams({ templateDocumentUrl: 'not-a-valid-url' }),
      shouldThrow: true,
      expectedError: 'templateDocumentUrl must be a valid URL.',
      expectedField: 'templateDocumentUrl',
    },
    {
      description: 'non-string yearGroupKey',
      parameters: buildValidWizardParams({ yearGroupKey: 123 }),
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a string when provided.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'null yearGroupKey',
      parameters: buildValidWizardParams({ yearGroupKey: null }),
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a non-null selected reference-data key.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'same document for reference and template URLs',
      parameters: buildValidWizardParams({
        referenceDocumentUrl: VALID_GOOGLE_URLS.SLIDES.basic,
        templateDocumentUrl: VALID_GOOGLE_URLS.SLIDES.basic,
      }),
      shouldThrow: true,
      expectedError:
        'referenceDocumentUrl and templateDocumentUrl must point to different documents.',
      expectedField: 'referenceDocumentUrl',
    },
    {
      description: 'different document types for reference and template URLs',
      parameters: buildValidWizardParams({
        referenceDocumentUrl: VALID_GOOGLE_URLS.SLIDES.basic,
        templateDocumentUrl: VALID_GOOGLE_URLS.SHEETS.basic,
      }),
      shouldThrow: true,
      expectedError:
        'referenceDocumentUrl and templateDocumentUrl must use the same supported document type.',
      expectedField: 'documentType',
    },
    {
      description: 'valid sheets URLs',
      parameters: buildValidWizardParams({
        referenceDocumentUrl: VALID_GOOGLE_URLS.SHEETS.basic,
        templateDocumentUrl:
          'https://docs.google.com/spreadsheets/d/2xYzAbCdEfGhIjKlMnOpQrStUvWx/edit',
      }),
      shouldThrow: false,
    },
    {
      description: 'valid with taskWeightings',
      parameters: buildValidWizardParams({
        taskWeightings: [{ taskId: 'task-1', taskWeighting: 1 }],
      }),
      shouldThrow: false,
    },
    {
      description: 'missing required field: primaryTitle',
      parameters: {
        primaryTopicKey: 'test-topic',
        referenceDocumentUrl: VALID_GOOGLE_URLS.SLIDES.basic,
        templateDocumentUrl:
          'https://docs.google.com/presentation/d/2aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
        yearGroupKey: 'year-10',
      },
      shouldThrow: true,
      expectedError: 'Missing required field: primaryTitle.',
      expectedField: 'primaryTitle',
    },
    {
      description: 'missing required field: referenceDocumentUrl',
      parameters: {
        primaryTitle: 'Test',
        primaryTopicKey: 'test-topic',
        templateDocumentUrl:
          'https://docs.google.com/presentation/d/2aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
        yearGroupKey: 'year-10',
      },
      shouldThrow: true,
      expectedError: 'Missing required field: referenceDocumentUrl.',
      expectedField: 'referenceDocumentUrl',
    },
  ])(
    'handles $description correctly',
    ({ parameters, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validateWizardUpsertParameters_ } = loadAssignmentDefinitionValidationModule();

      if (shouldThrow) {
        expect(() => validateWizardUpsertParameters_(parameters)).toThrow(ApiValidationError);
        expect(() => validateWizardUpsertParameters_(parameters)).toThrow(expectedError);
        try {
          validateWizardUpsertParameters_(parameters);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('upsertAssignmentDefinition');
        }
      } else {
        expect(() => validateWizardUpsertParameters_(parameters)).not.toThrow();
      }
    }
  );
});
