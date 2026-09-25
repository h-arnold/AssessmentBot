import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createParsedTaskDefinition,
  createUpsertPayload,
  createForcedReparsePayload,
  createDocumentChangePayload,
  captureThrownError,
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

// Stale-recovery upsert contracts (issue #301): forceReparse, the approval-save
// updatedAt baseline with DEFINITION_STALE, and the
// DEFINITION_PARSE_FAILED/INVALID_REQUEST recovery error classifications.
// Ordinary upserts stay byte-identical by design: without a forced reparse,
// document changes, or a stale baseline, unchanged documents are never reparsed.
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

    const thrown = captureThrownError(() =>
      controller.upsertDefinition(
        createUpsertPayload({
          definitionKey: 'existing-stable-key',
          updatedAt: '2026-01-01T00:00:00.000Z',
        })
      )
    );

    // The stable error code contract lets the frontend map user-safe copy
    // without feature-local string matching.
    expect(thrown).not.toBeNull();
    expect(thrown.code).toBe('DEFINITION_STALE');
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockFullCollection.replaceOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('accepts a matching approval baseline when the stored updatedAt is a live Date', () => {
    const approvalInstant = '2026-01-06T12:30:00.000Z';
    seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: { updatedAt: new Date(approvalInstant) },
    });

    const thrown = captureThrownError(() =>
      controller.upsertDefinition(
        createUpsertPayload({
          definitionKey: 'existing-stable-key',
          updatedAt: approvalInstant,
        })
      )
    );

    // Stored-record normalisation converts the stored Date to an ISO string before
    // the baseline comparison, so the same instant must not surface as stale.
    expect(thrown).toBeNull();
    expect(mockFullCollection.replaceOne).toHaveBeenCalled();
    expect(mockRegistryCollection.replaceOne).toHaveBeenCalled();
  });

  it('maps a document parsing failure to DEFINITION_PARSE_FAILED and persists nothing', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });
    extractSlidesTaskDefinitionsMock.mockImplementationOnce(() => {
      throw new Error('Slides read failed');
    });

    const thrown = captureThrownError(() =>
      controller.upsertDefinition(createDocumentChangePayload())
    );

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

    const thrown = captureThrownError(() =>
      controller.upsertDefinition(createDocumentChangePayload())
    );

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

  it('rejects a forced create without a definitionKey as INVALID_REQUEST', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);
    const payload = createUpsertPayload({ forceReparse: true });
    delete payload.taskWeightings;

    const thrown = captureThrownError(() => controller.upsertDefinition(payload));

    // Documented request-contract violation: the API envelope must surface
    // INVALID_REQUEST rather than INTERNAL_ERROR.
    expect(thrown).toBeInstanceOf(ApiValidationError);
    expect(thrown.code ?? null).toBeNull();
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
  });

  it('rejects forceReparse with taskWeightings as INVALID_REQUEST', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });

    const thrown = captureThrownError(() =>
      controller.upsertDefinition(
        createUpsertPayload({ definitionKey: 'existing-stable-key', forceReparse: true })
      )
    );

    expect(thrown).toBeInstanceOf(ApiValidationError);
    expect(thrown.code ?? null).toBeNull();
    expect(extractSlidesTaskDefinitionsMock).not.toHaveBeenCalled();
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockFullCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('blocks persistence when parser output mixes valid and invalid tasks', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });
    const validTask = createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 });
    const invalidTask = {
      getId: () => 't_task_bad',
      validate: () => ({ ok: false, errors: ['missing template artefact'] }),
      toJSON: () => ({
        id: 't_task_bad',
        taskTitle: 'Bad task',
        taskWeighting: null,
        index: 1,
        artifacts: { reference: [], template: [] },
      }),
    };
    extractSlidesTaskDefinitionsMock.mockReturnValueOnce([validTask, invalidTask]);

    const thrown = captureThrownError(() =>
      controller.upsertDefinition(createDocumentChangePayload())
    );

    // All-or-nothing parse contract: any invalid task blocks the refresh.
    expect(thrown).toBeInstanceOf(ApiValidationError);
    expect(thrown.code).toBe('DEFINITION_PARSE_FAILED');
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockFullCollection.replaceOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.replaceOne).not.toHaveBeenCalled();
  });
});
