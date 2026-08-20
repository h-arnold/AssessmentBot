/**
 * Clears the stored trigger context and deletes the fired trigger for a
 * triggerUid. Shared by every triggerHandler cleanup path.
 *
 * @param {TriggerController} triggerController - The controller that owns context and trigger deletion.
 * @param {string} triggerUid - The unique ID of the fired trigger.
 * @returns {void}
 */
function cleanupTrigger_(triggerController, triggerUid) {
  triggerController.clearTriggerContext(triggerUid);
  triggerController.deleteTriggerById(triggerUid);
}

/**
 * Single public trigger execution entrypoint.
 *
 * GAS invokes this function when a scheduled installable trigger fires, passing
 * the standard `event` object (whose `triggerUid` identifies the fired
 * trigger). The function validates the event, resolves the stored trigger
 * context, runs a fail-closed authorisation check, dispatches to the
 * registered handler and owns all trigger cleanup (context + trigger deletion).
 *
 * The legacy per-task trigger wrapper (triggerProcessSelectedAssignment) has
 * been removed; all scheduled work now funnels through this single entrypoint.
 *
 * @param {Object} [event] - The GAS trigger event object.
 * @param {string} [event.triggerUid] - The unique ID of the fired trigger.
 * @returns {undefined} Always returns undefined — GAS discards trigger return values.
 * @remarks
 * Cleanup ownership: this function owns all cleanup
 * (TriggerController.clearTriggerContext + TriggerController.deleteTriggerById)
 * for any resolved, known triggerUid — including partial-context,
 * unknown-method, auth-denial and auth-throw paths. The dispatch try/finally
 * runs cleanup even when the handler throws (routed through
 * ProgressTracker.logAndThrowError and rethrown); the auth-check try/catch
 * runs the same cleanup when AuthService.checkAccess throws.
 *
 * Single log boundary: the group-membership denial and any auth failure are
 * each logged exactly once by AuthService.checkAccess, so this handler never
 * duplicates that log.
 *
 * Dependencies are resolved as bare globals (GAS concatenation order):
 * TriggerController (Triggers/TriggerController.js) must load before this file.
 */
function triggerHandler(event) {
  // 1. Validate input — malformed input triggers no cleanup, no dispatch.
  if (!event?.triggerUid) {
    ABLogger.getInstance().error(
      'triggerHandler: received a malformed trigger event (missing event or triggerUid).'
    );
    return;
  }

  const triggerController = new TriggerController();
  const context = triggerController.getTriggerContext(event.triggerUid);

  // 2. Unknown triggerUid — the triggerUid is NOT resolved, so no cleanup.
  if (context === null) {
    ABLogger.getInstance().error(
      `triggerHandler: no trigger context found for triggerUid ${event.triggerUid}.`
    );
    return;
  }

  // 3. Incomplete context — the triggerUid WAS resolved, so cleanup runs.
  if (context.method == null || context.params == null) {
    ABLogger.getInstance().error(
      `triggerHandler: incomplete trigger context for triggerUid ${event.triggerUid}.`
    );
    cleanupTrigger_(triggerController, event.triggerUid);
    return;
  }

  // 4. Unregistered method — resolved known triggerUid, so cleanup runs.
  if (TRIGGER_METHOD_HANDLERS[context.method] === undefined) {
    ABLogger.getInstance().error(
      `triggerHandler: unknown trigger method '${context.method}' for triggerUid ${event.triggerUid}.`
    );
    cleanupTrigger_(triggerController, event.triggerUid);
    return;
  }

  // 5. Fail-closed auth with cache bypass. AuthService.checkAccess logs the
  //    denial/failure exactly once, so this handler never duplicates that log.
  let result;
  try {
    result = AuthService.getInstance().checkAccess({
      bypassCache: true,
      requireConfigured: true,
      method: context.method,
    });
  } catch (accessError) {
    // AuthService already failed loud; still release the trigger context so the
    // trigger does not accumulate on persistent auth errors.
    cleanupTrigger_(triggerController, event.triggerUid);
    throw accessError;
  }
  if (!result.allowed) {
    // Denial — logged once by AuthService.checkAccess. Release context.
    cleanupTrigger_(triggerController, event.triggerUid);
    return;
  }

  // 6. Dispatch + cleanup in finally — cleanup runs even when the handler throws.
  try {
    const handler = TRIGGER_METHOD_HANDLERS[context.method];
    handler(context.params);
  } catch (error) {
    ProgressTracker.getInstance().logAndThrowError(error.message, error);
  } finally {
    cleanupTrigger_(triggerController, event.triggerUid);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { triggerHandler };
}
