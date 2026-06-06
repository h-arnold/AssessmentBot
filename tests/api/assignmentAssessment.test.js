/**
 * Assignment Assessment API Handler Tests
 *
 * Tests for the startAssessmentRun_ API handler in z_Api/assignmentAssessment.js.
 *
 * Transport-boundary validation:
 * - Validates parameters is a plain object
 * - Validates required string fields (definitionKey, assignmentId, courseId)
 * - Delegates to AssignmentController.startAssessmentRun on valid input
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

const MODULE_PATH = '../../src/backend/z_Api/assignmentAssessment.js';

/**
 * Attempts to load the assignmentAssessment transport module.
 * In RED phase the file does not exist, so this will throw.
 *
 * @returns {Object} Module exports containing startAssessmentRun_.
 * @throws {Error} MODULE_NOT_FOUND when the file has not been created yet.
 */
function loadAssignmentAssessmentModule() {
  delete require.cache[require.resolve(MODULE_PATH)];
  return require(MODULE_PATH);
}

/**
 * Installs the AssignmentController global mock with a startAssessmentRun spy.
 */
function installAssignmentControllerStub() {
  const startAssessmentRun = vi.fn();
  const AssignmentController = vi.fn(function StubAssignmentController() {
    this.startAssessmentRun = startAssessmentRun;
  });

  globalThis.AssignmentController = AssignmentController;

  return { AssignmentController, startAssessmentRun };
}

describe('Api/startAssessmentRun transport contract', () => {
  let originalAssignmentController;

  beforeEach(() => {
    originalAssignmentController = globalThis.AssignmentController;
  });

  afterEach(() => {
    delete require.cache[require.resolve(MODULE_PATH)];

    if (originalAssignmentController === undefined) {
      delete globalThis.AssignmentController;
    } else {
      globalThis.AssignmentController = originalAssignmentController;
    }

    vi.restoreAllMocks();
  });

  it('exports startAssessmentRun_ in Node test runtime', () => {
    installAssignmentControllerStub();
    const module = loadAssignmentAssessmentModule();
    expect(module).toEqual(
      expect.objectContaining({
        startAssessmentRun_: expect.any(Function),
      })
    );
  });

  it('throws ApiValidationError when parameters is not a plain object', () => {
    installAssignmentControllerStub();
    const { startAssessmentRun_ } = loadAssignmentAssessmentModule();

    expect(() => startAssessmentRun_('not-an-object')).toThrow(ApiValidationError);
    expect(() => startAssessmentRun_(null)).toThrow(ApiValidationError);
    expect(() => startAssessmentRun_(undefined)).toThrow(ApiValidationError);
    expect(() => startAssessmentRun_([])).toThrow(ApiValidationError);
  });

  it('throws Error when a required string field is missing', () => {
    installAssignmentControllerStub();
    const { startAssessmentRun_ } = loadAssignmentAssessmentModule();

    // Missing definitionKey
    expect(() => startAssessmentRun_({ assignmentId: 'a1', courseId: 'c1' })).toThrow(Error);

    // Missing assignmentId
    expect(() => startAssessmentRun_({ definitionKey: 'dk1', courseId: 'c1' })).toThrow(Error);

    // Missing courseId
    expect(() => startAssessmentRun_({ definitionKey: 'dk1', assignmentId: 'a1' })).toThrow(Error);
  });

  it('delegates to controller on valid input and returns result', () => {
    const { startAssessmentRun } = installAssignmentControllerStub();
    startAssessmentRun.mockReturnValue(null);

    const { startAssessmentRun_ } = loadAssignmentAssessmentModule();

    const result = startAssessmentRun_({
      definitionKey: 'def-algebra-baseline',
      assignmentId: 'assign-001',
      courseId: 'course-001',
    });

    expect(result).toBeNull();
    expect(startAssessmentRun).toHaveBeenCalledTimes(1);
    expect(startAssessmentRun).toHaveBeenCalledWith({
      definitionKey: 'def-algebra-baseline',
      assignmentId: 'assign-001',
      courseId: 'course-001',
    });
  });
});
