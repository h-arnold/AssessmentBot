import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * BaseRequestManager Error Handling Tests
 *
 * Tests error handling according to backend error code documentation:
 * https://github.com/h-arnold/AssessmentBot-Backend/blob/master/docs/api/error-codes.md
 *
 * Error Categories:
 * - 200/201: Success (no retry needed)
 * - 400: Bad Request - validation failure (should NOT retry)
 * - 401: Unauthorised - invalid API key (should NOT retry, should abort)
 * - 403: Forbidden - API key permission issue (should NOT retry)
 * - 413: Payload Too Large (should NOT retry)
 * - 429: Too Many Requests - rate limiting (should retry with backoff)
 * - 500: Internal Server Error (should retry with backoff)
 * - 503: Service Unavailable - temporary (should retry with backoff)
 */

describe('BaseRequestManager Error Handling', () => {
  let BaseRequestManager;
  let mockUrlFetchApp;
  let mockUtilities;
  let mockConfigManager;
  let mockProgressTracker;
  let mockCacheService;

  beforeEach(() => {
    // Setup mock UrlFetchApp
    mockUrlFetchApp = {
      fetch: vi.fn(),
      fetchAll: vi.fn(),
    };
    global.UrlFetchApp = mockUrlFetchApp;

    // Setup mock Utilities
    mockUtilities = {
      sleep: vi.fn(),
    };
    global.Utilities = mockUtilities;

    // Setup mock CacheService
    mockCacheService = {
      getScriptCache: vi.fn().mockReturnValue({
        get: vi.fn(),
        put: vi.fn(),
      }),
    };
    global.CacheService = mockCacheService;

    // Setup mock ConfigurationManager
    mockConfigManager = {
      getInstance: vi.fn().mockReturnValue({
        getBackendAssessorBatchSize: vi.fn().mockReturnValue(10),
      }),
    };
    global.ConfigurationManager = mockConfigManager;

    // Setup mock ProgressTracker
    mockProgressTracker = {
      getInstance: vi.fn().mockReturnValue({
        logError: vi.fn(),
        Error: vi.fn(),
        updateProgress: vi.fn(),
        getCurrentProgress: vi.fn().mockReturnValue({ message: 'Processing' }),
      }),
    };
    global.ProgressTracker = mockProgressTracker;

    // Mock console methods to avoid noise in test output
    global.console = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Clear module cache and reload BaseRequestManager
    delete require.cache[
      require.resolve('../../src/AdminSheet/RequestHandlers/BaseRequestManager.js')
    ];
    const module = require('../../src/AdminSheet/RequestHandlers/BaseRequestManager.js');
    BaseRequestManager = module.BaseRequestManager || module;
  });

  afterEach(() => {
    delete global.UrlFetchApp;
    delete global.Utilities;
    delete global.CacheService;
    delete global.ConfigurationManager;
    delete global.ProgressTracker;
    vi.clearAllMocks();
  });

  describe('Success responses (200/201)', () => {
    it('should return response immediately for 200 status', () => {
      const mockResponse = {
        getResponseCode: () => 200,
        getContentText: () => '{"result": "success"}',
      };
      mockUrlFetchApp.fetch.mockReturnValue(mockResponse);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request);

      expect(result).toBe(mockResponse);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(1);
      expect(mockUtilities.sleep).not.toHaveBeenCalled();
    });

    it('should return response immediately for 201 status', () => {
      const mockResponse = {
        getResponseCode: () => 201,
        getContentText: () => '{"result": "created"}',
      };
      mockUrlFetchApp.fetch.mockReturnValue(mockResponse);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request);

      expect(result).toBe(mockResponse);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(1);
      expect(mockUtilities.sleep).not.toHaveBeenCalled();
    });
  });

  describe('Non-retryable errors', () => {
    it('should not retry on 400 Bad Request', () => {
      const mockResponse = {
        getResponseCode: () => 400,
        getContentText: () =>
          JSON.stringify({
            statusCode: 400,
            message: 'Validation failed',
            errors: [{ path: ['reference'], message: 'Required field missing' }],
          }),
      };
      mockUrlFetchApp.fetch.mockReturnValue(mockResponse);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request);

      expect(result).toBe(mockResponse);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(1);
      expect(mockUtilities.sleep).not.toHaveBeenCalled();
    });

    it('should not retry on 401 Unauthorised and throw error', () => {
      const mockResponse = {
        getResponseCode: () => 401,
        getContentText: () => JSON.stringify({ statusCode: 401, message: 'Invalid API key' }),
      };
      mockUrlFetchApp.fetch.mockReturnValue(mockResponse);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };

      expect(() => manager.sendRequestWithRetries(request)).toThrow();
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(1);
      expect(mockUtilities.sleep).not.toHaveBeenCalled();
    });

    it('should not retry on 403 Forbidden and throw error', () => {
      const mockResponse = {
        getResponseCode: () => 403,
        getContentText: () =>
          JSON.stringify({ statusCode: 403, message: 'Insufficient permissions' }),
      };
      mockUrlFetchApp.fetch.mockReturnValue(mockResponse);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };

      expect(() => manager.sendRequestWithRetries(request)).toThrow();
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(1);
      expect(mockUtilities.sleep).not.toHaveBeenCalled();
    });

    it('should not retry on 413 Payload Too Large', () => {
      const mockResponse = {
        getResponseCode: () => 413,
        getContentText: () =>
          JSON.stringify({ statusCode: 413, message: 'Request body too large' }),
      };
      mockUrlFetchApp.fetch.mockReturnValue(mockResponse);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request);

      expect(result).toBe(mockResponse);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(1);
      expect(mockUtilities.sleep).not.toHaveBeenCalled();
    });
  });

  describe('Retryable errors with exponential backoff', () => {
    it('should retry on 429 Too Many Requests with exponential backoff', () => {
      const mockResponse429 = {
        getResponseCode: () => 429,
        getContentText: () => JSON.stringify({ statusCode: 429, message: 'Rate limit exceeded' }),
      };
      const mockResponse200 = {
        getResponseCode: () => 200,
        getContentText: () => '{"result": "success"}',
      };

      mockUrlFetchApp.fetch
        .mockReturnValueOnce(mockResponse429)
        .mockReturnValueOnce(mockResponse429)
        .mockReturnValueOnce(mockResponse200);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request);

      expect(result).toBe(mockResponse200);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(3);
      expect(mockUtilities.sleep).toHaveBeenCalledTimes(2);
      // Verify exponential backoff (5000ms, 7500ms)
      expect(mockUtilities.sleep).toHaveBeenNthCalledWith(1, 5000);
      expect(mockUtilities.sleep).toHaveBeenNthCalledWith(2, 7500);
    });

    it('should retry on 500 Internal Server Error', () => {
      const mockResponse500 = {
        getResponseCode: () => 500,
        getContentText: () => JSON.stringify({ statusCode: 500, message: 'Internal server error' }),
      };
      const mockResponse200 = {
        getResponseCode: () => 200,
        getContentText: () => '{"result": "success"}',
      };

      mockUrlFetchApp.fetch
        .mockReturnValueOnce(mockResponse500)
        .mockReturnValueOnce(mockResponse200);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request);

      expect(result).toBe(mockResponse200);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(2);
      expect(mockUtilities.sleep).toHaveBeenCalledTimes(1);
      expect(mockUtilities.sleep).toHaveBeenCalledWith(5000);
    });

    it('should retry on 503 Service Unavailable', () => {
      const mockResponse503 = {
        getResponseCode: () => 503,
        getContentText: () => JSON.stringify({ statusCode: 503, message: 'Service unavailable' }),
      };
      const mockResponse200 = {
        getResponseCode: () => 200,
        getContentText: () => '{"result": "success"}',
      };

      mockUrlFetchApp.fetch
        .mockReturnValueOnce(mockResponse503)
        .mockReturnValueOnce(mockResponse200);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request);

      expect(result).toBe(mockResponse200);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(2);
      expect(mockUtilities.sleep).toHaveBeenCalledTimes(1);
    });

    it('should return null after max retries exhausted on retryable error', () => {
      const mockResponse503 = {
        getResponseCode: () => 503,
        getContentText: () => JSON.stringify({ statusCode: 503, message: 'Service unavailable' }),
      };

      mockUrlFetchApp.fetch.mockReturnValue(mockResponse503);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request, 2);

      expect(result).toBeNull();
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
      expect(mockUtilities.sleep).toHaveBeenCalledTimes(2);
    });
  });

  describe('Network exception handling', () => {
    it('should retry on network exception', () => {
      const networkError = new Error('Network connection failed');
      const mockResponse200 = {
        getResponseCode: () => 200,
        getContentText: () => '{"result": "success"}',
      };

      mockUrlFetchApp.fetch
        .mockImplementationOnce(() => {
          throw networkError;
        })
        .mockReturnValueOnce(mockResponse200);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request);

      expect(result).toBe(mockResponse200);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(2);
      expect(mockUtilities.sleep).toHaveBeenCalledTimes(1);
    });

    it('should return null after max retries on repeated network exceptions', () => {
      const networkError = new Error('Network connection failed');

      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw networkError;
      });

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request, 2);

      expect(result).toBeNull();
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
      expect(mockUtilities.sleep).toHaveBeenCalledTimes(2);
    });
  });

  describe('Exponential backoff behaviour', () => {
    it('should apply exponential backoff with 1.5x multiplier', () => {
      const mockResponse503 = {
        getResponseCode: () => 503,
        getContentText: () => JSON.stringify({ statusCode: 503, message: 'Service unavailable' }),
      };

      mockUrlFetchApp.fetch.mockReturnValue(mockResponse503);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      manager.sendRequestWithRetries(request, 2);

      // Verify delays: 5000ms, 7500ms (5000 * 1.5)
      expect(mockUtilities.sleep).toHaveBeenNthCalledWith(1, 5000);
      expect(mockUtilities.sleep).toHaveBeenNthCalledWith(2, 7500);
    });
  });

  describe('Mixed error scenarios', () => {
    it('should handle mixed retryable and non-retryable errors correctly', () => {
      const mockResponse503 = {
        getResponseCode: () => 503,
        getContentText: () => JSON.stringify({ statusCode: 503, message: 'Service unavailable' }),
      };
      const mockResponse400 = {
        getResponseCode: () => 400,
        getContentText: () => JSON.stringify({ statusCode: 400, message: 'Validation failed' }),
      };

      mockUrlFetchApp.fetch
        .mockReturnValueOnce(mockResponse503)
        .mockReturnValueOnce(mockResponse400);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request);

      expect(result).toBe(mockResponse400);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(2);
      expect(mockUtilities.sleep).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logging behaviour', () => {
    it('should log warnings for retryable errors', () => {
      const mockResponse503 = {
        getResponseCode: () => 503,
        getContentText: () => 'Service unavailable',
      };
      const mockResponse200 = {
        getResponseCode: () => 200,
        getContentText: () => '{"result": "success"}',
      };

      mockUrlFetchApp.fetch
        .mockReturnValueOnce(mockResponse503)
        .mockReturnValueOnce(mockResponse200);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      manager.sendRequestWithRetries(request);

      expect(console.warn).toHaveBeenCalled();
    });

    it('should log error when all retries exhausted', () => {
      const mockResponse503 = {
        getResponseCode: () => 503,
        getContentText: () => 'Service unavailable',
      };

      mockUrlFetchApp.fetch.mockReturnValue(mockResponse503);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      manager.sendRequestWithRetries(request, 1);

      expect(console.error).toHaveBeenCalled();
    });
  });
});
