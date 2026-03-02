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

  it('getAllPartialDefinitions returns all partial definitions from registry', () => {
    // Sample registry payload (partial documents) from production-like data
    const sampleDocs = [
      {
        _id: '585c9ad9-2993-4a0d-b3a4-f513133da1a0',
        primaryTitle: '1.1 Learning to Research',
        primaryTopic: 'Space',
        yearGroup: null,
        documentType: 'SLIDES',
        referenceDocumentId: '1fuOQ8ZFoB1Kdk9_rgEErRs4jrphRkB6zJYYLjEbVoII',
        templateDocumentId: '1blHtdE5Ieyr7F_XYuAta1O4PlVhDcmJJw0OJd0BakKY',
        definitionKey: '1.1 Learning to Research_Space_null',
        tasks: null,
      },
      {
        _id: '9387cd91-c034-4e0a-a896-f25a7bcfca4a',
        primaryTitle: '8. Secondary Storage - Cloud',
        primaryTopic: '1.1 Computer Architecture',
        yearGroup: null,
        documentType: 'SLIDES',
        referenceDocumentId: '1Qa3SXcZfFPtKVU0mZbbIyq3kksXOVMK12IvrLgnmwmk',
        templateDocumentId: '1kfWiX2QfzK39q98r_RxPqEvteShuUMfCdOg2wtJgCfg',
        definitionKey: '8. Secondary Storage - Cloud_1.1 Computer Architecture_null',
        tasks: null,
      },
      {
        _id: 'cb412c10-a619-4e3c-bba2-821b0ce33a08',
        primaryTitle: '1. DigiTech Pathways',
        primaryTopic: 'Pathways',
        yearGroup: null,
        documentType: 'SLIDES',
        referenceDocumentId: '1fXe7mD6YgBixNcLpRl-6NTSTayraVCDvGTIjLQ_vh24',
        templateDocumentId: '1nguALHo-wXxxMlml49_7JoQ8sFt0-0_eF9ec4_pX6JQ',
        definitionKey: '1. DigiTech Pathways_Pathways_null',
        tasks: null,
      },
      {
        _id: '7fc01a34-4301-4b69-941d-eb629c126b8f',
        primaryTitle: '7. Social Engineering',
        primaryTopic: 'Starters',
        yearGroup: null,
        documentType: 'SLIDES',
        referenceDocumentId: '13UhXRtuJf8uqwH5wYJkjVTBQhqpniZwPBhpMjT7KQxc',
        templateDocumentId: '1jKuG_CK2Z31rUs_5W8WDWl5WRjU0d1udq5eVGCki2-Y',
        definitionKey: '7. Social Engineering_Starters_null',
        tasks: null,
      },
      {
        _id: 'c130e72f-ed48-4045-917e-688244da35c7',
        primaryTitle: '7. Survival Challenges Reflect and Review',
        primaryTopic: 'Survival',
        yearGroup: null,
        documentType: 'SLIDES',
        referenceDocumentId: '1MXnBAxkTLcg8CIPxVWa0wEc9CgIz3DPfjqXMv3LPmNw',
        templateDocumentId: '12HMxnplFzBKpq1FknTRBirhtltWnuRoseQVUUoum5S8',
        definitionKey: '7. Survival Challenges Reflect and Review_Survival_null',
        tasks: null,
      },
    ];

    // Configure DbManager mock to return these docs via readAll
    DbManager.getInstance.mockReturnValue({
      getCollection: vi.fn().mockReturnValue(mockCollection),
      readAll: vi.fn().mockReturnValue(sampleDocs),
    });

    // Recreate controller to pick up new DbManager.mock behaviour
    controller = new AssignmentDefinitionController();

    const defs = controller.getAllPartialDefinitions();
    expect(Array.isArray(defs)).toBe(true);
    expect(defs.length).toBe(5);
    expect(defs[0]).toBeInstanceOf(AssignmentDefinition);
    const keys = defs.map((d) => d.definitionKey);
    expect(keys).toEqual(sampleDocs.map((d) => d.definitionKey));
  });

  it('getAllPartialDefinitions returns empty array when registry empty', () => {
    DbManager.getInstance.mockReturnValue({
      getCollection: vi.fn().mockReturnValue(mockCollection),
      readAll: vi.fn().mockReturnValue([]),
    });

    controller = new AssignmentDefinitionController();
    const defs = controller.getAllPartialDefinitions();
    expect(defs).toEqual([]);
  });
});
