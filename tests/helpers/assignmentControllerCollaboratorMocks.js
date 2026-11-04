/**
 * Shared setup for the AssignmentController suites that stub the controller's
 * collaborators (`assignmentController.definitionInputs.test.js` and
 * `assignmentController.hydration.test.js`).
 *
 * Both suites install the same logger, ProgressTracker, ABClassController and
 * AssignmentDefinitionController doubles before each test, so the doubles and
 * their installer live here once. Each suite keeps its own describes,
 * assertions and file-specific setup.
 */

import { vi } from 'vitest';
import { createMockABLogger } from './mockFactories.js';

/**
 * Installs the logger, ProgressTracker, ABClassController and
 * AssignmentDefinitionController doubles the controller resolves at call time.
 *
 * @returns {{ mockDefinitionController: object, mockABClassController: object, mockProgressTracker: object, loggerInstance: object }}
 *   The installed doubles.
 */
export function installAssignmentControllerCollaboratorMocks() {
  const loggerInstance = createMockABLogger(vi);
  vi.spyOn(globalThis.ABLogger, 'getInstance').mockReturnValue(loggerInstance);

  const mockProgressTracker = {
    startTracking: vi.fn(),
    updateProgress: vi.fn(),
    complete: vi.fn(),
    logAndThrowError: vi.fn((msg) => {
      throw new Error(msg);
    }),
  };
  globalThis.ProgressTracker = {
    getInstance: vi.fn().mockReturnValue(mockProgressTracker),
  };

  const mockABClassController = {
    loadClass: vi.fn().mockReturnValue({
      classId: 'course-123',
      students: [{ id: 'student-1', name: 'Student 1' }],
      yearGroupKey: 'year-group-10',
    }),
    persistAssignmentRun: vi.fn(),
  };
  globalThis.ABClassController = vi.fn().mockImplementation(function () {
    return mockABClassController;
  });

  const mockDefinitionController = {
    getDefinitionByKey: vi.fn(),
  };
  globalThis.AssignmentDefinitionController = vi.fn().mockImplementation(function () {
    return mockDefinitionController;
  });

  return {
    mockDefinitionController,
    mockABClassController,
    mockProgressTracker,
    loggerInstance,
  };
}
