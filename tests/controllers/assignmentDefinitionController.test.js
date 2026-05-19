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

// Section 2: AssignmentDefinitionController Red Phase Tests
// These tests are intentionally failing as they test for the expected future state
describe('AssignmentDefinitionController - Section 2 Red Phase (intentionally failing)', () => {
  let controller;
  let mockDbManager;
  let mockRegistryCollection;
  let mockFullCollection;

  beforeEach(() => {
    vi.clearAllMocks();

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

    DbManager.getInstance.mockReturnValue(mockDbManager);
    DriveManager.getFileModifiedTime.mockReturnValue('2025-01-01T12:00:00Z');
    ClassroomApiClient.fetchTopicName.mockReturnValue('Enriched Topic');

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

  // Test 1: ensureDefinition removed
  it('should throw when calling ensureDefinition (method removed)', () => {
    expect(() =>
      controller.ensureDefinition({
        primaryTitle: 'Test',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-1',
        templateDocumentId: 'tpl-1',
      })
    ).toThrow(/ensureDefinition.*not a function|Cannot read property.*ensureDefinition/i);
  });

  // Test 2: _buildUpsertContext removed
  it('should throw when calling _buildUpsertContext (helper removed)', () => {
    expect(() =>
      controller._buildUpsertContext({
        primaryTitle: 'Test',
        primaryTopicKey: 'topic-1',
        yearGroupKey: 'year-group-10',
      })
    ).toThrow(/_buildUpsertContext.*not a function|Cannot read property.*_buildUpsertContext/i);
  });

  // Test 3: _resolveYearGroupContextForUpsert returns correct shape
  describe('_resolveYearGroupContextForUpsert return shape', () => {
    it('should return object with yearGroupKey property', () => {
      const context = controller._resolveYearGroupContextForUpsert({
        payload: { yearGroupKey: 'year-group-10' },
      });
      expect(context).toHaveProperty('yearGroupKey');
      expect(context.yearGroupKey).toBe('year-group-10');
    });

    it('should return object with yearGroupLabel property', () => {
      const context = controller._resolveYearGroupContextForUpsert({
        payload: { yearGroupKey: 'year-group-10' },
      });
      expect(context).toHaveProperty('yearGroupLabel');
      expect(context.yearGroupLabel).toBe('Year 10');
    });

    it('should return object without yearGroup property', () => {
      const context = controller._resolveYearGroupContextForUpsert({
        payload: { yearGroupKey: 'year-group-10' },
      });
      expect(context).not.toHaveProperty('yearGroup');
    });

    it('should resolve yearGroupLabel from reference data', () => {
      const context = controller._resolveYearGroupContextForUpsert({
        payload: { yearGroupKey: 'year-group-10' },
      });
      expect(context.yearGroupLabel).toBe('Year 10');
    });
  });

  // Test 4: _assertNoDuplicateBusinessTuple uses yearGroupKey only
  describe('_assertNoDuplicateBusinessTuple uses yearGroupKey only', () => {
    it('should accept yearGroupKey parameter', () => {
      mockDbManager.readAll.mockReturnValue([]);

      // This should not throw - method should accept yearGroupKey
      expect(() =>
        controller._assertNoDuplicateBusinessTuple({
          definitionKeyToIgnore: null,
          primaryTitle: 'Test',
          primaryTopicKey: 'topic-1',
          yearGroupKey: 'year-group-10',
        })
      ).not.toThrow();
    });

    it('should not reference yearGroup in its implementation', () => {
      // This test verifies the method signature doesn't include yearGroup
      // We check by calling with only yearGroupKey (no yearGroup parameter)
      mockDbManager.readAll.mockReturnValue([]);

      expect(() =>
        controller._assertNoDuplicateBusinessTuple({
          definitionKeyToIgnore: null,
          primaryTitle: 'Test',
          primaryTopicKey: 'topic-1',
          yearGroupKey: 'year-group-10',
          // Note: NOT passing yearGroup parameter
        })
      ).not.toThrow();
    });

    it('should detect duplicates using yearGroupKey only', () => {
      mockDbManager.readAll.mockReturnValue([
        {
          definitionKey: 'other-key',
          primaryTitle: 'Test',
          primaryTopicKey: 'topic-1',
          yearGroupKey: 'year-group-10',
        },
      ]);

      expect(() =>
        controller._assertNoDuplicateBusinessTuple({
          definitionKeyToIgnore: null,
          primaryTitle: 'Test',
          primaryTopicKey: 'topic-1',
          yearGroupKey: 'year-group-10',
        })
      ).toThrow(/duplicate/i);
    });
  });

  // Test 5: _resolveAssignmentWeightingForUpsert no defaulting
  describe('_resolveAssignmentWeightingForUpsert no defaulting', () => {
    it('should return undefined when assignmentWeighting is missing from payload', () => {
      const result = controller._resolveAssignmentWeightingForUpsert({
        payload: {},
        isUpdate: false,
        existingDefinition: null,
      });
      expect(result).toBeUndefined();
    });

    it('should return null when assignmentWeighting is null in payload', () => {
      const result = controller._resolveAssignmentWeightingForUpsert({
        payload: { assignmentWeighting: null },
        isUpdate: false,
        existingDefinition: null,
      });
      expect(result).toBeNull();
    });

    it('should return the raw value when assignmentWeighting is 5 in payload', () => {
      const result = controller._resolveAssignmentWeightingForUpsert({
        payload: { assignmentWeighting: 5 },
        isUpdate: false,
        existingDefinition: null,
      });
      expect(result).toBe(5);
    });

    it('should return the raw value when assignmentWeighting is 0 in payload', () => {
      const result = controller._resolveAssignmentWeightingForUpsert({
        payload: { assignmentWeighting: 0 },
        isUpdate: false,
        existingDefinition: null,
      });
      expect(result).toBe(0);
    });
  });

  // Test 6: upsertDefinition validation preserved
  describe('upsertDefinition validation preserved', () => {
    it('should throw when payload missing required fields', () => {
      expect(() => controller.upsertDefinition({})).toThrow();
    });

    it('should throw when yearGroupKey is null in payload', () => {
      expect(() =>
        controller.upsertDefinition({
          primaryTitle: 'Test',
          primaryTopicKey: 'topic-1',
          yearGroupKey: null,
          referenceDocumentId: 'ref-1',
          templateDocumentId: 'tpl-1',
        })
      ).toThrow(/yearGroupKey/i);
    });

    it('should throw when yearGroupKey is missing from payload', () => {
      expect(() =>
        controller.upsertDefinition({
          primaryTitle: 'Test',
          primaryTopicKey: 'topic-1',
          referenceDocumentId: 'ref-1',
          templateDocumentId: 'tpl-1',
        })
      ).toThrow(/yearGroupKey/i);
    });

    it('should succeed with valid payload and resolved non-null yearGroupKey', () => {
      mockDbManager.readAll.mockReturnValue([]);
      mockFullCollection.findOne.mockReturnValue(null);
      mockRegistryCollection.findOne.mockReturnValue(null);

      const result = controller.upsertDefinition({
        primaryTitle: 'Test',
        primaryTopicKey: 'topic-1',
        yearGroupKey: 'year-group-10',
        referenceDocumentId: 'ref-1',
        templateDocumentId: 'tpl-1',
        documentType: 'SLIDES',
      });

      expect(result).toBeInstanceOf(AssignmentDefinition);
      expect(result.yearGroupKey).toBe('year-group-10');
    });
  });
});
