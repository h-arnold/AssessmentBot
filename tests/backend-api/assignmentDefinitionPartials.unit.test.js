import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const modulePath = '../../src/backend/z_Api/assignmentDefinitionPartials.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

function loadAssignmentDefinitionPartialsModule() {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function buildValidPartial(overrides = {}) {
  return {
    primaryTitle: 'Algebra Baseline',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'topic-algebra',
    yearGroup: 10,
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
  ])('fails when primaryTopicKey contract is invalid: $caseName', ({ mutateRow }) => {
    const validRow = buildValidPartial({ definitionKey: 'geometry-baseline' });
    const malformedRow = buildValidPartial();
    mutateRow(malformedRow);
    installAssignmentDefinitionControllerStub([validRow, malformedRow]);

    const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();

    expect(() => getAssignmentDefinitionPartials_()).toThrow(ApiValidationError);
  });
});
