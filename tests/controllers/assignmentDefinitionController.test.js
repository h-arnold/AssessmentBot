import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AssignmentDefinitionController from '../../src/backend/y_controllers/AssignmentDefinitionController.js';
import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';
import DbManager from '../../src/backend/DbManager/DbManager.js';
import DriveManager from '../../src/backend/GoogleDriveManager/DriveManager.js';
import ClassroomApiClient from '../../src/backend/GoogleClassroom/ClassroomApiClient.js';
import {
  setupAssignmentDefinitionMocks,
  createSamplePartialDefinitionDocs,
  cleanupAssignmentDefinitionTest,
} from '../helpers/assignmentDefinitionTestHelpers.js';

// Mock the modules
vi.mock('../../src/backend/DbManager/DbManager.js');
vi.mock('../../src/backend/GoogleDriveManager/DriveManager.js');
vi.mock('../../src/backend/GoogleClassroom/ClassroomApiClient.js');

describe('AssignmentDefinitionController', () => {
  let controller;
  let mockRegistryCollection;
  let mockFullCollection;
  let mockDbManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks using shared helper
    const {
      mockDbManager: setupDbManager,
      mockRegistryCollection: setupRegistryCollection,
      mockFullCollection: setupFullCollection,
    } = setupAssignmentDefinitionMocks(vi, {
      driveModifiedTime: '2025-01-01T12:00:00Z',
      topicName: 'Enriched Topic',
      topics: [
        { key: 'topic-1', name: 'Enriched Topic' },
        { key: 'topic-english', name: 'English' },
      ],
    });

    mockDbManager = setupDbManager;
    mockRegistryCollection = setupRegistryCollection;
    mockFullCollection = setupFullCollection;

    // Configure the vi.mock'd modules to return our mock objects
    DbManager.getInstance.mockReturnValue(mockDbManager);
    DriveManager.getFileModifiedTime.mockReturnValue('2025-01-01T12:00:00Z');
    ClassroomApiClient.fetchTopicName.mockReturnValue('Enriched Topic');

    // Create ReferenceDataController mock class
    const MockReferenceDataController = class {
      listYearGroups() {
        return [{ key: 'year-group-10', name: 'Year 10', yearGroup: 10 }];
      }
      listAssignmentTopics() {
        return [
          { key: 'topic-1', name: 'Enriched Topic' },
          { key: 'topic-english', name: 'English' },
        ];
      }
      fetchTopicName(topicId) {
        const topics = [
          { key: 'topic-1', name: 'Enriched Topic' },
          { key: 'topic-english', name: 'English' },
        ];
        const topic = topics.find((t) => t.key === topicId);
        return topic ? topic.name : 'Enriched Topic';
      }
    };

    // Expose to globals to match production usage
    globalThis.DbManager = DbManager;
    globalThis.DriveManager = DriveManager;
    globalThis.ClassroomApiClient = ClassroomApiClient;
    globalThis.AssignmentDefinition = AssignmentDefinition;
    globalThis.ReferenceDataController = MockReferenceDataController;
    globalThis.SlidesParser = class MockSlidesParser {
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
    };

    controller = new AssignmentDefinitionController();
  });

  afterEach(() => {
    cleanupAssignmentDefinitionTest();
  });

  it('should ensureDefinition creates new definition when not found', () => {
    mockRegistryCollection.findOne.mockReturnValue(null);

    const def = controller.ensureDefinition({
      primaryTitle: 'New Assignment',
      topicId: 'topic-1',
      courseId: 'course-1',
      yearGroup: 10,
      yearGroupKey: 'year-group-10',
      yearGroupLabel: 'Year 10',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-1',
      templateDocumentId: 'tpl-1',
    });

    expect(def).toBeInstanceOf(AssignmentDefinition);
    expect(def.primaryTopic).toBe('Enriched Topic');
    expect(def.definitionKey).toBe('New Assignment_Enriched Topic_10');
    expect(mockRegistryCollection.insertOne).toHaveBeenCalled();
    expect(mockRegistryCollection.save).toHaveBeenCalled();
  });

  it('should ensureDefinition returns existing definition if fresh', () => {
    const existingDef = new AssignmentDefinition({
      primaryTitle: 'Existing',
      primaryTopic: 'Topic',
      yearGroup: 10,
      yearGroupKey: 'year-group-10',
      yearGroupLabel: 'Year 10',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-1',
      templateDocumentId: 'tpl-1',
      referenceLastModified: '2025-01-01T12:00:00Z',
      templateLastModified: '2025-01-01T12:00:00Z',
      tasks: { t1: { taskTitle: 'Task 1', artifacts: { reference: [], template: [] } } },
    });

    // Mock the full collection to return the existing definition
    mockFullCollection.findOne.mockReturnValue(existingDef.toJSON());
    DriveManager.getFileModifiedTime.mockReturnValue('2025-01-01T12:00:00Z'); // Same time

    const def = controller.ensureDefinition({
      primaryTitle: 'Existing',
      primaryTopic: 'Topic',
      yearGroup: 10,
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-1',
      templateDocumentId: 'tpl-1',
    });

    expect(def.definitionKey).toBe(existingDef.definitionKey);
    expect(mockFullCollection.replaceOne).not.toHaveBeenCalled(); // No update needed
  });

  it('should refresh definition if Drive files are newer', () => {
    const existingDef = new AssignmentDefinition({
      primaryTitle: 'Stale',
      primaryTopic: 'Topic',
      yearGroup: 10,
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-1',
      templateDocumentId: 'tpl-1',
      referenceLastModified: '2024-01-01T12:00:00Z',
      templateLastModified: '2024-01-01T12:00:00Z',
      tasks: { t1: { taskTitle: 'Task 1', artifacts: { reference: [], template: [] } } },
    });

    mockRegistryCollection.findOne.mockReturnValue(existingDef.toJSON());
    DriveManager.getFileModifiedTime.mockReturnValue('2025-01-01T12:00:00Z'); // Newer

    const def = controller.ensureDefinition({
      primaryTitle: 'Stale',
      primaryTopic: 'Topic',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-1',
      templateDocumentId: 'tpl-1',
    });

    expect(def.referenceLastModified).toBe('2025-01-01T12:00:00Z');
    expect(mockRegistryCollection.replaceOne).toHaveBeenCalled();
  });

  it('should resolve topic name using ClassroomApiClient', () => {
    mockRegistryCollection.findOne.mockReturnValue(null);

    controller.ensureDefinition({
      primaryTitle: 'Title',
      topicId: 'topic-123',
      courseId: 'course-123',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref',
      templateDocumentId: 'tpl',
    });

    expect(ClassroomApiClient.fetchTopicName).toHaveBeenCalledWith('course-123', 'topic-123');
  });

  it('getAllPartialDefinitions returns all partial definitions from registry', () => {
    const sampleDocs = createSamplePartialDefinitionDocs();

    // Configure DbManager mock to return these docs via readAll
    mockDbManager.readAll.mockReturnValue(sampleDocs);

    // Recreate controller to pick up new DbManager mock behaviour
    controller = new AssignmentDefinitionController();

    const defs = controller.getAllPartialDefinitions();
    expect(Array.isArray(defs)).toBe(true);
    expect(defs.length).toBe(3);
    expect(defs[0]).toBeInstanceOf(AssignmentDefinition);
    const keys = defs.map((d) => d.definitionKey);
    expect(keys).toEqual(sampleDocs.map((d) => d.definitionKey));
    const topicKeys = defs.map((d) => d.primaryTopicKey);
    expect(topicKeys).toEqual(sampleDocs.map((d) => d.primaryTopicKey));
  });

  it('getAllPartialDefinitions preserves yearGroupKey/yearGroupLabel in list-surface partial payloads', () => {
    const sampleDocs = [
      {
        _id: 'assignment-row-1',
        primaryTitle: 'Algebra foundations',
        primaryTopic: 'Algebra',
        primaryTopicKey: 'topic-algebra',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        alternateTitles: [],
        alternateTopics: [],
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-1',
        templateDocumentId: 'tpl-1',
        assignmentWeighting: 1,
        definitionKey: 'alg-10',
        tasks: null,
        createdAt: '2026-01-05T10:00:00.000Z',
        updatedAt: null,
      },
    ];

    mockDbManager.readAll.mockReturnValue(sampleDocs);

    controller = new AssignmentDefinitionController();

    const [partialDefinition] = controller.getAllPartialDefinitions();

    expect(partialDefinition).toBeInstanceOf(AssignmentDefinition);

    const partialPayload = partialDefinition.toPartialJSON();
    expect(partialPayload.primaryTopicKey).toBe('topic-algebra');
    expect(partialPayload.yearGroupKey).toBe('year-group-10');
    expect(partialPayload.yearGroupLabel).toBe('Year 10');
    expect(partialPayload.definitionKey).toBe('alg-10');
    expect(partialPayload.tasks).toBeNull();
  });

  it('getAllPartialDefinitions returns empty array when registry empty', () => {
    mockDbManager.readAll.mockReturnValue([]);

    controller = new AssignmentDefinitionController();
    const defs = controller.getAllPartialDefinitions();
    expect(defs).toEqual([]);
  });
});
