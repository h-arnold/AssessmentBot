import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockABLogger } from '../helpers/mockFactories.js';

// Setup global mocks
globalThis.ABLogger = require('#backend/Utils/ABLogger.js');
const DefinitionStaleError = require('#backend/Utils/ErrorTypes/DefinitionStaleError.js');

// Import classes after mocks
const AssignmentController = require('#backend/y_controllers/AssignmentController.js');

const { AssignmentDefinition } = require('#backend/Models/AssignmentDefinition.js');

const createFullDefinition = function (options) {
  if (options === void 0) {
    options = {};
  }
  let primaryTitle = options.primaryTitle;
  let primaryTopic = options.primaryTopic;
  let yearGroupKey = options.yearGroupKey;
  let yearGroupLabel = options.yearGroupLabel;
  let documentType = options.documentType;
  let referenceDocumentId = options.referenceDocumentId;
  let templateDocumentId = options.templateDocumentId;
  let tasks = options.tasks;
  if (primaryTitle === void 0) {
    primaryTitle = 'Test';
  }
  if (primaryTopic === void 0) {
    primaryTopic = 'Topic';
  }
  if (yearGroupKey === void 0) {
    yearGroupKey = 'year-group-10';
  }
  if (yearGroupLabel === void 0) {
    yearGroupLabel = 'Year 10';
  }
  if (documentType === void 0) {
    documentType = 'SLIDES';
  }
  if (referenceDocumentId === void 0) {
    referenceDocumentId = 'ref';
  }
  if (templateDocumentId === void 0) {
    templateDocumentId = 'tpl';
  }
  if (tasks === void 0) {
    tasks = {
      t1: {
        id: 't1',
        taskTitle: 'Task 1',
        pageId: 'p1',
        artifacts: {
          reference: [{ taskId: 't1', role: 'reference', content: 'content', contentHash: 'hash' }],
        },
      },
    };
  }
  return new AssignmentDefinition({
    primaryTitle: primaryTitle,
    primaryTopic: primaryTopic,
    yearGroupKey: yearGroupKey,
    yearGroupLabel: yearGroupLabel,
    documentType: documentType,
    referenceDocumentId: referenceDocumentId,
    templateDocumentId: templateDocumentId,
    tasks: tasks,
  });
};

describe('AssignmentController - Definition Hydration', () => {
  let mockDefinitionController;
  let mockABClassController;
  let mockProgressTracker;
  let loggerInstance;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock logger
    loggerInstance = createMockABLogger(vi);
    vi.spyOn(globalThis.ABLogger, 'getInstance').mockReturnValue(loggerInstance);

    // Mock ProgressTracker
    mockProgressTracker = {
      startTracking: vi.fn(),
      updateProgress: vi.fn(),
      complete: vi.fn(),
      logAndThrowError: vi.fn((msg) => {
        throw new Error(msg);
      }),
    };
    globalThis.ProgressTracker = {
      getInstance: vi.fn().mockReturnValue(mockProgressTracker),
    };

    // Mock ABClassController
    const mockABClass = {
      students: [{ id: 'student-1', name: 'Student 1' }],
    };
    mockABClassController = {
      loadClass: vi.fn().mockReturnValue(mockABClass),
      persistAssignmentRun: vi.fn(),
    };
    globalThis.ABClassController = vi.fn().mockImplementation(function () {
      return mockABClassController;
    });

    // Mock AssignmentDefinitionController
    mockDefinitionController = {
      getDefinitionByKey: vi.fn(),
    };
    globalThis.AssignmentDefinitionController = vi.fn().mockImplementation(function () {
      return mockDefinitionController;
    });

    // Mock Assignment factory and subclasses
    globalThis.Assignment = {
      create: vi.fn((definition) => {
        // Return appropriate mock based on documentType
        const instance = new globalThis.SlidesAssignment();
        instance.assignmentDefinition = definition;
        return instance;
      }),
    };

    globalThis.SlidesAssignment = vi.fn().mockImplementation(function () {
      this.assignmentDefinition = null;
      this.populateTasks = vi.fn();
      this.fetchSubmittedDocuments = vi.fn();
      this.processAllSubmissions = vi.fn();
      this.processImages = vi.fn();
      this.assessResponses = vi.fn();
      this.touchUpdated = vi.fn();
      this.addStudent = vi.fn();
    });

    globalThis.Utils = {
      toastMessage: vi.fn(),
      generateHash: (str) => `hash_${(str || '').length}`,
    };
    globalThis.DateUtils = {
      isNewer: vi.fn().mockReturnValue(false),
      definitionNeedsRefresh: vi.fn().mockReturnValue(true),
    };

    // Mock DriveManager
    globalThis.DriveManager = {
      getFileModifiedTime: vi.fn().mockReturnValue('2025-01-01T00:00:00Z'),
    };
  });

  describe('processSelectedAssignment', () => {
    it('should fetch full definition from dedicated collection', () => {
      // Setup full definition
      const fullDefinition = createFullDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        referenceDocumentId: 'ref-123',
        templateDocumentId: 'tpl-456',
        tasks: {
          t1: {
            id: 't1',
            taskTitle: 'Introduction',
            pageId: 'p1',
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

      mockDefinitionController.getDefinitionByKey.mockReturnValue(fullDefinition);

      const controller = new AssignmentController();

      controller.processSelectedAssignment({
        assignmentId: 'assignment-1',
        definitionKey: 'Essay 1_English_year-group-10',
        courseId: 'course-1',
      });

      // Verify full definition fetched with correct form parameter
      expect(mockDefinitionController.getDefinitionByKey).toHaveBeenCalledWith(
        'Essay 1_English_year-group-10',
        { form: 'full' }
      );

      // Verify definition has full content
      const fetchedDef = mockDefinitionController.getDefinitionByKey.mock.results[0].value;
      expect(fetchedDef.tasks.t1.artifacts.reference[0].content).toBe('full-content');
      expect(fetchedDef.tasks.t1.artifacts.reference[0].contentHash).toBe('hash123');
    });

    it('should throw error if definition not found', () => {
      mockDefinitionController.getDefinitionByKey.mockReturnValue(null);

      const controller = new AssignmentController();

      expect(() => {
        controller.processSelectedAssignment({
          assignmentId: 'assignment-1',
          definitionKey: 'NonExistent_Topic_year-group-10',
          courseId: 'course-1',
        });
      }).toThrow('Assignment definition not found for key NonExistent_Topic_year-group-10');
    });

    it('should use full definition for assignment instance creation', () => {
      const fullDefinition = createFullDefinition();

      mockDefinitionController.getDefinitionByKey.mockReturnValue(fullDefinition);

      const controller = new AssignmentController();
      controller.processSelectedAssignment({
        assignmentId: 'assignment-1',
        definitionKey: 'Test_Topic_year-group-10',
        courseId: 'course-1',
      });

      // Verify SlidesAssignment was created (based on documentType)
      expect(globalThis.SlidesAssignment).toHaveBeenCalled();
    });
  });

  describe('runAssignmentPipeline', () => {
    it('should throw DefinitionStaleError when definition is stale', () => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        referenceLastModified: '2024-01-01T00:00:00Z',
        templateLastModified: '2024-01-01T00:00:00Z',
        tasks: {},
      });

      const mockAssignment = new globalThis.SlidesAssignment();
      mockAssignment.assignmentDefinition = definition;

      globalThis.DateUtils.isNewer.mockReturnValue(true);

      const controller = new AssignmentController();

      // Should throw DefinitionStaleError when stale
      expect(() => {
        controller.runAssignmentPipeline(mockAssignment, [{ id: 's1', name: 'Student 1' }], {
          includeImages: true,
          definitionController: mockDefinitionController,
        });
      }).toThrow(DefinitionStaleError);
    });

    it('should skip parsing if definition is fresh', () => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        referenceLastModified: '2025-01-01T00:00:00Z',
        templateLastModified: '2025-01-01T00:00:00Z',
        tasks: {
          t1: { taskTitle: 'Task 1', pageId: 'p1', artifacts: { reference: [], template: [] } },
        },
      });

      const mockAssignment = new globalThis.SlidesAssignment();
      mockAssignment.assignmentDefinition = definition;

      globalThis.DateUtils.definitionNeedsRefresh.mockReturnValue(false);

      const controller = new AssignmentController();
      controller.runAssignmentPipeline(mockAssignment, [{ id: 's1', name: 'Student 1' }], {
        includeImages: true,
        definitionController: mockDefinitionController,
      });

      // Should NOT call populateTasks when fresh
      expect(mockAssignment.populateTasks).not.toHaveBeenCalled();

      // Should proceed with other pipeline steps
      expect(mockAssignment.processAllSubmissions).toHaveBeenCalled();
    });
  });
});
