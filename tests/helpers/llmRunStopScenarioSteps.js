import { expect } from 'vitest';
import { httpResponse, seedStaleMixedMarks } from './llmRequestManagerHarness.js';

/** One complete distinct numeric body for one received run-stop member. */
function runStopNumericBody(index) {
  return {
    completeness: { score: 0, reasoning: `Run-stop numeric outcome ${index} completeness.` },
    accuracy: { score: 2.5, reasoning: '' },
    spag: { score: 5, reasoning: `Run-stop numeric outcome ${index} spag.` },
  };
}

/** Reserve status far outside every LLM accepted/stop/retryable window so an unexpected
 * native dispatch can never be misread as a business outcome; the stop rows fail on the
 * recorded seam list instead. */
const RUN_STOP_UNEXPECTED_PAYLOAD_GUARD = {
  getResponseCode: () => 600,
  getContentText: () => 'Run-stop unexpected native payload guard, never read.',
};

/** Whether the stop index matches an approved batch arrangement for this scenario. */
function isRunStopArrangementApproved(batchSize, requestIndex, origin, cancelledRetryable) {
  const allowedBatchSizes = cancelledRetryable ? [2, 3] : [1, 2];
  if (!allowedBatchSizes.includes(batchSize)) return false;
  if (batchSize === 1) return requestIndex === 1;
  if (requestIndex === 0) return true;
  return cancelledRetryable && batchSize === 2 && origin === 'INITIAL';
}

/** Validates the caller's explicit run-stop scenario. `null` selects the healthy control;
 * a stop scenario requires the approved stop index for its batch arrangement, an INITIAL
 * or TRANSPORT_RETRY origin and one of the three credential/endpoint stop statuses.
 * `cancelledRetryable` configures the OTHER same-batch member as a retryable HTTP 500 whose
 * pending retries Base cancels when the stop is classified: batch size 2 allows the stop at
 * index 0 (forward) or index 1 (reverse, INITIAL origin only), batch size 3 index 0 with a
 * healthy third numeric. `permanentSibling` swaps the sibling member for a permanent HTTP
 * 400 rejection. Exactly one sibling role is supported per scenario. */
function readRunStopScenario(scenario, numericCount, batchSize) {
  if (!scenario || typeof scenario !== 'object' || !Object.hasOwn(scenario, 'stop')) {
    throw new Error(
      'runRunStopControl requires an explicit scenario with an own stop key (null selects the healthy control).'
    );
  }
  if (scenario.stop === null) return null;
  if (numericCount !== 3) {
    throw new Error('Run-stop scenarios support the approved three numeric candidates only.');
  }
  ['cancelledRetryable', 'permanentSibling'].forEach((flag) => {
    if (scenario[flag] !== undefined && typeof scenario[flag] !== 'boolean') {
      throw new Error(`Run-stop scenario ${flag} must be a boolean when provided.`);
    }
  });
  const cancelledRetryable = scenario.cancelledRetryable === true;
  const permanentSibling = scenario.permanentSibling === true;
  const { requestIndex, origin, status } = scenario.stop;
  if (!isRunStopArrangementApproved(batchSize, requestIndex, origin, cancelledRetryable)) {
    throw new Error(
      'Run-stop scenarios support only the approved size-2/index-0 (same-batch), size-1/index-1 ' +
        '(earlier-batch) and size-2/index-1 INITIAL (reverse same-batch cancellation) stop arrangements.'
    );
  }
  if (origin !== 'INITIAL' && origin !== 'TRANSPORT_RETRY') {
    throw new Error(
      'Run-stop scenarios require an explicit stop origin of INITIAL or TRANSPORT_RETRY.'
    );
  }
  if (status !== 401 && status !== 403 && status !== 404) {
    throw new Error('Run-stop scenarios require an explicit stop status of 401, 403 or 404.');
  }
  return { ...scenario.stop, cancelledRetryable, permanentSibling };
}

/** The healthy sibling's numeric index for a stop scenario: the member after a cancelled
 * retryable sibling (size-3 batch only) or the stop's other same-batch member. `null` when
 * the scenario has no healthy member. */
function readHealthyIndex(stop, batchSize) {
  if (!stop || stop.permanentSibling) return null;
  if (stop.cancelledRetryable) return batchSize === 3 ? 2 : null;
  return batchSize === 2 ? 1 : 0;
}

/** The unprocessed numeric index: the third member unless a size-3 batch keeps it healthy. */
function readUnprocessedIndex(stop, batchSize) {
  if (!stop) return null;
  return stop.cancelledRetryable && batchSize === 3 ? null : 2;
}

/** The configured role of one numeric member in a stop scenario. */
function readRunStopRole(index, stop, stopIndex, cancelledIndex, unprocessedIndex) {
  if (index === stopIndex) return 'target';
  if (index === cancelledIndex) return 'cancelled';
  if (index === unprocessedIndex) return 'unprocessed';
  return stop.permanentSibling ? 'permanent' : 'healthy';
}

/** Healthy-control numeric entries: one distinct complete body per member, keyed by the
 * member's source content, with the detached captures the assertions need. */
function buildHealthyNumericEntries(pairs, bodies) {
  return pairs.map((pair, index) => {
    const expectedBody = runStopNumericBody(index);
    bodies.set(pair.item.artifact.content, expectedBody);
    return {
      ...pair,
      artifact: pair.item.artifact,
      artifactSnapshot: structuredClone(pair.item.artifact.toJSON()),
      documentId: pair.submission.documentId,
      expectedBody,
    };
  });
}

/** Answers each numeric member with the native response its role requires and returns the
 * sibling responses the assertions pin by identity. The healthy member also records its
 * expected body so its terminal map can be compared. */
function configureStopNativeResponses({
  stop,
  numeric,
  stopResponse,
  initialServerResponse,
  nativeResponsesBySource,
  bodies,
}) {
  const responses = {
    healthyNativeResponse: null,
    cancelledResponse: null,
    permanentResponse: null,
  };
  numeric.forEach((entry) => {
    const content = entry.item.artifact.content;
    if (entry.role === 'target') {
      const targetResponse = stop.origin === 'INITIAL' ? stopResponse : initialServerResponse;
      nativeResponsesBySource.set(content, targetResponse);
    } else if (entry.role === 'healthy') {
      entry.expectedBody = runStopNumericBody(0);
      bodies.set(content, entry.expectedBody);
      responses.healthyNativeResponse = httpResponse(200, JSON.stringify(entry.expectedBody));
      nativeResponsesBySource.set(content, responses.healthyNativeResponse);
    } else if (entry.role === 'cancelled') {
      // The cancelled sibling's initial retryable response: Base's batch
      // consumption returns it untouched (attempts 1) once the stop is
      // classified, so its pending retries never dispatch.
      responses.cancelledResponse = httpResponse(500, 'Cancelled retryable body, never read.');
      nativeResponsesBySource.set(content, responses.cancelledResponse);
    } else if (entry.role === 'permanent') {
      // The permanent sibling's per-request rejection: never read, never
      // retried, and never relabelled by the latched run stop.
      responses.permanentResponse = httpResponse(400, 'Permanent rejection body, never read.');
      nativeResponsesBySource.set(content, responses.permanentResponse);
    }
  });
  return responses;
}

/** Seeds the approved stale marks on a stop scenario's numeric items after generation. */
function seedStopScenarioMarks(numeric, stop, stopIndex, cancelledIndex, unprocessedIndex) {
  // The approved mixed stale numeric/N seeding happens after request
  // generation through the existing shared helper; no prior E is seeded.
  seedStaleMixedMarks(numeric[stopIndex].item);
  if (unprocessedIndex !== null) {
    seedStaleMixedMarks(numeric[unprocessedIndex].item);
  }
  if (cancelledIndex !== null) {
    seedStaleMixedMarks(numeric[cancelledIndex].item);
  }
  if (stop.permanentSibling) {
    seedStaleMixedMarks(numeric[1 - stopIndex].item);
  }
}

/** Prepares one stop scenario after generation: proves fixture payload fidelity, seeds
 * the approved stale marks, re-captures the detached member and signature evidence, and
 * builds the native responses each member's role requires. */
function prepareStopScenario({
  stop,
  numeric,
  requests,
  signature,
  stopIndex,
  cancelledIndex,
  unprocessedIndex,
  nativeResponsesBySource,
  bodies,
}) {
  // Fixture payload fidelity is proven before any dispatch so a local
  // fixture fault fails as setup and can never be caught as a network
  // failure or misread as a business outcome.
  requests.forEach((request, index) => {
    expect(JSON.parse(request.payload).studentResponse).toBe(numeric[index].item.artifact.content);
  });
  seedStopScenarioMarks(numeric, stop, stopIndex, cancelledIndex, unprocessedIndex);
  numeric.forEach((entry, index) => {
    entry.artifact = entry.item.artifact;
    entry.artifactSnapshot = structuredClone(entry.item.artifact.toJSON());
    entry.documentId = entry.submission.documentId;
    entry.request = requests[index];
  });
  // The signature snapshot is retained again after local mutations so
  // all four detached captures are post-mutation evidence.
  signature.artifactSnapshot = structuredClone(signature.item.artifact.toJSON());
  const stopResponse = httpResponse(
    stop.status,
    'Rejection body kept unread by the transport and every caller.'
  );
  const initialServerResponse =
    stop.origin === 'TRANSPORT_RETRY'
      ? httpResponse(500, 'Transient initial service failure body, never read.')
      : null;
  const responses = configureStopNativeResponses({
    stop,
    numeric,
    stopResponse,
    initialServerResponse,
    nativeResponsesBySource,
    bodies,
  });
  return {
    stopResponse,
    initialServerResponse,
    ...responses,
    targetRequestUrl: requests[stopIndex].url,
  };
}

/** Answers one healthy-control member with its distinct complete numeric body. */
function answerHealthyMember(nativeRequest, bodies) {
  const body = bodies.get(JSON.parse(nativeRequest.payload).studentResponse);
  if (!body) {
    throw new Error('Run-stop healthy control received an unexpected native payload.');
  }
  return httpResponse(200, JSON.stringify(body));
}

/** Answers one stop-scenario member with its configured native response. Unexpected payloads
 * are recorded on their own seam and answered with the guard status instead of being thrown
 * from inside dispatch, where Base would swallow them as network failures and mask the fault
 * as a business outcome. */
function answerRunStopMember(nativeRequest, memberIndex, nativeResponsesBySource, unexpected) {
  const received = JSON.parse(nativeRequest.payload).studentResponse;
  const configured = nativeResponsesBySource.get(received);
  if (!configured) {
    unexpected.push({ seam: 'fetchAll', memberIndex, sourceKey: received });
    return RUN_STOP_UNEXPECTED_PAYLOAD_GUARD;
  }
  return configured;
}

export {
  RUN_STOP_UNEXPECTED_PAYLOAD_GUARD,
  answerHealthyMember,
  answerRunStopMember,
  buildHealthyNumericEntries,
  prepareStopScenario,
  readHealthyIndex,
  readRunStopRole,
  readRunStopScenario,
  readUnprocessedIndex,
};
