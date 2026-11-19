/**
 * Seed-dispatch helpers for LLM assessment requests (issue #309).
 *
 * Owns the per-TaskDefinition seed partition and the batch-outcome consumer
 * shared by the seed and remainder phases. Both are exposed as methods on the
 * GAS global `LLMSeedPhase`; the Node test bootstrap attaches the same object
 * under that name. No payload content is ever logged here.
 */
const LLMSeedPhase = {
  /**
   * Splits generated requests into one seed per TaskDefinition and the rest.
   * Both arrays preserve generation order; a task's first request is its seed.
   * @param {Object[]} requests - Generated LLM requests in dispatch order.
   * @param {Object<string, Object>} uidIndex - UID to routed entry map.
   * @returns {{seeds: Object[], remainder: Object[]}} The seed and remainder arrays.
   * @throws {Error} When a UID has no route entry or its entry has no TaskDefinition.
   * @remarks Partition runs after the caller's input guards so invalid caller input
   * keeps its existing error precedence. Seeds form one parallel round and
   * deliberately bypass the configured batch-size throttle: the round is bounded
   * by the assignment's task count.
   */
  partitionRequests(requests, uidIndex) {
    const seeds = [];
    const remainder = [];
    const seenTaskIds = new Set();
    requests.forEach((request) => {
      const uid = request.uid;
      const route = uidIndex?.[uid];
      if (!route) {
        throw new Error(`LLM request UID has no route-map entry: ${uid}`);
      }
      const taskDefinition = route.taskDefinition;
      if (!taskDefinition) {
        throw new Error(`LLM route entry has no TaskDefinition for UID: ${uid}`);
      }
      const taskId = taskDefinition.getId();
      if (seenTaskIds.has(taskId)) {
        remainder.push(request);
      } else {
        seenTaskIds.add(taskId);
        seeds.push(request);
      }
    });
    return { seeds, remainder };
  },

  /**
   * Creates the shared onBatchComplete consumer used by both dispatch phases.
   * Accepted outcomes are routed before failures, every UID is consumed once,
   * and a stop latches the manager's shared `runStopped` state.
   * @param {Object} manager - The LLMRequestManager owning run and writeback state.
   * @param {Object} state - Phase-shared routing state: a UID to request map, a
   * set of already-routed UIDs, and the accepted and stop status arrays.
   * @returns {function(Object[]): boolean} The batch-outcome consumer; returns false when a stop latches the manager's `runStopped`, true otherwise.
   */
  createBatchConsumer(manager, state) {
    return (outcomes) => {
      if (
        outcomes.some(
          ({ response }) => response && state.stopStatuses.includes(response.getResponseCode())
        )
      ) {
        manager.runStopped = true;
      }
      const seen = new Set();
      const routed = outcomes.map((outcome) => {
        if (!state.requestByUid.has(outcome.uid) || seen.has(outcome.uid)) {
          throw new Error(`Unknown or duplicate LLM outcome UID: ${outcome.uid}`);
        }
        seen.add(outcome.uid);
        return { outcome, request: state.requestByUid.get(outcome.uid) };
      });
      routed.sort((left, right) => {
        return (
          Number(state.acceptedStatuses.includes(right.outcome.response?.getResponseCode?.())) -
          Number(state.acceptedStatuses.includes(left.outcome.response?.getResponseCode?.()))
        );
      });
      manager.progressTracker.updateProgress('Double-checking all assessments.', true);
      routed.forEach(({ outcome, request }) => {
        state.processedUids.add(outcome.uid);
        manager._processSingleResponse(outcome.response, request, outcome.attempts);
      });
      return !manager.runStopped;
    };
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LLMSeedPhase;
}
