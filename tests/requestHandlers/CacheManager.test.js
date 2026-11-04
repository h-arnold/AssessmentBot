import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

/**
 * CacheManager Tests — generic cache surface
 *
 * CacheManager is a generic get/put wrapper over the native script cache, also
 * used outside assessment (for example the auth cache). These tests own the
 * constraint-free generic behaviour only: constructor acquisition of the native
 * ScriptCache, faithful native-backed get/put round trips, explicit caller TTL
 * forwarding, the shared six-hour TTL constant, logged best-effort native
 * failures, and real JSON serialisation faults escaping the put boundary.
 * LLM-owned cache identity, hit validation and the assessment write chain are
 * covered by the LLM request-manager cache suites; no wrapper-specific key or
 * assessment expectation lives here.
 */
describe('CacheManager', () => {
  let CacheManager;
  let mockCacheService;
  let mockScriptCache;
  let cacheStorage;
  let mockRuntimeConstants;
  let mockAbLoggerInstance;
  let mockConsole;
  let restoreCacheManagerGlobals;
  let previousCacheManagerModule;

  beforeEach(() => {
    cacheStorage = new Map();
    // Faithful local native-cache store: native get returns the LAST string
    // written for a key, or null on miss; native put stores the actual
    // serialised argument it receives. Every retrieval therefore round-trips
    // through real serialisation instead of replaying a local value.
    mockScriptCache = {
      get: vi.fn((key) => (cacheStorage.has(key) ? cacheStorage.get(key) : null)),
      put: vi.fn((key, value) => cacheStorage.set(key, value)),
    };
    mockCacheService = {
      getScriptCache: vi.fn().mockReturnValue(mockScriptCache),
    };

    // RuntimeConstants is read at module load to derive the shared TTL.
    mockRuntimeConstants = {
      MINUTES_PER_HOUR: 60,
      SECONDS_PER_MINUTE: 60,
    };

    // ABLogger instance under test: all CacheManager diagnostics go here.
    mockAbLoggerInstance = {
      debug: vi.fn(),
      debugUi: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    };

    // Console is mocked to prove it never becomes the diagnostic channel.
    mockConsole = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const mockContext = withGlobalMocks({
      CacheService: () => mockCacheService,
      RuntimeConstants: () => mockRuntimeConstants,
      ABLogger: () => ({ getInstance: () => mockAbLoggerInstance }),
      console: () => mockConsole,
    });
    restoreCacheManagerGlobals = mockContext.restore;

    // Load CacheManager under the active mocks, preserving the previous
    // CommonJS module entry so teardown restores it for other cache users.
    const cacheModulePath = require.resolve('#backend/RequestHandlers/CacheManager.js');
    previousCacheManagerModule = require.cache[cacheModulePath];
    delete require.cache[cacheModulePath];
    CacheManager = require('#backend/RequestHandlers/CacheManager.js').CacheManager;
  });

  afterEach(() => {
    restoreCacheManagerGlobals();
    const cacheModulePath = require.resolve('#backend/RequestHandlers/CacheManager.js');
    delete require.cache[cacheModulePath];
    if (previousCacheManagerModule) require.cache[cacheModulePath] = previousCacheManagerModule;
    vi.clearAllMocks();
  });

  /** Asserts every console channel stayed silent; ABLogger owns diagnostics. */
  function expectConsoleSilent() {
    expect(mockConsole.log).not.toHaveBeenCalled();
    expect(mockConsole.warn).not.toHaveBeenCalled();
    expect(mockConsole.error).not.toHaveBeenCalled();
  }

  describe('Constructor', () => {
    it('acquires the native ScriptCache through CacheService exactly once', () => {
      const manager = new CacheManager();
      expect(mockCacheService.getScriptCache).toHaveBeenCalledTimes(1);
      expect(manager.cache).toBe(mockScriptCache);
    });
  });

  describe('Generic get()', () => {
    /**
     * Seeds the local native store directly, exactly as the real script cache
     * holds the string it received from a previous native put().
     */
    function seedNativeEntry(key, rawString) {
      cacheStorage.set(key, rawString);
    }

    it('returns null when the native cache has no entry for the key', () => {
      const result = new CacheManager().get('auth:g:e');
      expect(result).toBeNull();
      expect(mockScriptCache.get).toHaveBeenCalledWith('auth:g:e');
      expect(mockScriptCache.get).toHaveBeenCalledTimes(1);
    });

    it('parses and returns the stored JSON string when a native entry exists', () => {
      const cachedValue = { allowed: true, role: 'user' };
      seedNativeEntry('auth:g:e', JSON.stringify(cachedValue));
      const result = new CacheManager().get('auth:g:e');
      expect(result).toEqual(cachedValue);
      expect(mockScriptCache.get).toHaveBeenCalledWith('auth:g:e');
    });

    it('returns null and logs through ABLogger when the stored value is not valid JSON', () => {
      seedNativeEntry('auth:g:e', 'not-json');
      const result = new CacheManager().get('auth:g:e');
      expect(result).toBeNull();
      expect(mockAbLoggerInstance.error).toHaveBeenCalledWith(
        'Error parsing cached value:',
        expect.any(Error)
      );
      expectConsoleSilent();
    });

    it('returns null and logs through ABLogger when the native read throws', () => {
      const retrievalFailure = new Error('Native cache read failure');
      mockScriptCache.get.mockImplementationOnce(() => {
        throw retrievalFailure;
      });
      const result = new CacheManager().get('auth:g:e');
      expect(result).toBeNull();
      expect(mockAbLoggerInstance.error).toHaveBeenCalledWith(
        'Error reading from cache:',
        retrievalFailure
      );
      expectConsoleSilent();
    });
  });

  describe('Generic put()', () => {
    it('serialises the value and forwards it with the explicit caller TTL', () => {
      const value = { allowed: true };
      new CacheManager().put('auth:g:e', value, 12345);
      expect(mockScriptCache.put).toHaveBeenCalledWith('auth:g:e', JSON.stringify(value), 12345);
      expect(cacheStorage.get('auth:g:e')).toBe(JSON.stringify(value));
    });

    it('forwards the shared CACHE_EXPIRY_SECONDS constant verbatim when the caller passes it', () => {
      const value = { allowed: true };
      new CacheManager().put('auth:g:e', value, CacheManager.CACHE_EXPIRY_SECONDS);
      expect(mockScriptCache.put).toHaveBeenCalledWith(
        'auth:g:e',
        JSON.stringify(value),
        CacheManager.CACHE_EXPIRY_SECONDS
      );
      expect(cacheStorage.get('auth:g:e')).toBe(JSON.stringify(value));
    });

    it('does not throw and logs through ABLogger when the native write throws', () => {
      const writeFailure = new Error('Native cache write failure');
      mockScriptCache.put.mockImplementationOnce(() => {
        throw writeFailure;
      });
      // put() stays best-effort: a native outage is logged, never thrown.
      expect(() => {
        new CacheManager().put('auth:g:e', { allowed: true }, 12345);
      }).not.toThrow();
      expect(cacheStorage.has('auth:g:e')).toBe(false);
      expect(mockAbLoggerInstance.error).toHaveBeenCalledWith(
        'Error writing to cache:',
        writeFailure
      );
      expectConsoleSilent();
    });
  });

  describe('Shared cache TTL constant', () => {
    it('CACHE_EXPIRY_SECONDS equals the documented six-hour calculation from the active RuntimeConstants', () => {
      // The generic owner owns this single constant: 6 hours in seconds.
      const documentedSixHourSeconds =
        6 * mockRuntimeConstants.MINUTES_PER_HOUR * mockRuntimeConstants.SECONDS_PER_MINUTE;
      expect(mockRuntimeConstants.MINUTES_PER_HOUR).toBe(60);
      expect(mockRuntimeConstants.SECONDS_PER_MINUTE).toBe(60);
      expect(documentedSixHourSeconds).toBe(21600);
      expect(CacheManager.CACHE_EXPIRY_SECONDS).toBe(documentedSixHourSeconds);
    });
  });

  describe('Faithful native storage behaviour', () => {
    it('round-trips a complex nested value through the actual serialised native entry', () => {
      const original = {
        score: 95.5,
        feedback: ['item1', 'item2'],
        metadata: { attempts: 3 },
        nested: { deep: { value: 'test' } },
      };
      const manager = new CacheManager();
      manager.put('complex-key', original, 12345);
      // The native store holds exactly the serialised string put() produced.
      const storedString = cacheStorage.get('complex-key');
      expect(typeof storedString).toBe('string');
      expect(storedString).toBe(JSON.stringify(original));
      // Retrieval parses the stored string; it is not the original reference.
      const retrieved = manager.get('complex-key');
      expect(retrieved).toEqual(original);
      expect(retrieved).not.toBe(original);
    });

    it('keeps values under two distinct keys independent', () => {
      const first = { allowed: true };
      const second = { allowed: false };
      const manager = new CacheManager();
      manager.put('key-one', first, 12345);
      manager.put('key-two', second, 67890);
      expect(mockScriptCache.put).toHaveBeenCalledTimes(2);
      expect(manager.get('key-one')).toEqual(first);
      expect(manager.get('key-two')).toEqual(second);
      expect(cacheStorage.get('key-one')).toBe(JSON.stringify(first));
      expect(cacheStorage.get('key-two')).toBe(JSON.stringify(second));
    });

    it('returns the value of the last write when the same key is written again', () => {
      const manager = new CacheManager();
      manager.put('auth:g:e', { attempt: 'first' }, 12345);
      manager.put('auth:g:e', { attempt: 'second' }, 12345);
      expect(manager.get('auth:g:e')).toEqual({ attempt: 'second' });
      expect(cacheStorage.get('auth:g:e')).toBe(JSON.stringify({ attempt: 'second' }));
    });
  });

  describe('Real serialisation faults at the put boundary', () => {
    it('propagates the exact toJSON Error from the value without a native write or diagnostic', () => {
      const sentinel = new Error('Unserialisable value toJSON fault');
      const unserialisable = {
        toJSON() {
          throw sentinel;
        },
      };
      let propagated = null;
      try {
        new CacheManager().put('auth:g:e', unserialisable, 12345);
      } catch (error) {
        propagated = error;
      }
      // Serialisation happens before the native write and outside its native
      // best-effort catch, so the exact original error object escapes.
      expect(propagated).toBe(sentinel);
      expect(mockScriptCache.put).not.toHaveBeenCalled();
      expect(cacheStorage.has('auth:g:e')).toBe(false);
      // No misleading native-service failure diagnostic on this escape.
      expect(mockAbLoggerInstance.error).not.toHaveBeenCalled();
      expectConsoleSilent();
    });

    it('propagates the cyclic value TypeError without a native write or diagnostic', () => {
      const cyclic = { label: 'cycle' };
      cyclic.self = cyclic;
      let propagated = null;
      try {
        new CacheManager().put('auth:g:e', cyclic, 12345);
      } catch (error) {
        propagated = error;
      }
      expect(propagated).toBeInstanceOf(TypeError);
      expect(mockScriptCache.put).not.toHaveBeenCalled();
      expect(cacheStorage.has('auth:g:e')).toBe(false);
      expect(mockAbLoggerInstance.error).not.toHaveBeenCalled();
      expectConsoleSilent();
    });
  });
});
