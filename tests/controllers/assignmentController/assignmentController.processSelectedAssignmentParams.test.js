/**
 * Tests for the direct-params contract of
 * AssignmentController.processSelectedAssignment().
 *
 * The implementation accepts task params directly:
 *   processSelectedAssignment({ assignmentId, definitionKey, courseId })
 * It does NOT read from or write to UserProperties for task context, and it
 * does NOT clean up trigger context or delete the trigger — triggerHandler()
 * (Section 8) owns all cleanup.
 *
 * These tests assert the new contract and pass against the current
 * implementation, which no longer reads assignmentId/definitionKey/triggerId/
 * courseId from UserProperties and no longer calls
 * TriggerController.deleteTriggerById(triggerId).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =========================================================================
// Global mocks (before loading controller)
// =========================================================================

// Mock ABLogger
const mockLoggerInstance = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  debugUi: vi.fn(),
};
globalThis.ABLogger = {
  getInstance: vi.fn().mockReturnValue(mockLoggerInstance),
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

// Mock Utils
globalThis.Utils = {
  toastMessage: vi.fn(),
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

// Mock AssignmentDefinitionController
const mockDefinitionController = {
  getDefinitionByKey: vi.fn(),
  upsertDefinition: vi.fn(),
};
globalThis.AssignmentDefinitionController = vi.fn().mockImplementation(function () {
  return mockDefinitionController;
});

// Mock ABClassController
const mockABClass = {
  classId: 'course-123',
  yearGroup: 10,
  yearGroupKey: 'year-group-10',
  yearGroupLabel: 'Year 10',
  students: [{ id: 'student-1', name: 'Student 1' }],
  findAssignmentIndex: vi.fn().mockReturnValue(-1),
};
const mockABClassController = {
  loadClass: vi.fn().mockReturnValue(mockABClass),
  persistAssignmentRun: vi.fn(),
};
globalThis.ABClassController = vi.fn().mockImplementation(function () {
  return mockABClassController;
});

// Mock Assignment factory and the pipeline stages
const mockAssignmentInstance = {
  assignmentDefinition: {
    documentType: 'SLIDES',
    definitionKey: 'Essay_1_defKey',
    referenceDocumentId: 'ref-123',
    templateDocumentId: 'tpl-456',
    referenceLastModified: '2025-01-01T00:00:00Z',
    templateLastModified: '2025-01-01T00:00:00Z',
  },
  addStudent: vi.fn(),
  populateTasks: vi.fn(),
  fetchSubmittedDocuments: vi.fn(),
  processAllSubmissions: vi.fn(),
  processImages: vi.fn(),
  assessResponses: vi.fn(),
  touchUpdated: vi.fn(),
};
globalThis.Assignment = {
  create: vi.fn().mockReturnValue(mockAssignmentInstance),
};

// Mock DriveManager + DateUtils for freshness checks in runAssignmentPipeline
globalThis.DriveManager = {
  getFileModifiedTime: vi.fn().mockReturnValue('2025-01-01T00:00:00Z'),
};
globalThis.DateUtils = {
  isNewer: vi.fn().mockReturnValue(false),
};

// Load the controller (uses globalThis globals above)
const AssignmentController = require('../../../src/backend/y_controllers/AssignmentController.js');

// =========================================================================
// Tests — direct-params contract
// =========================================================================

describe('AssignmentController.processSelectedAssignment - direct params contract', () => {
  let controller;
  let userPropertiesMock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Provide a default definition so the pipeline can proceed once params are
    // resolved. The direct-params tests assert the params object is used
    // directly, NOT via UserProperties.
    const fullDefinition = {
      definitionKey: 'Essay_1_defKey',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-123',
      templateDocumentId: 'tpl-456',
      tasks: { t1: { taskTitle: 'Task 1' } },
      updateModifiedTimestamps: vi.fn(),
    };
    mockDefinitionController.getDefinitionByKey.mockReturnValue(fullDefinition);

    // The old code reads task context from UserProperties. We keep the mock
    // returning a distinct definition key so that when the current code reads
    // from properties we can distinguish property-derived params from direct
    // params.
    userPropertiesMock = {
      getProperty: vi.fn((key) => {
        const defaults = {
          assignmentId: 'assignment-from-properties',
          definitionKey: 'definition-from-properties',
          triggerId: 'trigger-from-properties',
          courseId: 'course-from-properties',
        };
        return defaults[key] ?? null;
      }),
      setProperty: vi.fn(),
      deleteProperty: vi.fn(),
      getKeys: vi.fn().mockReturnValue([]),
    };
    globalThis.PropertiesService = {
      getDocumentProperties: vi.fn().mockReturnValue(userPropertiesMock),
      getScriptProperties: vi.fn().mockReturnValue(userPropertiesMock),
      getUserProperties: vi.fn().mockReturnValue(userPropertiesMock),
    };

    // The controller reads/writes task context via the real
    // GASPropertiesUtils global (which internally calls PropertiesService).
    // Spy on it so contract assertions can be tracked on the correct seam.
    vi.spyOn(globalThis.GASPropertiesUtils, 'getUserProperties').mockReturnValue(
      userPropertiesMock
    );
    vi.spyOn(globalThis.GASPropertiesUtils, 'clearProperties').mockReturnValue(undefined);

    controller = new AssignmentController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Test 1: processSelectedAssignment accepts direct params and does not
   * read task context from UserProperties.
   *
   * The direct params must flow through to the downstream calls — the method
   * never reads assignmentId/definitionKey/courseId from UserProperties.
   */
  it('uses direct params instead of reading from UserProperties', () => {
    const params = {
      assignmentId: 'assignment-456',
      definitionKey: 'Essay_1_defKey',
      courseId: 'course-123',
    };

    controller.processSelectedAssignment(params);

    // The definition controller must be asked for the definition using the
    // direct parameter, not a property-derived value.
    expect(mockDefinitionController.getDefinitionByKey).toHaveBeenCalledWith('Essay_1_defKey', {
      form: 'full',
    });

    // The direct params must flow through to the downstream calls as well: the
    // class is loaded for the direct courseId and the Assignment factory
    // receives the direct courseId and assignmentId — never property-derived
    // values.
    expect(mockABClassController.loadClass).toHaveBeenCalledWith('course-123');
    expect(globalThis.Assignment.create).toHaveBeenCalledWith(
      expect.anything(),
      'course-123',
      'assignment-456'
    );

    // No task-context reads may happen for task context — assert on the
    // real seam (GASPropertiesUtils) rather than the lower PropertiesService.
    expect(GASPropertiesUtils.getUserProperties).not.toHaveBeenCalled();
  });

  /**
   * Test 2: processSelectedAssignment does not clean up trigger context or
   * delete the trigger — triggerHandler() owns all cleanup.
   *
   * The delivered method never deletes the trigger or cleans up trigger
   * context; all cleanup is left to triggerHandler().
   */
  it('does not delete the trigger or clean up trigger context', () => {
    const params = {
      assignmentId: 'assignment-456',
      definitionKey: 'Essay_1_defKey',
      courseId: 'course-123',
    };

    controller.processSelectedAssignment(params);

    expect(mockTriggerController.deleteTriggerById).not.toHaveBeenCalled();
    expect(mockTriggerController.removeTriggers).not.toHaveBeenCalled();

    // No trigger context may be cleaned up from UserProperties — triggerHandler()
    // owns all cleanup, so clearProperties() must never be called here.
    expect(GASPropertiesUtils.clearProperties).not.toHaveBeenCalled();
  });
});
