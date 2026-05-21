/**
 * Shared test helpers for Feedback model tests
 * Reduces duplication between feedback.test.js and cellReferenceFeedback.test.js
 */

import { vi } from 'vitest';

/**
 * Setup Feedback and CellReferenceFeedback modules for testing
 * This handles the complex dependency chain where CellReferenceFeedback extends Feedback
 * and both need to be loaded and available globally for proper testing
 * @returns {Object} { Feedback, CellReferenceFeedback, cleanup }
 */
export function setupFeedbackModules() {
  // Load Feedback base class first
  delete require.cache[require.resolve('../../src/backend/Models/Feedback/0_Feedback.js')];
  const Feedback = require('../../src/backend/Models/Feedback/0_Feedback.js');

  // Make Feedback available globally BEFORE loading CellReferenceFeedback
  // This is required because CellReferenceFeedback extends Feedback
  globalThis.Feedback = Feedback;

  // Load CellReferenceFeedback which extends Feedback
  delete require.cache[
    require.resolve('../../src/backend/Models/Feedback/1_CellReferenceFeedback.js')
  ];
  const CellReferenceFeedback = require('../../src/backend/Models/Feedback/1_CellReferenceFeedback.js');

  // Make CellReferenceFeedback available globally for Feedback.fromJSON
  globalThis.CellReferenceFeedback = CellReferenceFeedback;

  // Return cleanup function
  return {
    Feedback,
    CellReferenceFeedback,
    cleanup: () => {
      delete globalThis.Feedback;
      delete globalThis.CellReferenceFeedback;
      vi.clearAllMocks();
    },
  };
}

/**
 * Create a beforeEach/afterEach pair for Feedback tests
 * Usage:
 *   const { beforeEach: setup, afterEach: teardown } = createFeedbackTestHooks();
 *   describe('MyTest', () => {
 *     beforeEach(setup);
 *     afterEach(teardown);
 *     // tests...
 *   });
 * @returns {Object} { beforeEach, afterEach }
 */
export function createFeedbackTestHooks() {
  let cleanupFn;

  return {
    beforeEach: () => {
      const { cleanup } = setupFeedbackModules();
      cleanupFn = cleanup;
    },
    afterEach: () => {
      if (cleanupFn) {
        cleanupFn();
      }
    },
  };
}
