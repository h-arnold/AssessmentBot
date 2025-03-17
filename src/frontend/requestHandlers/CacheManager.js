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
        if (!contentHashReference || !contentHashResponse) {
            return null
        }

        //Hashing the hashes to ensure they stay within the character limit
        return contentHashReference + contentHashResponse;
    }

    /**
     * Retrieves cached assessment data if available.
     * @param {string} contentHashReference - Hash of the reference content.
     * @param {string} contentHashResponse - Hash of the student's response content.
     * @return {Object|null} - The cached assessment data or null if not found.
     */
    getCachedAssessment(contentHashReference, contentHashResponse) {
        const cacheKey = this.generateCacheKey(contentHashReference, contentHashResponse);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.error("Error parsing cached assessment data:", e);
                return null;
            }
        }
        return null;
    }

    /**
     * Stores assessment data in the cache.
     * @param {string} contentHashReference - Hash of the reference content.
     * @param {string} contentHashResponse - Hash of the student's response content.
     * @param {Object} assessmentData - The assessment data to cache.
     */
    setCachedAssessment(contentHashReference, contentHashResponse, assessmentData) {
        const cacheKey = this.generateCacheKey(contentHashReference, contentHashResponse);
        const serialized = JSON.stringify(assessmentData);
        const cacheExpirationInSeconds = 6 * 60 * 60; // 6 hours
        this.cache.put(cacheKey, serialized, cacheExpirationInSeconds);
    }
}
