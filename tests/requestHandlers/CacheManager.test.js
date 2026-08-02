import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';
import { simpleHash } from '../helpers/testUtils.js';

/**
 * CacheManager Tests
 * Tests caching of assessment data to prevent redundant processing
 */

// Global mock context - will be set up in beforeEach and torn down in afterEach
let restoreCacheManagerGlobals;

describe('CacheManager', () => {
  let CacheManager;
  let mockCacheService;
  let mockScriptCache;
  let mockUtils;
  let mockRuntimeConstants;
  let mockAbLoggerInstance;
  let mockConsole;

  beforeEach(() => {
    // Setup mock CacheService
    mockScriptCache = {
      get: vi.fn(),
      put: vi.fn(),
      remove: vi.fn(),
    };
    mockCacheService = {
      getScriptCache: vi.fn().mockReturnValue(mockScriptCache),
    };

    // Setup mock Utils
    mockUtils = {
      generateHash: vi.fn(simpleHash),
    };

    // Setup mock RuntimeConstants
    mockRuntimeConstants = {
      MINUTES_PER_HOUR: 60,
      SECONDS_PER_MINUTE: 60,
    };

    // Mock ABLogger instance for assertions on error calls
    mockAbLoggerInstance = {
      debug: vi.fn(),
      debugUi: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    };

    // Mock console to avoid noise
    mockConsole = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Setup all global mocks - saves originals and installs mocks
    const mockContext = withGlobalMocks({
      CacheService: () => mockCacheService,
      Utils: () => mockUtils,
      RuntimeConstants: () => mockRuntimeConstants,
      ABLogger: () => ({ getInstance: () => mockAbLoggerInstance }),
      console: () => mockConsole,
    });
    restoreCacheManagerGlobals = mockContext.restore;

    // Load CacheManager
    delete require.cache[require.resolve('../../src/backend/RequestHandlers/CacheManager.js')];
    const module = require('../../src/backend/RequestHandlers/CacheManager.js');
    CacheManager = module.CacheManager || module;
  });

  afterEach(() => {
    restoreCacheManagerGlobals();
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialise with ScriptCache', () => {
      const manager = new CacheManager();
      expect(mockCacheService.getScriptCache).toHaveBeenCalledTimes(1);
      expect(manager.cache).toBe(mockScriptCache);
    });
  });

  describe('generateCacheKey', () => {
    it('should return null when contentHashReference is falsy', () => {
      const manager = new CacheManager();
      const result = manager.generateCacheKey(null, 'hash2');
      expect(result).toBeNull();
      expect(mockUtils.generateHash).not.toHaveBeenCalled();
    });

    it('should return null when contentHashResponse is falsy', () => {
      const manager = new CacheManager();
      const result = manager.generateCacheKey('hash1', null);
      expect(result).toBeNull();
      expect(mockUtils.generateHash).not.toHaveBeenCalled();
    });

    it('should return null when both inputs are falsy', () => {
      const manager = new CacheManager();
      const result = manager.generateCacheKey('', '');
      expect(result).toBeNull();
      expect(mockUtils.generateHash).not.toHaveBeenCalled();
    });

    it('should generate hash from combined inputs', () => {
      const manager = new CacheManager();
      const hash1 = 'ref-hash';
      const hash2 = 'resp-hash';
      const result = manager.generateCacheKey(hash1, hash2);
      expect(mockUtils.generateHash).toHaveBeenCalledWith(`${hash1}::${hash2}`);
      expect(result).toBe(simpleHash(`${hash1}::${hash2}`));
    });

    it('should use consistent separator for raw key', () => {
      const manager = new CacheManager();
      manager.generateCacheKey('key1', 'key2');
      expect(mockUtils.generateHash).toHaveBeenCalledWith('key1::key2');
    });
  });

  describe('getCachedAssessment', () => {
    let manager;

    beforeEach(() => {
      manager = new CacheManager();
    });

    it('should return null when cacheKey is null', () => {
      mockScriptCache.get.mockReturnValue('cached-data');
      const result = manager.getCachedAssessment(null, null);
      expect(result).toBeNull();
      expect(mockScriptCache.get).not.toHaveBeenCalled();
    });

    it('should return null when cached data is not found', () => {
      mockScriptCache.get.mockReturnValue(null);
      mockUtils.generateHash.mockReturnValue('valid-key');
      const result = manager.getCachedAssessment('ref-hash', 'resp-hash');
      expect(result).toBeNull();
      expect(mockScriptCache.get).toHaveBeenCalledWith('valid-key');
    });

    it('should return parsed JSON when cached data is valid', () => {
      const cachedData = { assessment: 'data', score: 100 };
      mockScriptCache.get.mockReturnValue(JSON.stringify(cachedData));
      mockUtils.generateHash.mockReturnValue('valid-key');
      const result = manager.getCachedAssessment('ref-hash', 'resp-hash');
      expect(result).toEqual(cachedData);
      expect(mockScriptCache.get).toHaveBeenCalledWith('valid-key');
    });

    it('should return null when cached data is invalid JSON', () => {
      mockScriptCache.get.mockReturnValue('invalid-json');
      mockUtils.generateHash.mockReturnValue('valid-key');
      const result = manager.getCachedAssessment('ref-hash', 'resp-hash');
      expect(result).toBeNull();
      expect(mockAbLoggerInstance.error).toHaveBeenCalledWith(
        'Error parsing cached assessment data:',
        expect.any(Error)
      );
    });

    it('should handle cache retrieval errors gracefully', () => {
      const error = new Error('Cache error');
      mockScriptCache.get.mockImplementation(() => {
        throw error;
      });
      mockUtils.generateHash.mockReturnValue('valid-key');
      const result = manager.getCachedAssessment('ref-hash', 'resp-hash');
      expect(result).toBeNull();
      expect(mockAbLoggerInstance.error).toHaveBeenCalledWith(
        'Error retrieving cached assessment:',
        error
      );
    });
  });

  describe('setCachedAssessment', () => {
    let manager;

    beforeEach(() => {
      manager = new CacheManager();
    });

    it('should do nothing when cacheKey is null', () => {
      const assessmentData = { score: 100 };
      manager.setCachedAssessment(null, null, assessmentData);
      expect(mockScriptCache.put).not.toHaveBeenCalled();
    });

    it('should store serialized assessment data with correct expiry', () => {
      const assessmentData = { score: 100, feedback: 'excellent' };
      const expectedExpiry = 6 * 60 * 60; // 6 hours in seconds
      mockUtils.generateHash.mockReturnValue('valid-key');
      manager.setCachedAssessment('ref-hash', 'resp-hash', assessmentData);
      expect(mockScriptCache.put).toHaveBeenCalledWith(
        'valid-key',
        JSON.stringify(assessmentData),
        expectedExpiry
      );
    });

    it('should use correct cache expiry calculation', () => {
      const assessmentData = { score: 100 };
      mockUtils.generateHash.mockReturnValue('valid-key');
      manager.setCachedAssessment('ref-hash', 'resp-hash', assessmentData);
      const expectedExpiry =
        6 * mockRuntimeConstants.MINUTES_PER_HOUR * mockRuntimeConstants.SECONDS_PER_MINUTE;
      expect(mockScriptCache.put).toHaveBeenCalledWith(
        'valid-key',
        JSON.stringify(assessmentData),
        expectedExpiry
      );
    });

    it('should handle storage errors gracefully', () => {
      const error = new Error('Storage error');
      mockScriptCache.put.mockImplementation(() => {
        throw error;
      });
      mockUtils.generateHash.mockReturnValue('valid-key');
      const assessmentData = { score: 100 };
      // Should not throw
      manager.setCachedAssessment('ref-hash', 'resp-hash', assessmentData);
      expect(mockAbLoggerInstance.error).toHaveBeenCalledWith(
        'Error storing cached assessment data:',
        error
      );
    });

    it('should store complex assessment data', () => {
      const complexData = {
        score: 95.5,
        feedback: ['item1', 'item2'],
        metadata: { timestamp: Date.now(), attempts: 3 },
        nested: { deep: { value: 'test' } },
      };
      mockUtils.generateHash.mockReturnValue('complex-key');
      manager.setCachedAssessment('ref-hash', 'resp-hash', complexData);
      expect(mockScriptCache.put).toHaveBeenCalledWith(
        'complex-key',
        JSON.stringify(complexData),
        expect.any(Number)
      );
    });
  });

  describe('Generic cache methods', () => {
    let manager;

    beforeEach(() => {
      manager = new CacheManager();
    });

    it('get() returns null when key does not exist in cache', () => {
      mockScriptCache.get.mockReturnValue(null);
      const result = manager.get('auth:g:e');
      expect(result).toBeNull();
      expect(mockScriptCache.get).toHaveBeenCalledWith('auth:g:e');
    });

    it('get() returns the parsed value when key exists with valid JSON', () => {
      const cachedValue = { allowed: true, role: 'user' };
      mockScriptCache.get.mockReturnValue(JSON.stringify(cachedValue));
      const result = manager.get('auth:g:e');
      expect(result).toEqual(cachedValue);
    });

    it('get() returns null when the cached value is not valid JSON', () => {
      mockScriptCache.get.mockReturnValue('not-json');
      const result = manager.get('auth:g:e');
      expect(result).toBeNull();
      expect(mockAbLoggerInstance.error).toHaveBeenCalledWith(
        'Error parsing cached value:',
        expect.any(Error)
      );
    });

    it('put() stores a value and get() retrieves it correctly', () => {
      const value = { allowed: true, role: 'user' };
      manager.put('auth:g:e', value, 21600);
      expect(mockScriptCache.put).toHaveBeenCalledWith('auth:g:e', JSON.stringify(value), 21600);
      mockScriptCache.get.mockReturnValue(JSON.stringify(value));
      const result = manager.get('auth:g:e');
      expect(result).toEqual(value);
    });

    it('put() respects the explicit TTL passed by the caller', () => {
      const value = { allowed: true };
      manager.put('auth:g:e', value, 12345);
      expect(mockScriptCache.put).toHaveBeenCalledWith('auth:g:e', JSON.stringify(value), 12345);
    });

    it('remove() deletes the key and subsequent get() returns null', () => {
      manager.remove('auth:g:e');
      expect(mockScriptCache.remove).toHaveBeenCalledWith('auth:g:e');
      mockScriptCache.get.mockReturnValue(null);
      const result = manager.get('auth:g:e');
      expect(result).toBeNull();
    });

    it('ABLogger.error() is called on cache errors instead of console.error', () => {
      const getError = new Error('Cache get error');
      mockScriptCache.get.mockImplementation(() => {
        throw getError;
      });
      const getResult = manager.get('auth:g:e');
      expect(getResult).toBeNull();
      expect(mockAbLoggerInstance.error).toHaveBeenCalledWith(
        'Error reading from cache:',
        getError
      );

      const putError = new Error('Cache put error');
      mockScriptCache.put.mockImplementation(() => {
        throw putError;
      });
      // put() should not throw — caching is best-effort
      expect(() => manager.put('auth:g:e', { allowed: true }, 21600)).not.toThrow();
      expect(mockAbLoggerInstance.error).toHaveBeenCalledWith('Error writing to cache:', putError);
    });
  });

  describe('Integration scenarios', () => {
    let manager;

    beforeEach(() => {
      manager = new CacheManager();
    });

    it('should round-trip assessment data through cache', () => {
      const originalData = { score: 85, comments: ['good', 'needs work'] };
      const cacheKey = simpleHash('ref-hash::resp-hash');

      mockUtils.generateHash.mockReturnValue(cacheKey);
      mockScriptCache.get.mockImplementation((key) => {
        if (key === cacheKey) return JSON.stringify(originalData);
        return null;
      });

      // Store
      manager.setCachedAssessment('ref-hash', 'resp-hash', originalData);

      // Retrieve (need to re-mock get to return what was stored)
      mockScriptCache.get.mockReturnValue(JSON.stringify(originalData));
      const retrieved = manager.getCachedAssessment('ref-hash', 'resp-hash');

      expect(retrieved).toEqual(originalData);
    });

    it('should handle concurrent cache requests', () => {
      const data1 = { score: 90 };
      const data2 = { score: 80 };

      mockUtils.generateHash.mockReturnValueOnce('key1').mockReturnValueOnce('key2');

      mockScriptCache.put.mockImplementation((key, value, expiry) => {
        // Simulate cache storing both
        return true;
      });

      manager.setCachedAssessment('ref1', 'resp1', data1);
      manager.setCachedAssessment('ref2', 'resp2', data2);

      expect(mockScriptCache.put).toHaveBeenCalledTimes(2);
    });

    it('should return null for empty string inputs', () => {
      manager.setCachedAssessment('', '', { data: 'test' });
      expect(mockScriptCache.put).not.toHaveBeenCalled();

      const result = manager.getCachedAssessment('', '');
      expect(result).toBeNull();
      expect(mockScriptCache.get).not.toHaveBeenCalled();
    });
  });
});
