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

let AssignmentController, AssignmentDefinition, DriveManager, ABLogger, ProgressTracker, Validate;
let mockABLogger, mockProgressTracker;

describe('AssignmentController.createDefinitionFromWizardInputs', () => {
  beforeEach(async () => {
    // Setup controller test mocks
    const mocks = setupControllerTestMocks(vi);
    mockABLogger = mocks.mockABLogger;
    mockProgressTracker = {
      logError: vi.fn(),
    };

    // Mock global singletons
    globalThis.ABLogger = {
      getInstance: vi.fn(() => mockABLogger),
    };
    globalThis.ProgressTracker = {
      getInstance: vi.fn(() => mockProgressTracker),
    };

    // Dynamically import modules
    const [
      controllerModule,
      definitionModule,
      driveManagerModule,
      validateModule,
      abClassControllerModule,
    ] = await Promise.all([
      import('../../src/AdminSheet/y_controllers/AssignmentController.js'),
      import('../../src/AdminSheet/Models/AssignmentDefinition.js'),
      import('../../src/AdminSheet/GoogleDriveManager/DriveManager.js'),
      import('../../src/AdminSheet/Utils/Validate.js'),
      import('../../src/AdminSheet/y_controllers/ABClassController.js'),
    ]);

    AssignmentController = controllerModule.default || controllerModule;
    AssignmentDefinition = definitionModule.AssignmentDefinition;
    DriveManager = driveManagerModule.default || driveManagerModule;
    Validate = validateModule.Validate; // Note: destructured from module
    ABClassController = abClassControllerModule.default || abClassControllerModule;

    // Make classes available globally (GAS style)
    globalThis.DriveManager = DriveManager;
    globalThis.Validate = Validate;
    globalThis.AssignmentController = AssignmentController;
    globalThis.AssignmentDefinition = AssignmentDefinition;
    globalThis.ABClassController = ABClassController;
  });

  describe('Success cases - Slides', () => {
    it('returns full AssignmentDefinition for Slides with URL inputs (normalised)', () => {
      const assignmentId = 'assign-slides-456';
      const assignmentTitle = 'Slides with URLs';
      const refFileId = '3zX8wV7uT6sR5qP4oN3mL2kJ1iH0gF9ef';
      const tplFileId = '4aB3cD2eF1gH0iJ9kL8mN7oP6qR5sT4uv';
      const referenceUrl = `https://docs.google.com/presentation/d/${refFileId}/edit`;
      const templateUrl = `https://docs.google.com/presentation/d/${tplFileId}/edit`;

      const mockTask = createTaskDefinition({ index: 0 });
      const mockDefinition = new AssignmentDefinition({
        primaryTitle: assignmentTitle,
        primaryTopic: 'Topic',
        yearGroup: null,
        documentType: 'SLIDES',
        referenceDocumentId: refFileId,
        templateDocumentId: tplFileId,
        tasks: { task_0: mockTask },
        referenceLastModified: '2024-01-01T00:00:00.000Z',
        templateLastModified: '2024-01-01T00:00:00.000Z',
      });

      vi.spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs').mockReturnValue({
        definition: mockDefinition,
      });

      const controller = new AssignmentController();
      const result = controller.createDefinitionFromWizardInputs({
        assignmentId,
        assignmentTitle,
        referenceDocumentId: referenceUrl,
        templateDocumentId: templateUrl,
      });

      expect(result).toBeDefined();
      expect(result.documentType).toBe('SLIDES');
      expect(result.tasks).toBeDefined();

      // Verify normalisation happened - controller should be called with file IDs
      expect(AssignmentController.prototype.ensureDefinitionFromInputs).toHaveBeenCalledWith(
        expect.objectContaining({
          documentIds: {
            referenceDocumentId: refFileId,
            templateDocumentId: tplFileId,
          },
        })
      );
    });
  });

  describe('Success cases - Sheets', () => {
    it('returns full AssignmentDefinition with tasks for Sheets reference/template (raw IDs)', () => {
      const assignmentId = 'assign-sheets-789';
      const assignmentTitle = 'Test Sheets Assignment';
      const referenceDocumentId = '5aB4cD3eF2gH1iJ0kL9mN8oP7qR6sT5uv';
      const templateDocumentId = '6bC5dE4fG3hI2jK1lM0nO9pQ8rS7tU6vw';

      const mockTask = createTaskDefinition({ index: 0 });
      const mockDefinition = new AssignmentDefinition({
        primaryTitle: assignmentTitle,
        primaryTopic: 'Sheets Topic',
        yearGroup: null,
        documentType: 'SHEETS',
        referenceDocumentId,
        templateDocumentId,
        tasks: { task_0: mockTask },
        referenceLastModified: '2024-01-01T00:00:00.000Z',
        templateLastModified: '2024-01-01T00:00:00.000Z',
      });

      vi.spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs').mockReturnValue({
        definition: mockDefinition,
      });

      const controller = new AssignmentController();
      const result = controller.createDefinitionFromWizardInputs({
        assignmentId,
        assignmentTitle,
        referenceDocumentId,
        templateDocumentId,
      });

      expect(result).toBeDefined();
      expect(result.documentType).toBe('SHEETS');
      expect(result.tasks).toBeDefined();
    });

    it('returns full AssignmentDefinition for Sheets with URL inputs (normalised)', () => {
      const assignmentId = 'assign-sheets-012';
      const assignmentTitle = 'Sheets with URLs';
      const refFileId = '7cD6eF5gH4iJ3kL2mN1oP0qR9sT8uV7wx';
      const tplFileId = '8dE7fG6hI5jK4lM3nO2pQ1rS0tU9vW8xy';
      const referenceUrl = `https://docs.google.com/spreadsheets/d/${refFileId}/edit`;
      const templateUrl = `https://docs.google.com/spreadsheets/d/${tplFileId}/edit`;

      const mockTask = createTaskDefinition({ index: 0 });
      const mockDefinition = new AssignmentDefinition({
        primaryTitle: assignmentTitle,
        primaryTopic: 'Topic',
        yearGroup: null,
        documentType: 'SHEETS',
        referenceDocumentId: refFileId,
        templateDocumentId: tplFileId,
        tasks: { task_0: mockTask },
        referenceLastModified: '2024-01-01T00:00:00.000Z',
        templateLastModified: '2024-01-01T00:00:00.000Z',
      });

      vi.spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs').mockReturnValue({
        definition: mockDefinition,
      });

      const controller = new AssignmentController();
      const result = controller.createDefinitionFromWizardInputs({
        assignmentId,
        assignmentTitle,
        referenceDocumentId: referenceUrl,
        templateDocumentId: templateUrl,
      });

      expect(result).toBeDefined();
      expect(result.documentType).toBe('SHEETS');

      // Verify normalisation
      expect(AssignmentController.prototype.ensureDefinitionFromInputs).toHaveBeenCalledWith(
        expect.objectContaining({
          documentIds: {
            referenceDocumentId: refFileId,
            templateDocumentId: tplFileId,
          },
        })
      );
    });
  });

  describe('Contract verification', () => {
    it('response contains tasks (not null)', () => {
      const mockTask = createTaskDefinition({ index: 0 });
      const mockDefinition = new AssignmentDefinition({
        primaryTitle: 'Title',
        primaryTopic: 'Topic',
        yearGroup: null,
        documentType: 'SLIDES',
        referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
        templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
        tasks: { task_0: mockTask },
        referenceLastModified: '2024-01-01T00:00:00.000Z',
        templateLastModified: '2024-01-01T00:00:00.000Z',
      });

      vi.spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs').mockReturnValue({
        definition: mockDefinition,
      });

      const controller = new AssignmentController();
      const result = controller.createDefinitionFromWizardInputs({
        assignmentId: 'a1',
        assignmentTitle: 'Title',
        referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
        templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
      });

      expect(result.tasks).not.toBeNull();
      expect(result.tasks).toBeDefined();
      expect(typeof result.tasks).toBe('object');
    });

    it('response contains definitionKey', () => {
      const mockTask = createTaskDefinition({ index: 0 });
      const mockDefinition = new AssignmentDefinition({
        primaryTitle: 'Title',
        primaryTopic: 'Topic',
        yearGroup: null,
        documentType: 'SLIDES',
        referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
        templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
        tasks: { task_0: mockTask },
        referenceLastModified: '2024-01-01T00:00:00.000Z',
        templateLastModified: '2024-01-01T00:00:00.000Z',
      });

      vi.spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs').mockReturnValue({
        definition: mockDefinition,
      });

      const controller = new AssignmentController();
      const result = controller.createDefinitionFromWizardInputs({
        assignmentId: 'a1',
        assignmentTitle: 'Title',
        referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
        templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
      });

      expect(result.definitionKey).toBeDefined();
      expect(typeof result.definitionKey).toBe('string');
    });

    it('response is valid AssignmentDefinition JSON shape', () => {
      const mockTask = createTaskDefinition({ index: 0 });
      const mockDefinition = new AssignmentDefinition({
        primaryTitle: 'Title',
        primaryTopic: 'Topic',
        yearGroup: null,
        documentType: 'SLIDES',
        referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
        templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
        tasks: { task_0: mockTask },
        referenceLastModified: '2024-01-01T00:00:00.000Z',
        templateLastModified: '2024-01-01T00:00:00.000Z',
      });

      vi.spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs').mockReturnValue({
        definition: mockDefinition,
      });

      const controller = new AssignmentController();
      const result = controller.createDefinitionFromWizardInputs({
        assignmentId: 'a1',
        assignmentTitle: 'Title',
        referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
        templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
      });

      // Verify essential AssignmentDefinition.toJSON() shape
      expect(result).toHaveProperty('primaryTitle');
      expect(result).toHaveProperty('primaryTopic');
      expect(result).toHaveProperty('documentType');
      expect(result).toHaveProperty('referenceDocumentId');
      expect(result).toHaveProperty('templateDocumentId');
      expect(result).toHaveProperty('tasks');
      expect(result).toHaveProperty('definitionKey');
    });
  });

  describe('Failure cases - parameter validation', () => {
    it('throws error when assignmentId is missing', () => {
      expect(() => {
        const controller = new AssignmentController();
        controller.createDefinitionFromWizardInputs({
          assignmentTitle: 'Title',
          referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
          templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
        });
      }).toThrow(/assignmentId/);
    });

    it('throws error when referenceDocumentId is missing', () => {
      expect(() => {
        const controller = new AssignmentController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          assignmentTitle: 'Title',
          templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
        });
      }).toThrow(/referenceDocumentId/);
    });

    it('throws error when templateDocumentId is missing', () => {
      expect(() => {
        const controller = new AssignmentController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          assignmentTitle: 'Title',
          referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
        });
      }).toThrow(/templateDocumentId/);
    });
  });

  describe('Failure cases - identical documents', () => {
    it('throws error when reference and template IDs are identical (raw IDs)', () => {
      const sameId = '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv';

      expect(() => {
        const controller = new AssignmentController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
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
      const sameFileId = '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv';
      const referenceUrl = `https://docs.google.com/presentation/d/${sameFileId}/edit`;
      const templateUrl = `https://docs.google.com/presentation/d/${sameFileId}/edit?usp=sharing`;

      expect(() => {
        const controller = new AssignmentController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          assignmentTitle: 'Title',
          referenceDocumentId: referenceUrl,
          templateDocumentId: templateUrl,
        });
      }).toThrow(/Reference and template documents must be different/);

      expect(mockProgressTracker.logError).toHaveBeenCalledWith(
        'Reference and template documents must be different.',
        expect.objectContaining({
          referenceDocumentId: sameFileId,
          templateDocumentId: sameFileId,
        })
      );
    });

    it('throws error when reference URL and template ID resolve to same file', () => {
      const sameFileId = '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef';
      const referenceUrl = `https://docs.google.com/spreadsheets/d/${sameFileId}/edit`;

      expect(() => {
        const controller = new AssignmentController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          assignmentTitle: 'Title',
          referenceDocumentId: referenceUrl,
          templateDocumentId: sameFileId,
        });
      }).toThrow(/Reference and template documents must be different/);
    });
  });

  describe('Failure cases - invalid Drive IDs', () => {
    it('throws error when reference ID is invalid (malformed URL)', () => {
      expect(() => {
        const controller = new AssignmentController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          assignmentTitle: 'Title',
          referenceDocumentId: 'https://invalid-url',
          templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
        });
      }).toThrow(/Invalid Google Drive URL or file ID/);
    });

    it('throws error when template ID is invalid (too short)', () => {
      expect(() => {
        const controller = new AssignmentController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          assignmentTitle: 'Title',
          referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
          templateDocumentId: 'too-short',
        });
      }).toThrow(/Invalid Google Drive URL or file ID/);
    });
  });

  describe('Failure cases - controller errors', () => {
    it('throws error when documents have mismatched types', () => {
      // Mock ensureDefinitionFromInputs to throw mismatched type error
      vi.spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs').mockImplementation(
        () => {
          throw new Error('Document type mismatch: reference is SLIDES but template is SHEETS');
        }
      );

      expect(() => {
        const controller = new AssignmentController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          assignmentTitle: 'Title',
          referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
          templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
        });
      }).toThrow(/Document type mismatch/);

      expect(mockABLogger.error).toHaveBeenCalledWith(
        'Error in AssignmentController.createDefinitionFromWizardInputs:',
        expect.stringContaining('Document type mismatch')
      );
    });

    it('throws error when assignment lacks topic', () => {
      vi.spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs').mockImplementation(
        () => {
          throw new Error('Assignment must have a topic');
        }
      );

      expect(() => {
        const controller = new AssignmentController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          assignmentTitle: 'Title',
          referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
          templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
        });
      }).toThrow(/Assignment must have a topic/);
    });

    it('throws when yearGroup provided and persisting ABClass fails', () => {
      const mockTask = createTaskDefinition({ index: 0 });
      const mockDefinition = new AssignmentDefinition({
        primaryTitle: 'Title',
        primaryTopic: 'Topic',
        yearGroup: null,
        documentType: 'SLIDES',
        referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
        templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
        tasks: { task_0: mockTask },
        referenceLastModified: '2024-01-01T00:00:00.000Z',
        templateLastModified: '2024-01-01T00:00:00.000Z',
      });

      const abClass = { classId: 'course-1', yearGroup: null };

      vi.spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs').mockReturnValue({
        definition: mockDefinition,
        abClass,
      });

      const saveErr = new Error('Failed to persist class');
      vi.spyOn(ABClassController.prototype, 'saveClass').mockImplementation(() => {
        throw saveErr;
      });

      const controller = new AssignmentController();

      expect(() => {
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          assignmentTitle: 'Title',
          referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
          templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
          yearGroup: 9,
        });
      }).toThrow(saveErr);

      expect(ABClassController.prototype.saveClass).toHaveBeenCalled();
    });

    it('rethrows and logs controller errors', () => {
      const controllerError = new Error('Controller internal error');
      vi.spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs').mockImplementation(
        () => {
          throw controllerError;
        }
      );

      expect(() => {
        const controller = new AssignmentController();
        controller.createDefinitionFromWizardInputs({
          assignmentId: 'a1',
          assignmentTitle: 'Title',
          referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
          templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
        });
      }).toThrow('Controller internal error');

      expect(mockABLogger.error).toHaveBeenCalledWith(
        'Error in AssignmentController.createDefinitionFromWizardInputs:',
        'Controller internal error'
      );
    });
  });

  describe('Logging behaviour', () => {
    it('logs invocation with all parameters', () => {
      const mockTask = createTaskDefinition({ index: 0 });
      const mockDefinition = new AssignmentDefinition({
        primaryTitle: 'Title',
        primaryTopic: 'Topic',
        yearGroup: null,
        documentType: 'SLIDES',
        referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
        templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
        tasks: { task_0: mockTask },
        referenceLastModified: '2024-01-01T00:00:00.000Z',
        templateLastModified: '2024-01-01T00:00:00.000Z',
      });

      vi.spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs').mockReturnValue({
        definition: mockDefinition,
      });

      const controller = new AssignmentController();
      controller.createDefinitionFromWizardInputs({
        assignmentId: 'a1',
        assignmentTitle: 'Title',
        referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
        templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
      });

      expect(mockABLogger.info).toHaveBeenCalledWith(
        'AssignmentController.createDefinitionFromWizardInputs invoked:',
        expect.objectContaining({
          assignmentId: 'a1',
          assignmentTitle: 'Title',
          referenceDocumentId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
          templateDocumentId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
        })
      );
    });
  });
});
