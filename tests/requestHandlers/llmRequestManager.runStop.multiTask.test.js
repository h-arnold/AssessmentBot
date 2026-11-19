import { describe, it, expect, vi } from 'vitest';
import { withTemporaryGlobals } from '../helpers/globalMockManager.js';
import {
  createMultiTaskRunStopAssignment,
  expectSingleTaskFixture,
  runRunStopControl,
} from '../helpers/llmRunStopHarness.js';
import { RUN_STOP_UNEXPECTED_PAYLOAD_GUARD } from '../helpers/llmRunStopHarness.js';
import {
  canonicalRunStoppedAssessments,
  catalogueHTTPAssessments,
  expectSignatureEntries,
  httpResponse,
  loadManager,
  seedStaleMixedMarks,
} from '../helpers/llmRequestManagerHarness.js';

/**
 * Two-phase migration of the single-task stop-at-index-0 assertions. The single
 * seed is the stop target: phase 1 is a one-member round that latches `runStopped`,
 * so phase 2 never dispatches. Every remainder member is terminalised
 * `LLM_RUN_STOPPED` without further HTTP. All expectations are derived from the
 * two-phase seed/remainder split of the selected fixture, never pinned to
 * regenerated task keys or counts.
 *
 * @param {object} collected Run-stop collection from `runRunStopControl`.
 * @param {object} options `cancelled` marks the retryable sibling role; `retryIndex`
 * identifies the member whose retry revealed the stop (the seed in these rows);
 * `viaRetry` forces the retry-transport budget when a retryable seed, not the
 * stop's own INITIAL response, is what revealed the stop.
 */
function expectSeedRoundStop(collected, { cancelled = false, retryIndex = 0, viaRetry } = {}) {
  const retryBudget = viaRetry ?? collected.stop.origin === 'TRANSPORT_RETRY';
  const canonical = canonicalRunStoppedAssessments();
  const {
    numeric,
    requests,
    stop,
    spies,
    scriptCache,
    caught,
    stopResponse,
    initialServerResponse,
  } = collected;
  const target = numeric[stop.requestIndex];
  const retryEntry = numeric[retryIndex];

  // One seed per task identity in a single-task fixture: the seed round holds
  // only the first request; the other two form the skipped remainder.
  expectSingleTaskFixture(collected);
  const seedIndexes = [0];
  const remainderIndexes = numeric.map((_, index) => index).slice(1);
  expect(requests).toHaveLength(numeric.length);
  expect(new Set(requests.map((request) => request.uid)).size).toBe(requests.length);
  expect(requests.map((request) => request.uid)).toEqual(
    numeric.map((entry) => entry.item.artifact.getUid())
  );

  // Native budget: phase 1 dispatches the seed round only; phase 2 is skipped
  // after the stop, so there is exactly one fetchAll of size seeds.length.
  expect(collected.fetchAll).toHaveBeenCalledTimes(1);
  expect(collected.fetchAll.mock.calls.map((call) => call[0].length)).toEqual([seedIndexes.length]);
  expect(collected.unexpectedNativePayloads).toEqual([]);

  // Retry semantics: a direct INITIAL stop at the seed needs no retry; a
  // TRANSPORT_RETRY stop (or a retryable seed that reveals the stop on its own
  // first retry) goes through exactly one wait and one retry-engine outcome.
  if (retryBudget) {
    expect(collected.fetch).toHaveBeenCalledTimes(1);
    expect(collected.fetch.mock.calls[0][0]).toBe(retryEntry.request.url);
    expect(collected.fetch.mock.calls[0][1].payload).toBe(retryEntry.request.payload);
    expect(collected.sleep.mock.calls.map((call) => call[0])).toEqual([5000]);
    expect(spies.engine).toHaveBeenCalledTimes(1);
    const engineOutcome = spies.engine.mock.results[0].value;
    expect(engineOutcome.uid).toBe(retryEntry.request.uid);
    expect(engineOutcome.response).toBe(stopResponse);
    expect(engineOutcome.attempts).toBe(2);
  } else {
    expect(collected.fetch).not.toHaveBeenCalled();
    expect(collected.sleep).not.toHaveBeenCalled();
    expect(spies.engine).not.toHaveBeenCalled();
  }

  // Only the stop-designated outcome was routed; remainder members were never
  // dispatched, so no attempts-1 cancelled provenance exists for them any more.
  expect(spies.processor).toHaveBeenCalledTimes(1);
  expect(spies.processor.mock.calls[0][0]).toBe(stopResponse);
  expect(spies.processor.mock.calls[0][1]).toBe(retryEntry.request);

  // Error bodies are never read, including a configured cancelled/permanent
  // sibling that the skipped remainder never dispatched.
  expect(stopResponse.getContentText).not.toHaveBeenCalled();
  if (initialServerResponse) expect(initialServerResponse.getContentText).not.toHaveBeenCalled();
  if (cancelled) expect(collected.cancelledResponse.getContentText).not.toHaveBeenCalled();

  // Source identities and detached snapshots survive processing unchanged.
  numeric.forEach((entry) => {
    expect(entry.item.artifact).toBe(entry.artifact);
    expect(entry.item.artifact.toJSON()).toEqual(entry.artifactSnapshot);
    expect(entry.item.taskId).toBe(entry.task.getId());
    expect(entry.submission.documentId).toBe(entry.documentId);
  });
  expectSignatureEntries(collected);

  // The stop is domain completion with errors, never an unhandled run abort.
  expect(caught).toBe(null);

  // The target and every never-dispatched remainder member terminalise with the
  // exact canonical LLM_RUN_STOPPED map, replacing their stale marks.
  [target, ...remainderIndexes.map((index) => numeric[index])].forEach((entry) =>
    expect(entry.item.getAssessment()).toEqual(canonical)
  );

  // No healthy outcome was routed, so no cache write occurs.
  expect(scriptCache.put).not.toHaveBeenCalled();
}

describe('LLM controlled-batch run-stop terminalisation (two-phase seed rounds)', () => {
  // Stop at index 0 is the single seed: phase 1 is a one-member round and the
  // two same-task siblings in the remainder are never dispatched.
  it.each([
    [401, 'INITIAL'],
    [403, 'INITIAL'],
    [404, 'INITIAL'],
    [401, 'TRANSPORT_RETRY'],
    [403, 'TRANSPORT_RETRY'],
    [404, 'TRANSPORT_RETRY'],
  ])(
    'terminalises the stopped seed and its skipped remainder for HTTP %s from %s origin at batch size 2',
    (status, origin) => {
      const collected = runRunStopControl('medium', 3, 2, {
        stop: { requestIndex: 0, origin, status },
      });
      expectSeedRoundStop(collected);
    }
  );

  // The retryable sibling is the same-task remainder member beside the stop.
  // Under two-phase dispatch it is never dispatched, so it terminalises through
  // the shared run-stop path with the same canonical map as before.
  it.each([
    [401, 'INITIAL'],
    [403, 'INITIAL'],
    [404, 'INITIAL'],
    [401, 'TRANSPORT_RETRY'],
    [403, 'TRANSPORT_RETRY'],
    [404, 'TRANSPORT_RETRY'],
  ])(
    'terminalises the stop-cancelled retryable sibling for HTTP %s from %s origin at batch size 2',
    (status, origin) => {
      const collected = runRunStopControl('medium', 3, 2, {
        stop: { requestIndex: 0, origin, status },
        cancelledRetryable: true,
      });
      expectSeedRoundStop(collected, { cancelled: true });
    }
  );

  it('terminalises the stop-cancelled retryable sibling preceding an INITIAL stop', () => {
    // Reverse arrangement: the retryable 500 is the seed, dispatched before the
    // stop-designated remainder member. Its own retry reveals the stop, latching
    // the run in phase 1; the stop target and third member are never dispatched.
    // Deriving the retry carrier from the seed round keeps the order-sensitivity
    // proof without assuming the old same-batch arrangement.
    const collected = runRunStopControl('medium', 3, 2, {
      stop: { requestIndex: 1, origin: 'INITIAL', status: 401 },
      cancelledRetryable: true,
    });
    expectSeedRoundStop(collected, { cancelled: true, retryIndex: 0, viaRetry: true });
  });

  it('keeps a permanent sibling LLM_HTTP_FAILED beside an INITIAL stop latch', () => {
    // With the stop at index 0 (seed) the single-task remainder is skipped, so
    // a permanent sibling there would never be dispatched and would lose its
    // LLM_HTTP_FAILED identity. Place the permanent sibling in the seed round
    // and the stop in the remainder instead: batch size 1 gives a one-member
    // healthy/permanent seed followed by a one-member stop round. The permanent
    // rejection is dispatched and keeps LLM_HTTP_FAILED beside the latched stop.
    const collected = runRunStopControl('medium', 3, 1, {
      stop: { requestIndex: 1, origin: 'INITIAL', status: 401 },
      permanentSibling: true,
    });
    expectSingleTaskFixture(collected);
    const canonical = canonicalRunStoppedAssessments();
    const { numeric, requests, spies, scriptCache, caught, stopResponse, permanentResponse } =
      collected;
    const permanent = numeric[0];
    const target = numeric[1];
    const unprocessed = numeric[2];

    expect(requests).toHaveLength(numeric.length);
    expect(requests.map((request) => request.uid)).toEqual(
      numeric.map((entry) => entry.item.artifact.getUid())
    );
    // Phase 1 dispatches the permanent seed; phase 2 dispatches the stop as a
    // single-member round, then the following member is skipped after the latch.
    expect(collected.fetchAll.mock.calls.map((call) => call[0].length)).toEqual([1, 1]);
    expect(collected.unexpectedNativePayloads).toEqual([]);
    expect(collected.fetch).not.toHaveBeenCalled();
    expect(collected.sleep).not.toHaveBeenCalled();
    expect(spies.engine).not.toHaveBeenCalled();

    expect(spies.processor).toHaveBeenCalledTimes(2);
    expect(spies.processor.mock.calls[0][0]).toBe(permanentResponse);
    expect(spies.processor.mock.calls[0][1]).toBe(permanent.request);
    expect(spies.processor.mock.calls[1][0]).toBe(stopResponse);
    expect(spies.processor.mock.calls[1][1]).toBe(target.request);

    expect(stopResponse.getContentText).not.toHaveBeenCalled();
    expect(permanentResponse.getContentText).not.toHaveBeenCalled();

    numeric.forEach((entry) => {
      expect(entry.item.artifact).toBe(entry.artifact);
      expect(entry.item.artifact.toJSON()).toEqual(entry.artifactSnapshot);
      expect(entry.item.taskId).toBe(entry.task.getId());
      expect(entry.submission.documentId).toBe(entry.documentId);
    });
    expectSignatureEntries(collected);
    expect(caught).toBe(null);

    // The dispatched permanent rejection keeps its catalogue identity; the stop
    // target and never-dispatched member terminalise with the canonical map.
    expect(permanent.item.getAssessment()).toEqual(
      catalogueHTTPAssessments('The assessment service rejected the request.', 'LLM_HTTP_FAILED')
    );
    [target, unprocessed].forEach((entry) => expect(entry.item.getAssessment()).toEqual(canonical));
    expect(scriptCache.put).not.toHaveBeenCalled();
  });
});

/**
 * Multi-task same-batch-survivor runner. Consumes the opt-in multi-task harness
 * selector so the two numeric candidates span two task identities: both are
 * seeds in one parallel round, so a stop at index 0 latches the run while the
 * healthy sibling seeded beside it still receives its numeric outcome. No
 * harness capability is changed and no fixture value is hard-coded.
 */
function runMultiTaskSeedSurvivor() {
  const responsesBySource = new Map();
  const unexpectedNativePayloads = [];
  const fetchAll = vi.fn((nativeRequests) =>
    nativeRequests.map((nativeRequest) => {
      const content = JSON.parse(nativeRequest.payload).studentResponse;
      const configured = responsesBySource.get(content);
      if (!configured) {
        unexpectedNativePayloads.push({ seam: 'fetchAll', content });
        return RUN_STOP_UNEXPECTED_PAYLOAD_GUARD;
      }
      return configured;
    })
  );
  const fetch = vi.fn((url) => {
    unexpectedNativePayloads.push({ seam: 'fetch', url: String(url) });
    return RUN_STOP_UNEXPECTED_PAYLOAD_GUARD;
  });
  const sleep = vi.fn();
  const context = loadManager({ fetchAll, fetch, sleep });
  const collected = { fetchAll, fetch, sleep, unexpectedNativePayloads, responsesBySource };
  try {
    withTemporaryGlobals(context.globals, () => {
      delete require.cache[context.llmPath];
      const manager = new (require(context.llmPath))();
      const fixture = createMultiTaskRunStopAssignment('medium', 2);
      const [target, survivor] = fixture.numeric;
      const template = fixture.notAttempted.task.getPrimaryTemplate();
      expect(typeof template.content === 'string' && template.content.length > 0).toBe(true);
      fixture.notAttempted.item.artifact.content = template.content;
      fixture.notAttempted.item.artifact.contentHash = template.contentHash;
      const requests = manager.generateRequestObjects(fixture.assignment);
      expect(requests).toHaveLength(fixture.numeric.length);

      const stopResponse = httpResponse(401, 'Rejection body kept unread by every caller.');
      const survivorBody = {
        completeness: { score: 0, reasoning: 'Same-batch survivor completeness.' },
        accuracy: { score: 2.5, reasoning: '' },
        spag: { score: 5, reasoning: 'Same-batch survivor spag.' },
      };
      responsesBySource.set(target.item.artifact.content, stopResponse);
      responsesBySource.set(
        survivor.item.artifact.content,
        httpResponse(200, JSON.stringify(survivorBody))
      );
      // Stale mixed marks are seeded after generation, as in the single-task rows.
      seedStaleMixedMarks(target.item);
      seedStaleMixedMarks(survivor.item);

      const captured = fixture.numeric.map((entry) => ({
        entry,
        artifact: entry.item.artifact,
        artifactSnapshot: structuredClone(entry.item.artifact.toJSON()),
        documentId: entry.submission.documentId,
        taskId: entry.task.getId(),
      }));
      const signature = {
        entry: fixture.notAttempted,
        mapSnapshot: structuredClone(fixture.notAttempted.item.getAssessment()),
        entries: ['completeness', 'accuracy', 'spag'].map((criterion) =>
          fixture.notAttempted.item.getAssessment(criterion)
        ),
      };
      const spies = {
        processor: vi.spyOn(manager, '_processSingleResponse'),
        survivorAddAssessment: vi.spyOn(survivor.item, 'addAssessment'),
      };
      let caught = null;
      try {
        manager.processStudentResponses(requests, fixture.assignment);
      } catch (error) {
        caught = error;
      }
      Object.assign(collected, {
        manager,
        requests,
        target,
        survivor,
        survivorBody,
        stopResponse,
        captured,
        signature,
        spies,
        caught,
        scriptCache: context.scriptCache,
      });
    });
    return collected;
  } finally {
    vi.restoreAllMocks();
    context.restore();
  }
}

describe('LLM same-batch healthy sibling survives a multi-task seed stop', () => {
  it('terminalises the stop-cancelled retryable sibling while a same-batch healthy member survives', () => {
    const collected = runMultiTaskSeedSurvivor();
    const {
      requests,
      target,
      survivor,
      captured,
      signature,
      spies,
      stopResponse,
      survivorBody,
      caught,
      scriptCache,
    } = collected;

    // Derive the seed/remainder split from the fixture's task identities: one
    // seed per task means both candidates are seeds and the remainder is empty,
    // so exactly one parallel round is dispatched with size = seed count.
    const seedCount = new Set(captured.map((row) => row.taskId)).size;
    expect(seedCount).toBe(captured.length);
    expect(collected.fetchAll).toHaveBeenCalledTimes(1);
    expect(collected.fetchAll.mock.calls.map((call) => call[0].length)).toEqual([seedCount]);
    expect(collected.unexpectedNativePayloads).toEqual([]);
    expect(collected.fetch).not.toHaveBeenCalled();
    expect(collected.sleep).not.toHaveBeenCalled();
    expect(requests.map((request) => request.uid)).toEqual(
      captured.map((row) => row.entry.item.artifact.getUid())
    );

    // Both seed outcomes are routed in the same round; the accepted survivor is
    // processed first by the shared consumer's accepted-first sort.
    expect(spies.processor).toHaveBeenCalledTimes(2);
    expect(spies.processor.mock.calls[0][0]).not.toBe(stopResponse);
    expect(spies.processor.mock.calls[0][1].uid).toBe(survivor.item.artifact.getUid());
    expect(spies.processor.mock.calls[1][0]).toBe(stopResponse);
    expect(spies.processor.mock.calls[1][1].uid).toBe(target.item.artifact.getUid());

    // The stop body is never read; the stop is domain completion, not an abort.
    expect(stopResponse.getContentText).not.toHaveBeenCalled();
    expect(caught).toBe(null);

    captured.forEach((row) => {
      expect(row.entry.item.artifact).toBe(row.artifact);
      expect(row.entry.item.artifact.toJSON()).toEqual(row.artifactSnapshot);
      expect(row.entry.item.taskId).toBe(row.taskId);
      expect(row.entry.submission.documentId).toBe(row.documentId);
    });

    // The stop target terminalises canonically while the healthy same-batch
    // sibling keeps its numeric body, its three Assessment writes and its cache
    // entry; the genuine template-copy N sibling stays untouched.
    expect(target.item.getAssessment()).toEqual(canonicalRunStoppedAssessments());
    expect(survivor.item.getAssessment()).toEqual(survivorBody);
    expect(spies.survivorAddAssessment).toHaveBeenCalledTimes(3);
    spies.survivorAddAssessment.mock.calls.forEach((call) =>
      expect(call[1]).toBeInstanceOf(globalThis.Assessment)
    );
    expect(signature.entry.item.getAssessment()).toEqual(signature.mapSnapshot);
    ['completeness', 'accuracy', 'spag'].forEach((criterion, index) => {
      expect(signature.entry.item.getAssessment(criterion)).toBe(signature.entries[index]);
    });
    expect(scriptCache.put).toHaveBeenCalledTimes(1);
  });
});
