/**
 * Tests for the `TRIGGER_METHOD_HANDLERS` registry.
 *
 * The top-level require below loads the production module directly.
 *
 * Contract under test: the registry follows the SPEC form exactly —
 * processSelectedAssignment: (params) => new AssignmentController()
 * .processSelectedAssignment(params) — each entry is an anonymous arrow
 * function inside a const object literal. There must be no top-level function
 * declarations in the file: the static exposure guard (globalExposure.test.js)
 * flags them because GAS would expose any top-level function without a
 * trailing underscore as a callable google.script.run global.
 *
 * AssignmentController is a GAS global constructor, mocked here with a
 * constructable vi.fn (arrow functions cannot be invoked with `new`). The mock
 * global is installed per-test through withGlobalMocks so the original global
 * is always restored (globalMockManager pattern; see
 * docs/developer/backend/backend-testing.md).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

const mockAssignmentController = { processSelectedAssignment: vi.fn() };

// Module under test: the registry that triggerHandler dispatches trigger contexts through.
const { TRIGGER_METHOD_HANDLERS } = require('#backend/Triggers/triggerMethodHandlers.js');

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

  it('dispatches cleanupProgress through the cleanup coordinator', () => {
    expect(typeof TRIGGER_METHOD_HANDLERS.cleanupProgress).toBe('function');

    const sweep = vi.fn();
    const cleanupContext = withGlobalMocks({
      ProgressTrackerCleanup: () => ({ sweep }),
    });

    try {
      TRIGGER_METHOD_HANDLERS.cleanupProgress({});

      expect(sweep).toHaveBeenCalledTimes(1);
    } finally {
      cleanupContext.restore();
    }
  });

  it('exposes cleanupProgress only as a registry entry, not a public GAS function', () => {
    expect(globalThis.cleanupProgress).toBeUndefined();

    const source = fs.readFileSync(
      require.resolve('#backend/Triggers/triggerMethodHandlers.js'),
      'utf8'
    );
    expect(source).not.toMatch(/^\s*function\s+cleanupProgress\s*\(/mu);
  });
});
