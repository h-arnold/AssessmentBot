/**
 * CacheManager Class
 *
 * Generic best-effort cache over the Apps Script script cache, shared by all cache
 * consumers (authentication results, assessment results and others). It defines no
 * domain-specific keys, validation or policy: consumers own their own key derivation
 * and value validation.
 */
// Single source of truth for the shared cache TTL (6 hours, in seconds).
const CACHE_EXPIRY_HOURS = 6;
const CACHE_EXPIRY_SECONDS =
  CACHE_EXPIRY_HOURS * RuntimeConstants.MINUTES_PER_HOUR * RuntimeConstants.SECONDS_PER_MINUTE;

/**
 * Cache manager.
 */
class CacheManager {
  /**
   * Initialises the CacheManager with the Apps Script cache service.
   */
  constructor() {
    this.cache = CacheService.getScriptCache();
  }

  /**
   * Retrieves a generic cached value.
   * @param {string} key - The cache key.
   * @returns {Object|null} The parsed cached value, or null on cache miss or parse error.
   * @remarks Generic cache reads degrade to a miss when cached JSON is malformed or the cache
   * service read fails; the condition is recorded through ABLogger.
   */
  get(key) {
    try {
      const cached = this.cache.get(key);
      if (!cached) return null;
      try {
        return JSON.parse(cached);
      } catch (error) {
        ABLogger.getInstance().error('Error parsing cached value:', error);
        return null;
      }
    } catch (error) {
      ABLogger.getInstance().error('Error reading from cache:', error);
      return null;
    }
  }

  /**
   * Stores a generic value in the cache.
   * @param {string} key - The cache key.
   * @param {Object} value - The value to cache.
   * @param {number} ttlSeconds - The cache entry TTL in seconds. Must be provided explicitly by the caller.
   * @returns {void}
   * @remarks The caller must provide the TTL explicitly; this generic method has no default TTL.
   * Cache write failures are logged through ABLogger and do not break the calling workflow.
   */
  put(key, value, ttlSeconds) {
    const serialized = JSON.stringify(value);
    try {
      this.cache.put(key, serialized, ttlSeconds);
    } catch (error) {
      ABLogger.getInstance().error('Error writing to cache:', error);
      // Don't throw — caching should be best-effort.
    }
  }
}

// Expose the shared cache TTL (seconds) so other GAS modules (e.g. AuthService) can reuse it.
CacheManager.CACHE_EXPIRY_SECONDS = CACHE_EXPIRY_SECONDS;

// Export for Node.js tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CacheManager };
}
