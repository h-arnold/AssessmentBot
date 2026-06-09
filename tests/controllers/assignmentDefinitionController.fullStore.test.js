import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AssignmentDefinitionController from '../../src/backend/y_controllers/AssignmentDefinitionController.js';
import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';
import DbManager from '../../src/backend/DbManager/DbManager.js';
import DriveManager from '../../src/backend/GoogleDriveManager/DriveManager.js';
import ClassroomApiClient from '../../src/backend/GoogleClassroom/ClassroomApiClient.js';
import {
  setupAssignmentDefinitionMocks,
  cleanupAssignmentDefinitionTest,
} from '../helpers/assignmentDefinitionTestHelpers.js';

// Mock the modules
vi.mock('../../src/backend/DbManager/DbManager.js');
vi.mock('../../src/backend/GoogleDriveManager/DriveManager.js');
vi.mock('../../src/backend/GoogleClassroom/ClassroomApiClient.js');

describe('AssignmentDefinitionController - Full Store Pattern', () => {
  let controller;
  let mockRegistryCollection;
  let mockFullCollection;
  let mockDbManager;
  let mockDropCollection;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks using shared helper
    const {
      mockDbManager: setupDbManager,
      mockRegistryCollection: setupRegistryCollection,
      mockFullCollection: setupFullCollection,
      mockDropCollection: setupDropCollection,
    } = setupAssignmentDefinitionMocks(vi, {
      driveModifiedTime: '2025-01-01T12:00:00Z',
      topicName: 'English',
    });

    mockDbManager = setupDbManager;
    mockRegistryCollection = setupRegistryCollection;
    mockFullCollection = setupFullCollection;
    mockDropCollection = setupDropCollection;

    // Configure the vi.mock'd modules to return our mock objects
    DbManager.getInstance.mockReturnValue(mockDbManager);
    DriveManager.getFileModifiedTime.mockReturnValue('2025-01-01T12:00:00Z');
    ClassroomApiClient.fetchTopicName.mockReturnValue('English');

    // Create ReferenceDataController mock class
    const MockReferenceDataController = class {
      listYearGroups() {
        return [{ key: 'year-group-10', name: 'Year 10' }];
      }
      listAssignmentTopics() {
        return [{ key: 'topic-english', name: 'English' }];
      }
      fetchTopicName(topicId) {
        return 'English';
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
            taskTitle: 'Task 1',
            validate: () => ({ ok: true }),
            toJSON: () => ({
              id: 't1',
              taskTitle: 'Task 1',
              artifacts: {
                reference: [
                  { taskId: 't1', role: 'reference', content: 'ref-content', contentHash: 'hash1' },
                ],
                template: [
                  { taskId: 't1', role: 'template', content: 'tpl-content', contentHash: 'hash2' },
                ],
              },
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

  describe('getDefinitionByKey - form parameter', () => {
    it('should return full definition by default', () => {
      const fullDef = {
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        definitionKey: 'Test_Topic_10',
        tasks: {
          t1: {
            id: 't1',
            taskTitle: 'Task 1',
            taskWeighting: 1,
            artifacts: {
              reference: [
                { taskId: 't1', role: 'reference', content: 'full', contentHash: 'hash' },
              ],
            },
          },
        },
      };
      mockFullCollection.findOne.mockReturnValue(fullDef);

      const result = controller.getDefinitionByKey('Test_Topic_10');

      expect(mockDbManager.getCollection).toHaveBeenCalledWith('assdef_full_Test_Topic_10');
      expect(result).toMatchObject({
        definitionKey: 'Test_Topic_10',
        yearGroupKey: 'year-group-10',
      });
      expect(result.tasks.t1).toMatchObject({ id: 't1', taskTitle: 'Task 1' });
    });

    it('should return full definition when form: "full" specified', () => {
      const fullDef = {
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        definitionKey: 'Test_Topic_10',
        tasks: {
          t1: {
            id: 't1',
            taskTitle: 'Task 1',
            taskWeighting: 1,
            artifacts: {
              reference: [
                { taskId: 't1', role: 'reference', content: 'full', contentHash: 'hash' },
              ],
            },
          },
        },
      };
      mockFullCollection.findOne.mockReturnValue(fullDef);

      const result = controller.getDefinitionByKey('Test_Topic_10', { form: 'full' });

      expect(mockDbManager.getCollection).toHaveBeenCalledWith('assdef_full_Test_Topic_10');
      expect(result).toMatchObject({
        definitionKey: 'Test_Topic_10',
        yearGroupKey: 'year-group-10',
      });
      expect(result.tasks.t1).toMatchObject({ id: 't1', taskTitle: 'Task 1' });
    });

    it('should return partial definition when form: "partial" specified', () => {
      const partialDef = {
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        definitionKey: 'Test_Topic_10',
        tasks: null,
      };
      mockRegistryCollection.findOne.mockReturnValue(partialDef);

      const result = controller.getDefinitionByKey('Test_Topic_10', { form: 'partial' });

      expect(mockDbManager.getCollection).toHaveBeenCalledWith('assignment_definitions');
      expect(result).toMatchObject({
        definitionKey: 'Test_Topic_10',
      });
      expect(result.tasks).toBeNull();
    });

    it('should fail fast when definitionKey is missing', () => {
      expect(() => controller.getDefinitionByKey(undefined)).toThrow(/definitionKey is required/i);
    });

    it('should return null if definition not found', () => {
      mockFullCollection.findOne.mockReturnValue(null);

      const result = controller.getDefinitionByKey('NonExistent_Topic_10');

      expect(result).toBeNull();
    });
  });

  describe('deleteDefinitionByKey - dual-store deletes', () => {
    it('should delete the matching registry record and drop the full-store collection for a safe key', () => {
      controller.deleteDefinitionByKey('safe-definition-key');

      expect(mockDbManager.getCollection).toHaveBeenCalledWith('assignment_definitions');
      expect(mockRegistryCollection.deleteOne).toHaveBeenCalledWith({
        definitionKey: 'safe-definition-key',
      });
      expect(mockRegistryCollection.save).toHaveBeenCalledTimes(1);
      expect(mockDropCollection).toHaveBeenCalledTimes(1);
      expect(mockDropCollection).toHaveBeenCalledWith('assdef_full_safe-definition-key');
    });

    it('should remain idempotent when the registry and full-store records are absent', () => {
      const missingCollectionError = new Error('Collection missing');
      missingCollectionError.code = 'COLLECTION_NOT_FOUND';
      mockDropCollection.mockImplementation(() => {
        throw missingCollectionError;
      });

      expect(() => controller.deleteDefinitionByKey('safe-definition-key')).not.toThrow();
      expect(() => controller.deleteDefinitionByKey('safe-definition-key')).not.toThrow();
      expect(mockDropCollection).toHaveBeenCalledTimes(2);
    });
  });
});
