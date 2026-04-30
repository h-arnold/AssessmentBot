import { describe, it, expect, vi, beforeEach } from 'vitest';
import AssignmentDefinitionController from '../../src/backend/y_controllers/AssignmentDefinitionController.js';
import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';
import { TaskDefinition } from '../../src/backend/Models/TaskDefinition.js';
import DbManager from '../../src/backend/DbManager/DbManager.js';
import DriveManager from '../../src/backend/GoogleDriveManager/DriveManager.js';
import SlidesParser from '../../src/backend/DocumentParsers/SlidesParser.js';
import { SheetsParser } from '../../src/backend/DocumentParsers/SheetsParser.js';
import { createMockCollection } from '../helpers/mockFactories.js';

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

function createParsedTaskDefinition({ id, taskTitle, index = 0 }) {
  return {
    getId: () => id,
    validate: () => ({ ok: true, errors: [] }),
    toJSON: () => ({
      id,
      taskTitle: taskTitle || 'Task ' + id,
      taskWeighting: null,
      index,
      artifacts: {
        reference: [],
        template: [],
      },
    }),
  };
}

function createUpsertPayload(overrides = {}) {
  return {
    primaryTitle: 'Water cycle explanation',
    primaryTopicKey: 'topic-science',
    yearGroup: 8,
    yearGroupKey: 'year-group-8',
    alternateTitles: ['The water cycle'],
    referenceDocumentId: 'ref-doc-id',
    templateDocumentId: 'tpl-doc-id',
    documentType: 'SLIDES',
    assignmentWeighting: 1,
    taskWeightings: [],
    ...overrides,
  };
}

function createWizardUpsertPayload(overrides = {}) {
  return {
    primaryTitle: 'Water cycle explanation',
    primaryTopicKey: 'topic-science',
    yearGroupKey: 'year-group-8',
    referenceDocumentId: 'ref-doc-id',
    templateDocumentId: 'tpl-doc-id',
    documentType: 'SLIDES',
    assignmentWeighting: 1,
    taskWeightings: [{ taskId: 't_task_1', taskWeighting: 1 }],
    ...overrides,
  };
}

function expectCanonicalFullDefinitionShape(definition) {
  expect(definition).toMatchObject({
    definitionKey: expect.any(String),
    primaryTitle: expect.any(String),
    primaryTopicKey: expect.any(String),
    primaryTopic: expect.any(String),
    yearGroupKey: expect.any(String),
    yearGroupLabel: expect.any(String),
    referenceDocumentId: expect.any(String),
    templateDocumentId: expect.any(String),
    assignmentWeighting: expect.any(Number),
    tasks: expect.arrayContaining([
      expect.objectContaining({
        taskId: expect.any(String),
        taskTitle: expect.any(String),
        taskWeighting: expect.any(Number),
      }),
    ]),
  });

  expect(definition).not.toHaveProperty('referenceDocumentUrl');
  expect(definition).not.toHaveProperty('templateDocumentUrl');
}

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
      { key: 'year-group-8', name: 'Year 8', yearGroup: 8 },
      { key: 'year-group-10', name: 'Year 10', yearGroup: 10 },
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

  it('creates and persists full + registry records from free-form metadata', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);

    const saved = controller.upsertDefinition(
      createUpsertPayload({
        primaryTitle: '   Independent writing task   ',
        alternateTitles: ['Writing task', 'Independent writing'],
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

  it('fails loudly when Utilities.getUuid returns a blank create key', () => {
    globalThis.Utilities.getUuid.mockReturnValue('   ');

    const runUpsert = () => controller.upsertDefinition(createUpsertPayload());

    expect(runUpsert).toThrow(TypeError);
    expect(runUpsert).toThrow(/non-empty string definitionKey/i);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
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
        yearGroup: saved.yearGroup,
      })
    );
  });

  it('updates metadata while preserving the stored definitionKey', () => {
    const existing = {
      ...createUpsertPayload({
        definitionKey: 'existing-stable-key',
        primaryTitle: 'Old title',
        alternateTitles: ['Old alt'],
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

  it('rejects duplicate business-identity tuples without partial writes', () => {
    mockDbManager.readAll.mockReturnValue([
      {
        definitionKey: 'other-definition',
        primaryTitle: 'Water cycle explanation',
        primaryTopicKey: 'topic-science',
        yearGroup: 8,
        yearGroupKey: 'year-group-8',
      },
    ]);

    expect(() => controller.upsertDefinition(createUpsertPayload())).toThrow(/duplicate/i);
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

    expect(saved.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: 't_task_1', taskWeighting: 5 }),
        expect.objectContaining({ taskId: 't_task_2', taskWeighting: 4 }),
      ])
    );
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

  it('preserves existing alternateTitles when updates omit alternateTitles', () => {
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      alternateTitles: ['Stored title A', 'Stored title B'],
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

  it('rejects updates when yearGroupKey is omitted from the save payload', () => {
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key', yearGroup: 9 }),
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

  it('rejects create-stage duplicate tuples before persistence when yearGroupKey collides', () => {
    mockDbManager.readAll.mockReturnValue([
      {
        definitionKey: 'other-definition',
        primaryTitle: 'Water cycle explanation',
        primaryTopicKey: 'topic-science',
        yearGroup: 7,
        yearGroupKey: 'year-group-8',
      },
    ]);

    expect(() => controller.upsertDefinition(createWizardUpsertPayload())).toThrow(/duplicate/i);
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
        yearGroup: 8,
        yearGroupKey: 'year-group-8',
      }),
      yearGroupKey: 'year-group-8',
      yearGroupLabel: 'Year 8',
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

  it('returns the canonical full-definition transport shape for create/write/read flows', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);

    const saved = controller.upsertDefinition(createWizardUpsertPayload());
    const readBack = controller.getDefinitionByKey(saved.definitionKey, { form: 'full' });

    expectCanonicalFullDefinitionShape(saved);
    expectCanonicalFullDefinitionShape(readBack);
  });

  it('defaults parsed task weightings to 1 for stage-one creates when taskWeightings are omitted', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);

    const payload = createWizardUpsertPayload();
    delete payload.taskWeightings;

    const saved = controller.upsertDefinition(payload);

    expect(saved.tasks).toEqual([
      expect.objectContaining({ taskId: 't_task_1', taskWeighting: 1 }),
      expect.objectContaining({ taskId: 't_task_2', taskWeighting: 1 }),
    ]);
  });

  it('fails full-definition reads when persisted records are missing yearGroupKey', () => {
    const legacyDefinition = {
      ...createUpsertPayload({ definitionKey: 'legacy-definition' }),
      primaryTopic: 'Science',
      yearGroup: 8,
      yearGroupKey: null,
      yearGroupLabel: null,
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
      if (filter?.definitionKey === 'legacy-definition') {
        return legacyDefinition;
      }
      return null;
    });

    expect(() => controller.getDefinitionByKey('legacy-definition', { form: 'full' })).toThrow(
      /yearGroupKey/i
    );
  });

  it('resolves yearGroupLabel from yearGroupKey on canonical reads', () => {
    const staleLabelDefinition = {
      ...createWizardUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      yearGroup: 8,
      yearGroupKey: 'year-group-8',
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

    expect(readBack.yearGroupLabel).toBe('Year 8');
  });

  it('re-parse keeps matching task weightings and defaults new tasks to 1', () => {
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
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

    expect(saved.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: 't_task_1', taskWeighting: 8 }),
        expect.objectContaining({ taskId: 't_task_3', taskWeighting: 1 }),
      ])
    );
  });

  it('detects duplicate tuples on final save when title/topic/yearGroupKey changes', () => {
    const existing = {
      ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
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

    expect(() =>
      controller.upsertDefinition(
        createWizardUpsertPayload({
          definitionKey: 'existing-stable-key',
          primaryTitle: 'Updated title',
          primaryTopicKey: 'topic-maths',
          yearGroupKey: 'year-group-10',
        })
      )
    ).toThrow(/duplicate/i);
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
