/**
 * AssignmentController.createDefinitionFromWizardInputs Tests
 *
 * Tests for the wizard Step 3 controller method that:
 * - Accepts assignmentId, referenceDocumentId, templateDocumentId
 * - Normalises URL/ID inputs
 * - Validates reference ≠ template
 * - Returns full AssignmentDefinition.toJSON() with tasks
 * - Does NOT start assessment triggers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupControllerTestMocks, cleanupControllerTestMocks } from '../helpers/mockFactories.js';
import { createTaskDefinition } from '../helpers/modelFactories.js';
import {
  createMockDefinition,
  setupMockEnsureDefinition,
  createTestController,
  buildDriveUrl,
  assertBasicResult,
  assertDefinitionShape,
  assertNormalisedIds,
  assertYearGroupKey,
  standardParams,
  STANDARD_DOCS,
} from '../helpers/wizardInputsTestHelpers.js';

let AssignmentController,
  AssignmentDefinition,
  DriveManager,
  ABLogger,
  ProgressTracker,
  Validate,
  ABClassController;
let mockABLogger, mockProgressTracker;

// Document type constants
const SLIDES = 'SLIDES';
const SHEETS = 'SHEETS';

// Standard timestamps
const TIMESTAMP = '2024-01-01T00:00:00.000Z';

/**
 * Create a complete test setup for success cases
 */
function setupSuccessTest({
  documentType = SLIDES,
  assignmentId = 'a1',
  courseId = 'course-1',
  assignmentTitle = 'Test Assignment',
  refFileId = STANDARD_DOCS.refId,
  tplFileId = STANDARD_DOCS.tplId,
  useUrls = false,
  yearGroupKey = 'year-group-10',
  abClass,
} = {}) {
  const referenceDocumentId = useUrls ? buildDriveUrl(refFileId, documentType) : refFileId;
  const templateDocumentId = useUrls ? buildDriveUrl(tplFileId, documentType) : tplFileId;

  const mockDefinition = createMockDefinition(vi, {
    primaryTitle: assignmentTitle,
    primaryTopic: 'Topic',
    yearGroupKey,
    documentType,
    referenceDocumentId: refFileId,
    templateDocumentId: tplFileId,
  });

  const mockOptions = { definition: mockDefinition };
  if (abClass) {
    mockOptions.abClass = abClass;
  }

  const mockSpy = setupMockEnsureDefinition(vi, mockOptions);

  return {
    assignmentId,
    courseId,
    assignmentTitle,
    refFileId,
    tplFileId,
    referenceDocumentId,
    templateDocumentId,
    mockDefinition,
    mockSpy,
    documentType,
  };
}

describe('AssignmentController.createDefinitionFromWizardInputs', () => {
  beforeEach(async () => {
    // Setup controller test mocks
    const mocks = setupControllerTestMocks(vi);
    mockABLogger = mocks.mockABLogger;
    mockProgressTracker = {
      logError: vi.fn(),
    };

    // Mock ABClassController.saveClass
    const ABClassControllerModule =
      await import('../../src/backend/y_controllers/ABClassController');
    ABClassController = ABClassControllerModule.default || ABClassControllerModule;
    vi.spyOn(ABClassController.prototype, 'saveClass');

    // Mock global singletons
    globalThis.ABLogger = {
      getInstance: vi.fn(() => mockABLogger),
    };
    globalThis.ProgressTracker = {
      getInstance: vi.fn(() => mockProgressTracker),
    };
    globalThis.ABClassController = ABClassController;

    // Dynamically import modules
    const [
      controllerModule,
      definitionModule,
      driveManagerModule,
      validateModule,
      abClassControllerModule,
    ] = await Promise.all([
      import('../../src/backend/y_controllers/AssignmentController'),
      import('../../src/backend/Models/AssignmentDefinition.js'),
      import('../../src/backend/GoogleDriveManager/DriveManager'),
      import('../../src/backend/Utils/Validate.js'),
      import('../../src/backend/y_controllers/ABClassController'),
    ]);

    AssignmentController = controllerModule.default || controllerModule;
    AssignmentDefinition = definitionModule.AssignmentDefinition;
    DriveManager = driveManagerModule.default || driveManagerModule;
    Validate = validateModule.Validate;
    ABClassController = abClassControllerModule.default || abClassControllerModule;

    // Make classes available globally (GAS style)
    globalThis.DriveManager = DriveManager;
    globalThis.Validate = Validate;
    globalThis.AssignmentController = AssignmentController;
    globalThis.AssignmentDefinition = AssignmentDefinition;
    globalThis.ABClassController = ABClassController;
  });

  afterEach(() => {
    cleanupControllerTestMocks();
    vi.restoreAllMocks();
  });

  // ========================================================================
  // Success cases - Slides
  // ========================================================================

  describe('Success cases - Slides', () => {
    it('returns full AssignmentDefinition for Slides with URL inputs (normalised)', () => {
      const {
        assignmentId = 'assign-slides-456',
        courseId,
        assignmentTitle = 'Slides with URLs',
        refFileId = STANDARD_DOCS.slidesRef,
        tplFileId = STANDARD_DOCS.slidesTpl,
        referenceDocumentId,
        templateDocumentId,
        mockSpy,
      } = setupSuccessTest({
        documentType: SLIDES,
        assignmentId: 'assign-slides-456',
        assignmentTitle: 'Slides with URLs',
        refFileId: STANDARD_DOCS.slidesRef,
        tplFileId: STANDARD_DOCS.slidesTpl,
        useUrls: true,
      });

      const controller = createTestController();
      const result = controller.createDefinitionFromWizardInputs({
        assignmentId,
        courseId,
        assignmentTitle,
        referenceDocumentId,
        templateDocumentId,
      });

      assertBasicResult(expect, result, SLIDES);
      assertNormalisedIds(expect, mockSpy, refFileId, tplFileId);
    });
  });

  // ========================================================================
  // Success cases - Sheets
  // ========================================================================

  describe('Success cases - Sheets', () => {
    it('returns full AssignmentDefinition with tasks for Sheets reference/template (raw IDs)', () => {
      const { courseId, referenceDocumentId, templateDocumentId } = setupSuccessTest({
        documentType: SHEETS,
        assignmentId: 'assign-sheets-789',
        assignmentTitle: 'Test Sheets Assignment',
        refFileId: STANDARD_DOCS.sheetsRef,
        tplFileId: STANDARD_DOCS.sheetsTpl,
        useUrls: false,
      });

      const controller = createTestController();
      const result = controller.createDefinitionFromWizardInputs({
        assignmentId: 'assign-sheets-789',
        courseId,
        assignmentTitle: 'Test Sheets Assignment',
        referenceDocumentId,
        templateDocumentId,
      });

      assertBasicResult(expect, result, SHEETS);
    });

    it('returns full AssignmentDefinition for Sheets with URL inputs (normalised)', () => {
      const {
        assignmentId = 'assign-sheets-012',
        courseId,
        assignmentTitle = 'Sheets with URLs',
        refFileId = STANDARD_DOCS.sheetsRef,
        tplFileId = STANDARD_DOCS.sheetsTpl,
        referenceDocumentId,
        templateDocumentId,
        mockSpy,
      } = setupSuccessTest({
        documentType: SHEETS,
        assignmentId: 'assign-sheets-012',
        assignmentTitle: 'Sheets with URLs',
        refFileId: STANDARD_DOCS.sheetsRef,
        tplFileId: STANDARD_DOCS.sheetsTpl,
        useUrls: true,
      });

      const controller = createTestController();
      const result = controller.createDefinitionFromWizardInputs({
        assignmentId,
        courseId,
        assignmentTitle,
        referenceDocumentId,
        templateDocumentId,
      });

      assertBasicResult(expect, result, SHEETS);
      assertNormalisedIds(expect, mockSpy, refFileId, tplFileId);
    });
  });

  // ========================================================================
  // Contract verification
  // ========================================================================

  describe('Contract verification', () => {
    it('response contains tasks (not null)', () => {
      const { courseId } = setupSuccessTest({});

      const controller = createTestController();
      const result = controller.createDefinitionFromWizardInputs({
        ...standardParams(),
        courseId,
      });

      expect(result.tasks).not.toBeNull();
      expect(result.tasks).toBeDefined();
      expect(typeof result.tasks).toBe('object');
    });

    it('response contains definitionKey', () => {
      const { courseId } = setupSuccessTest({});

      const controller = createTestController();
      const result = controller.createDefinitionFromWizardInputs({
        ...standardParams(),
        courseId,
      });

      expect(result.definitionKey).toBeDefined();
      expect(typeof result.definitionKey).toBe('string');
    });

    it('response is valid AssignmentDefinition JSON shape', () => {
      const { courseId } = setupSuccessTest({});

      const controller = createTestController();
      const result = controller.createDefinitionFromWizardInputs({
        ...standardParams(),
        courseId,
      });

      assertDefinitionShape(expect, result);
    });
  });

  // ========================================================================
  // Failure cases - parameter validation
  // ========================================================================

  describe('Failure cases - parameter validation', () => {
    const baseParams = standardParams();

    it('throws error when assignmentId is missing', () => {
      const params = { ...baseParams };
      delete params.assignmentId;

      expect(() => {
        const controller = createTestController();
        controller.createDefinitionFromWizardInputs(params);
      }).toThrow(/assignmentId/);
    });

    it('throws error when courseId is missing', () => {
      const params = { ...baseParams };
      delete params.courseId;

      expect(() => {
        const controller = createTestController();
        controller.createDefinitionFromWizardInputs(params);
      }).toThrow(/courseId/);
    });

    it('throws error when referenceDocumentId is missing', () => {
      const params = { ...baseParams };
      delete params.referenceDocumentId;

      expect(() => {
        const controller = createTestController();
        controller.createDefinitionFromWizardInputs(params);
      }).toThrow(/referenceDocumentId/);
    });

    it('throws error when templateDocumentId is missing', () => {
      const params = { ...baseParams };
      delete params.templateDocumentId;

      expect(() => {
        const controller = createTestController();
        controller.createDefinitionFromWizardInputs(params);
      }).toThrow(/templateDocumentId/);
    });
  });

  // ========================================================================
  // Failure cases - identical documents
  // ========================================================================

  describe('Failure cases - identical documents', () => {
    const sameId = STANDARD_DOCS.refId;

    it('throws error when reference and template IDs are identical (raw IDs)', () => {
      expect(() => {
        const controller = createTestController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          courseId: 'course-1',
          assignmentTitle: 'Title',
          referenceDocumentId: sameId,
          templateDocumentId: sameId,
        });
      }).toThrow(/Reference and template documents must be different/);

      expect(mockProgressTracker.logError).toHaveBeenCalledWith(
        'Reference and template documents must be different.',
        expect.objectContaining({
          referenceDocumentId: sameId,
          templateDocumentId: sameId,
        })
      );
    });

    it('throws error when reference and template are identical after normalisation (URLs)', () => {
      const referenceUrl = buildDriveUrl(sameId, SLIDES);
      const templateUrl = buildDriveUrl(sameId, SLIDES) + '?usp=sharing';

      expect(() => {
        const controller = createTestController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          courseId: 'course-1',
          assignmentTitle: 'Title',
          referenceDocumentId: referenceUrl,
          templateDocumentId: templateUrl,
        });
      }).toThrow(/Reference and template documents must be different/);

      expect(mockProgressTracker.logError).toHaveBeenCalledWith(
        'Reference and template documents must be different.',
        expect.objectContaining({
          referenceDocumentId: sameId,
          templateDocumentId: sameId,
        })
      );
    });

    it('throws error when reference URL and template ID resolve to same file', () => {
      const referenceUrl = buildDriveUrl(STANDARD_DOCS.tplId, SHEETS);

      expect(() => {
        const controller = createTestController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          courseId: 'course-1',
          assignmentTitle: 'Title',
          referenceDocumentId: referenceUrl,
          templateDocumentId: STANDARD_DOCS.tplId,
        });
      }).toThrow(/Reference and template documents must be different/);
    });
  });

  // ========================================================================
  // Failure cases - invalid Drive IDs
  // ========================================================================

  describe('Failure cases - invalid Drive IDs', () => {
    it('throws error when reference ID is invalid (malformed URL)', () => {
      expect(() => {
        const controller = createTestController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          courseId: 'course-1',
          assignmentTitle: 'Title',
          referenceDocumentId: 'https://invalid-url',
          templateDocumentId: STANDARD_DOCS.tplId,
        });
      }).toThrow(/Invalid Google Drive URL or file ID/);
    });

    it('throws error when template ID is invalid (too short)', () => {
      expect(() => {
        const controller = createTestController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          courseId: 'course-1',
          assignmentTitle: 'Title',
          referenceDocumentId: STANDARD_DOCS.refId,
          templateDocumentId: 'too-short',
        });
      }).toThrow(/Invalid Google Drive URL or file ID/);
    });
  });

  // ========================================================================
  // Failure cases - controller errors
  // ========================================================================

  describe('Failure cases - controller errors', () => {
    it('throws error when documents have mismatched types', () => {
      setupMockEnsureDefinition(vi, {
        implementation: () => {
          throw new Error('Document type mismatch: reference is SLIDES but template is SHEETS');
        },
      });

      expect(() => {
        const controller = createTestController();
        controller.createDefinitionFromWizardInputs(standardParams());
      }).toThrow(/Document type mismatch/);

      expect(mockABLogger.error).toHaveBeenCalledWith(
        'Error in AssignmentController.createDefinitionFromWizardInputs:',
        expect.stringContaining('Document type mismatch')
      );
    });

    it('throws error when assignment lacks topic', () => {
      setupMockEnsureDefinition(vi, {
        implementation: () => {
          throw new Error('Assignment must have a topic');
        },
      });

      expect(() => {
        const controller = createTestController();
        controller.createDefinitionFromWizardInputs(standardParams());
      }).toThrow(/Assignment must have a topic/);
    });

    it('throws when yearGroupKey resolution fails', () => {
      setupMockEnsureDefinition(vi, {
        implementation: () => {
          throw new Error(
            'yearGroupKey resolution failed: both input yearGroupKey and abClass.yearGroupKey are null'
          );
        },
      });

      const controller = createTestController();

      expect(() => {
        controller.createDefinitionFromWizardInputs({
          ...standardParams(),
          yearGroupKey: null,
        });
      }).toThrow(/yearGroupKey.*resolution.*failed/i);

      expect(ABClassController.prototype.saveClass).not.toHaveBeenCalled();
    });

    it('rethrows and logs controller errors', () => {
      const controllerError = new Error('Controller internal error');

      setupMockEnsureDefinition(vi, {
        implementation: () => {
          throw controllerError;
        },
      });

      expect(() => {
        const controller = createTestController();
        controller.createDefinitionFromWizardInputs(standardParams());
      }).toThrow('Controller internal error');

      expect(mockABLogger.error).toHaveBeenCalledWith(
        'Error in AssignmentController.createDefinitionFromWizardInputs:',
        'Controller internal error'
      );
    });

    // ========================================================================
    // Section 3 - Red Phase: Failing tests for yearGroupKey parameter migration
    // ========================================================================

    it('should accept yearGroupKey: string | null parameter instead of yearGroup', () => {
      const { courseId, mockSpy } = setupSuccessTest({
        assignmentId: 'assign-slides-456',
        assignmentTitle: 'Slides with yearGroupKey',
        refFileId: STANDARD_DOCS.slidesRef,
        tplFileId: STANDARD_DOCS.slidesTpl,
        yearGroupKey: 'year-group-10',
        abClass: { classId: 'course-1', yearGroupKey: 'year-group-10' },
      });

      const controller = createTestController();
      const result = controller.createDefinitionFromWizardInputs({
        assignmentId: 'assign-slides-456',
        courseId,
        assignmentTitle: 'Slides with yearGroupKey',
        referenceDocumentId: STANDARD_DOCS.slidesRef,
        templateDocumentId: STANDARD_DOCS.slidesTpl,
        yearGroupKey: 'year-group-10',
      });

      assertBasicResult(expect, result, SLIDES);
      assertYearGroupKey(expect, mockSpy, 'year-group-10');
    });

    it('should pass yearGroupKey to ensureDefinitionFromInputs', () => {
      const { courseId, mockSpy } = setupSuccessTest({
        assignmentId: 'assign-test-001',
        assignmentTitle: 'Test with yearGroupKey',
        refFileId: STANDARD_DOCS.refId,
        tplFileId: STANDARD_DOCS.tplId,
        yearGroupKey: 'year-group-11',
        abClass: { classId: 'course-1', yearGroupKey: 'year-group-10' },
      });

      const controller = createTestController();
      controller.createDefinitionFromWizardInputs({
        assignmentId: 'assign-test-001',
        courseId,
        assignmentTitle: 'Test with yearGroupKey',
        referenceDocumentId: STANDARD_DOCS.refId,
        templateDocumentId: STANDARD_DOCS.tplId,
        yearGroupKey: 'year-group-11',
      });

      assertYearGroupKey(expect, mockSpy, 'year-group-11');
    });

    it('should not set abClass.yearGroup when yearGroupKey is provided', () => {
      const { courseId } = setupSuccessTest({
        assignmentId: 'assign-test-002',
        assignmentTitle: 'Test without modifying yearGroup',
        refFileId: STANDARD_DOCS.refId,
        tplFileId: STANDARD_DOCS.tplId,
        yearGroupKey: 'year-group-12',
        abClass: { classId: 'course-1', yearGroupKey: 'year-group-10' },
      });

      const controller = createTestController();
      controller.createDefinitionFromWizardInputs({
        assignmentId: 'assign-test-002',
        courseId,
        assignmentTitle: 'Test without modifying yearGroup',
        referenceDocumentId: STANDARD_DOCS.refId,
        templateDocumentId: STANDARD_DOCS.tplId,
        yearGroupKey: 'year-group-12',
      });

      expect(ABClassController.prototype.saveClass).not.toHaveBeenCalled();
    });

    it('should pass yearGroupKey: null when no yearGroupKey provided', () => {
      const { courseId, mockSpy } = setupSuccessTest({
        assignmentId: 'assign-test-003',
        assignmentTitle: 'Test with null yearGroupKey',
        refFileId: STANDARD_DOCS.refId,
        tplFileId: STANDARD_DOCS.tplId,
        yearGroupKey: 'year-group-10',
        abClass: { classId: 'course-1', yearGroupKey: 'year-group-10' },
      });

      const controller = createTestController();
      controller.createDefinitionFromWizardInputs({
        assignmentId: 'assign-test-003',
        courseId,
        assignmentTitle: 'Test with null yearGroupKey',
        referenceDocumentId: STANDARD_DOCS.refId,
        templateDocumentId: STANDARD_DOCS.tplId,
        yearGroupKey: null,
      });

      assertYearGroupKey(expect, mockSpy, null);
    });

    it('should log invocation with yearGroupKey parameter', () => {
      const { courseId } = setupSuccessTest({
        assignmentId: 'assign-test-004',
        assignmentTitle: 'Test logging with yearGroupKey',
        refFileId: STANDARD_DOCS.refId,
        tplFileId: STANDARD_DOCS.tplId,
        yearGroupKey: 'year-group-13',
      });

      const controller = createTestController();
      controller.createDefinitionFromWizardInputs({
        assignmentId: 'assign-test-004',
        courseId,
        assignmentTitle: 'Test logging with yearGroupKey',
        referenceDocumentId: STANDARD_DOCS.refId,
        templateDocumentId: STANDARD_DOCS.tplId,
        yearGroupKey: 'year-group-13',
      });

      expect(mockABLogger.info).toHaveBeenCalledWith(
        'AssignmentController.createDefinitionFromWizardInputs invoked:',
        expect.objectContaining({
          assignmentId: 'assign-test-004',
          assignmentTitle: 'Test logging with yearGroupKey',
          referenceDocumentId: STANDARD_DOCS.refId,
          templateDocumentId: STANDARD_DOCS.tplId,
          yearGroupKey: 'year-group-13',
        })
      );
    });
  });

  // ========================================================================
  // Logging behaviour
  // ========================================================================

  describe('Logging behaviour', () => {
    it('logs invocation with all parameters', () => {
      const { courseId } = setupSuccessTest({});

      const controller = createTestController();
      controller.createDefinitionFromWizardInputs({
        ...standardParams(),
        courseId,
      });

      expect(mockABLogger.info).toHaveBeenCalledWith(
        'AssignmentController.createDefinitionFromWizardInputs invoked:',
        expect.objectContaining({
          assignmentId: 'a1',
          assignmentTitle: 'Title',
          courseId: 'course-1',
          referenceDocumentId: STANDARD_DOCS.refId,
          templateDocumentId: STANDARD_DOCS.tplId,
        })
      );
    });
  });
});
