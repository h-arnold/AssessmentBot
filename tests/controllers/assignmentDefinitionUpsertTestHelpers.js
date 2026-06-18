/**
 * Shared test helpers for AssignmentDefinitionController upsert tests
 *
 * Extracted from assignmentDefinitionController.upsert.test.js during
 * the Section 10 max-lines split. Provides pure helper functions used
 * across all split test files.
 *
 * Note: Mock variables (extractSlidesTaskDefinitionsMock,
 * extractSheetsTaskDefinitionsMock) and vi.mock() calls remain in each
 * test file because Vitest hoists vi.mock along with locally-declared
 * const/let references but does not hoist imported bindings the same way.
 */

import { expect, vi } from 'vitest';
import { createMockCollection } from '../helpers/mockFactories.js';
import AssignmentDefinitionController from '../../src/backend/y_controllers/AssignmentDefinition/index.js';
import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';
import { TaskDefinition } from '../../src/backend/Models/TaskDefinition.js';
import DbManager from '../../src/backend/DbManager/DbManager.js';
import DriveManager from '../../src/backend/GoogleDriveManager/DriveManager.js';
import SlidesParser from '../../src/backend/DocumentParsers/SlidesParser.js';
import { SheetsParser } from '../../src/backend/DocumentParsers/SheetsParser.js';

/**
 * Creates a mock parsed task definition
 * @param {{ id: string, taskTitle?: string, index?: number }} options
 * @returns {Object} Mock task definition object
 */
export function createParsedTaskDefinition({ id, taskTitle, index = 0 }) {
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

/**
 * Creates a standard upsert payload for free-form (non-wizard) tests
 * @param {Object} [overrides] - Properties to override on the returned payload
 * @returns {Object} Upsert payload
 */
export function createUpsertPayload(overrides = {}) {
  return {
    primaryTitle: 'Water cycle explanation',
    primaryTopicKey: 'topic-science',
    yearGroupKey: 'year-group-8',
    yearGroupLabel: 'Year 8',
    alternateTitles: ['The water cycle'],
    referenceDocumentId: 'ref-doc-id',
    templateDocumentId: 'tpl-doc-id',
    documentType: 'SLIDES',
    assignmentWeighting: 1,
    taskWeightings: [],
    ...overrides,
  };
}

/**
 * Creates an upsert payload for wizard-based (taskWeightings) tests
 * @param {Object} [overrides] - Properties to override on the returned payload
 * @returns {Object} Wizard upsert payload
 */
export function createWizardUpsertPayload(overrides = {}) {
  return {
    primaryTitle: 'Water cycle explanation',
    primaryTopicKey: 'topic-science',
    yearGroupKey: 'year-group-8',
    yearGroupLabel: 'Year 8',
    referenceDocumentId: 'ref-doc-id',
    templateDocumentId: 'tpl-doc-id',
    documentType: 'SLIDES',
    assignmentWeighting: 1,
    taskWeightings: [{ taskId: 't_task_1', taskWeighting: 1 }],
    ...overrides,
  };
}

/**
 * Asserts that a definition has the canonical full-definition transport shape
 * @param {Object} definition - The definition to inspect
 */
export function expectCanonicalFullDefinitionShape(definition) {
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

/**
 * Asserts that task-weighting map entries match expected values
 * @param {Object} taskMap - Task map from a definition (saved.tasks)
 * @param {Array<[string, number]>} expectedEntries - Array of [taskId, expectedWeighting] pairs
 */
export function expectTaskWeightingMapEntries(taskMap, expectedEntries) {
  for (const [taskId, expectedWeighting] of expectedEntries) {
    expect(taskMap[taskId]).toBeDefined();
    expect(taskMap[taskId].taskWeighting).toBe(expectedWeighting);
  }
}

/**
 * Sets up the full test bed for AssignmentDefinitionController upsert tests.
 * Configures all global mocks, mock collections, DbManager, reference data,
 * parser mocks, and controller instantiation.
 *
 * @param {Function} extractSlidesTaskDefinitionsMock - The vi.fn() mock for SlidesParser
 * @param {Function} extractSheetsTaskDefinitionsMock - The vi.fn() mock for SheetsParser
 * @returns {{
 *   controller: AssignmentDefinitionController,
 *   mockDbManager: Object,
 *   mockRegistryCollection: Object,
 *   mockFullCollection: Object,
 *   referenceData: { assignmentTopicRecords: Array, yearGroupRecords: Array }
 * }}
 */
export function setupUpsertControllerTestBed(
  extractSlidesTaskDefinitionsMock,
  extractSheetsTaskDefinitionsMock
) {
  vi.clearAllMocks();

  const mockRegistryCollection = createMockCollection(vi);
  const mockFullCollection = createMockCollection(vi);

  const mockDbManager = {
    getCollection: vi.fn((name) => {
      if (name === 'assignment_definitions') return mockRegistryCollection;
      if (name.startsWith('assdef_full_')) return mockFullCollection;
      throw new Error('Unexpected collection requested: ' + name);
    }),
    readAll: vi.fn().mockReturnValue([]),
  };

  DbManager.getInstance.mockReturnValue(mockDbManager);

  const referenceData = {
    assignmentTopicRecords: [
      { key: 'topic-science', name: 'Science' },
      { key: 'topic-maths', name: 'Maths' },
    ],
    yearGroupRecords: [
      { key: 'year-group-8', name: 'Year 8' },
      { key: 'year-group-10', name: 'Year 10' },
    ],
  };

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
      return referenceData.assignmentTopicRecords.map((topic) => ({ ...topic }));
    }

    listYearGroups() {
      return referenceData.yearGroupRecords.map((yearGroup) => ({ ...yearGroup }));
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

  const controller = new AssignmentDefinitionController();

  return { controller, mockDbManager, mockRegistryCollection, mockFullCollection, referenceData };
}

/**
 * Sets up mock state for duplicate detection tests.
 * Configures readAll (and optionally findOne) mocks and returns the upsert payload.
 *
 * @param {Object} mockDbManager - The mock DbManager from setupUpsertControllerTestBed
 * @param {Object} [options] - Optional overrides
 * @param {Array} [options.readAllResult] - Records for readAll mock (default: single colliding record)
 * @param {Function} [options.createPayload] - Function returning the upsert payload (default: createWizardUpsertPayload)
 * @param {Object} [options.findOneResult] - Full definition for findOne mock (sets both full + registry)
 * @param {Object} [options.mockFullCollection] - Needed if findOneResult is set
 * @param {Object} [options.mockRegistryCollection] - Needed if findOneResult is set
 * @returns {Object} The upsert payload
 */
export function setupDuplicateDetectionTest(
  mockDbManager,
  {
    readAllResult,
    createPayload = () => createWizardUpsertPayload(),
    findOneResult,
    mockFullCollection,
    mockRegistryCollection,
  } = {}
) {
  if (findOneResult) {
    mockFullCollection.findOne.mockReturnValue(findOneResult);
    mockRegistryCollection.findOne.mockReturnValue({ ...findOneResult, tasks: null });
  }

  mockDbManager.readAll.mockReturnValue(
    readAllResult || [
      {
        definitionKey: 'other-definition',
        primaryTitle: 'Water cycle explanation',
        primaryTopicKey: 'topic-science',
        yearGroupKey: 'year-group-8',
      },
    ]
  );

  return createPayload();
}

/**
 * Seeds both collection mocks with an "existing" definition built from
 * createUpsertPayload defaults.  Sets findOne on both mockFullCollection
 * and mockRegistryCollection to return the seeded record, then returns
 * the record for use in test assertions.
 *
 * @param {Object} args
 * @param {Object} args.mockFullCollection
 * @param {Object} args.mockRegistryCollection
 * @param {Object} [args.overrides={}] — spread into the definition after defaults
 * @param {Object} [args.taskOverrides={}] — override the default task fields
 * @param {boolean} [args.withTimestamps=true] — include referenceLastModified / templateLastModified
 * @returns {Object} the seeded `existing` record
 */
export function seedExistingDefinition({
  mockFullCollection,
  mockRegistryCollection,
  overrides = {},
  taskOverrides = {},
  withTimestamps = true,
} = {}) {
  const defaultTask = {
    id: 't_task_1',
    taskTitle: 'Task A',
    artifacts: { reference: [], template: [] },
    ...taskOverrides,
  };

  const existing = {
    ...createUpsertPayload({ definitionKey: 'existing-stable-key' }),
    primaryTopic: 'Science',
    yearGroupKey: 'year-group-8',
    tasks: { t_task_1: defaultTask },
    ...(withTimestamps
      ? {
          referenceLastModified: '2025-04-01T00:00:00.000Z',
          templateLastModified: '2025-04-01T00:00:00.000Z',
        }
      : {}),
    ...overrides,
  };

  mockFullCollection.findOne.mockReturnValue(existing);
  mockRegistryCollection.findOne.mockReturnValue({ ...existing, tasks: null });

  return existing;
}
