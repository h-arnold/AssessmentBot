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

describe('AssignmentDefinitionController upsert behaviour — transport shape', () => {
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
   * Sets up common mock state for duplicate detection tests.
   * @returns {Object} The wizard upsert payload to use for the test
   */
  function setupDuplicateDetectionTest() {
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
    mockDbManager.readAll.mockReturnValue([
      {
        definitionKey: 'existing-stable-key',
        primaryTitle: 'Water cycle explanation',
        primaryTopicKey: 'topic-science',
        yearGroupKey: 'year-group-8',
      },
      {
        definitionKey: 'other-definition',
        primaryTitle: 'Updated title',
        primaryTopicKey: 'topic-maths',
        yearGroupKey: 'year-group-10',
      },
    ]);

    return createWizardUpsertPayload({
      definitionKey: 'existing-stable-key',
      primaryTitle: 'Updated title',
      primaryTopicKey: 'topic-maths',
      yearGroupKey: 'year-group-10',
    });
  }

  it('returns the canonical full-definition transport shape for create/write/read flows', () => {
    const stored = {};
    mockFullCollection.findOne.mockImplementation(
      (filter) => stored[filter?.definitionKey] ?? null
    );
    mockFullCollection.insertOne.mockImplementation((doc) => {
      if (doc?.definitionKey) stored[doc.definitionKey] = doc;
    });
    mockFullCollection.replaceOne.mockImplementation((filter, doc) => {
      if (filter?.definitionKey) stored[filter.definitionKey] = doc;
    });
    mockRegistryCollection.findOne.mockReturnValue(null);

    const saved = controller.upsertDefinition(createWizardUpsertPayload());
    const readBack = controller.getDefinitionByKey(saved.definitionKey, { form: 'full' });

    expect(saved).toBeInstanceOf(AssignmentDefinition);
    expect(readBack).toBeInstanceOf(AssignmentDefinition);

    expectCanonicalFullDefinitionShape(controller.getFullAssignmentDefinition(saved));
    expectCanonicalFullDefinitionShape(controller.getFullAssignmentDefinition(readBack));
  });

  it('defaults parsed task weightings to 1 for stage-one creates when taskWeightings are omitted', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);

    const payload = createWizardUpsertPayload();
    delete payload.taskWeightings;

    const saved = controller.upsertDefinition(payload);

    expectTaskWeightingMapEntries(saved.tasks, [
      ['t_task_1', 1],
      ['t_task_2', 1],
    ]);
  });

  it('resolves yearGroupLabel from yearGroupKey on canonical reads', () => {
    const staleLabelDefinition = {
      ...createWizardUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      yearGroupKey: 'year-group-8',
      yearGroupLabel: 'Outdated label',
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

    mockFullCollection.findOne.mockImplementation((filter) => {
      if (filter?.definitionKey === 'existing-stable-key') {
        return staleLabelDefinition;
      }
      return null;
    });

    const readBack = controller.getDefinitionByKey('existing-stable-key', { form: 'full' });
    const canonicalReadBack = controller.getFullAssignmentDefinition(readBack);

    expect(canonicalReadBack.yearGroupLabel).toBe('Year 8');
  });

  it('re-parse keeps matching task weightings and defaults new tasks to 1', () => {
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      yearGroupKey: 'year-group-8',
      tasks: {
        t_task_1: {
          id: 't_task_1',
          taskTitle: 'Task A',
          taskWeighting: 8,
          artifacts: { reference: [], template: [] },
        },
      },
      referenceLastModified: '2025-04-01T00:00:00.000Z',
      templateLastModified: '2025-04-01T00:00:00.000Z',
    };
    mockFullCollection.findOne.mockReturnValue(existing);
    mockRegistryCollection.findOne.mockReturnValue({ ...existing, tasks: null });

    extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
      createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 }),
      createParsedTaskDefinition({ id: 't_task_3', taskTitle: 'Task C', index: 2 }),
    ]);

    const saved = controller.upsertDefinition(
      createUpsertPayload({
        definitionKey: 'existing-stable-key',
        referenceDocumentId: 'new-ref-doc-id',
        templateDocumentId: 'new-tpl-doc-id',
      })
    );

    expectTaskWeightingMapEntries(saved.tasks, [
      ['t_task_1', 8],
      ['t_task_3', 1],
    ]);
  });

  it('detects duplicate tuples on final save when title/topic/yearGroupKey changes', () => {
    const payload = setupDuplicateDetectionTest();
    expect(() => controller.upsertDefinition(payload)).toThrow(/duplicate/i);
  });

  it('detects duplicate tuples using yearGroupKey only (ignoring yearGroup field in stored data)', () => {
    const payload = setupDuplicateDetectionTest();
    expect(() => controller.upsertDefinition(payload)).toThrow(/duplicate/i);
  });

  it('rejects same-document identifier pairs for save writes', () => {
    const runUpsert = () =>
      controller.upsertDefinition(
        createWizardUpsertPayload({
          referenceDocumentId: 'same-doc',
          templateDocumentId: 'same-doc',
        })
      );

    expect(runUpsert).toThrow();
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
  });
});
