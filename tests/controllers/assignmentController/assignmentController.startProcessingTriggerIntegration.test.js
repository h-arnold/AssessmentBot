/**
 * Tests for the startProcessing trigger integration.
 *
 * The current implementation already creates the time-based trigger targeting
 * 'triggerHandler' and stores task context through
 * TriggerController.storeTriggerContext(triggerUid, { method, params }), with
 * triggerUid taken from createTimeBasedTrigger() and no direct UserProperties
 * reads for task context.
 *
 * The RED assertion is the correlation ID: trigger params must include a
 * non-empty requestId so progress records can be keyed by the dispatch request
 * ID. The current params carry only assignmentId, definitionKey and courseId.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  installTriggerContextMocks,
  mockTriggerController,
} from '#test-helpers/assignmentControllerTriggerContextMocks.js';

// =========================================================================
// Global mocks (before loading controller)
// =========================================================================

installTriggerContextMocks();

// Load the controller
const AssignmentController = require('#backend/y_controllers/AssignmentController.js');

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
    controller.startProcessing('assignment-456', 'Essay_1_defKey', 'course-123', 'req-trigger-001');

    // NEW CONTRACT: startProcessing() must hand the trigger UID returned by
    // createTimeBasedTrigger() to TriggerController.storeTriggerContext() with
    // method 'processSelectedAssignment' and the direct task params, including
    // the correlation requestId used to key progress records.
    expect(mockTriggerController.storeTriggerContext).toHaveBeenCalledWith('trigger-789', {
      method: 'processSelectedAssignment',
      params: {
        assignmentId: 'assignment-456',
        definitionKey: 'Essay_1_defKey',
        courseId: 'course-123',
        requestId: 'req-trigger-001',
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
