import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  installAssignmentDefinitionControllerStub,
  loadAssignmentDefinitionPartialsModule,
  buildValidPartial,
  createMockDefinitionForPartialRow,
  expectFunctionNotInSource,
  expectFunctionInSource,
  expectPatternInSource,
  expectPatternNotInSource,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';

const modulePath = '../../src/backend/z_Api/assignmentDefinitionPartials';
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

describe('Api/assignmentDefinitionPartials transport contract', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

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

  it('returns rows with yearGroup field stripped from objects that include it', () => {
    const rowWithYearGroup = {
      ...buildValidPartial(),
      yearGroup: 10,
    };
    const validRow = buildValidPartial({ definitionKey: 'geometry-baseline' });
    installAssignmentDefinitionControllerStub([validRow, rowWithYearGroup]);

    const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();
    const result = getAssignmentDefinitionPartials_();

    expect(result).toHaveLength(2);
    result.forEach((row) => {
      expect(row).not.toHaveProperty('yearGroup');
    });
  });

  it.each([
    {
      caseName: 'createdAt as Date object is normalised to ISO string',
      mutateRow: (row) => {
        row.createdAt = new Date('2026-01-05T10:00:00.000Z');
      },
      expectedCreatedAt: '2026-01-05T10:00:00.000Z',
      expectedUpdatedAt: '2026-01-06T12:30:00.000Z',
    },
    {
      caseName: 'updatedAt as Date object is normalised to ISO string',
      mutateRow: (row) => {
        row.updatedAt = new Date('2026-01-06T12:30:00.000Z');
      },
      expectedCreatedAt: '2026-01-05T10:00:00.000Z',
      expectedUpdatedAt: '2026-01-06T12:30:00.000Z',
    },
    {
      caseName: 'createdAt as ISO string remains unchanged',
      mutateRow: (row) => {
        row.createdAt = '2026-01-05T10:00:00.000Z';
      },
      expectedCreatedAt: '2026-01-05T10:00:00.000Z',
      expectedUpdatedAt: '2026-01-06T12:30:00.000Z',
    },
    {
      caseName: 'updatedAt as ISO string remains unchanged',
      mutateRow: (row) => {
        row.updatedAt = '2026-01-06T12:30:00.000Z';
      },
      expectedCreatedAt: '2026-01-05T10:00:00.000Z',
      expectedUpdatedAt: '2026-01-06T12:30:00.000Z',
    },
    {
      caseName: 'both timestamps as Date objects are normalised',
      mutateRow: (row) => {
        row.createdAt = new Date('2026-01-05T10:00:00.000Z');
        row.updatedAt = new Date('2026-01-06T12:30:00.000Z');
      },
      expectedCreatedAt: '2026-01-05T10:00:00.000Z',
      expectedUpdatedAt: '2026-01-06T12:30:00.000Z',
    },
  ])(
    'normalises Date fields correctly: $caseName',
    ({ mutateRow, expectedCreatedAt, expectedUpdatedAt }) => {
      const row = buildValidPartial();
      mutateRow(row);
      installAssignmentDefinitionControllerStub([row]);

      const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();
      const result = getAssignmentDefinitionPartials_();

      expect(result).toHaveLength(1);
      expect(result[0].createdAt).toBe(expectedCreatedAt);
      expect(result[0].updatedAt).toBe(expectedUpdatedAt);
    }
  );

  it.each([
    {
      caseName: 'definitionKey is present',
      mutateRow: (row) => {
        row.definitionKey = 'test-key';
      },
      assertProperty: (row) => {
        expect(row).toHaveProperty('definitionKey', 'test-key');
      },
    },
    {
      caseName: 'primaryTitle is present',
      mutateRow: (row) => {
        row.primaryTitle = 'Test Title';
      },
      assertProperty: (row) => {
        expect(row).toHaveProperty('primaryTitle', 'Test Title');
      },
    },
    {
      caseName: 'yearGroupKey is present',
      mutateRow: (row) => {
        row.yearGroupKey = 'year-group-10';
      },
      assertProperty: (row) => {
        expect(row).toHaveProperty('yearGroupKey', 'year-group-10');
      },
    },
  ])(
    'preserves expected fields in returned objects: $caseName',
    ({ mutateRow, assertProperty }) => {
      const row = buildValidPartial({ definitionKey: 'geometry-baseline' });
      mutateRow(row);
      installAssignmentDefinitionControllerStub([row]);

      const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();
      const result = getAssignmentDefinitionPartials_();

      expect(result).toHaveLength(1);
      assertProperty(result[0]);
    }
  );

  it.each([
    {
      caseName: 'yearGroup field is stripped even when present',
      mutateRow: (row) => {
        row.yearGroup = 10;
      },
    },
    {
      caseName: 'yearGroup null is stripped',
      mutateRow: (row) => {
        row.yearGroup = null;
      },
    },
    {
      caseName: 'yearGroup string is stripped',
      mutateRow: (row) => {
        row.yearGroup = '10';
      },
    },
    {
      caseName: 'yearGroupKey is preserved',
      mutateRow: (row) => {
        row.yearGroupKey = 'year-group-11';
      },
    },
    {
      caseName: 'yearGroupLabel is preserved',
      mutateRow: (row) => {
        row.yearGroupLabel = 'Year 11';
      },
    },
    {
      caseName: 'primaryTopicKey is preserved',
      mutateRow: (row) => {
        row.primaryTopicKey = 'topic-geometry';
      },
    },
  ])(
    'ensures correct year-group related fields in returned objects: $caseName',
    ({ mutateRow }) => {
      const row = buildValidPartial({ definitionKey: 'geometry-baseline' });
      mutateRow(row);
      installAssignmentDefinitionControllerStub([row]);

      const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();
      const result = getAssignmentDefinitionPartials_();

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('yearGroup');
      expect(result[0]).toHaveProperty('yearGroupKey');
      expect(result[0]).toHaveProperty('yearGroupLabel');
      expect(result[0]).toHaveProperty('primaryTopicKey');
    }
  );

  it('ensures tasks field is null for all partial definition rows', () => {
    const row1 = buildValidPartial({ definitionKey: 'algebra-baseline', tasks: null });
    const row2 = buildValidPartial({ definitionKey: 'geometry-baseline', tasks: null });
    installAssignmentDefinitionControllerStub([row1, row2]);

    const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();
    const result = getAssignmentDefinitionPartials_();

    expect(result).toHaveLength(2);
    result.forEach((row) => {
      expect(row.tasks).toBeNull();
    });
  });

  it('throws ApiValidationError when controller returns non-array', () => {
    installAssignmentDefinitionControllerStub('not-an-array');

    const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => getAssignmentDefinitionPartials_()).toThrow(ApiValidationError);
    expect(() => getAssignmentDefinitionPartials_()).toThrow(
      'Controller response must be an array.'
    );
  });
});

describe('deleteAssignmentDefinition_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('should delete assignment definition with valid parameters', () => {
    const mockController = {
      deleteDefinitionByKey: vi.fn(),
    };
    const { AssignmentDefinitionController } = installAssignmentDefinitionControllerStub([]);
    AssignmentDefinitionController.prototype.deleteDefinitionByKey =
      mockController.deleteDefinitionByKey;

    const { deleteAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    deleteAssignmentDefinition_({ definitionKey: 'test-key' });

    expect(AssignmentDefinitionController).toHaveBeenCalledTimes(1);
    expect(mockController.deleteDefinitionByKey).toHaveBeenCalledWith('test-key');
  });

  it('should throw ApiValidationError when parameters is null', () => {
    installAssignmentDefinitionControllerStub([]);

    const { deleteAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => deleteAssignmentDefinition_(null)).toThrow(ApiValidationError);
    expect(() => deleteAssignmentDefinition_(null)).toThrow('params must be an object.');
  });

  it('should throw ApiValidationError when parameters is missing definitionKey', () => {
    installAssignmentDefinitionControllerStub([]);

    const { deleteAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => deleteAssignmentDefinition_({})).toThrow(ApiValidationError);
    expect(() => deleteAssignmentDefinition_({})).toThrow('Missing required field: definitionKey.');
  });

  it('should throw ApiValidationError when definitionKey contains unsafe characters', () => {
    installAssignmentDefinitionControllerStub([]);

    const { deleteAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => deleteAssignmentDefinition_({ definitionKey: 'key/with/slash' })).toThrow(
      ApiValidationError
    );
    expect(() => deleteAssignmentDefinition_({ definitionKey: 'key/with/slash' })).toThrow(
      'definitionKey contains unsafe characters.'
    );
  });
});

describe('getAssignmentDefinition_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('should return canonical definition when definition is found', () => {
    const mockDefinition = {
      definitionKey: 'test-key',
      primaryTitle: 'Test Definition',
    };
    const mockController = {
      getDefinitionByKey: vi.fn(() => mockDefinition),
      toCanonicalFullDefinitionResponse: vi.fn((d) => d),
    };
    const { AssignmentDefinitionController } = installAssignmentDefinitionControllerStub([]);
    AssignmentDefinitionController.prototype.getDefinitionByKey = mockController.getDefinitionByKey;
    AssignmentDefinitionController.prototype.toCanonicalFullDefinitionResponse =
      mockController.toCanonicalFullDefinitionResponse;

    const { getAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const result = getAssignmentDefinition_({ definitionKey: 'test-key' });

    expect(AssignmentDefinitionController).toHaveBeenCalledTimes(1);
    expect(mockController.getDefinitionByKey).toHaveBeenCalledWith('test-key');
    expect(mockController.toCanonicalFullDefinitionResponse).toHaveBeenCalledWith(mockDefinition);
    expect(result).toEqual(mockDefinition);
  });

  it('should return null when definition is not found', () => {
    const mockController = {
      getDefinitionByKey: vi.fn(() => null),
      toCanonicalFullDefinitionResponse: vi.fn(),
    };
    const { AssignmentDefinitionController } = installAssignmentDefinitionControllerStub([]);
    AssignmentDefinitionController.prototype.getDefinitionByKey = mockController.getDefinitionByKey;
    AssignmentDefinitionController.prototype.toCanonicalFullDefinitionResponse =
      mockController.toCanonicalFullDefinitionResponse;

    const { getAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const result = getAssignmentDefinition_({ definitionKey: 'non-existent-key' });

    expect(result).toBeNull();
    expect(mockController.toCanonicalFullDefinitionResponse).not.toHaveBeenCalled();
  });

  it('should throw ApiValidationError when parameters is null', () => {
    installAssignmentDefinitionControllerStub([]);

    const { getAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => getAssignmentDefinition_(null)).toThrow(ApiValidationError);
    expect(() => getAssignmentDefinition_(null)).toThrow('params must be an object.');
  });

  it('should throw ApiValidationError when definitionKey is missing', () => {
    installAssignmentDefinitionControllerStub([]);

    const { getAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => getAssignmentDefinition_({})).toThrow(ApiValidationError);
    expect(() => getAssignmentDefinition_({})).toThrow('Missing required field: definitionKey.');
  });

  it('should throw ApiValidationError when definitionKey contains unsafe characters', () => {
    installAssignmentDefinitionControllerStub([]);

    const { getAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => getAssignmentDefinition_({ definitionKey: 'key\\with\\backslash' })).toThrow(
      ApiValidationError
    );
    expect(() => getAssignmentDefinition_({ definitionKey: 'key\\with\\backslash' })).toThrow(
      'definitionKey contains unsafe characters.'
    );
  });
});

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

// ============================================================================
// Section 5 Red Phase Tests - API layer: Remove helper functions, inline logic,
// and update transport boundary
// These tests are intentionally written to FAIL until Section 5 implementation is complete
// ============================================================================

describe('Section 5: API layer refactoring - Helper functions removed from source', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('should verify toCanonicalTransportDefinition_ is not present in source file', () => {
    installAssignmentDefinitionControllerStub([]);
    expectFunctionNotInSource('toCanonicalTransportDefinition_');
  });

  it('should verify buildControllerUpsertPayload_ is not present in source file', () => {
    installAssignmentDefinitionControllerStub([]);
    expectFunctionNotInSource('buildControllerUpsertPayload_');
  });

  it('should verify toPlainPartialRow_ is not present in source file', () => {
    installAssignmentDefinitionControllerStub([]);
    expectFunctionNotInSource('toPlainPartialRow_');
  });
});

describe('Section 5: API layer refactoring - Call sites updated', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('should verify upsertAssignmentDefinition_ calls controller.toCanonicalFullDefinitionResponse(definition)', () => {
    installAssignmentDefinitionControllerStub([]);
    expectPatternInSource('controller.toCanonicalFullDefinitionResponse(definition)');
    expectPatternNotInSource('toCanonicalTransportDefinition_(controller, definition)');
  });

  it('should verify getAssignmentDefinition_ calls controller.toCanonicalFullDefinitionResponse(definition)', () => {
    installAssignmentDefinitionControllerStub([]);
    expectPatternInSource('controller.toCanonicalFullDefinitionResponse(definition)');
    expectPatternNotInSource('toCanonicalTransportDefinition_(controller, definition)');
  });
});

describe('Section 5: API layer refactoring - getAssignmentDefinitionPartials_ return shape', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('should export toTransportPartialRow_ helper', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(modulePath);
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');
    expect(typeof moduleExports.toTransportPartialRow_).toBe('function');
  });

  it('should use toTransportPartialRow_ for partial row serialization', () => {
    installAssignmentDefinitionControllerStub([]);
    expectPatternInSource('toTransportPartialRow_');
  });

  it('should defensively strip yearGroup field from partial JSON', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(modulePath);
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');

    const mockDefinition = createMockDefinitionForPartialRow({ yearGroup: '10' });
    const result = moduleExports.toTransportPartialRow_(mockDefinition);
    expect(result).not.toHaveProperty('yearGroup');
  });

  it('should normalize Date fields as ISO strings', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(modulePath);
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');

    const createdAt = new Date('2026-01-05T10:00:00.000Z');
    const updatedAt = new Date('2026-01-06T12:30:00.000Z');
    const mockDefinition = createMockDefinitionForPartialRow({ createdAt, updatedAt });

    const result = moduleExports.toTransportPartialRow_(mockDefinition);

    expect(result.createdAt).toBe('2026-01-05T10:00:00.000Z');
    expect(result.updatedAt).toBe('2026-01-06T12:30:00.000Z');
  });

  it('should handle pre-normalised string dates correctly', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(modulePath);
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');

    const mockDefinition = createMockDefinitionForPartialRow();
    const result = moduleExports.toTransportPartialRow_(mockDefinition);

    expect(result.createdAt).toBe('2026-01-05T10:00:00.000Z');
    expect(result.updatedAt).toBe('2026-01-06T12:30:00.000Z');
  });

  it('should ensure tasks field is null for partial definitions', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(modulePath);
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');

    const mockDefinition = createMockDefinitionForPartialRow();
    const result = moduleExports.toTransportPartialRow_(mockDefinition);

    expect(result.tasks).toBeNull();
  });
});

describe('Section 5: API layer refactoring - Transport validation unchanged', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('should throw ApiValidationError when yearGroupKey is null via upsertAssignmentDefinition_', () => {
    installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const invalidPayload = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentId: 'ref-doc-001',
      templateDocumentId: 'tpl-doc-001',
      yearGroupKey: null,
    };

    expect(() => upsertAssignmentDefinition_(invalidPayload)).toThrow(ApiValidationError);
  });

  it('should throw ApiValidationError when yearGroupKey is missing via upsertAssignmentDefinition_', () => {
    installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const invalidPayload = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentId: 'ref-doc-001',
      templateDocumentId: 'tpl-doc-001',
      // yearGroupKey is missing
    };

    expect(() => upsertAssignmentDefinition_(invalidPayload)).toThrow(ApiValidationError);
  });

  it('should validate upsert parameters via validation helper', () => {
    installAssignmentDefinitionControllerStub([]);
    expectFunctionInSource('validateUpsertParameters_');
  });

  it('should validate read parameters via validation helper', () => {
    installAssignmentDefinitionControllerStub([]);
    expectFunctionInSource('validateReadParameters_');
  });

  it('should validate delete parameters via validation helper', () => {
    installAssignmentDefinitionControllerStub([]);
    expectFunctionInSource('validateDeleteParameters_');
  });
});

describe('Section 5: API layer refactoring - No assignmentWeighting defaulting in inlined code', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('should NOT add assignmentWeighting: 1 when missing from URL-based payload', () => {
    const { AssignmentDefinitionController } = installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    // Mock the controller to capture what payload it receives
    const receivedPayloads = [];
    AssignmentDefinitionController.prototype.upsertDefinition = vi.fn((payload) => {
      receivedPayloads.push(payload);
      return { definitionKey: 'test-key' };
    });

    // Mock toCanonicalFullDefinitionResponse
    AssignmentDefinitionController.prototype.toCanonicalFullDefinitionResponse = vi.fn((d) => d);

    // Need yearGroupKey for validation
    const payloadWithoutWeighting = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentUrl: VALID_GOOGLE_URLS.SLIDES.basic,
      templateDocumentUrl:
        'https://docs.google.com/presentation/d/2aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
      yearGroupKey: 'year-10',
      // assignmentWeighting is missing
    };

    upsertAssignmentDefinition_(payloadWithoutWeighting);

    // After Section 5: the inlined code should NOT add assignmentWeighting: 1
    // The payload passed to controller.upsertDefinition should NOT have assignmentWeighting added
    expect(receivedPayloads[0]).not.toHaveProperty('assignmentWeighting');
  });

  it('should NOT default assignmentWeighting when null in URL-based payload', () => {
    const { AssignmentDefinitionController } = installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const receivedPayloads = [];
    AssignmentDefinitionController.prototype.upsertDefinition = vi.fn((payload) => {
      receivedPayloads.push(payload);
      return { definitionKey: 'test-key' };
    });

    AssignmentDefinitionController.prototype.toCanonicalFullDefinitionResponse = vi.fn((d) => d);

    const payloadWithNullWeighting = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentUrl: VALID_GOOGLE_URLS.SLIDES.basic,
      templateDocumentUrl:
        'https://docs.google.com/presentation/d/2aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
      yearGroupKey: 'year-10',
      assignmentWeighting: null,
    };

    upsertAssignmentDefinition_(payloadWithNullWeighting);

    // After Section 5: the inlined code should NOT default null assignmentWeighting to 1
    // The payload passed to controller should preserve the null value
    expect(receivedPayloads[0]).toHaveProperty('assignmentWeighting', null);
  });

  it('should preserve provided assignmentWeighting values in URL-based payload', () => {
    const { AssignmentDefinitionController } = installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const receivedPayloads = [];
    AssignmentDefinitionController.prototype.upsertDefinition = vi.fn((payload) => {
      receivedPayloads.push(payload);
      return { definitionKey: 'test-key' };
    });

    AssignmentDefinitionController.prototype.toCanonicalFullDefinitionResponse = vi.fn((d) => d);

    const payloadWithWeighting = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentUrl: VALID_GOOGLE_URLS.SLIDES.basic,
      templateDocumentUrl:
        'https://docs.google.com/presentation/d/2aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
      yearGroupKey: 'year-10',
      assignmentWeighting: 5,
    };

    upsertAssignmentDefinition_(payloadWithWeighting);

    // Provided assignmentWeighting values should be preserved
    expect(receivedPayloads[0]).toHaveProperty('assignmentWeighting', 5);
  });
});

// ============================================================================
// Comprehensive Unit Tests for All Exported Validation Functions
// ============================================================================

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
    const { hasControlCharacters_ } = loadAssignmentDefinitionPartialsModule();
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
    const { isIsoDateTimeString_ } = loadAssignmentDefinitionPartialsModule();
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
    const module = loadAssignmentDefinitionPartialsModule();
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

describe('throwValidationError_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('throws ApiValidationError with correct properties', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwValidationError_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => throwValidationError_('test message', 'testField', 5)).toThrow(ApiValidationError);
    try {
      throwValidationError_('test message', 'testField', 5);
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('getAssignmentDefinitionPartials');
      expect(err.fieldName).toBe('testField');
      expect(err.details).toBe('rowIndex=5');
    }
  });

  it('throws ApiValidationError with null fieldName', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwValidationError_ } = loadAssignmentDefinitionPartialsModule();

    try {
      throwValidationError_('test message', null, 10);
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('getAssignmentDefinitionPartials');
      expect(err.fieldName).toBe(null);
      expect(err.details).toBe('rowIndex=10');
    }
  });

  it('throws ApiValidationError with zero rowIndex', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwValidationError_ } = loadAssignmentDefinitionPartialsModule();

    try {
      throwValidationError_('test message', 'field', 0);
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('getAssignmentDefinitionPartials');
      expect(err.fieldName).toBe('field');
      expect(err.details).toBe('rowIndex=0');
    }
  });
});

describe('throwReadValidationError_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('throws ApiValidationError with correct properties for read operations', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwReadValidationError_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => throwReadValidationError_('test message', 'testField')).toThrow(
      ApiValidationError
    );
    try {
      throwReadValidationError_('test message', 'testField');
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('getAssignmentDefinition');
      expect(err.fieldName).toBe('testField');
    }
  });

  it('throws ApiValidationError with null fieldName', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwReadValidationError_ } = loadAssignmentDefinitionPartialsModule();

    try {
      throwReadValidationError_('test message', null);
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('getAssignmentDefinition');
      expect(err.fieldName).toBe(null);
    }
  });
});

describe('throwUpsertValidationError_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('throws ApiValidationError with correct properties for upsert operations', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwUpsertValidationError_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => throwUpsertValidationError_('test message', 'testField')).toThrow(
      ApiValidationError
    );
    try {
      throwUpsertValidationError_('test message', 'testField');
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('upsertAssignmentDefinition');
      expect(err.fieldName).toBe('testField');
    }
  });

  it('throws ApiValidationError with null fieldName', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwUpsertValidationError_ } = loadAssignmentDefinitionPartialsModule();

    try {
      throwUpsertValidationError_('test message', null);
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('upsertAssignmentDefinition');
      expect(err.fieldName).toBe(null);
    }
  });
});

describe('throwDeleteValidationError_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('throws ApiValidationError with correct properties for delete operations', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwDeleteValidationError_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => throwDeleteValidationError_('test message', 'testField')).toThrow(
      ApiValidationError
    );
    try {
      throwDeleteValidationError_('test message', 'testField');
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('deleteAssignmentDefinition');
      expect(err.fieldName).toBe('testField');
    }
  });

  it('throws ApiValidationError with null fieldName', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwDeleteValidationError_ } = loadAssignmentDefinitionPartialsModule();

    try {
      throwDeleteValidationError_('test message', null);
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('deleteAssignmentDefinition');
      expect(err.fieldName).toBe(null);
    }
  });
});

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
      const { validateReadParameters_ } = loadAssignmentDefinitionPartialsModule();

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
      const { validateDefinitionKey_ } = loadAssignmentDefinitionPartialsModule();

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
      const { validatePrimaryTopicKey_ } = loadAssignmentDefinitionPartialsModule();

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
      const { validateYearGroupKeyedFields_ } = loadAssignmentDefinitionPartialsModule();

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
      const { validateTimestamp_ } = loadAssignmentDefinitionPartialsModule();

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

describe('validatePartialRow_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const buildValidRow = (overrides = {}) => ({
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
  });

  it.each([
    {
      description: 'valid partial row',
      row: buildValidRow(),
      rowIndex: 0,
      shouldThrow: false,
    },
    {
      description: 'valid partial row at different index',
      row: buildValidRow({ definitionKey: 'geometry-baseline' }),
      rowIndex: 5,
      shouldThrow: false,
    },
    {
      description: 'null row',
      row: null,
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'Each assignment definition partial row must be an object.',
      expectedField: null,
    },
    {
      description: 'undefined row',
      row: undefined,
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'Each assignment definition partial row must be an object.',
      expectedField: null,
    },
    {
      description: 'string row',
      row: 'not-an-object',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'Each assignment definition partial row must be an object.',
      expectedField: null,
    },
    {
      description: 'number row',
      row: 123,
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'Each assignment definition partial row must be an object.',
      expectedField: null,
    },
    {
      description: 'array row',
      row: ['not', 'an', 'object'],
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'Each assignment definition partial row must be an object.',
      expectedField: null,
    },
    {
      description: 'row with empty definitionKey',
      row: buildValidRow({ definitionKey: '' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'definitionKey must be a non-empty string.',
      expectedField: 'definitionKey',
    },
    {
      description: 'row with untrimmed definitionKey',
      row: buildValidRow({ definitionKey: '  algebra-baseline' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'definitionKey must already be trimmed.',
      expectedField: 'definitionKey',
    },
    {
      description: 'row with empty primaryTopicKey',
      row: buildValidRow({ primaryTopicKey: '' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'primaryTopicKey must be a non-empty string.',
      expectedField: 'primaryTopicKey',
    },
    {
      description: 'row with untrimmed primaryTopicKey',
      row: buildValidRow({ primaryTopicKey: '  topic-algebra' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'primaryTopicKey must already be trimmed.',
      expectedField: 'primaryTopicKey',
    },
    {
      description: 'row with empty yearGroupKey',
      row: buildValidRow({ yearGroupKey: '' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a non-empty string.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'row with empty yearGroupLabel',
      row: buildValidRow({ yearGroupLabel: '' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'yearGroupLabel must be a non-empty string.',
      expectedField: 'yearGroupLabel',
    },
    {
      description: 'row with non-null tasks',
      row: buildValidRow({ tasks: [{ id: 'task-1' }] }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'tasks must be null in partial transport.',
      expectedField: 'tasks',
    },
    {
      description: 'row with invalid createdAt',
      row: buildValidRow({ createdAt: 'invalid-date' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'createdAt must be null or an ISO datetime string.',
      expectedField: 'createdAt',
    },
    {
      description: 'row with invalid updatedAt',
      row: buildValidRow({ updatedAt: 'invalid-date' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'updatedAt must be null or an ISO datetime string.',
      expectedField: 'updatedAt',
    },
    {
      description: 'row with null createdAt (valid)',
      row: buildValidRow({ createdAt: null }),
      rowIndex: 0,
      shouldThrow: false,
    },
    {
      description: 'row with null updatedAt (valid)',
      row: buildValidRow({ updatedAt: null }),
      rowIndex: 0,
      shouldThrow: false,
    },
    {
      description: 'row missing required field: primaryTitle',
      row: (() => {
        const row = buildValidRow();
        delete row.primaryTitle;
        return row;
      })(),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'Missing required field: primaryTitle.',
      expectedField: 'primaryTitle',
    },
  ])(
    'handles $description correctly',
    ({ row, rowIndex, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validatePartialRow_ } = loadAssignmentDefinitionPartialsModule();

      if (shouldThrow) {
        expect(() => validatePartialRow_(row, rowIndex)).toThrow(ApiValidationError);
        expect(() => validatePartialRow_(row, rowIndex)).toThrow(expectedError);
        try {
          validatePartialRow_(row, rowIndex);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('getAssignmentDefinitionPartials');
          expect(err.details).toBe(`rowIndex=${rowIndex}`);
        }
      } else {
        expect(() => validatePartialRow_(row, rowIndex)).not.toThrow();
      }
    }
  );
});

describe('validateTaskWeightingsShape_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it.each([
    {
      description: 'undefined taskWeightings is valid',
      taskWeightings: undefined,
      shouldThrow: false,
    },
    {
      description: 'null taskWeightings throws error (not undefined)',
      taskWeightings: null,
      shouldThrow: true,
      expectedError: 'taskWeightings must be an array when provided.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'empty array taskWeightings',
      taskWeightings: [],
      shouldThrow: false,
    },
    {
      description: 'valid single task weighting',
      taskWeightings: [{ taskId: 'task-1', taskWeighting: 1 }],
      shouldThrow: false,
    },
    {
      description: 'valid multiple task weightings',
      taskWeightings: [
        { taskId: 'task-1', taskWeighting: 1 },
        { taskId: 'task-2', taskWeighting: 2 },
      ],
      shouldThrow: false,
    },
    {
      description: 'non-array taskWeightings',
      taskWeightings: 'not-an-array',
      shouldThrow: true,
      expectedError: 'taskWeightings must be an array when provided.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'non-array taskWeightings (object)',
      taskWeightings: { taskId: 'task-1', taskWeighting: 1 },
      shouldThrow: true,
      expectedError: 'taskWeightings must be an array when provided.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'array with null entry',
      taskWeightings: [null],
      shouldThrow: true,
      expectedError: 'taskWeightings entries must be objects.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'array with string entry',
      taskWeightings: ['not-an-object'],
      shouldThrow: true,
      expectedError: 'taskWeightings entries must be objects.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'array with number entry',
      taskWeightings: [123],
      shouldThrow: true,
      expectedError: 'taskWeightings entries must be objects.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'array with array entry',
      taskWeightings: [['nested', 'array']],
      shouldThrow: true,
      expectedError: 'taskWeightings entries must be objects.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'array entry missing taskId',
      taskWeightings: [{ taskWeighting: 1 }],
      shouldThrow: true,
      expectedError: 'taskWeightings entries must include taskId.',
      expectedField: 'taskWeightings[0].taskId',
    },
    {
      description: 'array entry with null taskId',
      taskWeightings: [{ taskId: null, taskWeighting: 1 }],
      shouldThrow: true,
      expectedError: 'taskWeightings.taskId must be a string.',
      expectedField: 'taskWeightings[0].taskId',
    },
    {
      description: 'array entry with empty string taskId',
      taskWeightings: [{ taskId: '', taskWeighting: 1 }],
      shouldThrow: true,
      expectedError: 'taskWeightings.taskId must be a non-empty string.',
      expectedField: 'taskWeightings[0].taskId',
    },
    {
      description: 'array entry with untrimmed taskId',
      taskWeightings: [{ taskId: '  task-1', taskWeighting: 1 }],
      shouldThrow: true,
      expectedError: 'taskWeightings.taskId must already be trimmed.',
      expectedField: 'taskWeightings[0].taskId',
    },
    {
      description: 'array entry with taskId containing forward slash',
      taskWeightings: [{ taskId: 'invalid/key', taskWeighting: 1 }],
      shouldThrow: true,
      expectedError: 'taskWeightings.taskId contains unsafe characters.',
      expectedField: 'taskWeightings[0].taskId',
    },
    {
      description: 'array entry missing taskWeighting',
      taskWeightings: [{ taskId: 'task-1' }],
      shouldThrow: true,
      expectedError: 'taskWeightings entries must include taskWeighting.',
      expectedField: 'taskWeightings[0].taskWeighting',
    },
    {
      description: 'array entry with null taskWeighting (valid)',
      taskWeightings: [{ taskId: 'task-1', taskWeighting: null }],
      shouldThrow: false,
    },
    {
      description: 'array entry with zero taskWeighting (valid)',
      taskWeightings: [{ taskId: 'task-1', taskWeighting: 0 }],
      shouldThrow: false,
    },
    {
      description: 'array entry with negative taskWeighting (valid - no range check in transport)',
      taskWeightings: [{ taskId: 'task-1', taskWeighting: -1 }],
      shouldThrow: false,
    },
  ])(
    'handles $description correctly',
    ({ taskWeightings, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validateTaskWeightingsShape_ } = loadAssignmentDefinitionPartialsModule();

      if (shouldThrow) {
        expect(() => validateTaskWeightingsShape_(taskWeightings)).toThrow(ApiValidationError);
        expect(() => validateTaskWeightingsShape_(taskWeightings)).toThrow(expectedError);
        try {
          validateTaskWeightingsShape_(taskWeightings);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('upsertAssignmentDefinition');
        }
      } else {
        expect(() => validateTaskWeightingsShape_(taskWeightings)).not.toThrow();
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
      const { validateRequiredYearGroupKey_ } = loadAssignmentDefinitionPartialsModule();

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
      description: 'non-string yearGroupKey',
      parameters: buildValidUpsertParams({ yearGroupKey: 123 }),
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a string when provided.',
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
      const { validateUpsertParameters_ } = loadAssignmentDefinitionPartialsModule();

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
    const { validateUpsertParameters_ } = loadAssignmentDefinitionPartialsModule();

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
      const { validateWizardUpsertParameters_ } = loadAssignmentDefinitionPartialsModule();

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
