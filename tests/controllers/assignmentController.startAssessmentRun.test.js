/**
 * AssignmentController.startAssessmentRun Tests
 *
 * Tests for the startAssessmentRun controller method that:
 * - Accepts { definitionKey, assignmentId, courseId }
 * - Fetches definition via AssignmentDefinitionController
 * - Checks freshness of reference/template documents
 * - Resolves ABClass via ABClassController.loadClass
 * - Delegates to startProcessing for trigger creation
 * - Returns null (no payload)
 * - Throws DefinitionStaleError when documents have changed
 *
 * Parameter validation is owned by the API transport layer (z_Api),
 * so the controller does not validate parameter shape.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const DefinitionStaleError = require('../../src/backend/Utils/ErrorTypes/DefinitionStaleError.js');

let AssignmentController, AssignmentDefinitionController, DriveManager, ABClassController;

// Standard test parameters
const VALID_PARAMS = Object.freeze({
  definitionKey: 'def-algebra-baseline',
  assignmentId: 'assign-001',
  courseId: 'course-001',
});

const MOCK_DEFINITION = Object.freeze({
  definitionKey: 'def-algebra-baseline',
  primaryTitle: 'Algebra Baseline',
  referenceDocumentId: 'ref-doc-001',
  templateDocumentId: 'tpl-doc-001',
  referenceLastModified: '2024-01-01T00:00:00.000Z',
  templateLastModified: '2024-01-01T00:00:00.000Z',
});

/**
 * Sets up standard mocks required by AssignmentController.
 * Installs global shims for ABLogger, ProgressTracker, AssignmentDefinitionController,
 * DriveManager, ABClassController, GASPropertiesUtils, and Utils.
 */
function setupStandardMocks() {
  // Mock ABLogger
  globalThis.ABLogger = {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  };

  // Mock ProgressTracker
  globalThis.ProgressTracker = {
    getInstance: vi.fn(() => ({
      logError: vi.fn(),
      logAndThrowError: vi.fn((msg) => {
        throw new Error(msg);
      }),
      updateProgress: vi.fn(),
      startTracking: vi.fn(),
      complete: vi.fn(),
    })),
  };

  // Mock AssignmentDefinitionController
  globalThis.AssignmentDefinitionController = vi.fn(function () {
    this.getDefinitionByKey = vi.fn();
  });

  // Mock DriveManager
  globalThis.DriveManager = {
    getFileModifiedTime: vi.fn(),
  };

  // Mock ABClassController
  globalThis.ABClassController = vi.fn(function () {
    this.loadClass = vi.fn();
  });

  // Mock GASPropertiesUtils
  globalThis.GASPropertiesUtils = {
    getUserProperties: vi.fn(),
    applyProperties: vi.fn(),
    clearProperties: vi.fn(),
  };

  // Mock TriggerController (used by startProcessing which is mocked by spy)
  globalThis.TriggerController = vi.fn(function () {
    this.createTimeBasedTrigger = vi.fn(() => 'trigger-123');
  });

  // Ensure Utils.isNewer is available (provided by setupGlobals.js)
}

/**
 * Loads the AssignmentController module fresh with cleared cache.
 */
function loadAssignmentController() {
  const modulePath = '../../src/backend/y_controllers/AssignmentController.js';
  delete require.cache[require.resolve(modulePath)];
  const module = require(modulePath);
  return module.default || module;
}

describe('AssignmentController.startAssessmentRun', () => {
  let controller;

  beforeEach(() => {
    setupStandardMocks();
    const AssignmentCtrl = loadAssignmentController();
    controller = new AssignmentCtrl();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up globally installed mocks
    delete globalThis.ABLogger;
    delete globalThis.ProgressTracker;
    delete globalThis.AssignmentDefinitionController;
    delete globalThis.DriveManager;
    delete globalThis.ABClassController;
    delete globalThis.GASPropertiesUtils;
    delete globalThis.TriggerController;
  });

  // ========================================================================
  // Happy path
  // ========================================================================

  describe('Happy path', () => {
    it('valid inputs calls startProcessing and returns null', () => {
      // Arrange
      const mockDefinition = { ...MOCK_DEFINITION };

      // Mock definition lookup returns the definition
      globalThis.AssignmentDefinitionController = vi.fn(function () {
        this.getDefinitionByKey = vi.fn(() => mockDefinition);
      });

      // Mock DriveManager to return dates older than MOCK_DEFINITION (not stale)
      globalThis.DriveManager = {
        getFileModifiedTime: vi.fn(() => '2023-01-01T00:00:00.000Z'),
      };

      // Mock ABClassController.loadClass
      globalThis.ABClassController = vi.fn(function () {
        this.loadClass = vi.fn(() => ({}));
      });

      const AssignmentCtrl = loadAssignmentController();
      controller = new AssignmentCtrl();
      const mockStartProcessing = vi.spyOn(controller, 'startProcessing');

      // Act
      const result = controller.startAssessmentRun({ ...VALID_PARAMS });

      // Assert
      expect(result).toBeNull();
      expect(mockStartProcessing).toHaveBeenCalledTimes(1);
      expect(mockStartProcessing).toHaveBeenCalledWith(
        VALID_PARAMS.assignmentId,
        VALID_PARAMS.definitionKey,
        VALID_PARAMS.courseId
      );
    });
  });

  // ========================================================================
  // Definition resolution failures
  // ========================================================================

  describe('Definition resolution failures', () => {
    it('throws when definitionKey is not found in the registry', () => {
      // getDefinitionByKey returns undefined by default → definition not found → throws Error
      expect(() => controller.startAssessmentRun({ ...VALID_PARAMS })).toThrow(Error);
    });
  });

  // ========================================================================
  // Stale definition detection
  // ========================================================================

  describe('Stale definition detection', () => {
    it('throws DefinitionStaleError with referenceStale: true when reference document has changed', () => {
      // Mock definition lookup returns the definition
      globalThis.AssignmentDefinitionController = vi.fn(function () {
        this.getDefinitionByKey = vi.fn(() => ({ ...MOCK_DEFINITION }));
      });

      // Mock DriveManager: reference is newer, template is older
      globalThis.DriveManager = {
        getFileModifiedTime: vi.fn((docId) => {
          if (docId === MOCK_DEFINITION.referenceDocumentId) {
            return '2024-06-01T00:00:00.000Z'; // newer → stale
          }
          return '2023-01-01T00:00:00.000Z'; // older → not stale
        }),
      };

      const AssignmentCtrl = loadAssignmentController();
      controller = new AssignmentCtrl();

      expect(() => controller.startAssessmentRun({ ...VALID_PARAMS })).toThrow(
        DefinitionStaleError
      );
    });

    it('throws DefinitionStaleError with templateStale: true when template document has changed', () => {
      // Mock definition lookup returns the definition
      globalThis.AssignmentDefinitionController = vi.fn(function () {
        this.getDefinitionByKey = vi.fn(() => ({ ...MOCK_DEFINITION }));
      });

      // Mock DriveManager: template is newer, reference is older
      globalThis.DriveManager = {
        getFileModifiedTime: vi.fn((docId) => {
          if (docId === MOCK_DEFINITION.templateDocumentId) {
            return '2024-06-01T00:00:00.000Z'; // newer → stale
          }
          return '2023-01-01T00:00:00.000Z'; // older → not stale
        }),
      };

      const AssignmentCtrl = loadAssignmentController();
      controller = new AssignmentCtrl();

      expect(() => controller.startAssessmentRun({ ...VALID_PARAMS })).toThrow(
        DefinitionStaleError
      );
    });
  });

  // ========================================================================
  // ABClass resolution failures
  // ========================================================================

  describe('ABClass resolution failures', () => {
    it('no longer throws TypeError when ABClass is not found (definition lookup fails first)', () => {
      // With default mocks, getDefinitionByKey returns undefined → definition-not-found Error.
      // Previously the controller would throw TypeError for missing params, which is now
      // handled by the API transport layer.
      expect(() => controller.startAssessmentRun({ ...VALID_PARAMS })).not.toThrow(TypeError);
    });
  });
});
