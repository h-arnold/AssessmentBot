/**
 * RED-phase tests for runAssignmentPipeline throw-on-stale behaviour.
 *
 * These tests verify that runAssignmentPipeline throws DefinitionStaleError
 * when the reference or template document has been modified since the
 * definition was created, instead of silently re-parsing.
 *
 * Current behaviour (to be changed in GREEN phase):
 *   - runAssignmentPipeline uses Utils.definitionNeedsRefresh and silently
 *     re-parses when the definition is stale
 *
 * Expected behaviour (GREEN phase):
 *   - runAssignmentPipeline uses Utils.isNewer per-document and throws
 *     DefinitionStaleError with structured metadata when any document is stale
 *   - processSelectedAssignment catches the error from runAssignmentPipeline
 *     and calls ProgressTracker.logAndThrowError
 *
 * These tests are RED (expected to fail) until the throw-on-stale
 * behaviour is implemented.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =========================================================================
// Global mocks (before loading controller)
// =========================================================================

// Mock DriveManager
globalThis.DriveManager = {
  getFileModifiedTime: vi.fn(),
};

// Mock ABLogger
const mockLoggerInstance = {
  info: vi.fn(),
  error: vi.fn(),
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

// Mock Utils with both old and new staleness-check methods
globalThis.Utils = {
  toastMessage: vi.fn(),
  definitionNeedsRefresh: vi.fn(),
  isNewer: vi.fn(),
};

// Mock ConfigurationManager (needed by processSelectedAssignment flow)
globalThis.ConfigurationManager = {
  getInstance: vi.fn().mockReturnValue({
    getAssessmentRecordCourseId: vi.fn().mockReturnValue('course-123'),
  }),
};

// Load the controller and error type
const AssignmentController = require('../../../src/backend/y_controllers/AssignmentController.js');
const DefinitionStaleError = require('../../../src/backend/Utils/ErrorTypes/DefinitionStaleError.js');

// =========================================================================
// Tests
// =========================================================================

describe('AssignmentController - runAssignmentPipeline throw-on-stale (RED phase)', () => {
  let controller;

  // Shared test data
  const TEST_DEFINITION_KEY = 'Essay_1_defKey';
  const REFERENCE_MODIFIED = '2025-06-01T12:00:00Z';
  const TEMPLATE_MODIFIED = '2025-06-01T12:00:00Z';
  const REFERENCE_LAST_MODIFIED = '2025-05-01T12:00:00Z';
  const TEMPLATE_LAST_MODIFIED = '2025-05-01T12:00:00Z';

  beforeEach(() => {
    vi.clearAllMocks();

    controller = new AssignmentController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =====================================================================
  // runAssignmentPipeline — stale detection (direct calls)
  // =====================================================================

  describe('runAssignmentPipeline - stale detection', () => {
    let mockDefinition;
    let mockAssignment;
    let mockDefinitionController;

    beforeEach(() => {
      mockDefinition = {
        definitionKey: TEST_DEFINITION_KEY,
        referenceDocumentId: 'ref-doc-123',
        templateDocumentId: 'tpl-doc-456',
        referenceLastModified: REFERENCE_LAST_MODIFIED,
        templateLastModified: TEMPLATE_LAST_MODIFIED,
        tasks: { t1: { taskTitle: 'Task 1' } },
        updateModifiedTimestamps: vi.fn(),
      };

      mockAssignment = {
        assignmentDefinition: mockDefinition,
        addStudent: vi.fn(),
        populateTasks: vi.fn(),
        fetchSubmittedDocuments: vi.fn(),
        processAllSubmissions: vi.fn(),
        processImages: vi.fn(),
        assessResponses: vi.fn(),
      };

      mockDefinitionController = {
        saveDefinition: vi.fn(),
      };

      // Default Drive timestamps — both newer than stored definition timestamps
      DriveManager.getFileModifiedTime
        .mockReturnValueOnce(REFERENCE_MODIFIED)
        .mockReturnValueOnce(TEMPLATE_MODIFIED);

      // Make old code take the re-parse path (definitionNeedsRefresh returns true)
      Utils.definitionNeedsRefresh.mockReturnValue(true);

      // isNewer — default to stale (both documents are newer)
      Utils.isNewer.mockReturnValue(true);
    });

    /**
     * Test 1: Stale reference document → throws DefinitionStaleError
     * Asserts that when the reference document has been modified since definition creation,
     * runAssignmentPipeline throws DefinitionStaleError with referenceStale: true.
     */
    it('[RED] throws DefinitionStaleError when reference document is stale', () => {
      // Arrange: reference is stale, template is not
      Utils.isNewer
        .mockReturnValueOnce(true) // reference is newer → stale
        .mockReturnValueOnce(false); // template is not newer → fresh

      // Act & Assert: should throw DefinitionStaleError
      // NOTE: This assertion FAILS (RED) because the current code silently re-parses
      // instead of throwing. It will pass when the throw-on-stale behaviour is implemented.
      expect(() => {
        controller.runAssignmentPipeline(mockAssignment, [], {
          definitionController: mockDefinitionController,
        });
      }).toThrow(DefinitionStaleError);
    });

    /**
     * Test 2: Stale template document → throws DefinitionStaleError
     * Asserts that when the template document has been modified since definition creation,
     * runAssignmentPipeline throws DefinitionStaleError with templateStale: true.
     */
    it('[RED] throws DefinitionStaleError when template document is stale', () => {
      // Arrange: reference is not stale, template is stale
      Utils.isNewer
        .mockReturnValueOnce(false) // reference is not newer → fresh
        .mockReturnValueOnce(true); // template is newer → stale

      // Act & Assert: should throw DefinitionStaleError
      expect(() => {
        controller.runAssignmentPipeline(mockAssignment, [], {
          definitionController: mockDefinitionController,
        });
      }).toThrow(DefinitionStaleError);
    });

    /**
     * Test 3: Both stale → throws with both flags true
     * Asserts that when both reference and template documents have been modified,
     * runAssignmentPipeline throws DefinitionStaleError with both flags set to true.
     */
    it('[RED] throws DefinitionStaleError when both documents are stale', () => {
      // Act & Assert: both are stale (default mock returns true for both), should throw
      expect(() => {
        controller.runAssignmentPipeline(mockAssignment, [], {
          definitionController: mockDefinitionController,
        });
      }).toThrow(DefinitionStaleError);
    });

    /**
     * Test 4: Neither stale → no throw, pipeline continues
     * Asserts that when both documents are fresh, runAssignmentPipeline proceeds
     * without throwing and continues to later pipeline stages.
     */
    it('does not throw when neither document is stale', () => {
      // Arrange: neither is stale
      Utils.isNewer.mockReturnValue(false);
      Utils.definitionNeedsRefresh.mockReturnValue(false);

      // Act & Assert: should NOT throw
      expect(() => {
        controller.runAssignmentPipeline(mockAssignment, [], {
          definitionController: mockDefinitionController,
        });
      }).not.toThrow();

      // Verify pipeline continued to later stages
      expect(mockAssignment.fetchSubmittedDocuments).toHaveBeenCalled();
      expect(mockAssignment.assessResponses).toHaveBeenCalled();
    });

    /**
     * Test 5: Error includes correct definitionKey and staleness metadata
     * Asserts that the thrown DefinitionStaleError carries the expected
     * structured metadata about which documents are stale.
     */
    it('[RED] error includes correct definitionKey and staleness metadata when reference is stale', () => {
      // Arrange: reference is stale, template is not
      Utils.isNewer
        .mockReturnValueOnce(true) // reference is newer
        .mockReturnValueOnce(false); // template is not newer

      // Act
      try {
        controller.runAssignmentPipeline(mockAssignment, [], {
          definitionController: mockDefinitionController,
        });
        // If we reach here, the test fails — DefinitionStaleError was not thrown
        expect.unreachable('Expected DefinitionStaleError to be thrown');
      } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(DefinitionStaleError);
        expect(error.message).toBe(
          'Assignment definition is stale: reference or template document has changed.'
        );
        expect(error.definitionKey).toBe(TEST_DEFINITION_KEY);
        expect(error.referenceStale).toBe(true);
        expect(error.templateStale).toBe(false);
        expect(error.referenceLastModified).toBe(REFERENCE_MODIFIED);
        expect(error.templateLastModified).toBe(TEMPLATE_MODIFIED);
      }
    });

    /**
     * Test 5b: Error metadata for template-stale scenario
     */
    it('[RED] error includes correct definitionKey and staleness metadata when template is stale', () => {
      // Arrange: template is stale, reference is not
      Utils.isNewer
        .mockReturnValueOnce(false) // reference is not newer
        .mockReturnValueOnce(true); // template is newer

      // Act
      try {
        controller.runAssignmentPipeline(mockAssignment, [], {
          definitionController: mockDefinitionController,
        });
        expect.unreachable('Expected DefinitionStaleError to be thrown');
      } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(DefinitionStaleError);
        expect(error.message).toBe(
          'Assignment definition is stale: reference or template document has changed.'
        );
        expect(error.definitionKey).toBe(TEST_DEFINITION_KEY);
        expect(error.referenceStale).toBe(false);
        expect(error.templateStale).toBe(true);
        expect(error.referenceLastModified).toBe(REFERENCE_MODIFIED);
        expect(error.templateLastModified).toBe(TEMPLATE_MODIFIED);
      }
    });
  });

  // =====================================================================
  // processSelectedAssignment — stale error propagation (regression)
  // =====================================================================

  describe('processSelectedAssignment - stale error propagation', () => {
    const STALE_TIMESTAMP = '2025-06-01T12:00:00Z';

    beforeEach(() => {
      // Setup lock to succeed
      const mockLock = {
        tryLock: vi.fn().mockReturnValue(true),
        releaseLock: vi.fn(),
      };
      globalThis.LockService = {
        getDocumentLock: vi.fn().mockReturnValue(mockLock),
      };

      // Mock GASPropertiesUtils
      const mockUserProperties = {
        getProperty: vi.fn((key) => {
          const defaults = {
            assignmentId: 'assignment-456',
            definitionKey: TEST_DEFINITION_KEY,
            triggerId: 'trigger-789',
            courseId: 'course-123',
          };
          return defaults[key] ?? null;
        }),
        setProperty: vi.fn(),
        deleteProperty: vi.fn(),
        getKeys: vi.fn().mockReturnValue([]),
      };
      globalThis.GASPropertiesUtils = {
        getUserProperties: vi.fn().mockReturnValue(mockUserProperties),
        applyProperties: vi.fn(),
        clearProperties: vi.fn(),
      };

      // Mock TriggerController
      globalThis.TriggerController = vi.fn().mockImplementation(function () {
        return {
          createTimeBasedTrigger: vi.fn(),
          deleteTriggerById: vi.fn(),
          removeTriggers: vi.fn(),
        };
      });

      // Mock AssignmentDefinitionController
      const mockDefinition = {
        definitionKey: TEST_DEFINITION_KEY,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-123',
        templateDocumentId: 'tpl-456',
        tasks: { t1: { taskTitle: 'Task 1' } },
        updateModifiedTimestamps: vi.fn(),
      };
      globalThis.AssignmentDefinitionController = vi.fn().mockImplementation(function () {
        return {
          getDefinitionByKey: vi.fn().mockReturnValue(mockDefinition),
          saveDefinition: vi.fn(),
        };
      });

      // Mock ABClassController
      const mockABClass = {
        classId: 'course-123',
        students: [],
        findAssignmentIndex: vi.fn().mockReturnValue(-1),
        yearGroupKey: 'year-group-10',
      };
      globalThis.ABClassController = vi.fn().mockImplementation(function () {
        return {
          loadClass: vi.fn().mockReturnValue(mockABClass),
          rehydrateAssignment: vi.fn(),
          persistAssignmentRun: vi.fn(),
        };
      });

      // Mock Assignment.create factory
      const mockAssignmentInstance = {
        assignmentDefinition: {
          definitionKey: TEST_DEFINITION_KEY,
          documentType: 'SLIDES',
          referenceDocumentId: 'ref-123',
          templateDocumentId: 'tpl-456',
          tasks: { t1: { taskTitle: 'Task 1' } },
          updateModifiedTimestamps: vi.fn(),
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

      // Mock DriveManager — return stale timestamps (newer than stored)
      DriveManager.getFileModifiedTime.mockReset().mockReturnValue(STALE_TIMESTAMP);

      // Mock Utils — stale check returns true (needs refresh in old code, isNewer in new code)
      Utils.definitionNeedsRefresh.mockReturnValue(true);
      Utils.isNewer.mockReturnValue(true);

      // Override logAndThrowError to a plain mock (no throw) so that if/when
      // processSelectedAssignment's catch block calls it, the test assertion
      // is reached instead of crashing. The purpose of test 6 is verifying
      // the catch block calls logAndThrowError, not testing ProgressTracker's
      // internal throw handling.
      mockProgressTracker.logAndThrowError = vi.fn();
    });

    /**
     * Test 6: When runAssignmentPipeline throws DefinitionStaleError,
     * processSelectedAssignment catches it and calls logAndThrowError.
     *
     * This is a regression test: the catch block in processSelectedAssignment
     * already handles errors from runAssignmentPipeline. Once the throw-on-stale
     * behaviour is added, the error will propagate correctly through the
     * existing error boundary.
     */
    it('[RED] processSelectedAssignment catches DefinitionStaleError and calls logAndThrowError', () => {
      // Act: run processSelectedAssignment which internally calls runAssignmentPipeline
      controller.processSelectedAssignment();

      // ASSERTION: This will FAIL (RED) because the current code silently re-parses
      // instead of throwing DefinitionStaleError. Once the throw-on-stale behaviour
      // is implemented, runAssignmentPipeline will throw, and the catch block in
      // processSelectedAssignment will call logAndThrowError.
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });
  });
});
