import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createUpsertPayload,
  expectTaskWeightingMapEntries,
  seedExistingDefinition,
  setupUpsertControllerTestBed,
  setupDuplicateDetectionTest,
} from './assignmentDefinitionUpsertTestHelpers.js';

const extractSlidesTaskDefinitionsMock = vi.fn();
const extractSheetsTaskDefinitionsMock = vi.fn();

vi.mock('../../src/backend/DbManager/DbManager.js');
vi.mock('../../src/backend/GoogleDriveManager/DriveManager.js');
vi.mock('../../src/backend/DocumentParsers/SlidesParser.js', () => ({
  default: class {
    extractTaskDefinitions = (...a) => extractSlidesTaskDefinitionsMock(...a);
  },
}));
vi.mock('../../src/backend/DocumentParsers/SheetsParser.js', () => ({
  SheetsParser: class {
    extractTaskDefinitions = (...a) => extractSheetsTaskDefinitionsMock(...a);
  },
}));

describe('AssignmentDefinitionController upsert behaviour — validation', () => {
  let controller;
  let mockRegistryCollection;
  let mockFullCollection;
  let mockDbManager;
  let referenceData;

  beforeEach(() => {
    const ctx = setupUpsertControllerTestBed(
      extractSlidesTaskDefinitionsMock,
      extractSheetsTaskDefinitionsMock
    );
    controller = ctx.controller;
    mockDbManager = ctx.mockDbManager;
    mockRegistryCollection = ctx.mockRegistryCollection;
    mockFullCollection = ctx.mockFullCollection;
    referenceData = ctx.referenceData;
  });

  it('rejects duplicate business-identity tuples using yearGroupKey only', () => {
    const payload = setupDuplicateDetectionTest(mockDbManager, {
      createPayload: () => createUpsertPayload(),
    });
    expect(() => controller.upsertDefinition(payload)).toThrow(/duplicate/i);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
  });

  it('rejects duplicate business-identity tuples even when yearGroup field present in stored data (yearGroupKey only)', () => {
    const payload = setupDuplicateDetectionTest(mockDbManager, {
      createPayload: () => createUpsertPayload(),
    });
    expect(() => controller.upsertDefinition(payload)).toThrow(/duplicate/i);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
  });

  it('rejects an unknown primaryTopicKey', () => {
    referenceData.assignmentTopicRecords = [];
    expect(() => controller.upsertDefinition(createUpsertPayload())).toThrow(/primaryTopicKey/i);
  });

  it('reparses and refreshes timestamps when document IDs change for a slides definition', () => {
    seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: {
        documentType: 'SLIDES',
        referenceLastModified: '2025-01-01T00:00:00.000Z',
        templateLastModified: '2025-01-01T00:00:00.000Z',
        tasks: {
          old_task: {
            id: 'old_task',
            taskTitle: 'Old',
            artifacts: { reference: [], template: [] },
          },
        },
      },
    });

    controller.upsertDefinition(
      createUpsertPayload({
        definitionKey: 'existing-stable-key',
        referenceDocumentId: 'new-ref-doc-id',
        templateDocumentId: 'new-tpl-doc-id',
      })
    );

    expect(extractSlidesTaskDefinitionsMock).toHaveBeenCalledWith(
      'new-ref-doc-id',
      'new-tpl-doc-id'
    );
    expect(mockFullCollection.replaceOne).toHaveBeenCalledWith(
      { definitionKey: 'existing-stable-key' },
      expect.objectContaining({
        referenceLastModified: '2025-05-01T00:00:00.000Z',
        templateLastModified: '2025-05-01T00:00:00.000Z',
      })
    );
  });

  it('keeps fresh-definition refresh behaviour when documents are unchanged', () => {
    seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: { documentType: 'SLIDES' },
    });

    controller.upsertDefinition(createUpsertPayload({ definitionKey: 'existing-stable-key' }));

    expect(extractSlidesTaskDefinitionsMock).not.toHaveBeenCalled();
    expect(extractSheetsTaskDefinitionsMock).not.toHaveBeenCalled();
  });

  it('persists assignmentWeighting', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);

    const saved = controller.upsertDefinition(createUpsertPayload({ assignmentWeighting: 10 }));

    expect(saved.assignmentWeighting).toBe(10);
    expect(mockFullCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentWeighting: 10 })
    );
    expect(mockRegistryCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentWeighting: 10 })
    );
  });

  it('persists valid taskWeightings patches', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);

    const saved = controller.upsertDefinition(
      createUpsertPayload({
        taskWeightings: [
          { taskId: 't_task_1', taskWeighting: 5 },
          { taskId: 't_task_2', taskWeighting: 4 },
        ],
      })
    );

    expectTaskWeightingMapEntries(saved.tasks, [
      ['t_task_1', 5],
      ['t_task_2', 4],
    ]);
  });

  it('rejects unknown task IDs in taskWeightings', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);

    expect(() =>
      controller.upsertDefinition(
        createUpsertPayload({ taskWeightings: [{ taskId: 'unknown-task-id', taskWeighting: 25 }] })
      )
    ).toThrow(/taskWeightings/i);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
  });

  it('rejects payloads that omit primaryTopicKey', () => {
    const payload = createUpsertPayload();
    delete payload.primaryTopicKey;

    expect(() => controller.upsertDefinition(payload)).toThrow(/primaryTopicKey/i);
  });

  it('rejects identical reference/template documents', () => {
    expect(() =>
      controller.upsertDefinition(
        createUpsertPayload({
          referenceDocumentId: 'same-doc',
          templateDocumentId: 'same-doc',
        })
      )
    ).toThrow(/reference.*template/i);
  });

  // ---- Alternate title and topic persistence / validation tests ----

  it('preserves existing alternateTitles when updates omit alternateTitles', () => {
    seedExistingDefinition({
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
    seedExistingDefinition({
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
    seedExistingDefinition({
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
