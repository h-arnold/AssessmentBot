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
 * Validate-then-dispatch: input is validated before any context resolution or
 * dispatch. A missing/undefined event, a missing triggerUid, an unknown
 * triggerUid, an incomplete context, or an unregistered method all surface via
 * fail-loud ABLogger error logging and skip execution — GAS discards trigger
 * return values, so no error envelope is produced.
 *
 * Fail-closed auth: AuthService.getInstance().checkAccess is always invoked
 * with { bypassCache: true, requireConfigured: true, method: <context method> }
 * before any handler runs, so runs from revoked users or an unconfigured auth
 * group never dispatch. On denial the handler logs the denial itself
 * (ABLogger.warn) and aborts without dispatching.
 *
 * Cleanup ownership: this function owns all cleanup
 * (TriggerController.clearTriggerContext + TriggerController.deleteTriggerById)
 * for any resolved, known triggerUid — including partial-context, unknown-method
 * and auth-denial paths. When the handler dispatches, cleanup runs in a finally
 * block so it also runs when the handler throws; the error is routed through
 * ProgressTracker.logAndThrowError(error.message, error) and rethrown.
 *
 * Dependencies are resolved as bare globals (GAS concatenation order):
 * TriggerController (Triggers/TriggerController.js) must load before this file.
 */
function triggerHandler(event) {
  // 1. Validate input — malformed input triggers no cleanup, no dispatch.
  if (!event || !event.triggerUid) {
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

  // 5. Fail-closed auth with cache bypass. On denial the handler logs the
  //    denial itself (ABLogger.warn) and cleans up without dispatching.
  const result = AuthService.getInstance().checkAccess({
    bypassCache: true,
    requireConfigured: true,
    method: context.method,
  });
  if (!result.allowed) {
    ABLogger.getInstance().warn(
      `triggerHandler: access denied for trigger method '${context.method}' (triggerUid ${event.triggerUid}).`
    );
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
