/**
 * Tests for AssignmentProcessor globals.js
 * Tests global functions that delegate to AssignmentController
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock AssignmentController
const mockAssignmentController = {
  startProcessing: vi.fn(),
  processSelectedAssignment: vi.fn(),
  triggerController: {
    removeTriggers: vi.fn(),
  },
  testWorkflow: vi.fn(),
};

// Mock ABLogger - singleton that returns the same instance
const mockLoggerInstance = {
  info: vi.fn(),
  error: vi.fn(),
};
const mockABLogger = {
  getInstance: () => mockLoggerInstance,
};

// Mock AssignmentController - moved to module scope per S7721
function AssignmentController() {
  return mockAssignmentController;
}

function createAssignmentProcessorGlobalsTestContext() {
  // Clear module cache
  delete require.cache[require.resolve('../../src/backend/AssignmentProcessor/globals.js')];

  // Setup global mocks
  globalThis.AssignmentController = AssignmentController;
  globalThis.ABLogger = mockABLogger;

  // Load the globals module
  const globals = require('../../src/backend/AssignmentProcessor/globals.js');

  return { globals };
}

function cleanupAssignmentProcessorGlobalsTestContext() {
  delete globalThis.AssignmentController;
  delete globalThis.ABLogger;
  vi.restoreAllMocks();
}

describe('AssignmentProcessor globals', () => {
  let globals;

  beforeEach(() => {
    vi.resetAllMocks();

    // Create fresh context
    const context = createAssignmentProcessorGlobalsTestContext();
    globals = context.globals;
  });

  afterEach(() => {
    cleanupAssignmentProcessorGlobalsTestContext();
  });

  describe('saveStartAndShowProgress removal', () => {
    it('globals.saveStartAndShowProgress is undefined after removal', () => {
      // ASSERTION: This will FAIL (RED) because globals.js still exports
      // saveStartAndShowProgress. Once removed (GREEN phase), this will pass.
      expect(globals.saveStartAndShowProgress).toBeUndefined();
    });

    it('other globals functions are still exported', () => {
      // These should remain defined regardless of saveStartAndShowProgress removal
      expect(typeof globals.startProcessing).toBe('function');
      expect(typeof globals.triggerProcessSelectedAssignment).toBe('function');
      expect(typeof globals.removeTrigger).toBe('function');
      expect(typeof globals.testWorkflow).toBe('function');
    });
  });

  describe('startProcessing', () => {
    it('creates new AssignmentController and delegates to startProcessing', () => {
      const result = 'trigger-id-123';
      mockAssignmentController.startProcessing.mockReturnValue(result);

      const output = globals.startProcessing('assignment-123', 'definition-key-123');

      expect(mockAssignmentController.startProcessing).toHaveBeenCalledWith(
        'assignment-123',
        'definition-key-123',
        undefined
      );
      expect(output).toBe(result);
    });

    it('returns the process ID from controller', () => {
      const processId = 'process-uuid-456';
      mockAssignmentController.startProcessing.mockReturnValue(processId);

      const output = globals.startProcessing('assignment-123', 'definition-key-123');

      expect(output).toBe(processId);
    });
  });

  describe('startProcessing with courseId', () => {
    it('passes courseId as third argument to controller.startProcessing', () => {
      const result = 'trigger-id-123';
      mockAssignmentController.startProcessing.mockReturnValue(result);

      const output = globals.startProcessing('assignment-123', 'definition-key-123', 'course-456');

      // ASSERTION: This will FAIL (RED) because globals.startProcessing currently
      // only passes assignmentId and definitionKey to the controller (no courseId)
      expect(mockAssignmentController.startProcessing).toHaveBeenCalledWith(
        'assignment-123',
        'definition-key-123',
        'course-456'
      );
      expect(output).toBe(result);
    });

    it('returns the process ID from controller when courseId is provided', () => {
      const processId = 'process-uuid-456';
      mockAssignmentController.startProcessing.mockReturnValue(processId);

      const output = globals.startProcessing('assignment-123', 'definition-key-123', 'course-456');

      // ASSERTION: This will also be RED because the three-arg delegation is not yet in place
      expect(mockAssignmentController.startProcessing).toHaveBeenCalledWith(
        'assignment-123',
        'definition-key-123',
        'course-456'
      );
      expect(output).toBe(processId);
    });
  });

  describe('createDefinitionFromWizardInputs removal', () => {
    it('globals.createDefinitionFromWizardInputs is undefined after removal', () => {
      expect(globals.createDefinitionFromWizardInputs).toBeUndefined();
    });
  });

  describe('triggerProcessSelectedAssignment', () => {
    it('creates new AssignmentController and delegates to processSelectedAssignment', () => {
      const result = { success: true };
      mockAssignmentController.processSelectedAssignment.mockReturnValue(result);

      const output = globals.triggerProcessSelectedAssignment();

      expect(mockAssignmentController.processSelectedAssignment).toHaveBeenCalled();
      expect(output).toBe(result);
    });

    it('returns the result from controller', () => {
      const result = { processed: true, count: 5 };
      mockAssignmentController.processSelectedAssignment.mockReturnValue(result);

      const output = globals.triggerProcessSelectedAssignment();

      expect(output).toEqual(result);
    });
  });

  describe('removeTrigger', () => {
    it('creates new AssignmentController and delegates to triggerController.removeTriggers', () => {
      const mockRemoveResult = { success: true, removedCount: 1 };
      mockAssignmentController.triggerController.removeTriggers.mockReturnValue(mockRemoveResult);

      const output = globals.removeTrigger('testFunction');

      expect(mockAssignmentController.triggerController.removeTriggers).toHaveBeenCalledWith(
        'testFunction'
      );
      // removeTrigger doesn't return anything - it just calls the controller method
      expect(output).toBeUndefined();
    });

    it('calls removeTriggers with the provided function name', () => {
      globals.removeTrigger('handleAssessment');

      expect(mockAssignmentController.triggerController.removeTriggers).toHaveBeenCalledWith(
        'handleAssessment'
      );
    });
  });

  describe('testWorkflow', () => {
    it('creates new AssignmentController and delegates to testWorkflow', () => {
      const result = { test: 'passed' };
      mockAssignmentController.testWorkflow.mockReturnValue(result);

      globals.testWorkflow();

      expect(mockAssignmentController.testWorkflow).toHaveBeenCalled();
      // testWorkflow doesn't return anything - it just calls the controller method
    });

    it('calls controller testWorkflow method', () => {
      const result = { status: 'ok', tests: 10 };
      mockAssignmentController.testWorkflow.mockReturnValue(result);

      globals.testWorkflow();

      expect(mockAssignmentController.testWorkflow).toHaveBeenCalled();
    });
  });
});
