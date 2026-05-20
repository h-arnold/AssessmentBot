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

// ============================================================================
// Section 5 Red Phase Tests - API layer: Remove helper functions, inline logic,
// and update transport boundary
// These tests are intentionally written to FAIL until Section 5 implementation is complete
// ============================================================================

describe('Section 5: API layer refactoring - Helper functions removed from source', () => {
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

  it('should verify toCanonicalTransportDefinition_ is not present in source file', () => {
    installAssignmentDefinitionControllerStub([]);

    // Read the source file to check for the function definition
    const fs = require('fs');
    const path = require('path');
    const absolutePath = path.resolve(__dirname, modulePath);
    const sourceCode = fs.readFileSync(absolutePath, 'utf8');

    // After Section 5 implementation, toCanonicalTransportDefinition_ should be removed from source
    expect(sourceCode).not.toContain('function toCanonicalTransportDefinition_');
  });

  it('should verify buildControllerUpsertPayload_ is not present in source file', () => {
    installAssignmentDefinitionControllerStub([]);

    const fs = require('fs');
    const path = require('path');
    const absolutePath = path.resolve(__dirname, modulePath);
    const sourceCode = fs.readFileSync(absolutePath, 'utf8');

    // After Section 5 implementation, buildControllerUpsertPayload_ should be removed from source
    expect(sourceCode).not.toContain('function buildControllerUpsertPayload_');
  });

  it('should verify toPlainPartialRow_ is not present in source file', () => {
    installAssignmentDefinitionControllerStub([]);

    const fs = require('fs');
    const path = require('path');
    const absolutePath = path.resolve(__dirname, modulePath);
    const sourceCode = fs.readFileSync(absolutePath, 'utf8');

    // After Section 5 implementation, toPlainPartialRow_ should be removed from source
    expect(sourceCode).not.toContain('function toPlainPartialRow_');
  });
});

describe('Section 5: API layer refactoring - Call sites updated', () => {
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

  it('should verify upsertAssignmentDefinition_ calls controller.toCanonicalFullDefinitionResponse(definition)', () => {
    installAssignmentDefinitionControllerStub([]);

    // Read source to check that upsertAssignmentDefinition_ calls controller.toCanonicalFullDefinitionResponse directly
    const fs = require('fs');
    const path = require('path');
    const absolutePath = path.resolve(__dirname, modulePath);
    const sourceCode = fs.readFileSync(absolutePath, 'utf8');

    // After Section 5: upsertAssignmentDefinition_ should call controller.toCanonicalFullDefinitionResponse(definition) directly
    // not toCanonicalTransportDefinition_(controller, definition)
    expect(sourceCode).toContain('controller.toCanonicalFullDefinitionResponse(definition)');
    expect(sourceCode).not.toContain('toCanonicalTransportDefinition_(controller, definition)');
  });

  it('should verify getAssignmentDefinition_ calls controller.toCanonicalFullDefinitionResponse(definition)', () => {
    installAssignmentDefinitionControllerStub([]);

    // Read source to check that getAssignmentDefinition_ calls controller.toCanonicalFullDefinitionResponse directly
    const fs = require('fs');
    const path = require('path');
    const absolutePath = path.resolve(__dirname, modulePath);
    const sourceCode = fs.readFileSync(absolutePath, 'utf8');

    // After Section 5: getAssignmentDefinition_ should call controller.toCanonicalFullDefinitionResponse(definition) directly
    // not toCanonicalTransportDefinition_(controller, definition)
    expect(sourceCode).toContain('controller.toCanonicalFullDefinitionResponse(definition)');
    expect(sourceCode).not.toContain('toCanonicalTransportDefinition_(controller, definition)');
  });
});

describe('Section 5: API layer refactoring - getAssignmentDefinitionPartials_ return shape', () => {
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

  it('should export toTransportPartialRow_ helper', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(modulePath);
    // After Section 5: toTransportPartialRow_ should be exported for test accessibility
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');
    expect(typeof moduleExports.toTransportPartialRow_).toBe('function');
  });

  it('should use toTransportPartialRow_ for partial row serialization', () => {
    installAssignmentDefinitionControllerStub([]);

    // Read the source file to check that getAssignmentDefinitionPartials_ uses toTransportPartialRow_
    const fs = require('fs');
    const path = require('path');
    const absolutePath = path.resolve(__dirname, modulePath);
    const sourceCode = fs.readFileSync(absolutePath, 'utf8');

    // After Section 5: getAssignmentDefinitionPartials_ should call toTransportPartialRow_(definition)
    // not toPlainPartialRow_(row)
    expect(sourceCode).toContain('toTransportPartialRow_');
  });

  it('should defensively strip yearGroup field from partial JSON', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(modulePath);

    // After Section 5: toTransportPartialRow_ should be exported and strip yearGroup
    // This test will fail until toTransportPartialRow_ is exported
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');

    // Create a mock definition with yearGroup in its output
    const mockDefinition = {
      toPartialJSON: () => ({
        primaryTitle: 'Test',
        primaryTopic: 'Test Topic',
        primaryTopicKey: 'test-topic',
        yearGroupKey: 'year-10',
        yearGroupLabel: 'Year 10',
        yearGroup: '10', // This should be stripped
        alternateTitles: [],
        alternateTopics: [],
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-001',
        templateDocumentId: 'tpl-001',
        assignmentWeighting: 1,
        definitionKey: 'test-key',
        tasks: null,
        createdAt: '2026-01-05T10:00:00.000Z',
        updatedAt: '2026-01-06T12:30:00.000Z',
      }),
    };

    const result = moduleExports.toTransportPartialRow_(mockDefinition);
    expect(result).not.toHaveProperty('yearGroup');
  });

  it('should normalize Date fields as ISO strings', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(modulePath);

    // This test will fail until toTransportPartialRow_ is exported
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');

    const createdAt = new Date('2026-01-05T10:00:00.000Z');
    const updatedAt = new Date('2026-01-06T12:30:00.000Z');

    const mockDefinition = {
      toPartialJSON: () => ({
        primaryTitle: 'Test',
        primaryTopic: 'Test Topic',
        primaryTopicKey: 'test-topic',
        yearGroupKey: 'year-10',
        yearGroupLabel: 'Year 10',
        alternateTitles: [],
        alternateTopics: [],
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-001',
        templateDocumentId: 'tpl-001',
        assignmentWeighting: 1,
        definitionKey: 'test-key',
        tasks: null,
        createdAt,
        updatedAt,
      }),
    };

    const result = moduleExports.toTransportPartialRow_(mockDefinition);

    expect(result.createdAt).toBe('2026-01-05T10:00:00.000Z');
    expect(result.updatedAt).toBe('2026-01-06T12:30:00.000Z');
  });

  it('should handle pre-normalised string dates correctly', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(modulePath);

    // This test will fail until toTransportPartialRow_ is exported
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');

    const mockDefinition = {
      toPartialJSON: () => ({
        primaryTitle: 'Test',
        primaryTopic: 'Test Topic',
        primaryTopicKey: 'test-topic',
        yearGroupKey: 'year-10',
        yearGroupLabel: 'Year 10',
        alternateTitles: [],
        alternateTopics: [],
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-001',
        templateDocumentId: 'tpl-001',
        assignmentWeighting: 1,
        definitionKey: 'test-key',
        tasks: null,
        createdAt: '2026-01-05T10:00:00.000Z',
        updatedAt: '2026-01-06T12:30:00.000Z',
      }),
    };

    const result = moduleExports.toTransportPartialRow_(mockDefinition);

    expect(result.createdAt).toBe('2026-01-05T10:00:00.000Z');
    expect(result.updatedAt).toBe('2026-01-06T12:30:00.000Z');
  });

  it('should ensure tasks field is null for partial definitions', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(modulePath);

    // This test will fail until toTransportPartialRow_ is exported
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');

    const mockDefinition = {
      toPartialJSON: () => ({
        primaryTitle: 'Test',
        primaryTopic: 'Test Topic',
        primaryTopicKey: 'test-topic',
        yearGroupKey: 'year-10',
        yearGroupLabel: 'Year 10',
        alternateTitles: [],
        alternateTopics: [],
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-001',
        templateDocumentId: 'tpl-001',
        assignmentWeighting: 1,
        definitionKey: 'test-key',
        tasks: null,
        createdAt: '2026-01-05T10:00:00.000Z',
        updatedAt: '2026-01-06T12:30:00.000Z',
      }),
    };

    const result = moduleExports.toTransportPartialRow_(mockDefinition);

    expect(result.tasks).toBeNull();
  });
});

describe('Section 5: API layer refactoring - Transport validation unchanged', () => {
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

    // Read source to verify validateUpsertParameters_ exists
    const fs = require('fs');
    const path = require('path');
    const absolutePath = path.resolve(__dirname, modulePath);
    const sourceCode = fs.readFileSync(absolutePath, 'utf8');

    // validateUpsertParameters_ should still exist in source
    expect(sourceCode).toContain('function validateUpsertParameters_');
  });

  it('should validate read parameters via validation helper', () => {
    installAssignmentDefinitionControllerStub([]);

    const fs = require('fs');
    const path = require('path');
    const absolutePath = path.resolve(__dirname, modulePath);
    const sourceCode = fs.readFileSync(absolutePath, 'utf8');

    // validateReadParameters_ should still exist in source
    expect(sourceCode).toContain('function validateReadParameters_');
  });

  it('should validate delete parameters via validation helper', () => {
    installAssignmentDefinitionControllerStub([]);

    const fs = require('fs');
    const path = require('path');
    const absolutePath = path.resolve(__dirname, modulePath);
    const sourceCode = fs.readFileSync(absolutePath, 'utf8');

    // validateDeleteParameters_ should still exist in source
    expect(sourceCode).toContain('function validateDeleteParameters_');
  });
});

describe('Section 5: API layer refactoring - No assignmentWeighting defaulting in inlined code', () => {
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

  it('should NOT add assignmentWeighting: 1 when missing from URL-based payload', () => {
    installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    // Mock the controller to capture what payload it receives
    const receivedPayloads = [];
    globalThis.AssignmentDefinitionController.prototype.upsertDefinition = vi.fn((payload) => {
      receivedPayloads.push(payload);
      return { definitionKey: 'test-key' };
    });

    // Mock toCanonicalFullDefinitionResponse
    globalThis.AssignmentDefinitionController.prototype.toCanonicalFullDefinitionResponse = vi.fn(
      (d) => d
    );

    // Need yearGroupKey for validation
    const payloadWithoutWeighting = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentUrl:
        'https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
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
    installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const receivedPayloads = [];
    globalThis.AssignmentDefinitionController.prototype.upsertDefinition = vi.fn((payload) => {
      receivedPayloads.push(payload);
      return { definitionKey: 'test-key' };
    });

    globalThis.AssignmentDefinitionController.prototype.toCanonicalFullDefinitionResponse = vi.fn(
      (d) => d
    );

    const payloadWithNullWeighting = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentUrl:
        'https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
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
    installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const receivedPayloads = [];
    globalThis.AssignmentDefinitionController.prototype.upsertDefinition = vi.fn((payload) => {
      receivedPayloads.push(payload);
      return { definitionKey: 'test-key' };
    });

    globalThis.AssignmentDefinitionController.prototype.toCanonicalFullDefinitionResponse = vi.fn(
      (d) => d
    );

    const payloadWithWeighting = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentUrl:
        'https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
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
