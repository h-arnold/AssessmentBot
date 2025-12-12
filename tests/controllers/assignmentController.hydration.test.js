import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup global mocks
globalThis.ABLogger = require('../../src/AdminSheet/Utils/ABLogger.js');

// Mock PropertiesService
globalThis.PropertiesService = {
  getDocumentProperties: vi.fn(),
};

// Mock LockService
globalThis.LockService = {
  getDocumentLock: vi.fn(),
};

// Mock Classroom service
globalThis.Classroom = {
  Courses: {
    CourseWork: {
      get: vi.fn(),
    },
  },
};

// Import classes after mocks
const AssignmentController = require('../../src/AdminSheet/y_controllers/AssignmentController.js');

const { AssignmentDefinition } = require('../../src/AdminSheet/Models/AssignmentDefinition.js');

describe('AssignmentController - Definition Hydration', () => {
  let mockProperties;
  let mockLock;
  let mockDefinitionController;
  let mockABClassController;
  let mockGoogleClassroomManager;
  let mockTriggerController;
  let mockProgressTracker;
  let loggerInstance;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock logger
    loggerInstance = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      debugUi: vi.fn(),
    };
    vi.spyOn(globalThis.ABLogger, 'getInstance').mockReturnValue(loggerInstance);

    // Mock PropertiesService
    mockProperties = {
      getProperty: vi.fn(),
      setProperty: vi.fn(),
      deleteProperty: vi.fn(),
    };
    globalThis.PropertiesService.getDocumentProperties.mockReturnValue(mockProperties);

    // Mock LockService
    mockLock = {
      tryLock: vi.fn(() => true),
      releaseLock: vi.fn(),
    };
    globalThis.LockService.getDocumentLock.mockReturnValue(mockLock);

    // Mock ProgressTracker
    mockProgressTracker = {
      startTracking: vi.fn(),
      updateProgress: vi.fn(),
      complete: vi.fn(),
      logError: vi.fn(),
      logAndThrowError: vi.fn((msg) => {
        throw new Error(msg);
      }),
    };
    globalThis.ProgressTracker = {
      getInstance: vi.fn().mockReturnValue(mockProgressTracker),
    };

    // Mock TriggerController
    mockTriggerController = {
      deleteTriggerById: vi.fn(),
      removeTriggers: vi.fn(),
    };
    globalThis.TriggerController = vi.fn().mockReturnValue(mockTriggerController);

    // Mock GoogleClassroomManager
    mockGoogleClassroomManager = {
      getCourseId: vi.fn().mockReturnValue('course-123'),
    };
    globalThis.GoogleClassroomManager = vi.fn().mockReturnValue(mockGoogleClassroomManager);

    // Mock ABClassController
    const mockABClass = {
      classId: 'course-123',
      yearGroup: 10,
      students: [{ id: 'student-1', name: 'Student 1' }],
      findAssignmentIndex: vi.fn().mockReturnValue(-1),
    };
    mockABClassController = {
      loadClass: vi.fn().mockReturnValue(mockABClass),
      rehydrateAssignment: vi.fn(),
      persistAssignmentRun: vi.fn(),
    };
    globalThis.ABClassController = vi.fn().mockReturnValue(mockABClassController);

    // Mock AssignmentDefinitionController
    mockDefinitionController = {
      getDefinitionByKey: vi.fn(),
      ensureDefinition: vi.fn(),
      saveDefinition: vi.fn(),
    };
    globalThis.AssignmentDefinitionController = vi.fn().mockReturnValue(mockDefinitionController);

    // Mock Assignment factory and subclasses
    globalThis.Assignment = {
      fromJSON: vi.fn(),
      createInstance: vi.fn(),
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
      this.extractStudentSubmissions = vi.fn();
      this.processImages = vi.fn();
      this.assessResponses = vi.fn();
      this.assessStudentResponses = vi.fn();
      this.touchUpdated = vi.fn();
      this.addStudent = vi.fn();
    });

    // Mock Utils
    globalThis.Utils = {
      toastMessage: vi.fn(),
      definitionNeedsRefresh: vi.fn().mockReturnValue(false),
    };

    // Mock DriveManager
    globalThis.DriveManager = {
      getFileModifiedTime: vi.fn().mockReturnValue('2025-01-01T00:00:00Z'),
    };

    // Mock other dependencies
    globalThis.AnalysisSheetManager = vi.fn().mockImplementation(() => ({
      createAnalysisSheet: vi.fn(),
    }));
    globalThis.OverviewSheetManager = vi.fn().mockImplementation(() => ({
      createOverviewSheet: vi.fn(),
    }));
  });

  describe('processSelectedAssignment', () => {
    it('should fetch full definition from dedicated collection', () => {
      // Setup properties
      mockProperties.getProperty.mockImplementation((key) => {
        if (key === 'assignmentId') return 'assignment-456';
        if (key === 'definitionKey') return 'Essay 1_English_10';
        if (key === 'triggerId') return 'trigger-789';
        return null;
      });

      // Setup full definition
      const fullDefinition = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-123',
        templateDocumentId: 'tpl-456',
        tasks: {
          t1: {
            id: 't1',
            taskTitle: 'Introduction',
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

      controller.processSelectedAssignment();

      // Verify full definition fetched with correct form parameter
      expect(mockDefinitionController.getDefinitionByKey).toHaveBeenCalledWith(
        'Essay 1_English_10',
        { form: 'full' }
      );

      // Verify definition has full content
      const fetchedDef = mockDefinitionController.getDefinitionByKey.mock.results[0].value;
      expect(fetchedDef.tasks.t1.artifacts.reference[0].content).toBe('full-content');
      expect(fetchedDef.tasks.t1.artifacts.reference[0].contentHash).toBe('hash123');
    });

    it('should throw error if definition not found', () => {
      mockProperties.getProperty.mockImplementation((key) => {
        if (key === 'assignmentId') return 'assignment-456';
        if (key === 'definitionKey') return 'NonExistent_Topic_10';
        if (key === 'triggerId') return 'trigger-789';
        return null;
      });

      mockDefinitionController.getDefinitionByKey.mockReturnValue(null);

      const controller = new AssignmentController();

      expect(() => {
        controller.processSelectedAssignment();
      }).toThrow('Assignment definition not found for key NonExistent_Topic_10');
    });

    it('should use full definition for assignment instance creation', () => {
      mockProperties.getProperty.mockImplementation((key) => {
        if (key === 'assignmentId') return 'assignment-456';
        if (key === 'definitionKey') return 'Test_Topic_10';
        if (key === 'triggerId') return 'trigger-789';
        return null;
      });

      const fullDefinition = new AssignmentDefinition({
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

      mockDefinitionController.getDefinitionByKey.mockReturnValue(fullDefinition);

      const controller = new AssignmentController();
      controller.processSelectedAssignment();

      // Verify SlidesAssignment was created (based on documentType)
      expect(globalThis.SlidesAssignment).toHaveBeenCalled();
    });
  });

  describe('runAssignmentPipeline', () => {
    it('should check staleness and re-parse if needed', () => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        referenceLastModified: '2024-01-01T00:00:00Z',
        templateLastModified: '2024-01-01T00:00:00Z',
        tasks: {},
      });

      const mockAssignment = new globalThis.SlidesAssignment();
      mockAssignment.assignmentDefinition = definition;

      globalThis.Utils.definitionNeedsRefresh.mockReturnValue(true);

      const controller = new AssignmentController();
      controller.runAssignmentPipeline(mockAssignment, [{ id: 's1', name: 'Student 1' }], {
        includeImages: true,
        definitionController: mockDefinitionController,
      });

      // Should call populateTasks when stale
      expect(mockAssignment.populateTasks).toHaveBeenCalled();

      // Should save refreshed definition
      expect(mockDefinitionController.ensureDefinition).not.toHaveBeenCalled(); // Already handled in populateTasks path
    });

    it('should skip parsing if definition is fresh', () => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        referenceLastModified: '2025-01-01T00:00:00Z',
        templateLastModified: '2025-01-01T00:00:00Z',
        tasks: { t1: {} },
      });

      const mockAssignment = new globalThis.SlidesAssignment();
      mockAssignment.assignmentDefinition = definition;

      globalThis.Utils.definitionNeedsRefresh.mockReturnValue(false);

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

  describe('ensureDefinitionFromInputs', () => {
    beforeEach(() => {
      globalThis.Classroom.Courses.CourseWork.get.mockReturnValue({
        title: 'Assignment Title',
        topicId: 'topic-123',
      });

      const mockDefinition = new AssignmentDefinition({
        primaryTitle: 'Assignment Title',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        tasks: {},
      });

      mockDefinitionController.ensureDefinition.mockReturnValue(mockDefinition);

      // Mock DriveApp for document type detection
      globalThis.DriveApp = {
        getFileById: vi.fn().mockReturnValue({
          getMimeType: vi.fn().mockReturnValue('application/vnd.google-apps.presentation'),
        }),
      };
    });

    it('should return definition with correct key', () => {
      const controller = new AssignmentController();

      const result = controller.ensureDefinitionFromInputs({
        assignmentTitle: 'Assignment Title',
        assignmentId: 'assignment-123',
        documentIds: {
          referenceDocumentId: 'ref',
          templateDocumentId: 'tpl',
        },
      });

      expect(result.definition).toBeInstanceOf(AssignmentDefinition);
      expect(result.definition.definitionKey).toBe('Assignment Title_English_10');
      expect(result.courseId).toBe('course-123');
      expect(result.abClass).toBeDefined();
    });

    it('should detect document type from Drive', () => {
      const controller = new AssignmentController();

      controller.ensureDefinitionFromInputs({
        assignmentTitle: 'Test',
        assignmentId: 'assignment-123',
        documentIds: {
          referenceDocumentId: 'ref',
          templateDocumentId: 'tpl',
        },
      });

      expect(globalThis.DriveApp.getFileById).toHaveBeenCalledWith('ref');
      expect(globalThis.DriveApp.getFileById).toHaveBeenCalledWith('tpl');
    });

    it('should fetch year group from ABClass', () => {
      const controller = new AssignmentController();

      controller.ensureDefinitionFromInputs({
        assignmentTitle: 'Test',
        assignmentId: 'assignment-123',
        documentIds: {
          referenceDocumentId: 'ref',
          templateDocumentId: 'tpl',
        },
      });

      expect(mockABClassController.loadClass).toHaveBeenCalledWith('course-123');

      // Verify ensureDefinition was called with yearGroup from ABClass
      expect(mockDefinitionController.ensureDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          yearGroup: 10,
        })
      );
    });
  });

  describe('startProcessing', () => {
    it('should store only definitionKey in properties (no doc IDs)', () => {
      const mockTrigger = {
        createTimeBasedTrigger: vi.fn().mockReturnValue('trigger-123'),
      };
      globalThis.TriggerController.mockReturnValue(mockTrigger);

      const controller = new AssignmentController();
      controller.startProcessing('assignment-456', 'Essay 1_English_10');

      expect(mockProperties.setProperty).toHaveBeenCalledWith('assignmentId', 'assignment-456');
      expect(mockProperties.setProperty).toHaveBeenCalledWith(
        'definitionKey',
        'Essay 1_English_10'
      );
      expect(mockProperties.setProperty).toHaveBeenCalledWith('triggerId', 'trigger-123');

      // Should NOT store documentType, referenceDocumentId, or templateDocumentId
      expect(mockProperties.setProperty).not.toHaveBeenCalledWith(
        'documentType',
        expect.anything()
      );
      expect(mockProperties.setProperty).not.toHaveBeenCalledWith(
        'referenceDocumentId',
        expect.anything()
      );
      expect(mockProperties.setProperty).not.toHaveBeenCalledWith(
        'templateDocumentId',
        expect.anything()
      );
    });
  });
});
