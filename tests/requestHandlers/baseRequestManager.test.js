import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

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

// Global mock context - will be set up in beforeEach and torn down in afterEach
let restoreRequestHandlerGlobals;

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

    // Setup mock Utilities
    mockUtilities = {
      sleep: vi.fn(),
    };

    // Setup mock CacheService
    mockCacheService = {
      getScriptCache: vi.fn().mockReturnValue({
        get: vi.fn(),
        put: vi.fn(),
      }),
    };

    // Setup mock ConfigurationManager
    mockConfigManager = {
      getInstance: vi.fn().mockReturnValue({
        getBackendAssessorBatchSize: vi.fn().mockReturnValue(10),
      }),
    };

    // Setup mock ProgressTracker
    mockProgressTracker = {
      getInstance: vi.fn().mockReturnValue({
        logError: vi.fn(),
        Error: vi.fn(),
        updateProgress: vi.fn(),
        getCurrentProgress: vi.fn().mockReturnValue({ message: 'Processing' }),
      }),
    };

    // Setup mock ABLogger
    const mockABLogger = {
      getInstance: vi.fn().mockReturnValue({
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        debugUi: vi.fn(),
      }),
    };

    // Load AbortRequestError
    const AbortRequestError = require('#backend/Utils/ErrorTypes/AbortRequestError.js');

    // Mock console methods to avoid noise in test output
    const mockConsole = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Setup all global mocks - saves originals and installs mocks
    const mockContext = withGlobalMocks({
      UrlFetchApp: () => mockUrlFetchApp,
      Utilities: () => mockUtilities,
      CacheService: () => mockCacheService,
      ConfigurationManager: () => mockConfigManager,
      ProgressTracker: () => mockProgressTracker,
      ABLogger: () => mockABLogger,
      AbortRequestError: () => AbortRequestError,
      console: () => mockConsole,
    });
    restoreRequestHandlerGlobals = mockContext.restore;

    // Clear module cache and reload BaseRequestManager
    delete require.cache[require.resolve('#backend/RequestHandlers/BaseRequestManager.js')];
    const module = require('#backend/RequestHandlers/BaseRequestManager.js');
    BaseRequestManager = module.BaseRequestManager || module;
  });

  afterEach(() => {
    restoreRequestHandlerGlobals();
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
      const request = { uid: 'success-200', url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request, {
        acceptedStatuses: [200, 201],
        stopStatuses: [],
      });

      expect(result).toMatchObject({
        uid: 'success-200',
        response: mockResponse,
        error: null,
        attempts: 1,
      });
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
      const request = { uid: 'success-201', url: 'https://api.test/endpoint', method: 'post' };
      const result = manager.sendRequestWithRetries(request, {
        acceptedStatuses: [200, 201],
        stopStatuses: [],
      });

      expect(result).toMatchObject({
        uid: 'success-201',
        response: mockResponse,
        error: null,
        attempts: 1,
      });
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(1);
      expect(mockUtilities.sleep).not.toHaveBeenCalled();
    });
  });

  describe('Native response processing faults', () => {
    it.each(['initial', 'retry'])(
      'propagates an ordinary Error from getResponseCode during %s classification',
      (faultPhase) => {
        const classificationError = new Error(`${faultPhase} response fault`);
        const faultyResponse = {
          getResponseCode: vi.fn(() => {
            throw classificationError;
          }),
        };
        const retryableResponse = { getResponseCode: () => 429 };
        mockUrlFetchApp.fetchAll.mockReturnValueOnce(
          faultPhase === 'initial'
            ? [faultyResponse, { getResponseCode: () => 200 }]
            : [retryableResponse, { getResponseCode: () => 200 }]
        );
        mockUrlFetchApp.fetch.mockReturnValueOnce(faultyResponse);
        const callbacks = [];
        let propagated;

        try {
          new BaseRequestManager().sendRequestsInBatches(
            [
              { uid: 'faulting', url: '/faulting' },
              { uid: 'member', url: '/member' },
            ],
            {
              batchSize: 2,
              acceptedStatuses: [200],
              stopStatuses: [],
              onBatchComplete: (outcomes) => callbacks.push(outcomes),
            }
          );
        } catch (error) {
          propagated = error;
        }

        expect(faultyResponse.getResponseCode).toHaveBeenCalledTimes(1);
        expect(propagated).toBe(classificationError);
        expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledTimes(1);
        expect(mockUrlFetchApp.fetchAll.mock.calls[0][0].map(({ url }) => url)).toEqual([
          '/faulting',
          '/member',
        ]);
        expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(faultPhase === 'initial' ? 0 : 1);
        expect(mockUrlFetchApp.fetch.mock.calls.map(([url]) => url)).toEqual(
          faultPhase === 'initial' ? [] : ['/faulting']
        );
        expect(mockUtilities.sleep.mock.calls).toEqual(faultPhase === 'initial' ? [] : [[5000]]);
        expect(callbacks).toEqual([]);
      }
    );
  });
});
