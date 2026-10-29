import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

let restoreGlobals;
let BaseRequestManager;
let fetchApp;
let utilities;
let mockUrlFetchApp;
let mockUtilities;
let loggerInstance;
let requestConsole;
const response = (code) => ({ getResponseCode: () => code });

describe('BaseRequestManager retry policy and outcome identity', () => {
  beforeEach(() => {
    fetchApp = { fetch: vi.fn(), fetchAll: vi.fn() };
    utilities = { sleep: vi.fn() };
    mockUrlFetchApp = fetchApp;
    mockUtilities = utilities;
    const cacheService = { getScriptCache: vi.fn(() => ({})) };
    const config = { getInstance: vi.fn(() => ({ getBackendAssessorBatchSize: () => 10 })) };
    const progress = {
      getInstance: vi.fn(() => ({
        logError: vi.fn(),
        updateProgress: vi.fn(),
        getCurrentProgress: () => ({ message: 'Processing' }),
      })),
    };
    loggerInstance = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const logger = { getInstance: vi.fn(() => loggerInstance) };
    requestConsole = { warn: vi.fn(), error: vi.fn(), log: vi.fn() };
    const AbortRequestError = require('#backend/Utils/ErrorTypes/AbortRequestError.js');
    restoreGlobals = withGlobalMocks({
      UrlFetchApp: fetchApp,
      Utilities: utilities,
      CacheService: cacheService,
      ConfigurationManager: config,
      ProgressTracker: progress,
      ABLogger: logger,
      AbortRequestError: () => AbortRequestError,
      console: () => requestConsole,
    }).restore;
    delete require.cache[require.resolve('#backend/RequestHandlers/BaseRequestManager.js')];
    BaseRequestManager = require('#backend/RequestHandlers/BaseRequestManager.js');
  });

  afterEach(() => {
    restoreGlobals();
    vi.clearAllMocks();
  });

  it.each([400, 401, 403, 404, 201, 300, 600])('does not retry terminal status %s', (code) => {
    fetchApp.fetch.mockReset().mockReturnValue(response(code));
    const outcome = new BaseRequestManager().sendRequestWithRetries(
      { uid: `u-${code}`, url: '/x' },
      { acceptedStatuses: [200], stopStatuses: [] }
    );
    expect(outcome).toMatchObject({ uid: `u-${code}`, response: expect.anything(), attempts: 1 });
    expect(fetchApp.fetch).toHaveBeenCalledTimes(1);
  });

  it('uses two bounded retries with exact waits and retains final network failure, not an obsolete response', () => {
    const oldResponse = response(503);
    const finalError = new Error('connection lost');
    fetchApp.fetch
      .mockReturnValueOnce(oldResponse)
      .mockImplementationOnce(() => {
        throw finalError;
      })
      .mockImplementationOnce(() => {
        throw finalError;
      });
    const outcome = new BaseRequestManager().sendRequestWithRetries(
      { uid: 'request-1', url: '/x' },
      { acceptedStatuses: [200], stopStatuses: [] }
    );
    expect(outcome).toMatchObject({
      uid: 'request-1',
      response: null,
      attempts: 3,
    });
    expect(outcome.error).toBe(finalError);
    expect(outcome.response).not.toBe(oldResponse);
    expect(fetchApp.fetch.mock.calls.map(([url]) => url)).toEqual(['/x', '/x', '/x']);
    expect(fetchApp.fetch).toHaveBeenCalledTimes(3);
    expect(utilities.sleep.mock.calls).toEqual([[5000], [7500]]);
  });

  it('does not sleep after the final attempt', () => {
    fetchApp.fetch.mockReturnValue(response(429));
    new BaseRequestManager().sendRequestWithRetries(
      { uid: 'exhausted', url: '/x' },
      { acceptedStatuses: [200], stopStatuses: [] }
    );
    expect(fetchApp.fetch).toHaveBeenCalledTimes(3);
    expect(utilities.sleep.mock.calls).toEqual([[5000], [7500]]);
  });

  it.each([
    ['llm-created', 201, [200, 201], 1],
    ['image-created', 201, [200], 1],
    ['other-success', 202, [200, 201], 1],
    ['redirect', 302, [200, 201], 1],
    ['bad-request', 400, [200, 201], 1],
    ['unauthorised', 401, [200, 201], 1],
    ['forbidden', 403, [200, 201], 1],
    ['missing', 404, [200, 201], 1],
    ['too-large', 413, [200, 201], 1],
    ['too-high', 600, [200, 201], 1],
    ['retry-500', 500, [200], 3],
    ['retry-599', 599, [200], 3],
  ])('applies %s status policy', (uid, status, accepted, attempts) => {
    fetchApp.fetch.mockReset().mockReturnValue(response(status));
    const outcome = new BaseRequestManager().sendRequestWithRetries(
      { uid, url: '/x' },
      { acceptedStatuses: accepted, stopStatuses: [] }
    );
    expect(outcome).toMatchObject({ uid, attempts, response: expect.anything(), error: null });
    expect(fetchApp.fetch).toHaveBeenCalledTimes(attempts);
  });

  it.each([401, 403, 404])('returns caller stop status %s without retrying', (status) => {
    fetchApp.fetch.mockReturnValue(response(status));
    const outcome = new BaseRequestManager().sendRequestWithRetries(
      { uid: `stop-${status}`, url: '/x' },
      { acceptedStatuses: [200, 201], stopStatuses: [401, 403, 404] }
    );
    expect(outcome).toMatchObject({
      uid: `stop-${status}`,
      attempts: 1,
      response: expect.anything(),
    });
    expect(fetchApp.fetch).toHaveBeenCalledTimes(1);
    expect(utilities.sleep).not.toHaveBeenCalled();
  });

  // Migrated legacy regressions: status, retry, backoff, mixed outcomes and diagnostics.
  describe('Non-retryable errors', () => {
    it.each([
      [400, 'Validation failed', []],
      [401, 'Invalid API key', [401, 403, 404]],
      [403, 'Insufficient permissions', [401, 403, 404]],
      [404, 'Not found', [401, 403, 404]],
      [413, 'Request body too large', []],
    ])('returns final HTTP %s without retrying', (status, message, stopStatuses) => {
      const mockResponse = {
        getResponseCode: () => status,
        getContentText: () => JSON.stringify({ statusCode: status, message }),
      };
      mockUrlFetchApp.fetch.mockReturnValue(mockResponse);
      const request = { uid: `http-${status}`, url: 'https://api.test/endpoint', method: 'post' };
      const result = new BaseRequestManager().sendRequestWithRetries(request, {
        acceptedStatuses: [200, 201],
        stopStatuses,
      });
      expect(result).toMatchObject({
        uid: request.uid,
        response: mockResponse,
        error: null,
        attempts: 1,
      });
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
      const request = {
        uid: 'http-429-recovery',
        url: 'https://api.test/endpoint',
        method: 'post',
      };
      const result = manager.sendRequestWithRetries(request, {
        acceptedStatuses: [200, 201],
        stopStatuses: [],
      });

      expect(result).toMatchObject({
        uid: request.uid,
        response: mockResponse200,
        error: null,
        attempts: 3,
      });
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
      const request = {
        uid: 'http-500-recovery',
        url: 'https://api.test/endpoint',
        method: 'post',
      };
      const result = manager.sendRequestWithRetries(request, {
        acceptedStatuses: [200, 201],
        stopStatuses: [],
      });

      expect(result).toMatchObject({
        uid: request.uid,
        response: mockResponse200,
        error: null,
        attempts: 2,
      });
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
      const request = {
        uid: 'http-503-recovery',
        url: 'https://api.test/endpoint',
        method: 'post',
      };
      const result = manager.sendRequestWithRetries(request, {
        acceptedStatuses: [200, 201],
        stopStatuses: [],
      });

      expect(result).toMatchObject({
        uid: request.uid,
        response: mockResponse200,
        error: null,
        attempts: 2,
      });
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(2);
      expect(mockUtilities.sleep).toHaveBeenCalledTimes(1);
    });

    it('returns the final retryable response after the constructor-owned attempt budget', () => {
      const mockResponse503 = {
        getResponseCode: () => 503,
        getContentText: () => JSON.stringify({ statusCode: 503, message: 'Service unavailable' }),
      };

      mockUrlFetchApp.fetch.mockReturnValue(mockResponse503);

      const manager = new BaseRequestManager();
      const request = { url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(
        { ...request, uid: 'http-exhausted' },
        { acceptedStatuses: [200, 201], stopStatuses: [] }
      );

      expect(result).toMatchObject({
        uid: 'http-exhausted',
        response: mockResponse503,
        error: null,
        attempts: 3,
      });
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
      const request = { uid: 'network-recovery', url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request, {
        acceptedStatuses: [200, 201],
        stopStatuses: [],
      });

      expect(result).toMatchObject({
        uid: request.uid,
        response: mockResponse200,
        error: null,
        attempts: 2,
      });
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(2);
      expect(mockUtilities.sleep).toHaveBeenCalledTimes(1);
    });

    it('returns the final native network Error after exhausting constructor-owned attempts', () => {
      const networkError = new Error('Network connection failed');

      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw networkError;
      });

      const manager = new BaseRequestManager();
      const request = {
        uid: 'network-exhausted',
        url: 'https://api.test/endpoint',
        method: 'post',
      };
      const result = manager.sendRequestWithRetries(request, {
        acceptedStatuses: [200, 201],
        stopStatuses: [],
      });

      expect(result).toMatchObject({ uid: request.uid, response: null, attempts: 3 });
      expect(result.error).toBe(networkError);
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
      const request = { uid: 'backoff', url: 'https://api.test/endpoint', method: 'post' };
      manager.sendRequestWithRetries(request, { acceptedStatuses: [200, 201], stopStatuses: [] });

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
      const request = { uid: 'mixed-503-400', url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request, {
        acceptedStatuses: [200, 201],
        stopStatuses: [],
      });

      expect(result).toMatchObject({
        uid: request.uid,
        response: mockResponse400,
        error: null,
        attempts: 2,
      });
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
      const request = { uid: 'diagnostic-retry', url: 'https://api.test/endpoint', method: 'post' };
      manager.sendRequestWithRetries(request, { acceptedStatuses: [200, 201], stopStatuses: [] });

      expect(loggerInstance.warn).toHaveBeenCalledTimes(1);
      expect(loggerInstance.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ uid: request.uid, attempt: expect.any(Number) })
      );
    });

    it('should log error when all retries exhausted', () => {
      const mockResponse503 = {
        getResponseCode: () => 503,
        getContentText: () => 'Service unavailable',
      };

      mockUrlFetchApp.fetch.mockReturnValue(mockResponse503);

      const manager = new BaseRequestManager();
      const request = {
        uid: 'diagnostic-exhaustion',
        url: 'https://api.test/endpoint',
        method: 'post',
      };
      manager.sendRequestWithRetries(request, { acceptedStatuses: [200, 201], stopStatuses: [] });

      expect(loggerInstance.error).toHaveBeenCalledTimes(1);
      expect(loggerInstance.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ uid: request.uid, attempts: 3 })
      );
    });
  });
});
