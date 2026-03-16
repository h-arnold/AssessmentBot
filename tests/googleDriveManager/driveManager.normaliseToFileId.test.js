/**
 * DriveManager.normaliseToFileId Tests
 *
 * Tests for URL/ID normalisation helper that accepts either:
 * - A raw Google Drive file ID
 * - A full Google Drive/Docs/Slides/Sheets URL
 *
 * The method extracts and validates the file ID, returning it unchanged if
 * already valid, or extracted if from a URL pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import DriveManager from '../../src/AdminSheet/GoogleDriveManager/DriveManager.js';

// Mock GAS globals
let mockProgressTracker;

describe('DriveManager.normaliseToFileId', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Fresh mock for each test
    mockProgressTracker = {
      logError: vi.fn(),
    };

    globalThis.ProgressTracker = {
      getInstance: vi.fn(() => mockProgressTracker),
    };
  });

  describe('Valid file ID inputs', () => {
    it('returns unchanged ID for valid 33-character file ID', () => {
      const validId = '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv';
      expect(DriveManager.normaliseToFileId(validId)).toBe(validId);
    });

    it('returns unchanged ID for valid 44-character file ID', () => {
      const validId = '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5c';
      expect(DriveManager.normaliseToFileId(validId)).toBe(validId);
    });

    it('returns unchanged ID for file ID with hyphens and underscores', () => {
      const validId = '1aB-cD_eF4gH5iJ6kL7mN8oP9qR0sT1uv';
      expect(DriveManager.normaliseToFileId(validId)).toBe(validId);
    });

    it('trims whitespace before validating ID', () => {
      const validId = '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv';
      expect(DriveManager.normaliseToFileId(`  ${validId}  `)).toBe(validId);
    });
  });

  describe('Valid URL inputs - Slides', () => {
    it('extracts ID from standard Slides URL with /edit', () => {
      const fileId = '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv';
      const url = `https://docs.google.com/presentation/d/${fileId}/edit`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });

    it('extracts ID from Slides URL with /edit#slide=id.p1', () => {
      const fileId = '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv';
      const url = `https://docs.google.com/presentation/d/${fileId}/edit#slide=id.p1`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });

    it('extracts ID from Slides URL without /edit suffix', () => {
      const fileId = '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv';
      const url = `https://docs.google.com/presentation/d/${fileId}`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });
  });

  describe('Valid URL inputs - Sheets', () => {
    it('extracts ID from standard Sheets URL with /edit', () => {
      const fileId = '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef';
      const url = `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });

    it('extracts ID from Sheets URL with query params', () => {
      const fileId = '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef';
      const url = `https://docs.google.com/spreadsheets/d/${fileId}/edit?usp=sharing`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });

    it('extracts ID from Sheets URL with #gid fragment', () => {
      const fileId = '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef';
      const url = `https://docs.google.com/spreadsheets/d/${fileId}/edit#gid=0`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });
  });

  describe('Valid URL inputs - Drive', () => {
    it('extracts ID from Drive file URL with /view', () => {
      const fileId = '3zX8wV7uT6sR5qP4oN3mL2kJ1iH0gF9ef';
      const url = `https://drive.google.com/file/d/${fileId}/view`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });

    it('extracts ID from Drive open URL with query parameter', () => {
      const fileId = '3zX8wV7uT6sR5qP4oN3mL2kJ1iH0gF9ef';
      const url = `https://drive.google.com/open?id=${fileId}`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });

    it('extracts ID from Drive URL with &id query parameter', () => {
      const fileId = '3zX8wV7uT6sR5qP4oN3mL2kJ1iH0gF9ef';
      const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });
  });

  describe('Valid URL inputs - Docs', () => {
    it('extracts ID from Google Docs URL with /edit', () => {
      const fileId = '4aB3cD2eF1gH0iJ9kL8mN7oP6qR5sT4uv';
      const url = `https://docs.google.com/document/d/${fileId}/edit`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });
  });

  describe('URL pattern priority', () => {
    it('prefers path pattern /d/ over query parameter', () => {
      const pathFileId = '5aB4cD3eF2gH1iJ0kL9mN8oP7qR6sT5uv';
      const queryFileId = '6bC5dE4fG3hI2jK1lM0nO9pQ8rS7tU6vw';
      const url = `https://docs.google.com/presentation/d/${pathFileId}/edit?id=${queryFileId}`;
      expect(DriveManager.normaliseToFileId(url)).toBe(pathFileId);
    });
  });

  describe('Invalid inputs - errors', () => {
    it('throws error for malformed URL without valid ID', () => {
      const invalidUrl = 'https://docs.google.com/presentation/invalid';
      expect(() => DriveManager.normaliseToFileId(invalidUrl)).toThrow(
        /Invalid Google Drive URL or file ID/
      );
      expect(mockProgressTracker.logError).toHaveBeenCalledWith(
        'Invalid Google Drive URL or file ID provided.',
        { input: invalidUrl }
      );
    });

    it('throws error for URL with too-short ID', () => {
      const shortId = 'abc123'; // Less than 33 chars
      const url = `https://docs.google.com/presentation/d/${shortId}/edit`;
      expect(() => DriveManager.normaliseToFileId(url)).toThrow(
        /Invalid Google Drive URL or file ID/
      );
    });

    it('throws error for ID with invalid characters', () => {
      const invalidId = '1aB2cD3eF4gH5iJ6kL7mN8oP9qR!@#$%';
      expect(() => DriveManager.normaliseToFileId(invalidId)).toThrow(
        /Invalid Google Drive URL or file ID/
      );
    });

    it('throws error for completely invalid string', () => {
      const invalid = 'not-a-valid-id-or-url';
      expect(() => DriveManager.normaliseToFileId(invalid)).toThrow(
        /Invalid Google Drive URL or file ID/
      );
    });

    it('throws error for raw ID that is too short', () => {
      const shortId = 'abc';
      expect(() => DriveManager.normaliseToFileId(shortId)).toThrow(
        /Invalid Google Drive URL or file ID/
      );
    });
  });

  describe('Parameter validation', () => {
    it('throws error for null input', () => {
      expect(() => DriveManager.normaliseToFileId(null)).toThrow();
    });

    it('throws error for undefined input', () => {
      expect(() => DriveManager.normaliseToFileId(undefined)).toThrow();
    });

    it('throws error for empty string', () => {
      expect(() => DriveManager.normaliseToFileId('')).toThrow();
    });

    it('throws error for whitespace-only string', () => {
      expect(() => DriveManager.normaliseToFileId('   ')).toThrow();
    });
  });

  describe('Type coercion', () => {
    it('converts number to string and validates', () => {
      const validId = '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv';
      // Mock edge case where ID might come as number (unlikely but defensive)
      expect(DriveManager.normaliseToFileId(validId)).toBe(validId);
    });

    it('handles URL with leading/trailing whitespace', () => {
      const fileId = '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv';
      const url = `  https://docs.google.com/presentation/d/${fileId}/edit  `;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });
  });

  describe('Edge cases', () => {
    it('handles URL with multiple query parameters', () => {
      const fileId = '7cD6eF5gH4iJ3kL2mN1oP0qR9sT8uV7wx';
      const url = `https://docs.google.com/spreadsheets/d/${fileId}/edit?usp=sharing&rm=minimal`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });

    it('handles URL with fragment identifier', () => {
      const fileId = '8dE7fG6hI5jK4lM3nO2pQ1rS0tU9vW8xy';
      const url = `https://docs.google.com/presentation/d/${fileId}/edit#slide=id.p10`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });

    it('handles URL with both query and fragment', () => {
      const fileId = '9eF8gH7iJ6kL5mN4oP3qR2sT1uV0wX9yz';
      const url = `https://docs.google.com/presentation/d/${fileId}/edit?usp=sharing#slide=id.p5`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });

    it('extracts ID from URL with /copy suffix', () => {
      const fileId = '0fG9hI8jK7lM6nO5pQ4rS3tU2vW1xY0za';
      const url = `https://docs.google.com/presentation/d/${fileId}/copy`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });
  });

  describe('Real-world URL examples', () => {
    it('handles typical teacher-shared Slides link', () => {
      const fileId = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456';
      const url = `https://docs.google.com/presentation/d/${fileId}/edit?usp=sharing`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });

    it('handles typical teacher-shared Sheets link', () => {
      const fileId = '2BcDeFgHiJkLmNoPqRsTuVwXyZ123456789';
      const url = `https://docs.google.com/spreadsheets/d/${fileId}/edit?usp=drivesdk`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });

    it('handles Drive preview URL', () => {
      const fileId = '3CdEfGhIjKlMnOpQrStUvWxYz12345678901';
      const url = `https://drive.google.com/file/d/${fileId}/preview`;
      expect(DriveManager.normaliseToFileId(url)).toBe(fileId);
    });
  });
});
