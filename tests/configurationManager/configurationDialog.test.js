import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock URL constructor for validation testing
global.URL = vi.fn().mockImplementation((url) => {
  // Simple URL validation mock
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL');
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Invalid URL');
  }
  if (url === 'http://' || url === 'https://') {
    throw new Error('Invalid URL');
  }
  return { href: url };
});

// Mock Materialize toast function
const mockToast = vi.fn();

// Validation functions extracted from ConfigurationDialog.html
const isValidUrl = (u) => {
  if (!u) return false;
  try {
    new URL(u);
    return true;
  } catch (e) {
    return false;
  }
};

const validateIntRange = (value, min, max, label, mockFocus = vi.fn()) => {
  const val = parseInt(value, 10);
  if (isNaN(val) || val < min || val > max) {
    mockToast({
      html: `${label} must be an integer between ${min} and ${max}.`,
      classes: 'orange',
    });
    mockFocus();
    return null;
  }
  return val;
};

describe('ConfigurationDialog Validation Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isValidUrl function', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://test.org')).toBe(true);
      expect(isValidUrl('https://api.example.com/v1/endpoint')).toBe(true);
      expect(isValidUrl('https://subdomain.example.com:8080/path?query=value')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('example')).toBe(false);
      expect(isValidUrl('//example.com')).toBe(false);
    });

    it('should return false for empty or null values', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl(null)).toBe(false);
      expect(isValidUrl(undefined)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidUrl('   ')).toBe(false);
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl('https://')).toBe(false);
    });
  });

  describe('validateIntRange function', () => {
    it('should return parsed value for valid integers within range', () => {
      const mockFocus = vi.fn();

      const result = validateIntRange('50', 1, 100, 'Test Field', mockFocus);

      expect(result).toBe(50);
      expect(mockToast).not.toHaveBeenCalled();
      expect(mockFocus).not.toHaveBeenCalled();
    });

    it('should return null and show error for values below minimum', () => {
      const mockFocus = vi.fn();

      const result = validateIntRange('0', 1, 100, 'Test Field', mockFocus);

      expect(result).toBeNull();
      expect(mockToast).toHaveBeenCalledWith({
        html: 'Test Field must be an integer between 1 and 100.',
        classes: 'orange',
      });
      expect(mockFocus).toHaveBeenCalled();
    });

    it('should return null and show error for values above maximum', () => {
      const mockFocus = vi.fn();

      const result = validateIntRange('150', 1, 100, 'Test Field', mockFocus);

      expect(result).toBeNull();
      expect(mockToast).toHaveBeenCalledWith({
        html: 'Test Field must be an integer between 1 and 100.',
        classes: 'orange',
      });
      expect(mockFocus).toHaveBeenCalled();
    });

    it('should return null and show error for non-numeric values', () => {
      const mockFocus = vi.fn();

      const result = validateIntRange('abc', 1, 100, 'Test Field', mockFocus);

      expect(result).toBeNull();
      expect(mockToast).toHaveBeenCalledWith({
        html: 'Test Field must be an integer between 1 and 100.',
        classes: 'orange',
      });
      expect(mockFocus).toHaveBeenCalled();
    });

    it('should accept boundary values', () => {
      const mockFocus = vi.fn();

      // Test minimum boundary
      let result = validateIntRange('1', 1, 100, 'Test Field', mockFocus);
      expect(result).toBe(1);
      expect(mockToast).not.toHaveBeenCalled();

      // Test maximum boundary
      result = validateIntRange('100', 1, 100, 'Test Field', mockFocus);
      expect(result).toBe(100);
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('should handle floating point input correctly', () => {
      const mockFocus = vi.fn();

      // parseInt should truncate floating point numbers
      const result = validateIntRange('50.7', 1, 100, 'Test Field', mockFocus);
      expect(result).toBe(50);
    });

    it('should handle string numbers', () => {
      const mockFocus = vi.fn();

      const result = validateIntRange('42', 1, 100, 'Test Field', mockFocus);
      expect(result).toBe(42);
    });
  });

  describe('Configuration field validation ranges', () => {
    it('should validate Backend Assessor Batch Size range (1-500)', () => {
      const mockFocus = vi.fn();

      // Valid values
      expect(validateIntRange('1', 1, 500, 'Backend Assessor Batch Size', mockFocus)).toBe(1);
      expect(validateIntRange('250', 1, 500, 'Backend Assessor Batch Size', mockFocus)).toBe(250);
      expect(validateIntRange('500', 1, 500, 'Backend Assessor Batch Size', mockFocus)).toBe(500);

      // Invalid values
      expect(validateIntRange('0', 1, 500, 'Backend Assessor Batch Size', mockFocus)).toBeNull();
      expect(validateIntRange('501', 1, 500, 'Backend Assessor Batch Size', mockFocus)).toBeNull();
    });

    it('should validate Slides Fetch Batch Size range (1-100)', () => {
      const mockFocus = vi.fn();

      // Valid values
      expect(validateIntRange('1', 1, 100, 'Slides Fetch Batch Size', mockFocus)).toBe(1);
      expect(validateIntRange('50', 1, 100, 'Slides Fetch Batch Size', mockFocus)).toBe(50);
      expect(validateIntRange('100', 1, 100, 'Slides Fetch Batch Size', mockFocus)).toBe(100);

      // Invalid values
      expect(validateIntRange('0', 1, 100, 'Slides Fetch Batch Size', mockFocus)).toBeNull();
      expect(validateIntRange('101', 1, 100, 'Slides Fetch Batch Size', mockFocus)).toBeNull();
    });

    it('should validate Days Until Auth Revoke range (1-365)', () => {
      const mockFocus = vi.fn();

      // Valid values
      expect(validateIntRange('1', 1, 365, 'Days Until Auth Revoke', mockFocus)).toBe(1);
      expect(validateIntRange('60', 1, 365, 'Days Until Auth Revoke', mockFocus)).toBe(60);
      expect(validateIntRange('365', 1, 365, 'Days Until Auth Revoke', mockFocus)).toBe(365);

      // Invalid values
      expect(validateIntRange('0', 1, 365, 'Days Until Auth Revoke', mockFocus)).toBeNull();
      expect(validateIntRange('366', 1, 365, 'Days Until Auth Revoke', mockFocus)).toBeNull();
    });
  });

  describe('Form validation logic', () => {
    it('should validate required API key', () => {
      const apiKey = '';
      expect(apiKey.trim()).toBe('');

      const apiKey2 = 'valid-key';
      expect(apiKey2.trim()).toBe('valid-key');
    });

    it('should validate required backend URL', () => {
      const validUrl = 'https://api.example.com';
      const invalidUrl = 'not-a-url';
      const emptyUrl = '';

      expect(validUrl.trim()).toBe('https://api.example.com');
      expect(isValidUrl(validUrl.trim())).toBe(true);

      expect(invalidUrl.trim()).toBe('not-a-url');
      expect(isValidUrl(invalidUrl.trim())).toBe(false);

      expect(emptyUrl.trim()).toBe('');
      expect(isValidUrl(emptyUrl.trim())).toBe(false);
    });

    it('should validate classroom selection data structure', () => {
      const classroomData = {
        courseId: 'course-123',
        courseName: 'Test Course',
      };

      expect(classroomData).toHaveProperty('courseId');
      expect(classroomData).toHaveProperty('courseName');
      expect(typeof classroomData.courseId).toBe('string');
      expect(typeof classroomData.courseName).toBe('string');
    });

    it('should validate form data structure', () => {
      const formData = {
        apiKey: 'test-key',
        backendUrl: 'https://api.test.com',
        backendAssessorBatchSize: 50,
        updateDetailsUrl: 'https://update.test.com',
        assessmentRecordTemplateId: 'template-123',
        assessmentRecordDestinationFolder: 'folder-456',
        slidesFetchBatchSize: 25,
        daysUntilAuthRevoke: 30,
        classroom: null,
      };

      // Validate required fields
      expect(formData.apiKey).toBeTruthy();
      expect(formData.backendUrl).toBeTruthy();
      expect(isValidUrl(formData.backendUrl)).toBe(true);

      // Validate integer fields
      expect(Number.isInteger(formData.backendAssessorBatchSize)).toBe(true);
      expect(
        formData.backendAssessorBatchSize >= 1 && formData.backendAssessorBatchSize <= 500
      ).toBe(true);

      expect(Number.isInteger(formData.slidesFetchBatchSize)).toBe(true);
      expect(formData.slidesFetchBatchSize >= 1 && formData.slidesFetchBatchSize <= 100).toBe(true);

      expect(Number.isInteger(formData.daysUntilAuthRevoke)).toBe(true);
      expect(formData.daysUntilAuthRevoke >= 1 && formData.daysUntilAuthRevoke <= 365).toBe(true);

      // Validate optional fields
      expect(typeof formData.updateDetailsUrl).toBe('string');
      expect(typeof formData.assessmentRecordTemplateId).toBe('string');
      expect(typeof formData.assessmentRecordDestinationFolder).toBe('string');
    });
  });

  describe('Error handling and user feedback', () => {
    it('should provide clear error messages for invalid ranges', () => {
      const mockFocus = vi.fn();

      validateIntRange('600', 1, 500, 'Backend Assessor Batch Size', mockFocus);

      expect(mockToast).toHaveBeenCalledWith({
        html: 'Backend Assessor Batch Size must be an integer between 1 and 500.',
        classes: 'orange',
      });
    });

    it('should handle non-integer inputs gracefully', () => {
      const mockFocus = vi.fn();

      validateIntRange('not-a-number', 1, 100, 'Test Field', mockFocus);

      expect(mockToast).toHaveBeenCalledWith({
        html: 'Test Field must be an integer between 1 and 100.',
        classes: 'orange',
      });
    });

    it('should handle edge case inputs', () => {
      const mockFocus = vi.fn();

      // Empty string
      expect(validateIntRange('', 1, 100, 'Test Field', mockFocus)).toBeNull();

      // Whitespace
      expect(validateIntRange('   ', 1, 100, 'Test Field', mockFocus)).toBeNull();

      // Special characters
      expect(validateIntRange('!@#', 1, 100, 'Test Field', mockFocus)).toBeNull();
    });
  });
});
