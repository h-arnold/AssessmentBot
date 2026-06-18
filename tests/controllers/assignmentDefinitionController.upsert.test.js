import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';
import {
  createUpsertPayload,
  createWizardUpsertPayload,
  seedExistingDefinition,
  setupUpsertControllerTestBed,
  setupDuplicateDetectionTest,
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

describe('AssignmentDefinitionController upsert behaviour', () => {
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

  /* ---- Core create / update tests ---- */

  it('creates and persists full + registry records from free-form metadata', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);

    const saved = controller.upsertDefinition(
      createUpsertPayload({
        primaryTitle: '   Independent writing task   ',
        alternateTitles: ['Writing task', 'Independent writing'],
        yearGroupKey: 'year-group-8',
      })
    );

    expect(mockFullCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(mockRegistryCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(saved).toMatchObject({
      primaryTitle: 'Independent writing task',
      primaryTopicKey: 'topic-science',
      primaryTopic: 'Science',
    });
    expect(mockRegistryCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryTopicKey: 'topic-science',
        primaryTopic: 'Science',
        tasks: null,
      })
    );
  });

  it('rejects create payloads that omit documentType', () => {
    const payload = createUpsertPayload();
    delete payload.documentType;

    expect(() => controller.upsertDefinition(payload)).toThrow(/documentType/i);
  });

  it('rejects non-numeric assignmentWeighting values', () => {
    expect(() =>
      controller.upsertDefinition(createUpsertPayload({ assignmentWeighting: 'heavy' }))
    ).toThrow(/assignmentWeighting/i);
  });

  it('rejects non-numeric taskWeighting values', () => {
    expect(() =>
      controller.upsertDefinition(
        createUpsertPayload({
          taskWeightings: [{ taskId: 't_task_1', taskWeighting: 'high' }],
        })
      )
    ).toThrow(/taskWeighting/i);
  });

  it('fails loudly when Utilities.getUuid is unavailable for create keys', () => {
    globalThis.Utilities = {};

    expect(() => controller.upsertDefinition(createUpsertPayload())).toThrow(/Utilities\.getUuid/i);
  });

  it('accepts a valid UUID from Utilities.getUuid as the create definitionKey', () => {
    const saved = controller.upsertDefinition(createUpsertPayload());
    expect(saved.definitionKey).toBe('11111111-2222-4333-8444-555555555555');
    expect(globalThis.Utilities.getUuid).toHaveBeenCalled();
  });

  it('creates a stable opaque definitionKey that is not metadata-derived', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);

    const saved = controller.upsertDefinition(createUpsertPayload());

    expect(saved.definitionKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(saved.definitionKey).not.toBe(
      AssignmentDefinition.buildDefinitionKey({
        primaryTitle: saved.primaryTitle,
        primaryTopic: saved.primaryTopic,
        yearGroupKey: saved.yearGroupKey,
      })
    );
  });

  it('updates metadata while preserving the stored definitionKey', () => {
    const existing = seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: { primaryTitle: 'Old title', alternateTitles: ['Old alt'] },
      taskOverrides: { taskWeighting: 15 },
    });
    // Override with targeted implementation for uniqueness check
    mockFullCollection.findOne.mockImplementation((filter) => {
      if (filter?.definitionKey === 'existing-stable-key') return existing;
      return null;
    });

    const saved = controller.upsertDefinition(
      createUpsertPayload({
        definitionKey: 'existing-stable-key',
        primaryTitle: 'Updated title',
        primaryTopicKey: 'topic-maths',
      })
    );

    expect(saved.definitionKey).toBe('existing-stable-key');
    expect(saved.primaryTitle).toBe('Updated title');
    expect(saved.primaryTopicKey).toBe('topic-maths');
    expect(mockFullCollection.replaceOne).toHaveBeenCalledTimes(1);
    expect(mockRegistryCollection.replaceOne).toHaveBeenCalledTimes(1);
  });

  /* ---- Weighting / preserve / rollback / error tests ---- */

  it('preserves existing assignmentWeighting when updates omit assignmentWeighting', () => {
    const existing = seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: { assignmentWeighting: 5 },
    });

    const payload = createUpsertPayload({ definitionKey: 'existing-stable-key' });
    delete payload.assignmentWeighting;
    const saved = controller.upsertDefinition(payload);

    expect(saved.assignmentWeighting).toBe(5);
  });

  it('rejects updates when yearGroupKey is omitted from the save payload', () => {
    const existing = seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
    });

    const payload = createUpsertPayload({ definitionKey: 'existing-stable-key' });
    delete payload.yearGroupKey;

    expect(() => controller.upsertDefinition(payload)).toThrow(/yearGroupKey/i);
  });

  it('attempts rollback and throws when registry write fails after full-store write', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.save.mockImplementation(() => {
      throw new Error('registry save failed');
    });

    expect(() => controller.upsertDefinition(createUpsertPayload())).toThrow(/registry/i);

    const fullRollbackAttemptCount =
      mockFullCollection.deleteOne.mock.calls.length +
      mockFullCollection.replaceOne.mock.calls.length;
    expect(fullRollbackAttemptCount).toBeGreaterThan(0);
  });

  it('fails loudly when full-store write fails before registry write', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);
    mockFullCollection.insertOne.mockImplementation(() => {
      throw new Error('full store insert failed');
    });

    expect(() => controller.upsertDefinition(createUpsertPayload())).toThrow(/full store/i);
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.replaceOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.save).not.toHaveBeenCalled();
  });

  it('surfaces a distinct repair-required failure when rollback also fails', () => {
    const existing = seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: { documentType: 'SLIDES' },
    });
    mockRegistryCollection.save.mockImplementation(() => {
      throw new Error('registry save failed');
    });
    mockFullCollection.replaceOne
      .mockImplementationOnce(() => {
        // primary update write succeeds
      })
      .mockImplementationOnce(() => {
        throw new Error('rollback failed');
      });

    expect(() =>
      controller.upsertDefinition(
        createUpsertPayload({ definitionKey: 'existing-stable-key', primaryTitle: 'Changed title' })
      )
    ).toThrow(/repair|rollback/i);
  });

  /* ---- Create-stage duplicate / save validation tests ---- */

  it('rejects create-stage duplicate tuples before persistence when yearGroupKey collides', () => {
    const payload = setupDuplicateDetectionTest(mockDbManager);
    expect(() => controller.upsertDefinition(payload)).toThrow(/duplicate/i);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
  });

  it('rejects create-stage duplicate tuples even when stored data has both yearGroup and yearGroupKey', () => {
    const payload = setupDuplicateDetectionTest(mockDbManager);
    expect(() => controller.upsertDefinition(payload)).toThrow(/duplicate/i);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
  });

  it('enforces 0..10 weighting range for assignmentWeighting and taskWeighting writes', () => {
    expect(() =>
      controller.upsertDefinition(createUpsertPayload({ assignmentWeighting: 20 }))
    ).toThrow(/0.*10/i);

    expect(() =>
      controller.upsertDefinition(
        createUpsertPayload({ taskWeightings: [{ taskId: 't_task_1', taskWeighting: 20 }] })
      )
    ).toThrow(/0.*10/i);

    expect(() =>
      controller.upsertDefinition(
        createUpsertPayload({ taskWeightings: [{ taskId: 't_task_1', taskWeighting: -1 }] })
      )
    ).toThrow(/0.*10/i);
  });

  it('rejects save writes when yearGroupKey is not a valid reference-data selection', () => {
    expect(() =>
      controller.upsertDefinition(createWizardUpsertPayload({ yearGroupKey: 'unknown-year-group' }))
    ).toThrow(/yearGroupKey/i);
  });

  it('rejects save writes when yearGroupKey is missing or null', () => {
    const missingYearGroupPayload = createWizardUpsertPayload();
    delete missingYearGroupPayload.yearGroupKey;

    expect(() => controller.upsertDefinition(missingYearGroupPayload)).toThrow(/yearGroupKey/i);
    expect(() =>
      controller.upsertDefinition(createWizardUpsertPayload({ yearGroupKey: null }))
    ).toThrow(/yearGroupKey/i);
  });

  it('keeps definitionKey stable when tuple edits change title/topic/yearGroupKey', () => {
    const existing = seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: { primaryTitle: 'Old title', primaryTopicKey: 'topic-science' },
      taskOverrides: { taskWeighting: 2 },
    });

    const saved = controller.upsertDefinition(
      createWizardUpsertPayload({
        definitionKey: 'existing-stable-key',
        primaryTitle: 'Updated title',
        primaryTopicKey: 'topic-maths',
        yearGroupKey: 'year-group-10',
      })
    );

    expect(saved.definitionKey).toBe('existing-stable-key');
    expect(saved.yearGroupKey).toBe('year-group-10');
  });

  it('persists yearGroupKey in both full and partial stores', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);

    controller.upsertDefinition(createWizardUpsertPayload({ yearGroupKey: 'year-group-10' }));

    expect(mockFullCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ yearGroupKey: 'year-group-10' })
    );
    expect(mockRegistryCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ yearGroupKey: 'year-group-10' })
    );
  });
});
