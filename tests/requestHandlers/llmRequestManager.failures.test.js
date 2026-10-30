import { describe, it, expect, vi } from 'vitest';
import { withTemporaryGlobals } from '../helpers/globalMockManager.js';
import {
  catalogueHTTPAssessments,
  createAssignment,
  expectExecutedTransportCounts,
  expectSourceRetained,
  httpResponse,
  loadManager,
  runTransportCase,
} from '../helpers/llmRequestManagerHarness.js';

const STUDENT_RESULT_DATA = {
  completeness: { score: 0, reasoning: 'Complete response.' },
  accuracy: { score: 2.5, reasoning: '' },
  spag: { score: 5, reasoning: 'Some errors.' },
};
const HTTP_REJECTED_REASON = 'The assessment service rejected the request.';
const SERVICE_EXHAUSTED_REASON =
  'The assessment service could not complete the request after retries.';

// Three distinct complete responses so final identity/attempt accounting is real.
function exhaustedHttpResponses(status) {
  return ['A', 'B', 'C'].map((suffix) =>
    httpResponse(status, `Service ${status} outcome ${suffix}.`)
  );
}

/**
 * Shared internal-fault runner. It establishes the real canonical TEXT model,
 * generates the request/routing mapping BEFORE any processing fault exists,
 * then injects one ordinary original Error at the caller-provided owned seam
 * and runs the real processStudentResponses. The thrown value is captured
 * explicitly (never silently ignored) and returned for identity assertions.
 */
function runInternalFaultCase(install) {
  const fault = new Error('Ordinary original programming fault at the owned seam');
  const nativeResponse = {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify(STUDENT_RESULT_DATA),
  };
  const fetchAll = vi.fn(() => [nativeResponse]);
  const fetch = vi.fn(() => nativeResponse);
  const sleep = vi.fn();
  const context = loadManager({ fetchAll, fetch, sleep });
  const collected = { fault, fetchAll, fetch, sleep };
  try {
    withTemporaryGlobals(context.globals, () => {
      delete require.cache[context.llmPath];
      const manager = new (require(context.llmPath))();
      const { assignment, item } = createAssignment('TEXT');
      // Request/mapping generation happens before the fault is installed.
      const requests = manager.generateRequestObjects(assignment);
      expect(requests).toHaveLength(1);
      expect(requests[0].uid).toBe(item.artifact.getUid());
      expect(Object.keys(manager.uidIndex)).toHaveLength(1);
      const artefact = item.artifact;
      const artefactSnapshot = structuredClone(artefact.toJSON());
      const documentId = assignment.submissions[0].documentId;
      const reach = install({ manager, item, fault });
      let caught = null;
      try {
        try {
          manager.processStudentResponses(requests, assignment);
        } catch (error) {
          caught = error;
        }
      } finally {
        if (reach.teardown) reach.teardown();
      }
      Object.assign(collected, {
        caught,
        manager,
        assignment,
        item,
        artefact,
        artefactSnapshot,
        documentId,
        reach,
        scriptCache: context.scriptCache,
      });
    });
    return collected;
  } finally {
    vi.restoreAllMocks();
    context.restore();
  }
}

/**
 * Authored processing-isolation controls shared by every fault row. Each row
 * first asserts its own explicit seam reach and exact original-error identity
 * before calling this helper; under Section 6 Green these checks must all hold
 * as well. Against the current source the helper is unreached because every
 * caller fails at its per-row identity assertion first.
 */
function expectOriginalErrorIsolation(collected) {
  const { fetchAll, fetch, sleep, item, artefact, artefactSnapshot, documentId, assignment } =
    collected;
  // One batch with one native member; no semantic single fetch or sleep.
  expect(fetchAll).toHaveBeenCalledTimes(1);
  expect(fetchAll.mock.calls[0][0]).toHaveLength(1);
  expect(fetch).not.toHaveBeenCalled();
  expect(sleep).not.toHaveBeenCalled();
  // Current item.artifact identity plus detached full snapshot and parent ID.
  expect(item.artifact).toBe(artefact);
  expect(artefact.toJSON()).toEqual(artefactSnapshot);
  expect(assignment.submissions[0].documentId).toBe(documentId);
}

/**
 * Authored safety tail shared by the red transport rows: no leaked raw fault
 * text in the safe catalogue reasoning, retained source identity and no cache
 * write. Against the current source these are unreached because every row
 * fails at its catalogued outcome assertion first.
 */
function expectTerminalIsolation(collected, leakMarker) {
  expect(collected.item.getAssessment('completeness').reasoning).not.toContain(leakMarker);
  expectSourceRetained(collected);
  expect(collected.scriptCache.put).not.toHaveBeenCalled();
}

describe('LLM internal fault original-error identity', () => {
  it('propagates the exact original error when the real item.addAssessment mutation throws', () => {
    const collected = runInternalFaultCase(({ item, fault }) => {
      const mutation = vi.spyOn(item, 'addAssessment').mockImplementation(() => {
        throw fault;
      });
      return { mutation };
    });
    // Actual reach: the real model mutation method was invoked.
    expect(collected.reach.mutation.mock.calls.length).toBeGreaterThan(0);
    // Same object identity thrown from the real public processing operation.
    expect(collected.caught).toBe(collected.fault);
    // Source retained and no catalogue E relabelling of the programming fault.
    expectOriginalErrorIsolation(collected);
    expect(collected.item.getAssessment()).toEqual({});
  });

  it('propagates the exact original error when the installed Utils.normaliseKeysToLowerCase throws', () => {
    const collected = runInternalFaultCase(({ fault }) => {
      // Throwing spy on the actual installed global normaliser: no fake
      // validator or processor is substituted for the real semantic seam.
      const normaliser = vi
        .spyOn(globalThis.Utils, 'normaliseKeysToLowerCase')
        .mockImplementation(() => {
          throw fault;
        });
      return { normaliser };
    });
    // Actual reach: the real installed normaliser seam was invoked during decoding.
    expect(collected.reach.normaliser.mock.calls.length).toBeGreaterThan(0);
    // Same object identity thrown from the real public processing operation.
    expect(collected.caught).toBe(collected.fault);
    // Source retained and no catalogue E relabelling of the programming fault.
    expectOriginalErrorIsolation(collected);
    expect(collected.item.getAssessment()).toEqual({});
  });

  it('propagates the exact original error when the retained uidIndex routing lookup throws', () => {
    const collected = runInternalFaultCase(({ manager, fault }) => {
      // Manager-local getter fault installed after request generation; the
      // real processing path reaches it through the retained mapping itself.
      const previousDescriptor = Object.getOwnPropertyDescriptor(manager, 'uidIndex');
      let routingLookups = 0;
      Object.defineProperty(manager, 'uidIndex', {
        configurable: true,
        enumerable: previousDescriptor ? previousDescriptor.enumerable : true,
        get() {
          routingLookups += 1;
          throw fault;
        },
      });
      return {
        routingLookups: () => routingLookups,
        teardown() {
          if (previousDescriptor) {
            Object.defineProperty(manager, 'uidIndex', previousDescriptor);
          } else {
            delete manager.uidIndex;
          }
        },
      };
    });
    // Actual reach through the real routed processing, never a manual getter call.
    expect(collected.reach.routingLookups()).toBeGreaterThan(0);
    // Same object identity thrown from the real public processing operation.
    expect(collected.caught).toBe(collected.fault);
    // Source retained and no catalogue E relabelling of the programming fault.
    expectOriginalErrorIsolation(collected);
    expect(collected.item.getAssessment()).toEqual({});
  });

  it('propagates the exact original error when the real cacheManager.put wiring seam throws', () => {
    const collected = runInternalFaultCase(({ manager, item, fault }) => {
      // Call-through recorder on the real mutation: proves the cache seam is a
      // wiring fault reached after valid data processing, not its replacement.
      const mutation = vi.spyOn(item, 'addAssessment');
      const cachePut = vi.spyOn(manager.cacheManager, 'put').mockImplementation(() => {
        throw fault;
      });
      return { mutation, cachePut };
    });
    // Actual reach: the real CacheManager.put write seam was invoked.
    expect(collected.reach.cachePut.mock.calls.length).toBeGreaterThan(0);
    // Same object identity thrown from the real public processing operation.
    expect(collected.caught).toBe(collected.fault);
    // Wiring seam is reached after assessment mutation completed successfully.
    expect(collected.reach.cachePut.mock.invocationCallOrder[0]).toBeGreaterThan(
      collected.reach.mutation.mock.invocationCallOrder[2]
    );
    // Native script cache is untouched by this wiring/method fault, keeping the
    // generic cache outage path distinct from the manager-owned write seam.
    expect(collected.scriptCache.put).not.toHaveBeenCalled();
    // Full processing isolation and retained source, with no task-wide E or
    // rollback demanded: partial mutation before a cache fault is not a new
    // atomic internal-error policy.
    expectOriginalErrorIsolation(collected);
    expect(collected.item.getAssessment()).toEqual(STUDENT_RESULT_DATA);
  });

  it('propagates the exact original toJSON sentinel from real CacheManager.put serialisation of the validated payload', () => {
    // Authentic seam: the real normaliser runs and the returned assessment root gains
    // ONE non-enumerable throwing toJSON, so the fault can only escape through the real
    // value serialisation inside CacheManager.put — no replaced put, stringify, validator
    // or processor. Enumeration stays numeric-only, so the real shared validator still
    // accepts the exact root that the real serialisation must stringify.
    const collected = runInternalFaultCase(({ manager }) => {
      const thrownSentinels = [];
      const normalisedRoots = [];
      // The harness installs normaliseKeysToLowerCase as a Vitest mock and vi.spyOn
      // REUSES that same mock object, so a captured property reference would recurse
      // into the spy itself; the call-through must capture the underlying real
      // implementation before splicing on the boundary-throwing toJSON.
      const installedNormaliser = globalThis.Utils.normaliseKeysToLowerCase;
      const originalNormaliser =
        typeof installedNormaliser.getMockImplementation === 'function'
          ? installedNormaliser.getMockImplementation()
          : installedNormaliser;
      const normaliser = vi
        .spyOn(globalThis.Utils, 'normaliseKeysToLowerCase')
        .mockImplementation((payload) => {
          // Call-through recorder: the real installed normaliser implementation runs first.
          const normalised = originalNormaliser(payload);
          normalisedRoots.push(normalised);
          // Non-enumerable so criterion iteration and the real validator are unchanged;
          // constructed inside so the captured stack proves CacheManager.put provenance.
          Object.defineProperty(normalised, 'toJSON', {
            value: vi.fn(() => {
              const sentinel = new Error('CACHE_PUT_TOJSON sentinel fault');
              thrownSentinels.push(sentinel);
              throw sentinel;
            }),
            enumerable: false,
            configurable: true,
            writable: true,
          });
          return normalised;
        });
      // Pass-through recorders only: no business logic is replaced anywhere.
      const validator = vi.spyOn(manager, 'validateAssessmentData');
      const cachePut = vi.spyOn(manager.cacheManager, 'put');
      return {
        normaliser,
        validator,
        cachePut,
        thrownSentinels: () => thrownSentinels,
        normalisedRoots: () => normalisedRoots,
      };
    });
    const reach = collected.reach;
    const firstRoot = reach.normalisedRoots()[0];
    // Preflight: the real normaliser was called and returned the intact numeric root.
    expect(reach.normaliser.mock.calls.length).toBeGreaterThan(0);
    expect(firstRoot).toEqual(STUDENT_RESULT_DATA);
    // The real shared validator accepted that exact object as a successful result.
    expect(reach.validator.mock.calls.length).toBeGreaterThan(0);
    expect(reach.validator.mock.calls[0][0]).toBe(firstRoot);
    expect(reach.validator.mock.results[0].value).toBe(true);
    // The real CacheManager.put seam received the identical root with an opaque key and
    // the shared TTL, after validation, while the payload was stringified for real.
    expect(reach.cachePut.mock.calls.length).toBeGreaterThan(0);
    expect(typeof reach.cachePut.mock.calls[0][0]).toBe('string');
    expect(reach.cachePut.mock.calls[0][0].length).toBeGreaterThan(0);
    expect(reach.cachePut.mock.calls[0][1]).toBe(firstRoot);
    expect(reach.cachePut.mock.calls[0][2]).toBe(
      collected.manager.cacheManager.constructor.CACHE_EXPIRY_SECONDS
    );
    expect(reach.cachePut.mock.invocationCallOrder[0]).toBeGreaterThan(
      reach.validator.mock.invocationCallOrder[0]
    );
    // The exact sentinel was thrown by that same real put serialisation: the captured
    // stack runs from toJSON through CacheManager.put, never through a replaced method.
    expect(reach.thrownSentinels().length).toBeGreaterThan(0);
    const sentinel = reach.thrownSentinels()[0];
    expect(sentinel.message).toContain('CACHE_PUT_TOJSON sentinel');
    expect(sentinel.stack).toContain('CacheManager.put');
    // Real put serialisation throws BEFORE the native write, so the native script-cache
    // seam is never reached and this stays distinct from a generic cache outage.
    expect(collected.scriptCache.put).not.toHaveBeenCalled();
    // RED check: the original sentinel must keep exact identity out of the public
    // processStudentResponses boundary instead of a broad decode/retry catch.
    expect(collected.caught).toBe(sentinel);
    // The valid numeric result may already be applied before serialisation; no catalogue
    // E relabelling of this programming fault is acceptable either way.
    expect(collected.item.getAssessment()).toEqual(STUDENT_RESULT_DATA);
    // Authored tail: no further dispatch or sleep beyond the original batch, retained
    // source identity and no native write under the Section 6 GREEN path.
    expectOriginalErrorIsolation(collected);
  });
});

describe('LLM service transport catalogue outcomes', () => {
  it.each([400, 413, 422])(
    'makes HTTP %s a permanent per-request LLM_HTTP_FAILED failure without retry or body access',
    (status) => {
      const rejected = httpResponse(status, `Rejected by the service for ${status}.`);
      // Explicit no-op recorder seam: permanent rejection rows need no spine spies.
      const collected = runTransportCase(
        {
          fetchAll: vi.fn(() => [rejected]),
          fetch: vi.fn(),
          sleep: vi.fn(),
        },
        () => ({})
      );
      expectExecutedTransportCounts(collected, { fetchCalls: 0, sleeps: [] });
      // The permanent classification never needs the rejected body.
      expect(rejected.getContentText).not.toHaveBeenCalled();
      expect(collected.item.getAssessment()).toEqual(
        catalogueHTTPAssessments(HTTP_REJECTED_REASON, 'LLM_HTTP_FAILED')
      );
      // Authored after the current production gap; reached only in Section 6 Green.
      expectSourceRetained(collected);
      expect(collected.scriptCache.put).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['429 too many requests', 429],
    ['500 server error', 500],
  ])(
    'exhausts retryable HTTP %s through the shared budget into LLM_UNAVAILABLE',
    (_label, status) => {
      const responses = exhaustedHttpResponses(status);
      const collected = runTransportCase(
        {
          fetchAll: vi.fn(() => [responses[0]]),
          fetch: vi
            .fn()
            .mockImplementationOnce(() => responses[1])
            .mockImplementationOnce(() => responses[2]),
          sleep: vi.fn(),
        },
        (manager) => ({
          routed: vi.spyOn(manager, '_processSingleResponse'),
          engine: vi.spyOn(manager, '_runRetryEngine'),
        })
      );
      expectExecutedTransportCounts(collected, { fetchCalls: 2, sleeps: [5000, 7500] });
      // Retryable exhaustion is terminal without touching any received body.
      responses.forEach((response) => expect(response.getContentText).not.toHaveBeenCalled());
      // Sequential same-request retries from the real engine: no re-batching
      // and no synthetic outcome substitution anywhere in the accounting.
      expect(collected.fetch.mock.calls.map((call) => call[0])).toEqual([
        collected.requests[0].url,
        collected.requests[0].url,
      ]);
      expect(collected.fetch.mock.calls.map((call) => call[1].payload)).toEqual([
        collected.requests[0].payload,
        collected.requests[0].payload,
      ]);
      const engineResult = collected.spies.engine.mock.results[0].value;
      expect(engineResult.uid).toBe(collected.requests[0].uid);
      expect(engineResult.response).toBe(responses[2]);
      expect(engineResult.error).toBe(null);
      expect(engineResult.attempts).toBe(3);
      const [routedResponse, routedRequest] = collected.spies.routed.mock.calls[0];
      expect(routedResponse).toBe(responses[2]);
      expect(routedRequest).toBe(collected.requests[0]);
      expect(collected.item.getAssessment()).toEqual(
        catalogueHTTPAssessments(SERVICE_EXHAUSTED_REASON, 'LLM_UNAVAILABLE')
      );
      // Authored after the current production gap; reached only in Section 6 Green.
      expectSourceRetained(collected);
      expect(collected.scriptCache.put).not.toHaveBeenCalled();
    }
  );

  it('exhausts native network failures at the UrlFetchApp seam into LLM_UNAVAILABLE', () => {
    const initialError = new Error('NETWORK_OUTAGE_INITIAL sentinel fault');
    const secondError = new Error('NETWORK_OUTAGE_SECOND sentinel fault');
    const finalError = new Error('NETWORK_OUTAGE_FINAL sentinel fault');
    const collected = runTransportCase(
      {
        fetchAll: vi.fn(() => {
          throw initialError;
        }),
        fetch: vi
          .fn()
          .mockImplementationOnce(() => {
            throw secondError;
          })
          .mockImplementationOnce(() => {
            throw finalError;
          }),
        sleep: vi.fn(),
      },
      (manager) => ({
        routed: vi.spyOn(manager, '_processSingleResponse'),
        engine: vi.spyOn(manager, '_runRetryEngine'),
      })
    );
    expectExecutedTransportCounts(collected, { fetchCalls: 2, sleeps: [5000, 7500] });
    // The native seam keeps the final original error across all three attempts.
    const engineResult = collected.spies.engine.mock.results[0].value;
    expect(engineResult.uid).toBe(collected.requests[0].uid);
    expect(engineResult.response).toBe(null);
    expect(engineResult.error).toBe(finalError);
    expect(engineResult.attempts).toBe(3);
    expect(collected.spies.routed).toHaveBeenCalledTimes(1);
    const [routedResponse] = collected.spies.routed.mock.calls[0];
    expect(routedResponse).toBe(null);
    expect(collected.item.getAssessment()).toEqual(
      catalogueHTTPAssessments(SERVICE_EXHAUSTED_REASON, 'LLM_UNAVAILABLE')
    );
    // Authored after the current production gap; reached only in Section 6 Green.
    expectTerminalIsolation(collected, 'NETWORK_OUTAGE');
  });

  it('replaces a stale HTTP 500 with the later network exhaustion outcome', () => {
    const staleServerResponse = httpResponse(500, 'Stale initial server failure.');
    const attemptTwoError = new Error('MIXED_OUTAGE_ATTEMPT_TWO sentinel fault');
    const attemptThreeError = new Error('MIXED_OUTAGE_ATTEMPT_THREE sentinel fault');
    const collected = runTransportCase(
      {
        fetchAll: vi.fn(() => [staleServerResponse]),
        fetch: vi
          .fn()
          .mockImplementationOnce(() => {
            throw attemptTwoError;
          })
          .mockImplementationOnce(() => {
            throw attemptThreeError;
          }),
        sleep: vi.fn(),
      },
      (manager) => ({
        routed: vi.spyOn(manager, '_processSingleResponse'),
        engine: vi.spyOn(manager, '_runRetryEngine'),
      })
    );
    expectExecutedTransportCounts(collected, { fetchCalls: 2, sleeps: [5000, 7500] });
    // A later network failure replaces the stale 500 within the shared budget.
    const engineResult = collected.spies.engine.mock.results[0].value;
    expect(engineResult.uid).toBe(collected.requests[0].uid);
    expect(engineResult.response).toBe(null);
    expect(engineResult.error).toBe(attemptThreeError);
    expect(engineResult.attempts).toBe(3);
    const [routedResponse] = collected.spies.routed.mock.calls[0];
    expect(routedResponse).toBe(null);
    expect(collected.item.getAssessment()).toEqual(
      catalogueHTTPAssessments(SERVICE_EXHAUSTED_REASON, 'LLM_UNAVAILABLE')
    );
    // Authored after the current production gap; reached only in Section 6 Green.
    expectTerminalIsolation(collected, 'MIXED_OUTAGE');
  });

  it('recovers an initial HTTP 500 on the second native attempt without an extra semantic retry', () => {
    const transientFailure = httpResponse(500, 'Transient initial service failure.');
    const recovered = httpResponse(200, JSON.stringify(STUDENT_RESULT_DATA));
    const collected = runTransportCase(
      {
        fetchAll: vi.fn(() => [transientFailure]),
        fetch: vi.fn(() => recovered),
        sleep: vi.fn(),
      },
      (manager) => ({ routed: vi.spyOn(manager, '_processSingleResponse') })
    );
    expectExecutedTransportCounts(collected, { fetchCalls: 1, sleeps: [5000] });
    expect(collected.fetch.mock.calls[0][0]).toBe(collected.requests[0].url);
    const [routedResponse, routedRequest] = collected.spies.routed.mock.calls[0];
    expect(routedResponse).toBe(recovered);
    expect(routedRequest).toBe(collected.requests[0]);
    expect(recovered.getContentText).toHaveBeenCalledTimes(1);
    // Recovery characterisation: this row passes against current production.
    expect(collected.item.getAssessment()).toEqual(STUDENT_RESULT_DATA);
    expectSourceRetained(collected);
    // The existing policy caches the validated recovery result exactly once.
    expect(collected.scriptCache.put).toHaveBeenCalledTimes(1);
  });
});
