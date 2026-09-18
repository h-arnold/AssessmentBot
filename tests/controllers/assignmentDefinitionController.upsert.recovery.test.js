import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createParsedTaskDefinition,
  createUpsertPayload,
  seedExistingDefinition,
  setupUpsertControllerTestBed,
} from './assignmentDefinitionUpsertTestHelpers.js';

const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

const extractSlidesTaskDefinitionsMock = vi.fn();
const extractSheetsTaskDefinitionsMock = vi.fn();

vi.mock('../../src/backend/DbManager/DbManager.js');
vi.mock('../../src/backend/GoogleDriveManager/DriveManager/index.js');
vi.mock('../../src/backend/DocumentParsers/SlidesParser/index.js', () => ({
  default: class {
    extractTaskDefinitions = (...a) => extractSlidesTaskDefinitionsMock(...a);
  },
}));
vi.mock('../../src/backend/DocumentParsers/SheetsParser.js', () => ({
  SheetsParser: class {
    extractTaskDefinitions = (...a) => extractSheetsTaskDefinitionsMock(...a);
  },
}));

// RED phase for stale-recovery upsert contracts (issue #301): forceReparse,
// expectedDefinitionUpdatedAt and DEFINITION_PARSE_FAILED. These tests assert
// behaviour the orchestrator does not implement yet, so each one fails until
// the green phase lands. Ordinary upserts stay byte-identical by design.
describe('AssignmentDefinitionController upsert — forced reparse and save-time staleness', () => {
  let controller;
  let mockRegistryCollection;
  let mockFullCollection;

  beforeEach(() => {
    const ctx = setupUpsertControllerTestBed(
      extractSlidesTaskDefinitionsMock,
      extractSheetsTaskDefinitionsMock
    );
    controller = ctx.controller;
    mockRegistryCollection = ctx.mockRegistryCollection;
    mockFullCollection = ctx.mockFullCollection;
  });

  // Builds an update payload that mirrors an explicit reparse request: the
  // persisted document identifiers are reused and no weighting patch is sent.
  function createForcedReparsePayload(overrides = {}) {
    const payload = createUpsertPayload({ definitionKey: 'existing-stable-key', ...overrides });
    delete payload.taskWeightings;
    return payload;
  }

  it('reparses unchanged documents when forceReparse is true', () => {
    seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      taskOverrides: { taskWeighting: 3 },
    });
    extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
      createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 }),
    ]);

    const saved = controller.upsertDefinition(createForcedReparsePayload({ forceReparse: true }));

    // The forced path bypasses the timestamp short-circuit, so the unchanged
    // documents are parsed again and equivalent tasks keep stored weightings.
    expect(extractSlidesTaskDefinitionsMock).toHaveBeenCalled();
    expect(saved.tasks.t_task_1.taskWeighting).toBe(3);
  });

  it('does not reparse unchanged documents on an ordinary upsert', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });
    const payload = createUpsertPayload({ definitionKey: 'existing-stable-key' });
    delete payload.taskWeightings;

    controller.upsertDefinition(payload);

    // Regression pin for timestamp-driven behaviour: identical document
    // identifiers and freshness timestamps must not trigger parsing.
    expect(extractSlidesTaskDefinitionsMock).not.toHaveBeenCalled();
    expect(extractSheetsTaskDefinitionsMock).not.toHaveBeenCalled();
  });

  it('rejects a stale approval baseline with DEFINITION_STALE and writes nothing', () => {
    seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: { updatedAt: '2026-01-06T12:30:00.000Z' },
    });

    let thrown = null;
    try {
      controller.upsertDefinition(
        createUpsertPayload({
          definitionKey: 'existing-stable-key',
          expectedDefinitionUpdatedAt: '2026-01-01T00:00:00.000Z',
        })
      );
    } catch (err) {
      thrown = err;
    }

    // The stable error code contract lets the frontend map user-safe copy
    // without feature-local string matching.
    expect(thrown).not.toBeNull();
    expect(thrown.code).toBe('DEFINITION_STALE');
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockFullCollection.replaceOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('maps a document parsing failure to DEFINITION_PARSE_FAILED and persists nothing', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });
    extractSlidesTaskDefinitionsMock.mockImplementationOnce(() => {
      throw new Error('Slides read failed');
    });

    let thrown = null;
    try {
      controller.upsertDefinition(
        createUpsertPayload({
          definitionKey: 'existing-stable-key',
          referenceDocumentId: 'new-ref-doc-id',
          templateDocumentId: 'new-tpl-doc-id',
        })
      );
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ApiValidationError);
    expect(thrown.code).toBe('DEFINITION_PARSE_FAILED');
    expect(thrown.message).toMatch(/could not be parsed/i);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockFullCollection.replaceOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('blocks the refresh and persists nothing when parsing yields zero tasks', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });
    extractSlidesTaskDefinitionsMock.mockReturnValueOnce([]);

    let thrown = null;
    try {
      controller.upsertDefinition(
        createUpsertPayload({
          definitionKey: 'existing-stable-key',
          referenceDocumentId: 'new-ref-doc-id',
          templateDocumentId: 'new-tpl-doc-id',
        })
      );
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ApiValidationError);
    expect(thrown.code).toBe('DEFINITION_PARSE_FAILED');
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockFullCollection.replaceOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('rolls back full-store writes when registry persistence fails on the forced path', () => {
    const seeded = seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: { documentType: 'SLIDES' },
    });
    mockRegistryCollection.save.mockImplementationOnce(() => {
      throw new Error('registry save failed');
    });

    expect(() =>
      controller.upsertDefinition(createForcedReparsePayload({ forceReparse: true }))
    ).toThrow();

    // The forced reparse must have run before the failed write, and the
    // final full-store write must restore the seeded pre-reparse record.
    expect(extractSlidesTaskDefinitionsMock).toHaveBeenCalled();
    const replaceCalls = mockFullCollection.replaceOne.mock.calls;
    expect(replaceCalls.length).toBeGreaterThanOrEqual(2);
    const [rollbackFilter, rollbackPayload] = replaceCalls[replaceCalls.length - 1];
    expect(rollbackFilter).toEqual({ definitionKey: 'existing-stable-key' });
    expect(rollbackPayload).toEqual(seeded);
  });

  it('rejects forceReparse combined with taskWeightings before parsing or persisting', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });

    expect(() =>
      controller.upsertDefinition(
        createUpsertPayload({ definitionKey: 'existing-stable-key', forceReparse: true })
      )
    ).toThrow(/forceReparse|taskWeightings/i);

    expect(extractSlidesTaskDefinitionsMock).not.toHaveBeenCalled();
    expect(extractSheetsTaskDefinitionsMock).not.toHaveBeenCalled();
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockFullCollection.replaceOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('rejects a forced create that supplies no existing definitionKey', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);
    const payload = createUpsertPayload({ forceReparse: true });
    delete payload.taskWeightings;

    expect(() => controller.upsertDefinition(payload)).toThrow(/definitionKey|forceReparse/i);

    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
  });
});
