import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockABLogger } from '../helpers/mockFactories.js';

// Setup global mocks
globalThis.ABLogger = require('#backend/Utils/ABLogger.js');

// Mock Classroom service
globalThis.Classroom = {
  Courses: {
    CourseWork: {
      get: vi.fn(),
    },
  },
};

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

describe('AssignmentController - Definition Inputs', () => {
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

    // Mock TriggerController (the startProcessing test supplies its own implementation)
    globalThis.TriggerController = vi.fn();

    // Mock ABClassController
    const mockABClass = {
      classId: 'course-123',
      yearGroupKey: 'year-group-10',
    };
    mockABClassController = {
      loadClass: vi.fn().mockReturnValue(mockABClass),
    };
    globalThis.ABClassController = vi.fn().mockImplementation(function () {
      return mockABClassController;
    });

    // Mock AssignmentDefinitionController
    mockDefinitionController = {
      ensureDefinition: vi.fn(),
      upsertDefinition: vi.fn(),
    };
    globalThis.AssignmentDefinitionController = vi.fn().mockImplementation(function () {
      return mockDefinitionController;
    });

    globalThis.Utils = {
      toastMessage: vi.fn(),
    };
  });

  // ========================================================================
  // Test Helpers for ensureDefinitionFromInputs
  // ========================================================================

  /**
   * Standard documentIds object used in most tests
   */
  const STANDARD_DOC_IDS = {
    referenceDocumentId: 'ref',
    templateDocumentId: 'tpl',
  };

  /**
   * Standard ensureDefinitionFromInputs parameters
   */
  const STANDARD_INPUTS = {
    assignmentTitle: 'Test',
    assignmentId: 'assignment-123',
    courseId: 'course-123',
    documentIds: STANDARD_DOC_IDS,
  };

  describe('ensureDefinitionFromInputs', () => {
    beforeEach(() => {
      globalThis.Classroom.Courses.CourseWork.get.mockReturnValue({
        title: 'Assignment Title',
        topicId: 'topic-123',
      });

      const mockDefinition = createFullDefinition({
        primaryTitle: 'Assignment Title',
        primaryTopic: 'English',
        tasks: {},
      });

      mockDefinitionController.ensureDefinition.mockReturnValue(mockDefinition);
      mockDefinitionController.upsertDefinition.mockReturnValue(mockDefinition);

      globalThis.DriveApp = {
        getFileById: vi.fn().mockReturnValue({
          getMimeType: vi.fn().mockReturnValue('application/vnd.google-apps.presentation'),
        }),
      };
    });

    it('should return definition with correct key', () => {
      const controller = new AssignmentController();

      const result = controller.ensureDefinitionFromInputs({
        ...STANDARD_INPUTS,
        assignmentTitle: 'Assignment Title',
      });

      expect(result.definition).toBeInstanceOf(AssignmentDefinition);
      expect(result.definition.definitionKey).toBe('Assignment Title_English_year-group-10');
      expect(result.courseId).toBe('course-123');
      expect(result.abClass).toBeDefined();
    });

    it('should detect document type from Drive', () => {
      const controller = new AssignmentController();

      controller.ensureDefinitionFromInputs(STANDARD_INPUTS);

      expect(globalThis.DriveApp.getFileById).toHaveBeenCalledWith('ref');
      expect(globalThis.DriveApp.getFileById).toHaveBeenCalledWith('tpl');
    });

    it('should fetch yearGroupKey from ABClass', () => {
      const controller = new AssignmentController();

      controller.ensureDefinitionFromInputs(STANDARD_INPUTS);

      expect(mockABClassController.loadClass).toHaveBeenCalledWith('course-123');

      // Verify upsertDefinition was called with yearGroupKey from ABClass
      expect(mockDefinitionController.upsertDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          yearGroupKey: 'year-group-10',
          primaryTopicKey: expect.any(String),
        })
      );
    });

    it('should accept yearGroupKey: string | null parameter', () => {
      const controller = new AssignmentController();

      // An explicit yearGroupKey parameter is forwarded to upsertDefinition
      controller.ensureDefinitionFromInputs({
        ...STANDARD_INPUTS,
        yearGroupKey: 'year-group-10',
      });

      // Verify upsertDefinition was called with yearGroupKey
      expect(mockDefinitionController.upsertDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          yearGroupKey: 'year-group-10',
          primaryTopicKey: expect.any(String),
        })
      );
    });

    it('should resolve yearGroupKey from input when provided', () => {
      const controller = new AssignmentController();

      // The input yearGroupKey takes precedence over the class record
      controller.ensureDefinitionFromInputs({
        ...STANDARD_INPUTS,
        yearGroupKey: 'year-group-11',
      });

      // Verify that input yearGroupKey is used (not abClass.yearGroupKey)
      expect(mockDefinitionController.upsertDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          yearGroupKey: 'year-group-11',
        })
      );
    });

    it('should resolve yearGroupKey from abClass.yearGroupKey when input is null', () => {
      const controller = new AssignmentController();

      // A null input falls back to abClass.yearGroupKey
      controller.ensureDefinitionFromInputs({
        ...STANDARD_INPUTS,
        yearGroupKey: null,
      });

      // Verify that abClass.yearGroupKey is used as fallback
      expect(mockDefinitionController.upsertDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          yearGroupKey: 'year-group-10', // from mockABClass.yearGroupKey
        })
      );
    });

    it('should throw when yearGroupKey resolution fails (both input and abClass.yearGroupKey are null)', () => {
      const controller = new AssignmentController();

      // Create a mock ABClass with null yearGroupKey
      const mockABClassWithNullKey = {
        classId: 'course-123',
        yearGroupKey: null,
      };
      mockABClassController.loadClass.mockReturnValue(mockABClassWithNullKey);

      // It should throw when both input yearGroupKey and abClass.yearGroupKey are null
      expect(() => {
        controller.ensureDefinitionFromInputs({
          ...STANDARD_INPUTS,
          yearGroupKey: null,
        });
      }).toThrow(/yearGroupKey.*resolution.*failed/i);
    });

    it('should resolve primaryTopicKey from topicId + courseId via Classroom API', () => {
      const controller = new AssignmentController();

      // Mock Classroom to return a topicId
      globalThis.Classroom.Courses.CourseWork.get.mockReturnValue({
        title: 'Test Assignment',
        topicId: 'topic-456',
      });

      controller.ensureDefinitionFromInputs({
        ...STANDARD_INPUTS,
        yearGroupKey: 'year-group-10',
      });

      // Verify that primaryTopicKey is resolved from topicId
      expect(mockDefinitionController.upsertDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryTopicKey: 'topic-456',
        })
      );
    });

    it('should delegate to controller.upsertDefinition (not controller.ensureDefinition)', () => {
      const controller = new AssignmentController();

      controller.ensureDefinitionFromInputs({
        ...STANDARD_INPUTS,
        yearGroupKey: 'year-group-10',
      });

      // Verify upsertDefinition is called
      expect(mockDefinitionController.upsertDefinition).toHaveBeenCalled();

      // Verify ensureDefinition is NOT called
      expect(mockDefinitionController.ensureDefinition).not.toHaveBeenCalled();
    });

    it('should delegate to upsertDefinition with resolved non-null yearGroupKey and primaryTopicKey', () => {
      const controller = new AssignmentController();

      // Mock Classroom to return a topicId
      globalThis.Classroom.Courses.CourseWork.get.mockReturnValue({
        title: 'Test Assignment',
        topicId: 'topic-789',
      });

      controller.ensureDefinitionFromInputs({
        ...STANDARD_INPUTS,
        yearGroupKey: 'year-group-12',
      });

      // Verify both resolved values are passed to upsertDefinition
      expect(mockDefinitionController.upsertDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          yearGroupKey: 'year-group-12',
          primaryTopicKey: 'topic-789',
        })
      );
    });
  });

  describe('startProcessing', () => {
    it('stores task context via TriggerController.storeTriggerContext() and targets triggerHandler', () => {
      const mockTrigger = {
        createTimeBasedTrigger: vi.fn().mockReturnValue('trigger-123'),
        storeTriggerContext: vi.fn(),
      };
      globalThis.TriggerController.mockImplementation(function () {
        return mockTrigger;
      });

      const controller = new AssignmentController();
      controller.startProcessing('assignment-456', 'Essay 1_English_year-group-10', 'course-123');

      expect(mockTrigger.createTimeBasedTrigger).toHaveBeenCalledWith('triggerHandler');
      expect(mockTrigger.storeTriggerContext).toHaveBeenCalledWith('trigger-123', {
        method: 'processSelectedAssignment',
        params: {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay 1_English_year-group-10',
          courseId: 'course-123',
        },
      });
    });
  });
});
