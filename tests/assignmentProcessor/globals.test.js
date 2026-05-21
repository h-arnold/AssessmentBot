/**
 * Tests for AssignmentProcessor globals.js
 * Tests global functions that delegate to AssignmentController
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock AssignmentController
const mockAssignmentController = {
  saveStartAndShowProgress: vi.fn(),
  startProcessing: vi.fn(),
  createDefinitionFromWizardInputs: vi.fn(),
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

  describe('saveStartAndShowProgress', () => {
    it('creates new AssignmentController and delegates to saveStartAndShowProgress', () => {
      const result = { success: true };
      mockAssignmentController.saveStartAndShowProgress.mockReturnValue(result);

      const output = globals.saveStartAndShowProgress(
        'Test Assignment',
        { referenceDocumentId: 'ref-id', templateDocumentId: 'tpl-id' },
        'assignment-123',
        'course-456'
      );

      expect(mockAssignmentController.saveStartAndShowProgress).toHaveBeenCalledWith(
        'Test Assignment',
        { referenceDocumentId: 'ref-id', templateDocumentId: 'tpl-id' },
        'assignment-123',
        'course-456'
      );
      expect(output).toBe(result);
    });

    it('logs info message when invoked', () => {
      globals.saveStartAndShowProgress(
        'Test Assignment',
        { referenceDocumentId: 'ref-id', templateDocumentId: 'tpl-id' },
        'assignment-123',
        'course-456'
      );

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        'saveStartAndShowProgress invoked (globals):',
        expect.objectContaining({
          assignmentTitle: 'Test Assignment',
          documentIds: { referenceDocumentId: 'ref-id', templateDocumentId: 'tpl-id' },
          assignmentId: 'assignment-123',
          courseId: 'course-456',
        })
      );
    });

    it('logs and rethrows errors', () => {
      const error = new Error('Test error');
      mockAssignmentController.saveStartAndShowProgress.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        globals.saveStartAndShowProgress(
          'Test Assignment',
          { referenceDocumentId: 'ref-id', templateDocumentId: 'tpl-id' },
          'assignment-123',
          'course-456'
        );
      }).toThrow(error);

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error in globals.saveStartAndShowProgress:',
        'Test error'
      );
    });

    it('handles error with no message property', () => {
      const error = new Error('No message');
      error.message = undefined;
      mockAssignmentController.saveStartAndShowProgress.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        globals.saveStartAndShowProgress(
          'Test Assignment',
          { referenceDocumentId: 'ref-id', templateDocumentId: 'tpl-id' },
          'assignment-123',
          'course-456'
        );
      }).toThrow(error);

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error in globals.saveStartAndShowProgress:',
        error
      );
    });

    it('handles non-Error object being thrown', () => {
      mockAssignmentController.saveStartAndShowProgress.mockImplementation(() => {
        throw new Error('String error');
      });

      expect(() => {
        globals.saveStartAndShowProgress(
          'Test Assignment',
          { referenceDocumentId: 'ref-id', templateDocumentId: 'tpl-id' },
          'assignment-123',
          'course-456'
        );
      }).toThrow();

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error in globals.saveStartAndShowProgress:',
        'String error'
      );
    });
  });

  describe('startProcessing', () => {
    it('creates new AssignmentController and delegates to startProcessing', () => {
      const result = 'trigger-id-123';
      mockAssignmentController.startProcessing.mockReturnValue(result);

      const output = globals.startProcessing('assignment-123', 'definition-key-123');

      expect(mockAssignmentController.startProcessing).toHaveBeenCalledWith(
        'assignment-123',
        'definition-key-123'
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

  describe('createDefinitionFromWizardInputs', () => {
    it('creates new AssignmentController and delegates to createDefinitionFromWizardInputs', () => {
      const params = {
        assignmentId: 'assignment-123',
        courseId: 'course-456',
        assignmentTitle: 'Test Assignment',
        referenceDocumentId: 'ref-doc-id',
        templateDocumentId: 'tpl-doc-id',
        yearGroupKey: 'year-10',
      };

      const result = { definition: { id: 'def-123' }, tasks: [] };
      mockAssignmentController.createDefinitionFromWizardInputs.mockReturnValue(result);

      const output = globals.createDefinitionFromWizardInputs(params);

      expect(mockAssignmentController.createDefinitionFromWizardInputs).toHaveBeenCalledWith(
        params
      );
      expect(output).toBe(result);
    });

    it('logs error and rethrows when controller throws', () => {
      const params = {
        assignmentId: 'assignment-123',
        courseId: 'course-456',
        assignmentTitle: 'Test Assignment',
        referenceDocumentId: 'ref-doc-id',
        templateDocumentId: 'tpl-doc-id',
      };

      const error = new Error('Validation failed');
      mockAssignmentController.createDefinitionFromWizardInputs.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        globals.createDefinitionFromWizardInputs(params);
      }).toThrow(error);

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error in globals.createDefinitionFromWizardInputs:',
        'Validation failed'
      );
    });

    it('handles missing yearGroupKey parameter', () => {
      const params = {
        assignmentId: 'assignment-123',
        courseId: 'course-456',
        assignmentTitle: 'Test Assignment',
        referenceDocumentId: 'ref-doc-id',
        templateDocumentId: 'tpl-doc-id',
      };

      const result = { definition: { id: 'def-123' }, tasks: [] };
      mockAssignmentController.createDefinitionFromWizardInputs.mockReturnValue(result);

      const output = globals.createDefinitionFromWizardInputs(params);

      expect(mockAssignmentController.createDefinitionFromWizardInputs).toHaveBeenCalledWith(
        expect.objectContaining({
          ...params,
          yearGroupKey: null,
        })
      );
      expect(output).toBe(result);
    });

    it('handles non-Error object in createDefinitionFromWizardInputs', () => {
      const params = {
        assignmentId: 'assignment-123',
        courseId: 'course-456',
        assignmentTitle: 'Test Assignment',
        referenceDocumentId: 'ref-doc-id',
        templateDocumentId: 'tpl-doc-id',
      };

      mockAssignmentController.createDefinitionFromWizardInputs.mockImplementation(() => {
        throw new Error('ERR_TEST');
      });

      expect(() => {
        globals.createDefinitionFromWizardInputs(params);
      }).toThrow();

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error in globals.createDefinitionFromWizardInputs:',
        'ERR_TEST'
      );
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
