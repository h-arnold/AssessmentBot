/**
 * Deferred cleanup coordinator for progress records.
 *
 * Owns the per-user pending-trigger dedupe (a short-lived user-cache flag backed
 * by a durable User Property marker) and the terminal-only sweep. The marker is
 * user scoped for the same reason as the records themselves: cleanup state must
 * not leak between teachers. Cleanup triggers opt out of quota recovery so a
 * full trigger quota cannot delete assessment triggers.
 *
 * Dependencies are resolved as bare globals at call time to mirror GAS
 * concatenation order. This file sorts before the ProgressTracker facade.
 *
 * @namespace
 */

/** User Property holding the UID of this user's pending cleanup trigger. */
const CLEANUP_MARKER_KEY = 'AB_PROGRESS_CLEANUP_TRIGGER';
/** User cache key mirroring the durable marker. */
const CLEANUP_FLAG_KEY = 'AB_PROGRESS_CLEANUP_FLAG';
/** Value stored in the user cache while a cleanup trigger is pending. */
const CLEANUP_FLAG_VALUE = 'pending';
/** Explicit cache TTL, in seconds, supplied to CacheManager.put(). */
const CLEANUP_FLAG_TTL_SECONDS = 600;
/** Delay before a cleanup trigger fires, in minutes. */
const CLEANUP_DELAY_MINUTES = 10;
/** Delay before a cleanup trigger fires, in milliseconds. */
const CLEANUP_DELAY_MS =
  CLEANUP_DELAY_MINUTES * RuntimeConstants.SECONDS_PER_MINUTE * RuntimeConstants.MS_PER_SECOND;
/** Single public trigger entrypoint. */
const TRIGGER_ENTRYPOINT = 'triggerHandler';
/** Trigger method dispatched by the coordinator. */
const CLEANUP_METHOD = 'cleanupProgress';

/**
 * Stores the pending-cleanup flag in the per-user cache.
 *
 * @param {CacheManager} cache - Cache manager wrapping the per-user cache.
 * @returns {void}
 */
const markPending = (cache) => {
  cache.put(CLEANUP_FLAG_KEY, CLEANUP_FLAG_VALUE, CLEANUP_FLAG_TTL_SECONDS);
};

/**
 * Reports whether the trigger named by the durable marker is still live.
 * A marker whose trigger was deleted externally — quota recovery in
 * TriggerController or an auth-denied cleanup run in triggerHandler — must not
 * keep suppressing a fresh cleanup trigger.
 *
 * @param {GoogleAppsScript.Properties.Properties} properties - The caller's User Property store.
 * @returns {boolean} True when a live trigger still carries the marker UID.
 */
const hasLiveCleanupTrigger = (properties) => {
  const markerUid = properties.getProperty(CLEANUP_MARKER_KEY);
  if (markerUid === null) return false;
  return ScriptApp.getProjectTriggers().some((trigger) => trigger.getUniqueId() === markerUid);
};

/**
 * Reports whether a progress record is terminal, so in-flight runs are kept.
 * A record missing `error` is incomplete, not failed: only an explicit
 * completion flag or a present, non-null error makes it terminal.
 *
 * @param {Object} record - Parsed progress record.
 * @returns {boolean} True when the run completed or carries an error.
 */
const isTerminalRecord = (record) =>
  record.completed === true || (record.error !== null && record.error !== undefined);

const ProgressTrackerCleanup = {
  /**
   * Schedules one cleanup trigger for this user when none is pending.
   * A cache miss falls back to the durable marker, which is checked against
   * the live project triggers: a marker whose trigger was deleted externally
   * is cleared rather than treated as pending. The final check and creation
   * run under the user lock so concurrent writes cannot create two triggers.
   * A failed lock acquisition is logged and does not break the progress write.
   *
   * @param {GoogleAppsScript.Properties.Properties} properties - The caller's User Property store.
   * @returns {void}
   */
  schedule(properties) {
    const cache = new CacheManager(CacheService.getUserCache());

    if (cache.get(CLEANUP_FLAG_KEY) !== null) return;

    if (hasLiveCleanupTrigger(properties)) {
      markPending(cache);
      return;
    }
    properties.deleteProperty(CLEANUP_MARKER_KEY);

    const lock = LockService.getUserLock();
    if (!lock.tryLock()) {
      ABLogger.getInstance().warn('Could not acquire the user lock to schedule progress cleanup.', {
        phase: 'schedule',
        flagKey: CLEANUP_FLAG_KEY,
        markerKey: CLEANUP_MARKER_KEY,
      });
      return;
    }

    try {
      if (cache.get(CLEANUP_FLAG_KEY) !== null) return;
      if (hasLiveCleanupTrigger(properties)) {
        markPending(cache);
        return;
      }
      properties.deleteProperty(CLEANUP_MARKER_KEY);
      this.rearm();
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Deletes terminal progress records, keeping in-flight runs intact, and
   * deletes the bare pre-upgrade key outright: records are keyed only now, so
   * a stale unkeyed copy is dead data and must not keep the cleanup timer
   * re-arming. Marker and cache flag are cleared, and a successful sweep that
   * observed an in-flight keyed record re-arms one trigger, all under the user
   * lock so a concurrent progress write cannot create a second trigger. If the
   * lock is held by a concurrent write, the sweep leaves the marker and flag to
   * that write's `schedule()`, which validates the marker against live triggers;
   * the cached flag bounds any delay to its TTL. A sweep failure is rethrown
   * after cleanup without re-arming.
   *
   * @returns {void}
   */
  sweep() {
    const properties = GASPropertiesUtils.getUserProperties();
    const cache = new CacheManager(CacheService.getUserCache());
    let hasInFlightRecord = false;
    let wasSuccessful = false;

    try {
      // Delete the bare pre-upgrade key.
      if (properties.getProperty(ProgressTrackerStore.KEY_PREFIX) !== null) {
        properties.deleteProperty(ProgressTrackerStore.KEY_PREFIX);
        ABLogger.getInstance().info('Deleted pre-upgrade unkeyed progress record.', {
          key: ProgressTrackerStore.KEY_PREFIX,
        });
      }

      for (const entry of ProgressTrackerStore.readAll(properties)) {
        const record = ProgressTrackerStore.parse(entry.value, entry.key);
        if (record === null) continue;
        if (typeof record !== 'object' || Array.isArray(record)) {
          ABLogger.getInstance().warn(
            'Skipping progress record that is not an object; it is left untouched.',
            {
              key: entry.key,
            }
          );
          continue;
        }
        if (isTerminalRecord(record)) {
          properties.deleteProperty(entry.key);
        } else {
          hasInFlightRecord = true;
        }
      }
      wasSuccessful = true;
    } finally {
      // Hold the user lock across the clear-and-rearm transition so a
      // concurrent progress write cannot slip a second trigger in. Without the
      // lock, leave both fields to that write's schedule() call.
      const lock = LockService.getUserLock();
      if (lock.tryLock()) {
        try {
          properties.deleteProperty(CLEANUP_MARKER_KEY);
          cache.remove(CLEANUP_FLAG_KEY);
          if (wasSuccessful && hasInFlightRecord) this.rearm();
        } finally {
          lock.releaseLock();
        }
      } else {
        ABLogger.getInstance().warn(
          'Could not acquire the user lock to finalise progress cleanup; leaving state to the lock holder.',
          {
            phase: 'sweep-finalise',
            flagKey: CLEANUP_FLAG_KEY,
            markerKey: CLEANUP_MARKER_KEY,
          }
        );
      }
    }
  },

  /**
   * Creates one cleanup trigger and records its pending state.
   * A declined creation (quota or any other error) leaves marker and flag unset
   * so a later progress write retries. Quota recovery is skipped because it
   * would delete unrelated assessment triggers. The creation failure is logged
   * by `createTimeBasedTrigger()`, where the raw error is available.
   *
   * @returns {string|null} The new trigger UID, or null when creation was declined.
   */
  rearm() {
    const controller = new TriggerController();
    const triggerUid = controller.createTimeBasedTrigger(
      TRIGGER_ENTRYPOINT,
      new Date(Date.now() + CLEANUP_DELAY_MS),
      { skipTooManyTriggersRecovery: true }
    );
    if (triggerUid === null || triggerUid === undefined) {
      return null;
    }

    controller.storeTriggerContext(triggerUid, { method: CLEANUP_METHOD, params: {} });
    const properties = GASPropertiesUtils.getUserProperties();
    const cache = new CacheManager(CacheService.getUserCache());
    properties.setProperty(CLEANUP_MARKER_KEY, triggerUid);
    markPending(cache);
    return triggerUid;
  },
};

// Export for Node tests; GAS exposes the object as a script-scope global.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressTrackerCleanup;
}

// Attach to globalThis for GAS runtime compatibility: GAS concatenates backend
// files into one classic script, where a top-level const is not a global property.
Object.assign(globalThis, { ProgressTrackerCleanup });
