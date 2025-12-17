import { describe, it, expect, vi, beforeEach } from 'vitest';
import AssignmentDefinitionController from '../../src/AdminSheet/y_controllers/AssignmentDefinitionController.js';
import { AssignmentDefinition } from '../../src/AdminSheet/Models/AssignmentDefinition.js';
import DbManager from '../../src/AdminSheet/DbManager/DbManager.js';
import DriveManager from '../../src/AdminSheet/GoogleDriveManager/DriveManager.js';
import ClassroomApiClient from '../../src/AdminSheet/GoogleClassroom/ClassroomApiClient.js';
import SlidesParser from '../../src/AdminSheet/DocumentParsers/SlidesParser.js';
import { setupDualCollectionGetFunction } from '../helpers/mockFactories.js';

vi.mock('../../src/AdminSheet/DbManager/DbManager.js');
vi.mock('../../src/AdminSheet/GoogleDriveManager/DriveManager.js');
vi.mock('../../src/AdminSheet/GoogleClassroom/ClassroomApiClient.js');
vi.mock('../../src/AdminSheet/DocumentParsers/SlidesParser.js', () => {
  return {
    default: class {
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
    },
  };
});

describe('AssignmentDefinitionController - Full Store Pattern', () => {
  let controller;
  let mockRegistryCollection;
  let mockFullCollection;
  let mockDbManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Use the new helper for dual-collection setup
    const { getCollectionFn, registryCollection, fullCollection } =
      setupDualCollectionGetFunction(vi);
    mockRegistryCollection = registryCollection;
    mockFullCollection = fullCollection;

    mockDbManager = {
      getCollection: getCollectionFn,
    };

    DbManager.getInstance.mockReturnValue(mockDbManager);

    globalThis.DbManager = DbManager;
    globalThis.DriveManager = DriveManager;
    globalThis.ClassroomApiClient = ClassroomApiClient;
    globalThis.SlidesParser = SlidesParser;
    globalThis.AssignmentDefinition = AssignmentDefinition;

    DriveManager.getFileModifiedTime.mockReturnValue('2025-01-01T12:00:00Z');
    ClassroomApiClient.fetchTopicName.mockReturnValue('English');

    controller = new AssignmentDefinitionController();
  });

  describe('saveDefinition - dual-store writes', () => {
    it('should write full definition to dedicated collection and partial to registry', () => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        tasks: {
          t1: {
            id: 't1',
            taskTitle: 'Task 1',
            artifacts: {
              reference: [
                {
                  taskId: 't1',
                  role: 'reference',
                  content: 'full-content',
                  contentHash: 'hash123',
                },
              ],
            },
          },
        },
      });

      mockFullCollection.findOne.mockReturnValue(null);
      mockRegistryCollection.findOne.mockReturnValue(null);

      controller.saveDefinition(definition);

      // Verify full collection received full payload
      expect(mockFullCollection.insertOne).toHaveBeenCalled();
      expect(mockFullCollection.save).toHaveBeenCalled();

      // Verify registry received partial payload
      expect(mockRegistryCollection.insertOne).toHaveBeenCalled();
      expect(mockRegistryCollection.save).toHaveBeenCalled();
    });

    it('should preserve full artifact content in full collection', () => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        tasks: {
          t1: {
            id: 't1',
            taskTitle: 'Task 1',
            artifacts: {
              reference: [
                {
                  taskId: 't1',
                  role: 'reference',
                  content: 'full-content',
                  contentHash: 'hash123',
                },
              ],
            },
          },
        },
      });

      mockFullCollection.findOne.mockReturnValue(null);
      mockRegistryCollection.findOne.mockReturnValue(null);

      controller.saveDefinition(definition);

      const fullStoreCall = mockFullCollection.insertOne.mock.calls[0];
      const savedFullDef = fullStoreCall[0];

      expect(savedFullDef.tasks.t1.artifacts.reference[0].content).toBe('full-content');
      expect(savedFullDef.tasks.t1.artifacts.reference[0].contentHash).toBe('hash123');
    });

    it('should redact artifact content in registry partial', () => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        tasks: {
          t1: {
            id: 't1',
            taskTitle: 'Task 1',
            artifacts: {
              reference: [
                {
                  taskId: 't1',
                  role: 'reference',
                  content: 'full-content',
                  contentHash: 'hash123',
                },
              ],
            },
          },
        },
      });

      mockFullCollection.findOne.mockReturnValue(null);
      mockRegistryCollection.findOne.mockReturnValue(null);

      controller.saveDefinition(definition);

      const registryCall = mockRegistryCollection.insertOne.mock.calls[0];
      const savedPartialDef = registryCall[0];

      expect(savedPartialDef.tasks).toBe(null);
      expect(savedPartialDef).not.toHaveProperty('referenceDocumentId');
      expect(savedPartialDef).not.toHaveProperty('templateDocumentId');
    });
  });

  describe('getDefinitionByKey - form parameter', () => {
    it('should return full definition by default', () => {
      const fullDef = {
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        definitionKey: 'Test_Topic_10',
        tasks: {
          t1: {
            id: 't1',
            taskTitle: 'Task 1',
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
      expect(result).toBeInstanceOf(AssignmentDefinition);
      expect(result.tasks.t1.artifacts.reference[0].content).toBe('full');
    });

    it('should return full definition when form: "full" specified', () => {
      const fullDef = {
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        definitionKey: 'Test_Topic_10',
        tasks: {
          t1: {
            id: 't1',
            taskTitle: 'Task 1',
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
      expect(result.tasks.t1.artifacts.reference[0].content).toBe('full');
    });

    it('should return partial definition when form: "partial" specified', () => {
      const partialDef = {
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        definitionKey: 'Test_Topic_10',
        tasks: {
          t1: {
            id: 't1',
            taskTitle: 'Task 1',
            artifacts: {
              reference: [{ taskId: 't1', role: 'reference', content: null, contentHash: null }],
            },
          },
        },
      };
      mockRegistryCollection.findOne.mockReturnValue(partialDef);

      const result = controller.getDefinitionByKey('Test_Topic_10', { form: 'partial' });

      expect(mockDbManager.getCollection).toHaveBeenCalledWith('assignment_definitions');
      expect(result.tasks.t1.artifacts.reference[0].content).toBeNull();
    });

    it('should return null if definition not found', () => {
      mockFullCollection.findOne.mockReturnValue(null);

      const result = controller.getDefinitionByKey('NonExistent_Topic_10');

      expect(result).toBeNull();
    });
  });

  describe('ensureDefinition - parsing and persistence', () => {
    it('should persist parsed tasks to full store when creating new definition', () => {
      mockFullCollection.findOne.mockReturnValue(null);

      controller.ensureDefinition({
        primaryTitle: 'New',
        topicId: 'topic-1',
        courseId: 'course-1',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
      });

      // Verify full collection received full payload via insertOne (new definition)
      const fullStoreCall = mockFullCollection.insertOne.mock.calls[0];
      const savedFullDef = fullStoreCall[0];
      expect(savedFullDef.tasks.t1.artifacts.reference[0].content).toBe('ref-content');
      expect(savedFullDef.tasks.t1.artifacts.reference[0].contentHash).toBe('hash1');
    });

    it('should re-persist full definition when Drive files are newer', () => {
      const staleDef = new AssignmentDefinition({
        primaryTitle: 'Stale',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        referenceLastModified: '2024-01-01T00:00:00Z',
        templateLastModified: '2024-01-01T00:00:00Z',
        tasks: {
          oldTask: {
            id: 'oldTask',
            taskTitle: 'Old Task',
            artifacts: { reference: [], template: [] },
          },
        },
      });

      mockFullCollection.findOne.mockReturnValue(staleDef.toJSON());
      DriveManager.getFileModifiedTime.mockReturnValue('2025-06-01T00:00:00Z');

      controller.ensureDefinition({
        primaryTitle: 'Stale',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
      });

      // Should have re-parsed and updated full store
      expect(mockFullCollection.replaceOne).toHaveBeenCalled();
      const fullStoreCall = mockFullCollection.replaceOne.mock.calls[0];
      const updatedFullDef = fullStoreCall[1];

      // New parsed tasks
      expect(updatedFullDef.tasks.t1).toBeDefined();
      expect(updatedFullDef.tasks.t1.artifacts.reference[0].content).toBe('ref-content');
      expect(updatedFullDef.referenceLastModified).toBe('2025-06-01T00:00:00Z');
      expect(updatedFullDef.templateLastModified).toBe('2025-06-01T00:00:00Z');
    });

    it('should update registry when definition is refreshed', () => {
      const staleDef = new AssignmentDefinition({
        primaryTitle: 'Stale',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        referenceLastModified: '2024-01-01T00:00:00Z',
        templateLastModified: '2024-01-01T00:00:00Z',
        tasks: {},
      });

      mockFullCollection.findOne.mockReturnValue(staleDef.toJSON());
      DriveManager.getFileModifiedTime.mockReturnValue('2025-06-01T00:00:00Z');

      controller.ensureDefinition({
        primaryTitle: 'Stale',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
      });

      // Registry should also be updated with partial (tasks: null)
      expect(mockRegistryCollection.save).toHaveBeenCalled();
      // Registry was updated via replaceOne or insertOne - check the appropriate method
      const registryReplaceCall = mockRegistryCollection.replaceOne.mock.calls[0];
      const registryInsertCall = mockRegistryCollection.insertOne.mock.calls[0];
      const partialDef = registryReplaceCall ? registryReplaceCall[1] : registryInsertCall[0];

      expect(partialDef.tasks).toBe(null);
      expect(partialDef).not.toHaveProperty('referenceDocumentId');
      expect(partialDef).not.toHaveProperty('templateDocumentId');
    });
  });

  describe('savePartialDefinition', () => {
    it('should only update registry, not full store', () => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        tasks: {
          t1: {
            id: 't1',
            taskTitle: 'Task 1',
            artifacts: {
              reference: [
                { taskId: 't1', role: 'reference', content: 'content', contentHash: 'hash' },
              ],
            },
          },
        },
      });

      controller.savePartialDefinition(definition);

      expect(mockFullCollection.replaceOne).not.toHaveBeenCalled();
      expect(mockRegistryCollection.save).toHaveBeenCalled();

      // Check what was passed to insertOne or replaceOne
      const registryReplaceCall = mockRegistryCollection.replaceOne.mock.calls[0];
      const registryInsertCall = mockRegistryCollection.insertOne.mock.calls[0];
      const savedPartial = registryReplaceCall ? registryReplaceCall[1] : registryInsertCall[0];
      expect(savedPartial.tasks).toBe(null);
    });
  });
});
