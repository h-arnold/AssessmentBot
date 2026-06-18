import { describe, it, expect, vi, beforeEach } from 'vitest';
import AssignmentDefinitionController from '../../src/backend/y_controllers/AssignmentDefinition/index.js';
import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';
import { TaskDefinition } from '../../src/backend/Models/TaskDefinition.js';
import DbManager from '../../src/backend/DbManager/DbManager.js';
import DriveManager from '../../src/backend/GoogleDriveManager/DriveManager.js';
import SlidesParser from '../../src/backend/DocumentParsers/SlidesParser.js';
import { SheetsParser } from '../../src/backend/DocumentParsers/SheetsParser.js';
import { createMockCollection } from '../helpers/mockFactories.js';
import {
  createParsedTaskDefinition,
  createUpsertPayload,
  createWizardUpsertPayload,
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
  let assignmentTopicRecords;
  let yearGroupRecords;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRegistryCollection = createMockCollection(vi);
    mockFullCollection = createMockCollection(vi);

    mockDbManager = {
      getCollection: vi.fn((name) => {
        if (name === 'assignment_definitions') return mockRegistryCollection;
        if (name.startsWith('assdef_full_')) return mockFullCollection;
        throw new Error('Unexpected collection requested: ' + name);
      }),
      readAll: vi.fn().mockReturnValue([]),
    };

    DbManager.getInstance.mockReturnValue(mockDbManager);

    assignmentTopicRecords = [
      { key: 'topic-science', name: 'Science' },
      { key: 'topic-maths', name: 'Maths' },
    ];
    yearGroupRecords = [
      { key: 'year-group-8', name: 'Year 8' },
      { key: 'year-group-10', name: 'Year 10' },
    ];

    globalThis.DbManager = DbManager;
    globalThis.DriveManager = DriveManager;
    globalThis.SlidesParser = SlidesParser;
    globalThis.SheetsParser = SheetsParser;
    globalThis.AssignmentDefinition = AssignmentDefinition;
    globalThis.TaskDefinition = TaskDefinition;
    globalThis.Utilities = {
      getUuid: vi.fn().mockReturnValue('11111111-2222-4333-8444-555555555555'),
    };
    globalThis.ReferenceDataController = class {
      listAssignmentTopics() {
        return assignmentTopicRecords.map((topic) => ({ ...topic }));
      }

      listYearGroups() {
        return yearGroupRecords.map((yearGroup) => ({ ...yearGroup }));
      }
    };

    DriveManager.getFileModifiedTime.mockImplementation((documentId) => {
      if (documentId.startsWith('new-')) return '2025-05-01T00:00:00.000Z';
      return '2025-04-01T00:00:00.000Z';
    });

    extractSlidesTaskDefinitionsMock.mockReturnValue([
      createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 }),
      createParsedTaskDefinition({ id: 't_task_2', taskTitle: 'Task B', index: 1 }),
    ]);
    extractSheetsTaskDefinitionsMock.mockReturnValue([
      createParsedTaskDefinition({ id: 't_sheet_task_1', taskTitle: 'Sheet Task A', index: 0 }),
    ]);

    controller = new AssignmentDefinitionController();
  });

  /**
   * Sets up common mock state for create-stage wizard duplicate detection tests.
   * Uses createWizardUpsertPayload for the test payload.
   */
  function setupWizardCreateStageDuplicateDetectionTest() {
    mockDbManager.readAll.mockReturnValue([
      {
        definitionKey: 'other-definition',
        primaryTitle: 'Water cycle explanation',
        primaryTopicKey: 'topic-science',
        yearGroupKey: 'year-group-8',
      },
    ]);
    return createWizardUpsertPayload();
  }

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
    const existing = {
      ...createUpsertPayload({
        definitionKey: 'existing-stable-key',
        primaryTitle: 'Old title',
        alternateTitles: ['Old alt'],
        yearGroupKey: 'year-group-8',
      }),
      primaryTopic: 'Science',
      tasks: {
        t_task_1: {
          id: 't_task_1',
          taskTitle: 'Task A',
          taskWeighting: 15,
          artifacts: { reference: [], template: [] },
        },
      },
      referenceLastModified: '2025-04-01T00:00:00.000Z',
      templateLastModified: '2025-04-01T00:00:00.000Z',
    };
    mockFullCollection.findOne.mockImplementation((filter) => {
      if (filter?.definitionKey === 'existing-stable-key') return existing;
      return null;
    });
    mockRegistryCollection.findOne.mockReturnValue({ ...existing, tasks: null });

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
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      assignmentWeighting: 5,
      yearGroupKey: 'year-group-8',
      tasks: {
        t_task_1: {
          id: 't_task_1',
          taskTitle: 'Task A',
          artifacts: { reference: [], template: [] },
        },
      },
      referenceLastModified: '2025-04-01T00:00:00.000Z',
      templateLastModified: '2025-04-01T00:00:00.000Z',
    };
    mockFullCollection.findOne.mockReturnValue(existing);
    mockRegistryCollection.findOne.mockReturnValue({ ...existing, tasks: null });

    const payload = createUpsertPayload({ definitionKey: 'existing-stable-key' });
    delete payload.assignmentWeighting;
    const saved = controller.upsertDefinition(payload);

    expect(saved.assignmentWeighting).toBe(5);
  });

  it('rejects updates when yearGroupKey is omitted from the save payload', () => {
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      tasks: {
        t_task_1: {
          id: 't_task_1',
          taskTitle: 'Task A',
          artifacts: { reference: [], template: [] },
        },
      },
      referenceLastModified: '2025-04-01T00:00:00.000Z',
      templateLastModified: '2025-04-01T00:00:00.000Z',
    };
    mockFullCollection.findOne.mockReturnValue(existing);
    mockRegistryCollection.findOne.mockReturnValue({ ...existing, tasks: null });

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
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      documentType: 'SLIDES',
      tasks: {
        t_task_1: {
          id: 't_task_1',
          taskTitle: 'Task A',
          artifacts: { reference: [], template: [] },
        },
      },
      referenceLastModified: '2025-04-01T00:00:00.000Z',
      templateLastModified: '2025-04-01T00:00:00.000Z',
    };
    mockFullCollection.findOne.mockReturnValue(existing);
    mockRegistryCollection.findOne.mockReturnValue({ ...existing, tasks: null });
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
    const payload = setupWizardCreateStageDuplicateDetectionTest();
    expect(() => controller.upsertDefinition(payload)).toThrow(/duplicate/i);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
  });

  it('rejects create-stage duplicate tuples even when stored data has both yearGroup and yearGroupKey', () => {
    const payload = setupWizardCreateStageDuplicateDetectionTest();
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
    const existing = {
      ...createUpsertPayload({
        definitionKey: 'existing-stable-key',
        primaryTitle: 'Old title',
        primaryTopicKey: 'topic-science',
        yearGroupKey: 'year-group-8',
      }),
      primaryTopic: 'Science',
      tasks: {
        t_task_1: {
          id: 't_task_1',
          taskTitle: 'Task A',
          taskWeighting: 2,
          artifacts: { reference: [], template: [] },
        },
      },
      referenceLastModified: '2025-04-01T00:00:00.000Z',
      templateLastModified: '2025-04-01T00:00:00.000Z',
    };

    mockFullCollection.findOne.mockReturnValue(existing);
    mockRegistryCollection.findOne.mockReturnValue({ ...existing, tasks: null });

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
