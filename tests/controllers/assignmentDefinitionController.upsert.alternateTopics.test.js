import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createUpsertPayload,
  seedExistingDefinition,
  setupUpsertControllerTestBed,
} from './assignmentDefinitionUpsertTestHelpers.js';

const extractSlidesTaskDefinitionsMock = vi.fn();
const extractSheetsTaskDefinitionsMock = vi.fn();

vi.mock('../../src/backend/DbManager/DbManager.js');
vi.mock('../../src/backend/GoogleDriveManager/DriveManager.js');
vi.mock('../../src/backend/DocumentParsers/SlidesParser.js', () => {
  return {
    default: class {
      extractTaskDefinitions(referenceDocumentId, templateDocumentId) {
        return extractSlidesTaskDefinitionsMock(referenceDocumentId, templateDocumentId);
      }
    },
  };
});

vi.mock('../../src/backend/DocumentParsers/SheetsParser.js', () => {
  return {
    SheetsParser: class {
      extractTaskDefinitions(referenceDocumentId, templateDocumentId) {
        return extractSheetsTaskDefinitionsMock(referenceDocumentId, templateDocumentId);
      }
    },
  };
});

describe('AssignmentDefinitionController upsert behaviour — alternate topics', () => {
  let controller;
  let mockRegistryCollection;
  let mockFullCollection;
  let mockDbManager;

  beforeEach(() => {
    const ctx = setupUpsertControllerTestBed(
      extractSlidesTaskDefinitionsMock,
      extractSheetsTaskDefinitionsMock
    );
    controller = ctx.controller;
    mockDbManager = ctx.mockDbManager;
    mockRegistryCollection = ctx.mockRegistryCollection;
    mockFullCollection = ctx.mockFullCollection;
  });

  it('preserves existing alternateTitles when updates omit alternateTitles', () => {
    const existing = seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: { alternateTitles: ['Stored title A', 'Stored title B'] },
    });

    const payload = createUpsertPayload({ definitionKey: 'existing-stable-key' });
    delete payload.alternateTitles;
    const saved = controller.upsertDefinition(payload);

    expect(saved.alternateTitles).toEqual(['Stored title A', 'Stored title B']);
  });

  it('preserves existing alternateTopics on update when payload omits alternateTopics', () => {
    const existing = seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: {
        alternateTitles: ['Stored alt title'],
        alternateTopics: ['Stored topic A', 'Stored topic B'],
      },
    });

    const payload = createUpsertPayload({ definitionKey: 'existing-stable-key' });
    delete payload.alternateTopics;
    const saved = controller.upsertDefinition(payload);

    expect(saved.alternateTopics).toEqual(['Stored topic A', 'Stored topic B']);
  });

  it('clears existing alternateTopics when update payload provides empty array', () => {
    const existing = seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: {
        alternateTitles: ['Stored alt title'],
        alternateTopics: ['Stored topic A', 'Stored topic B'],
      },
    });

    const payload = createUpsertPayload({
      definitionKey: 'existing-stable-key',
      alternateTopics: [],
    });
    const saved = controller.upsertDefinition(payload);

    expect(saved.alternateTopics).toEqual([]);
  });

  it('rejects alternateTopics with invalid entries (empty string after trim)', () => {
    expect(() =>
      controller.upsertDefinition(
        createUpsertPayload({ alternateTopics: ['  Linear Equations  ', ''] })
      )
    ).toThrow();
  });

  it('rejects non-array alternateTopics', () => {
    expect(() =>
      controller.upsertDefinition(createUpsertPayload({ alternateTopics: 'not an array' }))
    ).toThrow(TypeError);
  });

  it('rejects non-string entries in alternateTopics', () => {
    expect(() =>
      controller.upsertDefinition(createUpsertPayload({ alternateTopics: [123] }))
    ).toThrow();
  });

  it('constructs AssignmentDefinition with both alternateTitles and alternateTopics from payload', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);

    const saved = controller.upsertDefinition(
      createUpsertPayload({
        alternateTitles: ['Alt title 1', 'Alt title 2'],
        alternateTopics: ['Alt topic 1', 'Alt topic 2'],
      })
    );

    expect(saved.alternateTitles).toEqual(['Alt title 1', 'Alt title 2']);
    expect(saved.alternateTopics).toEqual(['Alt topic 1', 'Alt topic 2']);
  });
});
