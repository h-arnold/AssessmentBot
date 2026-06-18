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

  it('preserves existing alternateTitles when updates omit alternateTitles', () => {
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      alternateTitles: ['Stored title A', 'Stored title B'],
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
    delete payload.alternateTitles;
    const saved = controller.upsertDefinition(payload);

    expect(saved.alternateTitles).toEqual(['Stored title A', 'Stored title B']);
  });

  it('preserves existing alternateTopics on update when payload omits alternateTopics', () => {
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      alternateTitles: ['Stored alt title'],
      alternateTopics: ['Stored topic A', 'Stored topic B'],
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
    delete payload.alternateTopics;
    const saved = controller.upsertDefinition(payload);

    expect(saved.alternateTopics).toEqual(['Stored topic A', 'Stored topic B']);
  });

  it('clears existing alternateTopics when update payload provides empty array', () => {
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      alternateTitles: ['Stored alt title'],
      alternateTopics: ['Stored topic A', 'Stored topic B'],
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
