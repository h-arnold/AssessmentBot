import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const modulePath = '../../src/backend/z_Api/assignmentDefinitionPartials.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

// Test URLs similar to but not exactly the same as the example:
// https://docs.google.com/presentation/d/1udlgDTkZlHB6Xh4GKlOk6I0zJI-dvAF4iFAun09yW0k/edit
const VALID_GOOGLE_URLS = {
  SLIDES: {
    basic: 'https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
    withQuery:
      'https://docs.google.com/presentation/d/2aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit?usp=sharing',
    withHash: 'https://docs.google.com/presentation/d/3aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit#slide=id.p1',
    withQueryAndHash:
      'https://docs.google.com/presentation/d/4aBcDeFgHiJkLmNoPqRsTuVwXyZ/view?usp=sharing#slide=id.p1',
    viewMode: 'https://docs.google.com/presentation/d/5aBcDeFgHiJkLmNoPqRsTuVwXyZ/view',
    mixedCaseHost: 'https://DOCS.GOOGLE.COM/presentation/d/6aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
  },
  SHEETS: {
    basic: 'https://docs.google.com/spreadsheets/d/1xYzAbCdEfGhIjKlMnOpQrStUvWx/edit',
    withQuery:
      'https://docs.google.com/spreadsheets/d/2xYzAbCdEfGhIjKlMnOpQrStUvWx/edit?usp=sharing',
    gsheetPrefix: 'https://docs.google.com/spreadsheets/d/3xYzAbCdEfGhIjKlMnOpQrStUvWx/edit#gid=0',
  },
};

function loadAssignmentDefinitionPartialsModule() {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function buildValidPartial(overrides = {}) {
  return {
    primaryTitle: 'Algebra Baseline',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'topic-algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: ['Algebra Starter'],
    alternateTopics: ['Linear Equations'],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    assignmentWeighting: null,
    definitionKey: 'algebra-baseline',
    tasks: null,
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-06T12:30:00.000Z',
    ...overrides,
  };
}

function installAssignmentDefinitionControllerStub(partials) {
  const getAllPartialDefinitions = vi.fn(() => partials);
  const AssignmentDefinitionController = vi.fn(function StubAssignmentDefinitionController() {
    this.getAllPartialDefinitions = getAllPartialDefinitions;
  });

  globalThis.AssignmentDefinitionController = AssignmentDefinitionController;

  return { AssignmentDefinitionController, getAllPartialDefinitions };
}

describe('Api/assignmentDefinitionPartials transport contract', () => {
  let originalAssignmentDefinitionController;

  beforeEach(() => {
    originalAssignmentDefinitionController = globalThis.AssignmentDefinitionController;
  });

  afterEach(() => {
    delete require.cache[require.resolve(modulePath)];

    if (originalAssignmentDefinitionController === undefined) {
      delete globalThis.AssignmentDefinitionController;
    } else {
      globalThis.AssignmentDefinitionController = originalAssignmentDefinitionController;
    }

    vi.restoreAllMocks();
  });

  it('returns plain assignment-definition partial rows when all required fields are valid', () => {
    function ControllerLikePartial(overrides = {}) {
      Object.assign(this, buildValidPartial(overrides));
    }

    ControllerLikePartial.prototype.getDefinitionKey = function getDefinitionKey() {
      return this.definitionKey;
    };

    const controllerRows = [
      new ControllerLikePartial(),
      new ControllerLikePartial({ definitionKey: 'geometry-baseline', tasks: null }),
    ];

    const { AssignmentDefinitionController, getAllPartialDefinitions } =
      installAssignmentDefinitionControllerStub(controllerRows);

    const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();
    const result = getAssignmentDefinitionPartials_();
    const expectedRows = [
      buildValidPartial(),
      buildValidPartial({ definitionKey: 'geometry-baseline', tasks: null }),
    ];

    expect(result).toHaveLength(2);
    expect(result).toEqual(expectedRows);
    result.forEach((row) => {
      expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
      expect(row).not.toHaveProperty('getDefinitionKey');
    });

    expect(AssignmentDefinitionController).toHaveBeenCalledTimes(1);
    expect(getAllPartialDefinitions).toHaveBeenCalledTimes(1);
  });

  it('fails when a row is missing a required non-timestamp field', () => {
    const malformedRow = buildValidPartial();
    delete malformedRow.primaryTopic;
    const validRow = buildValidPartial({ definitionKey: 'geometry-baseline' });
    installAssignmentDefinitionControllerStub([validRow, malformedRow]);

    const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => getAssignmentDefinitionPartials_()).toThrow(ApiValidationError);
  });

  it.each([
    {
      caseName: 'createdAt is missing',
      mutateRow: (row) => {
        delete row.createdAt;
      },
    },
    {
      caseName: 'updatedAt is not an ISO string',
      mutateRow: (row) => {
        row.updatedAt = 'not-an-iso-date';
      },
    },
    {
      caseName: 'updatedAt is missing',
      mutateRow: (row) => {
        delete row.updatedAt;
      },
    },
    {
      caseName: 'createdAt is not an ISO string',
      mutateRow: (row) => {
        row.createdAt = 'not-an-iso-date';
      },
    },
    {
      caseName: 'createdAt is a non-existent calendar date',
      mutateRow: (row) => {
        row.createdAt = '2026-02-30T00:00:00.000Z';
      },
    },
  ])('fails when timestamp contract is invalid: $caseName', ({ mutateRow }) => {
    const malformedRow = buildValidPartial();
    mutateRow(malformedRow);
    const validRow = buildValidPartial({ definitionKey: 'geometry-baseline' });
    installAssignmentDefinitionControllerStub([validRow, malformedRow]);

    const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => getAssignmentDefinitionPartials_()).toThrow(ApiValidationError);
  });

  it.each([
    {
      caseName: 'definitionKey is missing',
      mutateRow: (row) => {
        delete row.definitionKey;
      },
    },
    {
      caseName: 'definitionKey is blank',
      mutateRow: (row) => {
        row.definitionKey = '   ';
      },
    },
    {
      caseName: 'definitionKey is not already trimmed',
      mutateRow: (row) => {
        row.definitionKey = ' algebra-baseline ';
      },
    },
  ])('fails when definitionKey contract is invalid: $caseName', ({ mutateRow }) => {
    const malformedRow = buildValidPartial();
    mutateRow(malformedRow);
    const validRow = buildValidPartial({ definitionKey: 'geometry-baseline' });
    installAssignmentDefinitionControllerStub([validRow, malformedRow]);

    const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => getAssignmentDefinitionPartials_()).toThrow(ApiValidationError);
  });

  it.each([
    {
      caseName: 'yearGroupKey is missing',
      mutateRow: (row) => {
        delete row.yearGroupKey;
      },
    },
    {
      caseName: 'yearGroupLabel is missing',
      mutateRow: (row) => {
        delete row.yearGroupLabel;
      },
    },
    {
      caseName: 'yearGroupLabel is blank',
      mutateRow: (row) => {
        row.yearGroupLabel = '   ';
      },
    },
    {
      caseName: 'primaryTopicKey is null',
      mutateRow: (row) => {
        row.primaryTopicKey = null;
      },
    },
    {
      caseName: 'primaryTopicKey is blank',
      mutateRow: (row) => {
        row.primaryTopicKey = '   ';
      },
    },
    {
      caseName: 'primaryTopicKey is not already trimmed',
      mutateRow: (row) => {
        row.primaryTopicKey = ' topic-algebra ';
      },
    },
  ])('fails when year-group/topic keyed-field contract is invalid: $caseName', ({ mutateRow }) => {
    const validRow = buildValidPartial({ definitionKey: 'geometry-baseline' });
    const malformedRow = buildValidPartial();
    mutateRow(malformedRow);
    installAssignmentDefinitionControllerStub([validRow, malformedRow]);

    const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => getAssignmentDefinitionPartials_()).toThrow(ApiValidationError);
  });
});

describe('extractSupportedDocumentDescriptor_ URL parsing regression tests', () => {
  let originalAssignmentDefinitionController;

  beforeEach(() => {
    originalAssignmentDefinitionController = globalThis.AssignmentDefinitionController;
  });

  afterEach(() => {
    delete require.cache[require.resolve(modulePath)];

    if (originalAssignmentDefinitionController === undefined) {
      delete globalThis.AssignmentDefinitionController;
    } else {
      globalThis.AssignmentDefinitionController = originalAssignmentDefinitionController;
    }

    vi.restoreAllMocks();
  });

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
