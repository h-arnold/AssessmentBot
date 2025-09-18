/**
 * CacheManager Class
 *
 * Handles caching of assessment data to prevent redundant processing.
 */
class CacheManager {
  constructor() {
    this.cache = CacheService.getScriptCache();
  }

  /**
   * Generates a unique cache key based on content hashes.
   * @param {string} contentHashReference - Hash of the reference content.
   * @param {string} contentHashResponse - Hash of the student's response content.
   * @return {string} - The cache key.
   */
  generateCacheKey(contentHashReference, contentHashResponse) {
    // If either input is falsy, return null to indicate no usable key.
    if (!contentHashReference || !contentHashResponse) {
      return null;
    }

    // Use a clear separator between the two hashes to make the raw key unambiguous
    // before hashing. We still hash the combined string so the final cache key is
    // a fixed-length SHA-256 hex string (64 chars) which stays well under Apps
    // Script's 250-character cache key limit.
    const raw = `${contentHashReference}|${contentHashResponse}`;
    return Utils.generateHash(raw);
  }

  /**
   * Retrieves cached assessment data if available.
   * @param {string} contentHashReference - Hash of the reference content.
   * @param {string} contentHashResponse - Hash of the student's response content.
   * @return {Object|null} - The cached assessment data or null if not found.
   */
  getCachedAssessment(contentHashReference, contentHashResponse) {
    const cacheKey = this.generateCacheKey(contentHashReference, contentHashResponse);
    if (!cacheKey) return null;

    try {
      const cached = this.cache.get(cacheKey);
      if (!cached) return null;
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing cached assessment data:', e);
        return null;
      }
    } catch (e) {
      console.error('Error retrieving cached assessment:', e);
      return null;
    }
  }

  /**
   * Stores assessment data in the cache.
   * @param {string} contentHashReference - Hash of the reference content.
   * @param {string} contentHashResponse - Hash of the student's response content.
   * @param {Object} assessmentData - The assessment data to cache.
   */
  setCachedAssessment(contentHashReference, contentHashResponse, assessmentData) {
    const cacheKey = this.generateCacheKey(contentHashReference, contentHashResponse);
    if (!cacheKey) return;

    const serialized = JSON.stringify(assessmentData);
    const cacheExpirationInSeconds = 6 * 60 * 60; // 6 hours
    try {
      this.cache.put(cacheKey, serialized, cacheExpirationInSeconds);
    } catch (e) {
      console.error('Error storing cached assessment data:', e);
      // Don't throw — caching should be best-effort.
    }
  }
}
