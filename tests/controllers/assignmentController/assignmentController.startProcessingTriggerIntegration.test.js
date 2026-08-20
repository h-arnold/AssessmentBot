/**
 * RED-phase tests for the startProcessing trigger integration (Section 10).
 *
 * The new contract (not yet implemented in startProcessing):
 * - startProcessing() creates a time-based trigger targeting 'triggerHandler'
 *   (not 'triggerProcessSelectedAssignment').
 * - startProcessing() stores the task context via
 *   TriggerController.storeTriggerContext(triggerUid, { method, params }) where
 *   triggerUid is the value returned by createTimeBasedTrigger().
 * - No UserProperties reads/writes remain for task context.
 *
 * These tests are RED against the current implementation, which still targets
 * 'triggerProcessSelectedAssignment' and writes task context to UserProperties
 * via GASPropertiesUtils.getUserProperties()/applyProperties().
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
  warn: vi.fn(),
};
globalThis.ABLogger = {
  getInstance: vi.fn().mockReturnValue(mockLoggerInstance),
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

// Load the controller
const AssignmentController = require('../../../src/backend/y_controllers/AssignmentController.js');

// =========================================================================
// Tests
// =========================================================================

describe('AssignmentController.startProcessing - trigger integration', () => {
  let controller;
  let userPropertiesMock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock user properties so the current (old) implementation can run through
    // without throwing while these tests are RED.
    userPropertiesMock = {
      getProperty: vi.fn(),
      setProperty: vi.fn(),
      deleteProperty: vi.fn(),
      getKeys: vi.fn().mockReturnValue([]),
    };

    // Spy on GASPropertiesUtils so the "no UserProperties reads" contract can be observed.
    vi.spyOn(GASPropertiesUtils, 'getUserProperties').mockReturnValue(userPropertiesMock);

    // Default trigger mock returns a valid trigger UID
    mockTriggerController.createTimeBasedTrigger.mockReturnValue('trigger-789');

    controller = new AssignmentController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores trigger context via TriggerController.storeTriggerContext() with the correct triggerUid, method and params', () => {
    controller.startProcessing('assignment-456', 'Essay_1_defKey', 'course-123');

    // NEW CONTRACT: startProcessing() must hand the trigger UID returned by
    // createTimeBasedTrigger() to TriggerController.storeTriggerContext() with
    // method 'processSelectedAssignment' and the direct task params.
    expect(mockTriggerController.storeTriggerContext).toHaveBeenCalledWith('trigger-789', {
      method: 'processSelectedAssignment',
      params: {
        assignmentId: 'assignment-456',
        definitionKey: 'Essay_1_defKey',
        courseId: 'course-123',
      },
    });

    // NEW CONTRACT: no UserProperties reads may remain for task context.
    expect(GASPropertiesUtils.getUserProperties).not.toHaveBeenCalled();
  });

  it('creates the trigger targeting triggerHandler', () => {
    controller.startProcessing('assignment-456', 'Essay_1_defKey', 'course-123');

    // NEW CONTRACT: the time-based trigger must target the single public
    // triggerHandler() entrypoint, not triggerProcessSelectedAssignment.
    expect(mockTriggerController.createTimeBasedTrigger).toHaveBeenCalledWith('triggerHandler');
  });
});
