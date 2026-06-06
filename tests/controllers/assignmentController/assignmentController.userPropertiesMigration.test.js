/**
 * RED-phase tests for UserProperties migration in AssignmentController.
 *
 * These tests verify that startProcessing and processSelectedAssignment use
 * GASPropertiesUtils (UserProperties) instead of direct PropertiesService
 * calls (DocumentProperties).
 *
 * Current behaviour (to be changed in GREEN phase):
 *   - startProcessing uses PropertiesService.getDocumentProperties() and
 *     this.applyDocumentProperties()
 *   - processSelectedAssignment uses PropertiesService.getDocumentProperties()
 *     and this.clearDocumentProperties()
 *   - applyDocumentProperties and clearDocumentProperties exist as methods
 *
 * Expected migration (GREEN phase):
 *   - startProcessing uses GASPropertiesUtils.getUserProperties() and
 *     GASPropertiesUtils.applyProperties()
 *   - processSelectedAssignment reads from GASPropertiesUtils.getUserProperties()
 *     and cleans up with GASPropertiesUtils.clearProperties()
 *   - applyDocumentProperties and clearDocumentProperties are removed
 *
 * These tests are RED (expected to fail) until the migration is implemented.
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

describe('AssignmentController - UserProperties Migration (RED phase)', () => {
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
  // startProcessing — UserProperties
  // =====================================================================

  describe('startProcessing', () => {
    it('[RED] stores trigger context via GASPropertiesUtils.getUserProperties()', () => {
      controller.startProcessing('assignment-456', 'Essay_1_defKey', 'course-123');

      // ASSERTION: This will FAIL (RED) because current code calls
      // PropertiesService.getDocumentProperties() instead of
      // GASPropertiesUtils.getUserProperties()
      expect(GASPropertiesUtils.getUserProperties).toHaveBeenCalled();
      expect(PropertiesService.getDocumentProperties).not.toHaveBeenCalled();
    });

    it('[RED] uses GASPropertiesUtils.applyProperties() instead of this.applyDocumentProperties()', () => {
      controller.startProcessing('assignment-456', 'Essay_1_defKey', 'course-123');

      // ASSERTION: This will FAIL (RED) because current code calls
      // this.applyDocumentProperties() instead of GASPropertiesUtils.applyProperties()
      expect(GASPropertiesUtils.applyProperties).toHaveBeenCalled();
      expect(PropertiesService.getDocumentProperties).not.toHaveBeenCalled();
    });

    it('[RED] passes correct propertyMap to GASPropertiesUtils.applyProperties()', () => {
      controller.startProcessing('assignment-456', 'Essay_1_defKey', 'course-123');

      // ASSERTION: This will FAIL (RED) — same reason as above
      expect(GASPropertiesUtils.applyProperties).toHaveBeenCalledWith(expect.anything(), {
        assignmentId: 'assignment-456',
        definitionKey: 'Essay_1_defKey',
        courseId: 'course-123',
        triggerId: 'trigger-789',
      });
      expect(PropertiesService.getDocumentProperties).not.toHaveBeenCalled();
    });
  });

  // =====================================================================
  // processSelectedAssignment — UserProperties reads & cleanup
  // =====================================================================

  describe('processSelectedAssignment', () => {
    beforeEach(() => {
      // Setup lock to succeed
      const mockLock = {
        tryLock: vi.fn().mockReturnValue(true),
        releaseLock: vi.fn(),
      };
      globalThis.LockService.getDocumentLock.mockReturnValue(mockLock);

      // Setup default property mocks so processSelectedAssignment doesn't
      // throw "Missing parameters" during the try block preamble
      mockDocProperties.getProperty.mockImplementation((key) => {
        const defaults = {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay_1_defKey',
          triggerId: 'trigger-789',
          courseId: 'course-123',
        };
        return defaults[key] ?? null;
      });

      // Also provide user properties mock (migrated code will read from here)
      userPropertiesMock.getProperty.mockImplementation((key) => {
        const defaults = {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay_1_defKey',
          triggerId: 'trigger-789',
          courseId: 'course-123',
        };
        return defaults[key] ?? null;
      });

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
          saveDefinition: vi.fn(),
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
          rehydrateAssignment: vi.fn(),
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

    it('[RED] reads trigger context from GASPropertiesUtils.getUserProperties()', () => {
      controller.processSelectedAssignment();

      // ASSERTION: This will FAIL (RED) because current code reads from
      // PropertiesService.getDocumentProperties() instead of
      // GASPropertiesUtils.getUserProperties()
      expect(GASPropertiesUtils.getUserProperties).toHaveBeenCalled();
      expect(PropertiesService.getDocumentProperties).not.toHaveBeenCalled();
    });

    it('[RED] cleans up properties with GASPropertiesUtils.clearProperties()', () => {
      controller.processSelectedAssignment();

      // ASSERTION: This will FAIL (RED) because current cleanup code calls
      // this.clearDocumentProperties() instead of GASPropertiesUtils.clearProperties()
      expect(GASPropertiesUtils.clearProperties).toHaveBeenCalled();
      expect(PropertiesService.getDocumentProperties).not.toHaveBeenCalled();
    });

    it('[RED] calls clearProperties() with expected trigger-context keys', () => {
      controller.processSelectedAssignment();

      // ASSERTION: This will FAIL (RED) — same as above
      expect(GASPropertiesUtils.clearProperties).toHaveBeenCalledWith(expect.anything(), [
        'assignmentId',
        'definitionKey',
        'triggerId',
        'courseId',
      ]);
      expect(PropertiesService.getDocumentProperties).not.toHaveBeenCalled();
    });
  });

  // =====================================================================
  // Method existence checks (applyDocumentProperties / clearDocumentProperties)
  // =====================================================================

  describe('removed methods', () => {
    it('[RED] applyDocumentProperties should not exist on AssignmentController', () => {
      // ASSERTION: This will FAIL (RED) because applyDocumentProperties
      // currently exists on the AssignmentController prototype
      expect(typeof controller.applyDocumentProperties).toBe('undefined');
    });

    it('[RED] clearDocumentProperties should not exist on AssignmentController', () => {
      // ASSERTION: This will FAIL (RED) because clearDocumentProperties
      // currently exists on the AssignmentController prototype
      expect(typeof controller.clearDocumentProperties).toBe('undefined');
    });

    it('[RED] saveStartAndShowProgress should not exist on AssignmentController', () => {
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

    it('[RED] createDefinitionFromWizardInputs should not exist on AssignmentController', () => {
      expect(typeof controller.createDefinitionFromWizardInputs).toBe('undefined');
    });
  });
});
