/**
 * Tests for the trigger-context migration in AssignmentController.
 *
 * startProcessing stores task context via
 * TriggerController.storeTriggerContext() (Script Properties keyed by
 * triggerUid) and no longer uses GASPropertiesUtils (UserProperties) for task
 * context, and applyDocumentProperties, clearDocumentProperties,
 * saveStartAndShowProgress, and createDefinitionFromWizardInputs have been
 * removed.
 *
 * processSelectedAssignment receives task params directly and must NOT read
 * from or clean up UserProperties — triggerHandler() owns all cleanup.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =========================================================================
// Global mocks (before loading controller)
// =========================================================================

// Mock LockService
globalThis.LockService = {
  getDocumentLock: vi.fn(),
};

// Mock ABLogger
const mockLoggerInstance = {
  info: vi.fn(),
  error: vi.fn(),
};
globalThis.ABLogger = {
  getInstance: vi.fn().mockReturnValue(mockLoggerInstance),
};

// Mock PropertiesService (still used by current code; migration changes to GASPropertiesUtils)
const mockDocProperties = {
  getProperty: vi.fn(),
  setProperty: vi.fn(),
  deleteProperty: vi.fn(),
  getKeys: vi.fn().mockReturnValue([]),
  deleteAllProperties: vi.fn(),
};
globalThis.PropertiesService = {
  getDocumentProperties: vi.fn().mockReturnValue(mockDocProperties),
  getScriptProperties: vi.fn(),
  getUserProperties: vi.fn(),
};

// Mock TriggerController
const mockTriggerController = {
  createTimeBasedTrigger: vi.fn(),
  deleteTriggerById: vi.fn(),
  removeTriggers: vi.fn(),
  storeTriggerContext: vi.fn(),
};
globalThis.TriggerController = vi.fn().mockImplementation(function () {
  return mockTriggerController;
});

// Mock Utils
globalThis.Utils = {
  toastMessage: vi.fn(),
  definitionNeedsRefresh: vi.fn(),
  isNewer: vi.fn().mockReturnValue(false),
};

// Mock ProgressTracker
const mockProgressTracker = {
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

// Mock ConfigurationManager
globalThis.ConfigurationManager = {
  getInstance: vi.fn().mockReturnValue({
    getAssessmentRecordCourseId: vi.fn().mockReturnValue('course-123'),
  }),
};

// Load the controller
const AssignmentController = require('../../../src/backend/y_controllers/AssignmentController.js');

// =========================================================================
// Tests
// =========================================================================

describe('AssignmentController - UserProperties Migration', () => {
  let controller;
  let userPropertiesMock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock user properties (what the migrated code should use)
    userPropertiesMock = {
      getProperty: vi.fn(),
      setProperty: vi.fn(),
      deleteProperty: vi.fn(),
      getKeys: vi.fn().mockReturnValue([]),
    };

    // Spy on GASPropertiesUtils static methods
    vi.spyOn(GASPropertiesUtils, 'getUserProperties').mockReturnValue(userPropertiesMock);
    vi.spyOn(GASPropertiesUtils, 'applyProperties');
    vi.spyOn(GASPropertiesUtils, 'clearProperties');

    // Default trigger mock returns a valid trigger ID
    mockTriggerController.createTimeBasedTrigger.mockReturnValue('trigger-789');

    controller = new AssignmentController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =====================================================================
  // startProcessing — trigger context via TriggerController
  // =====================================================================

  describe('startProcessing', () => {
    it('does NOT use GASPropertiesUtils.getUserProperties() for task context', () => {
      controller.startProcessing('assignment-456', 'Essay_1_defKey', 'course-123');

      // NEW CONTRACT: task context is stored via
      // TriggerController.storeTriggerContext() in Script Properties, so
      // startProcessing() must not read from UserProperties at all.
      expect(GASPropertiesUtils.getUserProperties).not.toHaveBeenCalled();
    });

    it('stores trigger context via TriggerController.storeTriggerContext() with the triggerUid, method and params', () => {
      controller.startProcessing('assignment-456', 'Essay_1_defKey', 'course-123');

      // NEW CONTRACT: task context is written through
      // TriggerController.storeTriggerContext(), keyed by the triggerUid
      // returned by createTimeBasedTrigger() and carrying method
      // 'processSelectedAssignment' plus the direct task params.
      expect(mockTriggerController.storeTriggerContext).toHaveBeenCalledWith('trigger-789', {
        method: 'processSelectedAssignment',
        params: {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay_1_defKey',
          courseId: 'course-123',
        },
      });
    });

    it('creates the trigger targeting triggerHandler', () => {
      controller.startProcessing('assignment-456', 'Essay_1_defKey', 'course-123');

      // NEW CONTRACT: the time-based trigger must target the single public
      // triggerHandler() entrypoint, not triggerProcessSelectedAssignment.
      expect(mockTriggerController.createTimeBasedTrigger).toHaveBeenCalledWith('triggerHandler');
    });
  });

  // =====================================================================
  // processSelectedAssignment — direct-params contract (no UserProperties)
  // =====================================================================

  describe('processSelectedAssignment', () => {
    beforeEach(() => {
      // Mock definition controller returns a valid definition
      const mockDefinition = {
        definitionKey: 'Essay_1_defKey',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-123',
        templateDocumentId: 'tpl-456',
        tasks: { t1: { taskTitle: 'Task 1' } },
      };
      globalThis.AssignmentDefinitionController = vi.fn().mockImplementation(function () {
        return {
          getDefinitionByKey: vi.fn().mockReturnValue(mockDefinition),
        };
      });

      // Mock ABClassController
      globalThis.ABClassController = vi.fn().mockImplementation(function () {
        return {
          loadClass: vi.fn().mockReturnValue({
            classId: 'course-123',
            students: [],
            findAssignmentIndex: vi.fn().mockReturnValue(-1),
            yearGroupKey: 'year-group-10',
          }),
          persistAssignmentRun: vi.fn(),
        };
      });

      // Mock Assignment
      globalThis.Assignment = {
        create: vi.fn().mockReturnValue({
          assignmentDefinition: mockDefinition,
          addStudent: vi.fn(),
          populateTasks: vi.fn(),
          fetchSubmittedDocuments: vi.fn(),
          processAllSubmissions: vi.fn(),
          processImages: vi.fn(),
          assessResponses: vi.fn(),
          touchUpdated: vi.fn(),
        }),
      };

      // Mock DriveManager
      globalThis.DriveManager = {
        getFileModifiedTime: vi.fn().mockReturnValue('2025-01-01T00:00:00Z'),
      };
    });

    it('does not read task context from GASPropertiesUtils.getUserProperties()', () => {
      controller.processSelectedAssignment({
        assignmentId: 'assignment-456',
        definitionKey: 'Essay_1_defKey',
        courseId: 'course-123',
      });

      // Under the direct-params contract the method must receive task context
      // as arguments and must not read from UserProperties at all.
      expect(GASPropertiesUtils.getUserProperties).not.toHaveBeenCalled();
      expect(PropertiesService.getDocumentProperties).not.toHaveBeenCalled();
    });

    it('does not clean up properties with GASPropertiesUtils.clearProperties()', () => {
      controller.processSelectedAssignment({
        assignmentId: 'assignment-456',
        definitionKey: 'Essay_1_defKey',
        courseId: 'course-123',
      });

      // Trigger context cleanup is owned by triggerHandler(), not this method.
      expect(GASPropertiesUtils.clearProperties).not.toHaveBeenCalled();
      expect(PropertiesService.getDocumentProperties).not.toHaveBeenCalled();
    });
  });

  // =====================================================================
  // Method existence checks (applyDocumentProperties / clearDocumentProperties)
  // =====================================================================

  describe('removed methods', () => {
    it('applyDocumentProperties should not exist on AssignmentController', () => {
      // ASSERTION: This will FAIL (RED) because applyDocumentProperties
      // currently exists on the AssignmentController prototype
      expect(typeof controller.applyDocumentProperties).toBe('undefined');
    });

    it('clearDocumentProperties should not exist on AssignmentController', () => {
      // ASSERTION: This will FAIL (RED) because clearDocumentProperties
      // currently exists on the AssignmentController prototype
      expect(typeof controller.clearDocumentProperties).toBe('undefined');
    });

    it('saveStartAndShowProgress should not exist on AssignmentController', () => {
      // ASSERTION: This will FAIL (RED) because saveStartAndShowProgress
      // currently exists on the AssignmentController prototype.
      // Once removed (GREEN phase), this test will pass.
      expect(typeof controller.saveStartAndShowProgress).toBe('undefined');
    });

    it('other controller methods are unaffected by saveStartAndShowProgress removal', () => {
      // These methods must remain defined regardless of removal
      expect(typeof controller.ensureDefinitionFromInputs).toBe('function');
      expect(typeof controller.startProcessing).toBe('function');
      expect(typeof controller.processSelectedAssignment).toBe('function');
      expect(typeof controller.createAssignmentInstance).toBe('function');
      expect(typeof controller.runAssignmentPipeline).toBe('function');
      expect(typeof controller.testWorkflow).toBe('function');
    });

    it('createDefinitionFromWizardInputs should not exist on AssignmentController', () => {
      expect(typeof controller.createDefinitionFromWizardInputs).toBe('undefined');
    });
  });
});
