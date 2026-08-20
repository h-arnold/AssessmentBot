/**
 * Tests for the TRIGGER_METHOD_HANDLERS registry (ACTION_PLAN Section 8).
 *
 * src/backend/Triggers/triggerMethodHandlers.js has been delivered (green phase complete); the
 * top-level require below loads the production module.
 *
 * Contract under test: the registry follows the SPEC form exactly —
 * processSelectedAssignment: (params) => new AssignmentController()
 * .processSelectedAssignment(params) — each entry is an anonymous arrow
 * function inside a const object literal. There must be NO top-level function
 * declarations in the file, otherwise the §7 global-exposure guard scan
 * (globalExposure.test.js) flags it.
 *
 * AssignmentController is a GAS global constructor, mocked here with a
 * constructable vi.fn (arrow functions cannot be invoked with `new`). The mock
 * global is installed per-test through withGlobalMocks so the original global
 * is always restored (globalMockManager pattern; see
 * docs/developer/backend/backend-testing.md).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

const mockAssignmentController = { processSelectedAssignment: vi.fn() };

// Module under test — created in the green phase (ACTION_PLAN Section 8).
const { TRIGGER_METHOD_HANDLERS } = require('../../src/backend/Triggers/triggerMethodHandlers.js');

describe('TRIGGER_METHOD_HANDLERS', () => {
  let restoreAssignmentController;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockContext = withGlobalMocks({
      AssignmentController: () =>
        vi.fn(function () {
          return mockAssignmentController;
        }),
    });
    restoreAssignmentController = mockContext.restore;
  });

  afterEach(() => {
    if (restoreAssignmentController) restoreAssignmentController();
    vi.restoreAllMocks();
  });

  it('registers processSelectedAssignment as a dispatchable handler', () => {
    expect(TRIGGER_METHOD_HANDLERS).toBeDefined();
    expect(typeof TRIGGER_METHOD_HANDLERS.processSelectedAssignment).toBe('function');
  });

  it('instantiates AssignmentController and dispatches processSelectedAssignment with the exact params', () => {
    const params = {
      assignmentId: 'assignment-456',
      definitionKey: 'Essay_1_defKey',
      courseId: 'course-123',
    };

    TRIGGER_METHOD_HANDLERS.processSelectedAssignment(params);

    expect(globalThis.AssignmentController).toHaveBeenCalledTimes(1);
    expect(mockAssignmentController.processSelectedAssignment).toHaveBeenCalledTimes(1);
    expect(mockAssignmentController.processSelectedAssignment).toHaveBeenCalledWith(params);
  });
});
