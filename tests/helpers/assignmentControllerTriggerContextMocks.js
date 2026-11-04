/**
 * Shared global mocks for the AssignmentController startProcessing suites
 * (`assignmentController.userPropertiesMigration.test.js` and
 * `assignmentController.startProcessingTriggerIntegration.test.js`).
 *
 * Both suites install the same GAS and service doubles on `globalThis` before
 * loading the controller, so the doubles and their installers live here once.
 * Each suite keeps its own describes, assertions and file-specific setup.
 */

import { vi } from 'vitest';

/** TriggerController double the suites assert against. */
export const mockTriggerController = {
  createTimeBasedTrigger: vi.fn(),
  deleteTriggerById: vi.fn(),
  removeTriggers: vi.fn(),
  storeTriggerContext: vi.fn(),
};

/**
 * Installs the LockService, ABLogger, TriggerController, Utils and
 * ProgressTracker doubles the controller reads at call time.
 */
export function installTriggerContextMocks() {
  globalThis.LockService = {
    getDocumentLock: vi.fn(),
  };

  globalThis.ABLogger = {
    getInstance: vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
    }),
  };

  globalThis.TriggerController = vi.fn().mockImplementation(function () {
    return mockTriggerController;
  });

  globalThis.Utils = {
    toastMessage: vi.fn(),
    definitionNeedsRefresh: vi.fn(),
    isNewer: vi.fn().mockReturnValue(false),
  };

  globalThis.ProgressTracker = {
    getInstance: vi.fn().mockReturnValue({
      startTracking: vi.fn(),
      updateProgress: vi.fn(),
      complete: vi.fn(),
      logError: vi.fn(),
      logAndThrowError: vi.fn((msg) => {
        throw new Error(msg);
      }),
    }),
  };
}

/**
 * Installs the PropertiesService and ConfigurationManager doubles the
 * UserProperties-migration suite reads.
 */
export function installUserPropertiesMocks() {
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

  globalThis.ConfigurationManager = {
    getInstance: vi.fn().mockReturnValue({
      getAssessmentRecordCourseId: vi.fn().mockReturnValue('course-123'),
    }),
  };
}
