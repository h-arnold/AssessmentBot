import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  installAssignmentDefinitionControllerStub,
  loadAssignmentDefinitionPartialsModule,
  buildValidPartial,
  createMockDefinitionForPartialRow,
  expectPatternInSource,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';
const transportModulePath = '../../src/backend/z_Api/assignmentDefinitionTransport.js';
const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');

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
      new ControllerLikePartial({ definitionKey: 'geometry-baseline', tasks: [] }),
    ];

    const { AssignmentDefinitionController, getAllPartialDefinitions } =
      installAssignmentDefinitionControllerStub(controllerRows);

    const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();
    const result = getAssignmentDefinitionPartials_();
    const expectedRows = [
      buildValidPartial(),
      buildValidPartial({ definitionKey: 'geometry-baseline', tasks: [] }),
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

  it('ensures tasks field is an array for all partial definition rows', () => {
    const row1 = buildValidPartial({ definitionKey: 'algebra-baseline', tasks: [] });
    const row2 = buildValidPartial({ definitionKey: 'geometry-baseline', tasks: [] });
    installAssignmentDefinitionControllerStub([row1, row2]);

    const { getAssignmentDefinitionPartials_ } = loadAssignmentDefinitionPartialsModule();
    const result = getAssignmentDefinitionPartials_();

    expect(result).toHaveLength(2);
    result.forEach((row) => {
      expect(row.tasks).toEqual([]);
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
      getFullAssignmentDefinition: vi.fn((d) => d),
    };
    const { AssignmentDefinitionController } = installAssignmentDefinitionControllerStub([]);
    AssignmentDefinitionController.prototype.getDefinitionByKey = mockController.getDefinitionByKey;
    AssignmentDefinitionController.prototype.getFullAssignmentDefinition =
      mockController.getFullAssignmentDefinition;

    const { getAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const result = getAssignmentDefinition_({ definitionKey: 'test-key' });

    expect(AssignmentDefinitionController).toHaveBeenCalledTimes(1);
    expect(mockController.getDefinitionByKey).toHaveBeenCalledWith('test-key');
    expect(mockController.getFullAssignmentDefinition).toHaveBeenCalledWith(mockDefinition);
    expect(result).toEqual(mockDefinition);
  });

  it('should return null when definition is not found', () => {
    const mockController = {
      getDefinitionByKey: vi.fn(() => null),
      getFullAssignmentDefinition: vi.fn(),
    };
    const { AssignmentDefinitionController } = installAssignmentDefinitionControllerStub([]);
    AssignmentDefinitionController.prototype.getDefinitionByKey = mockController.getDefinitionByKey;
    AssignmentDefinitionController.prototype.getFullAssignmentDefinition =
      mockController.getFullAssignmentDefinition;

    const { getAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const result = getAssignmentDefinition_({ definitionKey: 'non-existent-key' });

    expect(result).toBeNull();
    expect(mockController.getFullAssignmentDefinition).not.toHaveBeenCalled();
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

describe('API layer: getAssignmentDefinitionPartials_ return shape', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('should export toTransportPartialRow_ helper', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(transportModulePath);
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');
    expect(typeof moduleExports.toTransportPartialRow_).toBe('function');
  });

  it('should use toTransportPartialRow_ for partial row serialization', () => {
    installAssignmentDefinitionControllerStub([]);
    expectPatternInSource('toTransportPartialRow_');
  });

  it('should defensively strip yearGroup field from partial JSON', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(transportModulePath);
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');

    const mockDefinition = createMockDefinitionForPartialRow({ yearGroup: '10' });
    const result = moduleExports.toTransportPartialRow_(mockDefinition);
    expect(result).not.toHaveProperty('yearGroup');
  });

  it('should normalize Date fields as ISO strings', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(transportModulePath);
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

    const moduleExports = require(transportModulePath);
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');

    const mockDefinition = createMockDefinitionForPartialRow();
    const result = moduleExports.toTransportPartialRow_(mockDefinition);

    expect(result.createdAt).toBe('2026-01-05T10:00:00.000Z');
    expect(result.updatedAt).toBe('2026-01-06T12:30:00.000Z');
  });

  it('should ensure tasks field is an array for partial definitions', () => {
    installAssignmentDefinitionControllerStub([]);

    const moduleExports = require(transportModulePath);
    expect(moduleExports).toHaveProperty('toTransportPartialRow_');

    const mockDefinition = createMockDefinitionForPartialRow();
    const result = moduleExports.toTransportPartialRow_(mockDefinition);

    expect(result.tasks).toEqual([]);
  });
});
