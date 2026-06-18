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
  expectCanonicalFullDefinitionShape,
  expectTaskWeightingMapEntries,
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

describe('AssignmentDefinitionController upsert behaviour — validation', () => {
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
   * Sets up common mock state for create-stage duplicate detection tests.
   * Uses createUpsertPayload for the test payload.
   */
  function setupCreateStageDuplicateDetectionTest() {
    mockDbManager.readAll.mockReturnValue([
      {
        definitionKey: 'other-definition',
        primaryTitle: 'Water cycle explanation',
        primaryTopicKey: 'topic-science',
        yearGroupKey: 'year-group-8',
      },
    ]);
    return createUpsertPayload();
  }

  it('rejects duplicate business-identity tuples using yearGroupKey only', () => {
    const payload = setupCreateStageDuplicateDetectionTest();
    expect(() => controller.upsertDefinition(payload)).toThrow(/duplicate/i);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
  });

  it('rejects duplicate business-identity tuples even when yearGroup field present in stored data (yearGroupKey only)', () => {
    const payload = setupCreateStageDuplicateDetectionTest();
    expect(() => controller.upsertDefinition(payload)).toThrow(/duplicate/i);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
  });

  it('rejects an unknown primaryTopicKey', () => {
    assignmentTopicRecords = [];
    expect(() => controller.upsertDefinition(createUpsertPayload())).toThrow(/primaryTopicKey/i);
  });

  it('reparses and refreshes timestamps when document IDs change for a slides definition', () => {
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      documentType: 'SLIDES',
      yearGroupKey: 'year-group-8',
      tasks: {
        old_task: { id: 'old_task', taskTitle: 'Old', artifacts: { reference: [], template: [] } },
      },
      referenceLastModified: '2025-01-01T00:00:00.000Z',
      templateLastModified: '2025-01-01T00:00:00.000Z',
    };
    mockFullCollection.findOne.mockReturnValue(existing);
    mockRegistryCollection.findOne.mockReturnValue({ ...existing, tasks: null });

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
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      documentType: 'SLIDES',
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
});
