/**
 * AssignmentController _detectDocumentType Validation Tests
 *
 * Tests for controller-level validation that enforces:
 * - Reference and template document IDs must be different
 * - This check happens BEFORE MIME type validation (fail-fast)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupControllerTestMocks, cleanupControllerTestMocks } from '../helpers/mockFactories.js';

let AssignmentController;
let mockProgressTracker;

// Mock DriveApp for MIME type checks
globalThis.DriveApp = {
  getFileById: vi.fn(),
};

beforeEach(async () => {
  // Setup controller test mocks
  setupControllerTestMocks(vi);

  mockProgressTracker = {
    logAndThrowError: vi.fn((msg, context) => {
      const error = new Error(msg);
      error.context = context;
      throw error;
    }),
  };

  // Mock ProgressTracker singleton
  globalThis.ProgressTracker = {
    getInstance: vi.fn(() => mockProgressTracker),
  };

  // Dynamically import controller
  const controllerModule = await import('../../src/backend/y_controllers/AssignmentController.js');
  AssignmentController = controllerModule.default || controllerModule;
});

afterEach(() => {
  cleanupControllerTestMocks();
  vi.restoreAllMocks();
});

describe('AssignmentController._detectDocumentType', () => {
  describe('Identical document validation', () => {
    it('throws error when referenceDocumentId equals templateDocumentId', () => {
      const controller = new AssignmentController();
      const sameId = '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv';

      expect(() => controller._detectDocumentType(sameId, sameId)).toThrow(
        /Reference and template documents must be different/
      );
    });

    it('logs error with both document IDs when identical', () => {
      const controller = new AssignmentController();
      const sameId = '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef';

      try {
        controller._detectDocumentType(sameId, sameId);
      } catch (err) {
        // Error expected
      }

      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalledWith(
        'Reference and template documents must be different.',
        {
          referenceDocumentId: sameId,
          templateDocumentId: sameId,
        }
      );
    });

    it('throws error context includes both IDs', () => {
      const controller = new AssignmentController();
      const sameId = '3zX8wV7uT6sR5qP4oN3mL2kJ1iH0gF9e';

      try {
        controller._detectDocumentType(sameId, sameId);
        fail('Expected error to be thrown');
      } catch (err) {
        expect(err.context).toBeDefined();
        expect(err.context.referenceDocumentId).toBe(sameId);
        expect(err.context.templateDocumentId).toBe(sameId);
      }
    });
  });

  describe('Validation order - fail-fast before MIME checks', () => {
    it('identical check happens before DriveApp.getFileById is called', () => {
      const controller = new AssignmentController();
      const sameId = '4aB3cD2eF1gH0iJ9kL8mN7oP6qR5sT4u';

      // Mock DriveApp to track if it's called
      const mockGetFileById = vi.fn();
      globalThis.DriveApp.getFileById = mockGetFileById;

      expect(() => controller._detectDocumentType(sameId, sameId)).toThrow();

      // DriveApp.getFileById should NOT be called if IDs are identical
      expect(mockGetFileById).not.toHaveBeenCalled();
    });

    it('DriveApp.getFileById IS called when IDs are different (MIME validation)', () => {
      const controller = new AssignmentController();
      const refId = '5aB4cD3eF2gH1iJ0kL9mN8oP7qR6sT5u';
      const tplId = '6bC5dE4fG3hI2jK1lM0nO9pQ8rS7tU6v';

      // Mock valid Slides files
      const mockFile = {
        getMimeType: vi.fn().mockReturnValue('application/vnd.google-apps.presentation'),
      };
      globalThis.DriveApp.getFileById = vi.fn().mockReturnValue(mockFile);

      // Should NOT throw for different IDs with matching MIME types
      const result = controller._detectDocumentType(refId, tplId);

      expect(globalThis.DriveApp.getFileById).toHaveBeenCalledWith(refId);
      expect(globalThis.DriveApp.getFileById).toHaveBeenCalledWith(tplId);
      expect(result).toBe('SLIDES');
    });
  });

  describe('Valid document type detection', () => {
    it('returns SLIDES for matching presentation MIME types', () => {
      const controller = new AssignmentController();
      const refId = '7cD6eF5gH4iJ3kL2mN1oP0qR9sT8uV7w';
      const tplId = '8dE7fG6hI5jK4lM3nO2pQ1rS0tU9vW8x';

      const mockFile = {
        getMimeType: vi.fn().mockReturnValue('application/vnd.google-apps.presentation'),
      };
      globalThis.DriveApp.getFileById = vi.fn().mockReturnValue(mockFile);

      const result = controller._detectDocumentType(refId, tplId);

      expect(result).toBe('SLIDES');
    });

    it('returns SHEETS for matching spreadsheet MIME types', () => {
      const controller = new AssignmentController();
      const refId = '9eF8gH7iJ6kL5mN4oP3qR2sT1uV0wX9y';
      const tplId = '0fG9hI8jK7lM6nO5pQ4rS3tU2vW1xY0z';

      const mockFile = {
        getMimeType: vi.fn().mockReturnValue('application/vnd.google-apps.spreadsheet'),
      };
      globalThis.DriveApp.getFileById = vi.fn().mockReturnValue(mockFile);

      const result = controller._detectDocumentType(refId, tplId);

      expect(result).toBe('SHEETS');
    });

    it('throws error for mismatched MIME types (after identical check)', () => {
      const controller = new AssignmentController();
      const refId = '1AbCdEfGhIjKlMnOpQrStUvWxYz01234567890123';
      const tplId = '2BcDeFgHiJkLmNoPqRsTuVwXyZ12345678901234';

      // Reference is Slides, Template is Sheets
      globalThis.DriveApp.getFileById = vi
        .fn()
        .mockImplementationOnce(() => ({
          getMimeType: vi.fn().mockReturnValue('application/vnd.google-apps.presentation'),
        }))
        .mockImplementationOnce(() => ({
          getMimeType: vi.fn().mockReturnValue('application/vnd.google-apps.spreadsheet'),
        }));

      expect(() => controller._detectDocumentType(refId, tplId)).toThrow();
    });

    it('throws error for unsupported MIME type', () => {
      const controller = new AssignmentController();
      const refId = '3CdEfGhIjKlMnOpQrStUvWxYz123456789012345';
      const tplId = '4DeFgHiJkLmNoPqRsTuVwXyZ1234567890123456';

      // Both are Google Docs (unsupported)
      const mockFile = {
        getMimeType: vi.fn().mockReturnValue('application/vnd.google-apps.document'),
      };
      globalThis.DriveApp.getFileById = vi.fn().mockReturnValue(mockFile);

      expect(() => controller._detectDocumentType(refId, tplId)).toThrow(
        /Unsupported document type/
      );
    });
  });

  describe('Required parameters', () => {
    it('throws error when referenceDocumentId is missing', () => {
      const controller = new AssignmentController();
      const tplId = '5EfGhIjKlMnOpQrStUvWxYz12345678901234567';

      expect(() => controller._detectDocumentType(null, tplId)).toThrow(
        /referenceDocumentId and templateDocumentId are required/
      );
    });

    it('throws error when templateDocumentId is missing', () => {
      const controller = new AssignmentController();
      const refId = '6FgHiJkLmNoPqRsTuVwXyZ123456789012345678';

      expect(() => controller._detectDocumentType(refId, null)).toThrow(
        /referenceDocumentId and templateDocumentId are required/
      );
    });

    it('throws error when both parameters are missing', () => {
      const controller = new AssignmentController();

      expect(() => controller._detectDocumentType(null, null)).toThrow(
        /referenceDocumentId and templateDocumentId are required/
      );
    });
  });
});
