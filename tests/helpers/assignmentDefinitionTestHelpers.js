/**
 * Shared test helpers for AssignmentDefinitionController tests
 * Reduces duplication across assignment definition controller test files
 */

import { vi } from 'vitest';
import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';
import { setupDualCollectionGetFunction } from './mockFactories.js';

/**
 * Default task definition returned by SlidesParser mock
 */
export const DEFAULT_PARSED_TASK_DEFINITION = {
  getId: () => 't1',
  taskTitle: 'Task 1',
  validate: () => ({ ok: true, errors: [] }),
  toJSON: () => ({
    id: 't1',
    taskTitle: 'Task 1',
    taskWeighting: null,
    index: 0,
    artifacts: {
      reference: [
        { taskId: 't1', role: 'reference', content: 'ref-content', contentHash: 'hash1' },
      ],
      template: [{ taskId: 't1', role: 'template', content: 'tpl-content', contentHash: 'hash2' }],
    },
  }),
};

/**
 * Create a mock ReferenceDataController class with default data
 * @param {Object} options - Configuration options
 * @param {Array} options.yearGroups - Year groups to return (default: year-group-10)
 * @param {Array} options.topics - Topics to return (default: topic-english)
 * @returns {Function} Mock ReferenceDataController class
 */
export function createReferenceDataControllerMock(options = {}) {
  const {
    yearGroups = [{ key: 'year-group-10', name: 'Year 10' }],
    topics = [{ key: 'topic-english', name: 'English' }],
  } = options;

  return class MockReferenceDataController {
    listYearGroups() {
      return yearGroups;
    }
    listAssignmentTopics() {
      return topics;
    }
    fetchTopicName(topicId) {
      const topic = topics.find((t) => t.key === topicId);
      return topic ? topic.name : 'Unknown Topic';
    }
  };
}

/**
 * Setup mocks for AssignmentDefinitionController tests
 * Returns mock objects for dual-collection testing
 * @param {Object} vi - Vitest vi object
 * @param {Object} options - Configuration options
 * @param {string} options.driveModifiedTime - Drive file modified time to return
 * @param {string} options.topicName - Topic name to return from ClassroomApiClient
 * @param {Array} options.yearGroups - Year groups for ReferenceDataController
 * @param {Array} options.topics - Topics for ReferenceDataController
 * @returns {Object} { mockDbManager, mockRegistryCollection, mockFullCollection, mockDropCollection, mockReferenceDataController }
 */
export function setupAssignmentDefinitionMocks(vi, options = {}) {
  const {
    driveModifiedTime = '2025-01-01T12:00:00Z',
    topicName = 'English',
    yearGroups,
    topics,
  } = options;

  // Setup dual collection pattern
  const { getCollectionFn, registryCollection, fullCollection } =
    setupDualCollectionGetFunction(vi);

  const mockDropCollection = vi.fn();
  const mockDbManager = {
    getCollection: getCollectionFn,
    getDb: vi.fn(() => ({
      dropCollection: mockDropCollection,
    })),
    readAll: vi.fn().mockReturnValue([]),
  };

  const MockReferenceDataController = createReferenceDataControllerMock({
    yearGroups,
    topics,
  });

  const mockReferenceDataController = new MockReferenceDataController();

  // If specific topicName is provided, override the mock
  if (topicName) {
    mockReferenceDataController.fetchTopicName = vi.fn().mockReturnValue(topicName);
  }

  return {
    mockDbManager,
    mockRegistryCollection: registryCollection,
    mockFullCollection: fullCollection,
    mockDropCollection,
    mockReferenceDataController,
    mockDriveModifiedTime: driveModifiedTime,
  };
}

/**
 * Sample partial definitions for getAllPartialDefinitions tests
 * @returns {Array} Array of partial definition documents
 */
export function createSamplePartialDefinitionDocs() {
  return [
    {
      _id: '585c9ad9-2993-4a0d-b3a4-f513133da1a0',
      primaryTitle: '1.1 Learning to Research',
      primaryTopic: 'Space',
      primaryTopicKey: 'topic-space',
      yearGroupKey: 'year-group-10',
      yearGroupLabel: 'Year 10',
      documentType: 'SLIDES',
      referenceDocumentId: '1fuOQ8ZFoB1Kdk9_rgEErRs4jrphRkB6zJYYLjEbVoII',
      templateDocumentId: '1blHtdE5Ieyr7F_XYuAta1O4PlVhDcmJJw0OJd0BakKY',
      definitionKey: '1.1 Learning to Research_Space_year-group-10',
      tasks: null,
    },
    {
      _id: '9387cd91-c034-4e0a-a896-f25a7bcfca4a',
      primaryTitle: '8. Secondary Storage - Cloud',
      primaryTopic: '1.1 Computer Architecture',
      primaryTopicKey: 'topic-computer-architecture',
      yearGroupKey: 'year-group-10',
      yearGroupLabel: 'Year 10',
      documentType: 'SLIDES',
      referenceDocumentId: '1Qa3SXcZfFPtKVU0mZbbIyq3kksXOVMK12IvrLgnmwmk',
      templateDocumentId: '1kfWiX2QfzK39q98r_RxPqEvteShuUMfCdOg2wtJgCfg',
      definitionKey: '8. Secondary Storage - Cloud_1.1 Computer Architecture_year-group-10',
      tasks: null,
    },
    {
      _id: 'cb412c10-a619-4e3c-bba2-821b0ce33a08',
      primaryTitle: '1. DigiTech Pathways',
      primaryTopic: 'Pathways',
      primaryTopicKey: 'topic-pathways',
      yearGroupKey: 'year-group-10',
      yearGroupLabel: 'Year 10',
      documentType: 'SLIDES',
      referenceDocumentId: '1fXe7mD6YgBixNcLpRl-6NTSTayraVCDvGTIjLQ_vh24',
      templateDocumentId: '1nguALHo-wXxxMlml49_7JoQ8sFt0-0_eF9ec4_pX6JQ',
      definitionKey: '1. DigiTech Pathways_Pathways_year-group-10',
      tasks: null,
    },
  ];
}

/**
 * Standard cleanup for AssignmentDefinitionController tests
 */
export function cleanupAssignmentDefinitionTest() {
  vi.restoreAllMocks();
  delete globalThis.DbManager;
  delete globalThis.DriveManager;
  delete globalThis.ClassroomApiClient;
  delete globalThis.SlidesParser;
  delete globalThis.AssignmentDefinition;
  delete globalThis.ReferenceDataController;
}

/**
 * Default MockSlidesParser class for tests
 * Returns a consistent parsed task definition
 */
export class MockSlidesParser {
  extractTaskDefinitions() {
    return [
      {
        getId: () => 't1',
        taskTitle: 'Parsed Task',
        validate: () => ({ ok: true, errors: [] }),
        toJSON: () => ({
          id: 't1',
          taskTitle: 'Parsed Task',
          taskWeighting: null,
          index: 0,
          artifacts: { reference: [], template: [] },
        }),
      },
    ];
  }
}

/**
 * Setup and install global mocks for AssignmentDefinitionController tests
 * This installs all required globals (DbManager, DriveManager, ClassroomApiClient,
 * AssignmentDefinition, ReferenceDataController, SlidesParser) with proper mocking
 * @param {Object} vi - Vitest vi object
 * @param {Object} DbManager - Mocked DbManager module (from vi.mock)
 * @param {Object} DriveManager - Mocked DriveManager module (from vi.mock)
 * @param {Object} ClassroomApiClient - Mocked ClassroomApiClient module (from vi.mock)
 * @param {Object} options - Configuration options
 * @param {string} options.driveModifiedTime - Drive file modified time to return
 * @param {string} options.topicName - Topic name to return from ClassroomApiClient
 * @param {Array} options.yearGroups - Year groups for ReferenceDataController
 * @param {Array} options.topics - Topics for ReferenceDataController
 * @returns {Object} { mockDbManager, mockRegistryCollection, mockFullCollection, controller }
 */
export function setupAssignmentDefinitionTestGlobals(
  vi,
  DbManager,
  DriveManager,
  ClassroomApiClient,
  options = {}
) {
  const {
    driveModifiedTime = '2025-01-01T12:00:00Z',
    topicName = 'English',
    yearGroups,
    topics,
  } = options;

  // Get mock collections
  const { mockDbManager, mockRegistryCollection, mockFullCollection } =
    setupAssignmentDefinitionMocks(vi, {
      driveModifiedTime,
      topicName,
      yearGroups,
      topics,
    });

  // Configure the vi.mock'd modules to return our mock objects
  DbManager.getInstance.mockReturnValue(mockDbManager);
  DriveManager.getFileModifiedTime.mockReturnValue(driveModifiedTime);
  ClassroomApiClient.fetchTopicName.mockReturnValue(topicName);

  // Expose to globals to match production usage
  globalThis.DbManager = DbManager;
  globalThis.DriveManager = DriveManager;
  globalThis.ClassroomApiClient = ClassroomApiClient;
  globalThis.AssignmentDefinition = AssignmentDefinition;

  // Create and install ReferenceDataController mock
  const MockReferenceDataController = createReferenceDataControllerMock({
    yearGroups,
    topics,
  });
  globalThis.ReferenceDataController = MockReferenceDataController;

  // Install SlidesParser mock
  globalThis.SlidesParser = MockSlidesParser;

  // Create controller - use default export if available
  const AssignmentDefinitionController = require('../../src/backend/y_controllers/AssignmentDefinition/index.js');
  const ControllerClass = AssignmentDefinitionController.default || AssignmentDefinitionController;
  const controller = new ControllerClass();

  return {
    mockDbManager,
    mockRegistryCollection,
    mockFullCollection,
    controller,
  };
}
