import { describe, it, expect, vi, beforeEach } from 'vitest';
import AssignmentDefinitionController from '../../src/AdminSheet/y_controllers/AssignmentDefinitionController.js';
import { AssignmentDefinition } from '../../src/AdminSheet/Models/AssignmentDefinition.js';
import DbManager from '../../src/AdminSheet/DbManager/DbManager.js';
import DriveManager from '../../src/AdminSheet/GoogleDriveManager/DriveManager.js';
import ClassroomApiClient from '../../src/AdminSheet/GoogleClassroom/ClassroomApiClient.js';
import SlidesParser from '../../src/AdminSheet/DocumentParsers/SlidesParser.js';
import { createMockCollection } from '../helpers/mockFactories.js';

// Mocks
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
            validate: () => ({ ok: true }),
            toJSON: () => ({
              id: 't1',
              taskTitle: 'Parsed Task',
              artifacts: { reference: [], template: [] },
            }),
          },
        ];
      }
    },
  };
});

describe('AssignmentDefinitionController', () => {
  let controller;
  let mockCollection;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup DbManager mock using helper
    mockCollection = createMockCollection(vi);
    DbManager.getInstance.mockReturnValue({
      getCollection: vi.fn().mockReturnValue(mockCollection),
    });

    // Expose mocks to globals to match production usage
    globalThis.DbManager = DbManager;
    globalThis.DriveManager = DriveManager;
    globalThis.ClassroomApiClient = ClassroomApiClient;
    globalThis.SlidesParser = SlidesParser;
    globalThis.AssignmentDefinition = AssignmentDefinition;

    // Setup DriveManager mock
    DriveManager.getFileModifiedTime.mockReturnValue('2025-01-01T12:00:00Z');

    // Setup ClassroomApiClient mock
    ClassroomApiClient.fetchTopicName.mockReturnValue('Enriched Topic');

    controller = new AssignmentDefinitionController();
  });

  it('should ensureDefinition creates new definition when not found', () => {
    mockCollection.findOne.mockReturnValue(null);

    const def = controller.ensureDefinition({
      primaryTitle: 'New Assignment',
      topicId: 'topic-1',
      courseId: 'course-1',
      yearGroup: 10,
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-1',
      templateDocumentId: 'tpl-1',
    });

    expect(def).toBeInstanceOf(AssignmentDefinition);
    expect(def.primaryTopic).toBe('Enriched Topic');
    expect(def.definitionKey).toBe('New Assignment_Enriched Topic_10');
    expect(mockCollection.insertOne).toHaveBeenCalled();
    expect(mockCollection.save).toHaveBeenCalled();
  });

  it('should ensureDefinition returns existing definition if fresh', () => {
    const existingDef = new AssignmentDefinition({
      primaryTitle: 'Existing',
      primaryTopic: 'Topic',
      yearGroup: 10,
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-1',
      templateDocumentId: 'tpl-1',
      referenceLastModified: '2025-01-01T12:00:00Z',
      templateLastModified: '2025-01-01T12:00:00Z',
      tasks: { t1: { taskTitle: 'Task 1', artifacts: { reference: [], template: [] } } },
    });

    mockCollection.findOne.mockReturnValue(existingDef.toJSON());
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
    expect(mockCollection.replaceOne).not.toHaveBeenCalled(); // No update needed
  });

  it('should refresh definition if Drive files are newer', () => {
    const existingDef = new AssignmentDefinition({
      primaryTitle: 'Stale',
      primaryTopic: 'Topic',
      yearGroup: 10,
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-1',
      templateDocumentId: 'tpl-1',
      referenceLastModified: '2024-01-01T12:00:00Z', // Old
      templateLastModified: '2024-01-01T12:00:00Z',
      tasks: { t1: { taskTitle: 'Task 1', artifacts: { reference: [], template: [] } } },
    });

    mockCollection.findOne.mockReturnValue(existingDef.toJSON());
    DriveManager.getFileModifiedTime.mockReturnValue('2025-01-01T12:00:00Z'); // Newer

    const def = controller.ensureDefinition({
      primaryTitle: 'Stale',
      primaryTopic: 'Topic',
      yearGroup: 10,
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-1',
      templateDocumentId: 'tpl-1',
    });

    expect(def.referenceLastModified).toBe('2025-01-01T12:00:00Z');
    expect(mockCollection.replaceOne).toHaveBeenCalled();
  });

  it('should resolve topic name using ClassroomApiClient', () => {
    mockCollection.findOne.mockReturnValue(null);

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
});
