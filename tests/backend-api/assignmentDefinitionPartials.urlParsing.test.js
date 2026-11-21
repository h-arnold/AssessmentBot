import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  installAssignmentDefinitionControllerStub,
  loadAssignmentDefinitionPartialsModule,
  VALID_GOOGLE_URLS,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';
const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');

describe('extractSupportedDocumentDescriptor_ URL parsing regression tests', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it.each([
    {
      description: 'basic slides URL',
      url: VALID_GOOGLE_URLS.SLIDES.basic,
      expected: { documentId: '1aBcDeFgHiJkLmNoPqRsTuVwXyZ', documentType: 'SLIDES' },
    },
    {
      description: 'slides URL with query string',
      url: VALID_GOOGLE_URLS.SLIDES.withQuery,
      expected: { documentId: '2aBcDeFgHiJkLmNoPqRsTuVwXyZ', documentType: 'SLIDES' },
    },
    {
      description: 'slides URL with hash fragment',
      url: VALID_GOOGLE_URLS.SLIDES.withHash,
      expected: { documentId: '3aBcDeFgHiJkLmNoPqRsTuVwXyZ', documentType: 'SLIDES' },
    },
    {
      description: 'slides URL with query and hash',
      url: VALID_GOOGLE_URLS.SLIDES.withQueryAndHash,
      expected: { documentId: '4aBcDeFgHiJkLmNoPqRsTuVwXyZ', documentType: 'SLIDES' },
    },
    {
      description: 'slides URL in view mode',
      url: VALID_GOOGLE_URLS.SLIDES.viewMode,
      expected: { documentId: '5aBcDeFgHiJkLmNoPqRsTuVwXyZ', documentType: 'SLIDES' },
    },
    {
      description: 'slides URL with mixed case hostname',
      url: VALID_GOOGLE_URLS.SLIDES.mixedCaseHost,
      expected: { documentId: '6aBcDeFgHiJkLmNoPqRsTuVwXyZ', documentType: 'SLIDES' },
    },
    {
      description: 'basic sheets URL',
      url: VALID_GOOGLE_URLS.SHEETS.basic,
      expected: { documentId: '1xYzAbCdEfGhIjKlMnOpQrStUvWx', documentType: 'SHEETS' },
    },
    {
      description: 'sheets URL with query string',
      url: VALID_GOOGLE_URLS.SHEETS.withQuery,
      expected: { documentId: '2xYzAbCdEfGhIjKlMnOpQrStUvWx', documentType: 'SHEETS' },
    },
    {
      description: 'sheets URL with gid hash',
      url: VALID_GOOGLE_URLS.SHEETS.gsheetPrefix,
      expected: { documentId: '3xYzAbCdEfGhIjKlMnOpQrStUvWx', documentType: 'SHEETS' },
    },
  ])('correctly parses valid Google Docs URLs: $description', ({ url, expected }) => {
    installAssignmentDefinitionControllerStub([]);

    const { extractSupportedDocumentDescriptor_ } = loadAssignmentDefinitionPartialsModule();

    const result = extractSupportedDocumentDescriptor_(url, 'testField');

    expect(result).toEqual(expected);
  });

  it.each([
    {
      description: 'non-HTTPS protocol (http)',
      url: 'http://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
    },
    {
      description: 'non-HTTPS protocol (ftp)',
      url: 'ftp://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
    },
    {
      description: 'different hostname (drive.google.com)',
      url: 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
    },
    {
      description: 'different hostname (not google.com)',
      url: 'https://example.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
    },
    {
      description: 'missing document ID',
      url: 'https://docs.google.com/presentation/d/',
    },
    {
      description: 'missing path prefix',
      url: 'https://docs.google.com/document/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
    },
    {
      description: 'invalid path (forms instead of presentation)',
      url: 'https://docs.google.com/forms/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
    },
    {
      description: 'empty string',
      url: '',
    },
    {
      description: 'whitespace only',
      url: '   ',
    },
    {
      description: 'non-string value (number)',
      url: 12345,
    },
    {
      description: 'non-string value (null)',
      url: null,
    },
    {
      description: 'non-string value (undefined)',
      url: undefined,
    },
    {
      description: 'URL without protocol',
      url: 'docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
    },
  ])('rejects invalid URLs: $description', ({ url }) => {
    installAssignmentDefinitionControllerStub([]);

    const { extractSupportedDocumentDescriptor_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => extractSupportedDocumentDescriptor_(url, 'testField')).toThrow(ApiValidationError);
  });

  it('rejects URLs with unsupported document types', () => {
    installAssignmentDefinitionControllerStub([]);

    const { extractSupportedDocumentDescriptor_ } = loadAssignmentDefinitionPartialsModule();

    // Google Docs (documents) are not supported - only SLIDES and SHEETS
    const docUrl = 'https://docs.google.com/document/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit';
    expect(() => extractSupportedDocumentDescriptor_(docUrl, 'testField')).toThrow(
      ApiValidationError
    );
  });

  it('rejects URLs when reference and template point to same document', () => {
    installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const sameDocUrl = 'https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit';

    expect(() =>
      upsertAssignmentDefinition_({
        primaryTitle: 'Test Assignment',
        primaryTopicKey: 'test-topic',
        referenceDocumentUrl: sameDocUrl,
        templateDocumentUrl: sameDocUrl,
        yearGroupKey: 'year-10',
      })
    ).toThrow(ApiValidationError);
  });

  it('rejects URLs when reference and template have different document types', () => {
    installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const slidesUrl = 'https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit';
    const sheetsUrl = 'https://docs.google.com/spreadsheets/d/2xYzAbCdEfGhIjKlMnOpQrSt/edit';

    expect(() =>
      upsertAssignmentDefinition_({
        primaryTitle: 'Test Assignment',
        primaryTopicKey: 'test-topic',
        referenceDocumentUrl: slidesUrl,
        templateDocumentUrl: sheetsUrl,
        yearGroupKey: 'year-10',
      })
    ).toThrow(ApiValidationError);
  });

  it('correctly handles URLs with trailing slashes', () => {
    installAssignmentDefinitionControllerStub([]);

    const { extractSupportedDocumentDescriptor_ } = loadAssignmentDefinitionPartialsModule();

    const urlWithTrailingSlash =
      'https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/';

    // This should still work as the document ID is before any trailing slash
    // But based on the implementation, it might fail since there's no edit/view after /d/
    // Let's test the actual behavior
    const result = extractSupportedDocumentDescriptor_(urlWithTrailingSlash, 'testField');

    // The implementation splits by '/' and takes first segment after prefix
    // So for /presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/, the trailing slash creates an empty segment
    // which would cause documentId to be empty and fail validation
    expect(result).toEqual({ documentId: '1aBcDeFgHiJkLmNoPqRsTuVwXyZ', documentType: 'SLIDES' });
  });
});
