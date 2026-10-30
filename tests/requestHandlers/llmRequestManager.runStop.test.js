import { describe, it, expect, vi } from 'vitest';
import { withTemporaryGlobals } from '../helpers/globalMockManager.js';
import { createRunStopAssignment, runRunStopControl } from '../helpers/llmRunStopHarness.js';
import { RUN_STOP_UNEXPECTED_PAYLOAD_GUARD } from '../helpers/llmRunStopHarness.js';
import {
  catalogueHTTPAssessments,
  canonicalRunStoppedAssessments,
  expectRunStopTerminalStops,
  loadManager,
  RUN_STOP_CRITERIA,
  seedStaleMixedMarks,
} from '../helpers/llmRequestManagerHarness.js';

describe('LLM controlled-batch run-stop healthy controls', () => {
  it.each([[1], [2]])(
    'keeps canonical numeric candidates and the template signature healthy at batch size %s',
    (batchSize) => {
      const collected = runRunStopControl('medium', 3, batchSize, { stop: null });

      // Native budget: batched fetchAll only; no single fetch and no waits.
      expect(collected.fetch).not.toHaveBeenCalled();
      expect(collected.sleep).not.toHaveBeenCalled();
      const expectedCallLengths = batchSize === 1 ? [1, 1, 1] : [2, 1];
      expect(collected.fetchAll).toHaveBeenCalledTimes(expectedCallLengths.length);
      expect(collected.fetchAll.mock.calls.map((call) => call[0].length)).toEqual(
        expectedCallLengths
      );

      // Three distinct complete numeric bodies, one per real received member.
      expect(new Set(collected.bodies.values()).size).toBe(3);

      // Exactly three unique requests matching the ordered numeric candidates.
      expect(collected.requests.map((request) => request.uid)).toEqual(
        collected.numeric.map((entry) => entry.item.artifact.getUid())
      );

      // Every eligible item received its exact numeric JSON, source retained.
      collected.numeric.forEach((entry) => {
        expect(collected.bodies.get(entry.item.artifact.content)).toBe(entry.expectedBody);
        expect(entry.item.artifact).toBe(entry.artifact);
        expect(entry.item.artifact.toJSON()).toEqual(entry.artifactSnapshot);
        expect(entry.item.taskId).toBe(entry.task.getId());
        expect(entry.submission.documentId).toBe(entry.documentId);
        expect(entry.item.getAssessment()).toEqual(entry.expectedBody);
      });

      // The genuine template signature keeps exact N JSON and its entries.
      const signature = collected.signature;
      expect(signature.item.artifact).toBe(signature.artifact);
      expect(signature.item.artifact.toJSON()).toEqual(signature.artifactSnapshot);
      expect(signature.item.taskId).toBe(signature.task.getId());
      expect(signature.submission.documentId).toBe(signature.documentId);
      expect(signature.item.getAssessment()).toEqual({
        completeness: { score: 'N', reasoning: 'Task not attempted' },
        accuracy: { score: 'N', reasoning: 'Task not attempted' },
        spag: { score: 'N', reasoning: 'Task not attempted' },
      });
      ['completeness', 'accuracy', 'spag'].forEach((criterion, index) => {
        expect(signature.item.getAssessment(criterion)).toBe(signature.entries[index]);
      });

      // Healthy cache writes remain allowed: one per successful numeric item.
      expect(collected.scriptCache.put).toHaveBeenCalledTimes(3);
    }
  );
});

describe('LLM controlled-batch run-stop terminalisation', () => {
  it.each([
    [401, 'INITIAL', 2, 0],
    [403, 'INITIAL', 2, 0],
    [404, 'INITIAL', 2, 0],
    [401, 'TRANSPORT_RETRY', 2, 0],
    [403, 'TRANSPORT_RETRY', 2, 0],
    [404, 'TRANSPORT_RETRY', 2, 0],
    [401, 'INITIAL', 1, 1],
    [403, 'INITIAL', 1, 1],
    [404, 'INITIAL', 1, 1],
    [401, 'TRANSPORT_RETRY', 1, 1],
    [403, 'TRANSPORT_RETRY', 1, 1],
    [404, 'TRANSPORT_RETRY', 1, 1],
  ])(
    'terminalises the stopped request and its unprocessed sibling for HTTP %s from %s origin at batch size %s',
    (status, origin, batchSize, stopIndex) => {
      const collected = runRunStopControl('medium', 3, batchSize, {
        stop: { requestIndex: stopIndex, origin, status },
      });
      // Proof-first shared assertions. The intended first Red boundary is the
      // completion expectation for the current 401/403 logAndThrowError abort
      // and the canonical terminal map for 404's silent continuation.
      expectRunStopTerminalStops(collected);
    }
  );

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
      // Proof-first shared assertions including the cancelled sibling's
      // attempts-1 provenance from the real batch consumption. The intended
      // Red boundary is the cancelled sibling's terminal map: Base returned
      // its untouched initial 500 (retries cancelled by the stop), so it is
      // affected remaining eligible work — the current source labels it
      // LLM_UNAVAILABLE instead of the required LLM_RUN_STOPPED.
      expectRunStopTerminalStops(collected);
    }
  );

  it('terminalises the stop-cancelled retryable sibling while a same-batch healthy member survives', () => {
    const collected = runRunStopControl('medium', 3, 3, {
      stop: { requestIndex: 0, origin: 'INITIAL', status: 401 },
      cancelledRetryable: true,
    });
    // One batch of three: stop target, cancelled retryable sibling and a
    // healthy member dispatched after both. All proof-first shared assertions
    // run; the cancelled sibling's canonical map is the intended Red.
    expectRunStopTerminalStops(collected);
  });

  it('terminalises the stop-cancelled retryable sibling preceding an INITIAL stop', () => {
    // Reverse arrangement: the retryable 500 is dispatched BEFORE the stop in
    // the same initial batch; an order-sensitive repair must not pass only forward rows.
    const collected = runRunStopControl('medium', 3, 2, {
      stop: { requestIndex: 1, origin: 'INITIAL', status: 401 },
      cancelledRetryable: true,
    });
    expectRunStopTerminalStops(collected);
  });

  it('keeps a permanent sibling LLM_HTTP_FAILED beside an INITIAL stop latch', () => {
    const collected = runRunStopControl('medium', 3, 2, {
      stop: { requestIndex: 0, origin: 'INITIAL', status: 401 },
      permanentSibling: true,
    });
    // Latch true while processing: canonical LLM_HTTP_FAILED must survive the stop.
    expectRunStopTerminalStops(collected);
  });
});

describe('LLM genuine transport exhaustion is never relabelled by a sibling stop', () => {
  it('keeps a network-exhausted member LLM_UNAVAILABLE while a later sibling retry reveals the stop', () => {
    const firstMemberErrors = [
      new Error('EXHAUSTION_NETWORK_ONE sentinel'),
      new Error('EXHAUSTION_NETWORK_FINAL sentinel'),
    ];
    const unexpectedNativePayloads = [];
    let firstMemberContent = null;
    let secondMemberContent = null;
    let firstMemberFetches = 0;
    // Real Base consumption at batch size 2: the first member exhausts its
    // three attempts on network failures before the second member's first
    // retry returns the stop. Members share one endpoint URL, so retries are
    // distinguished by their request payload's student content. No outcome is
    // ever substituted.
    const fetch = vi.fn((url, nativeRequest) => {
      const content = nativeRequest ? JSON.parse(nativeRequest.payload).studentResponse : null;
      if (content === firstMemberContent) {
        const thrown = firstMemberErrors[firstMemberFetches];
        firstMemberFetches += 1;
        throw thrown || new Error('Unexpected extra exhausted-member retry.');
      }
      if (content !== secondMemberContent) {
        unexpectedNativePayloads.push({ seam: 'fetch', url: String(url) });
        return { getResponseCode: () => 600, getContentText: () => 'guard' };
      }
      return {
        getResponseCode: () => 401,
        getContentText: vi.fn(() => 'Stop body withheld from every caller.'),
      };
    });
    const fetchAll = vi.fn((nativeRequests) =>
      nativeRequests.map(() => ({
        getResponseCode: () => 500,
        getContentText: vi.fn(() => 'Initial retryable body, never read.'),
      }))
    );
    const sleep = vi.fn();
    const context = loadManager({ fetchAll, fetch, sleep });
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const manager = new (require(context.llmPath))();
        const fixture = createRunStopAssignment('medium', 2);
        const template = fixture.notAttempted.task.getPrimaryTemplate();
        fixture.notAttempted.item.artifact.content = template.content;
        fixture.notAttempted.item.artifact.contentHash = template.contentHash;
        const requests = manager.generateRequestObjects(fixture.assignment);
        expect(requests).toHaveLength(2);
        firstMemberContent = JSON.parse(requests[0].payload).studentResponse;
        secondMemberContent = JSON.parse(requests[1].payload).studentResponse;
        vi.spyOn(manager.configManager, 'getBackendAssessorBatchSize').mockImplementation(() => 2);
        const engine = vi.spyOn(manager, '_runRetryEngine');
        manager.processStudentResponses(requests, fixture.assignment);
        // Native budget: both members entered the real engine sequentially;
        // the first exhausted three attempts (waits 5000/7500), the second
        // stopped on its first retry (wait 5000).
        expect(fetchAll).toHaveBeenCalledTimes(1);
        expect(firstMemberFetches).toBe(2);
        expect(unexpectedNativePayloads).toEqual([]);
        expect(sleep.mock.calls.map((call) => call[0])).toEqual([5000, 7500, 5000]);
        const firstOutcome = engine.mock.results[0].value;
        expect(firstOutcome.uid).toBe(requests[0].uid);
        expect(firstOutcome.response).toBe(null);
        expect(firstOutcome.error).toBe(firstMemberErrors[1]);
        expect(firstOutcome.attempts).toBe(3);
        // Genuine exhaustion keeps its LLM_UNAVAILABLE catalogue outcome even
        // though a sibling stop latched the run afterwards; no E is cached.
        expect(fixture.numeric[0].item.getAssessment()).toEqual(
          catalogueHTTPAssessments(
            'The assessment service could not complete the request after retries.',
            'LLM_UNAVAILABLE'
          )
        );
        expect(fixture.numeric[1].item.getAssessment()).toEqual(canonicalRunStoppedAssessments());
        expect(context.scriptCache.put).not.toHaveBeenCalled();
      });
    } finally {
      vi.restoreAllMocks();
      context.restore();
    }
  });
});

/** Numeric body the genuine cold cache write stores for the cached sibling. */
const CACHED_STOP_BODY = {
  completeness: { score: 1, reasoning: 'Cached surviving result.' },
  accuracy: { score: 3.5, reasoning: '' },
  spag: { score: 4, reasoning: 'Cached surviving result.' },
};

/** Distinct from every live run-stop payload so a relabel cannot masquerade. */
const CACHED_STOP_NATIVE = () => ({
  getResponseCode: () => 200,
  getContentText: vi.fn(() => JSON.stringify(CACHED_STOP_BODY)),
});

/**
 * Cached-stop row. The cold phase does ONE real valid dispatch inside this native
 * cache context and asserts the real wrapper write (string JSON, shared TTL); its
 * history is then cleared. The warm phase uses a fresh real manager and a fresh
 * identical model: the cached sibling is excluded by a genuine cache hit, the
 * signature sibling by genuine template-copy N, and the last two candidates
 * carry the target and LATER-unprocessed roles. Batch size is exactly 1 and no
 * outcome is ever substituted.
 */
function runCachedStopControl(status, origin) {
  const withNativeCode = (code, content) => ({
    getResponseCode: () => code,
    getContentText: vi.fn(() => content),
  });
  const stopResponse = withNativeCode(status, 'Stop body withheld from every caller.');
  const initialServerResponse =
    origin === 'TRANSPORT_RETRY'
      ? withNativeCode(500, 'Transient initial server body withheld.')
      : null;
  const responsesBySource = new Map();
  const unexpectedNativePayloads = [];
  let targetUrl = null;
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
    if (origin !== 'TRANSPORT_RETRY' || url !== targetUrl) {
      unexpectedNativePayloads.push({ seam: 'fetch', url: String(url) });
      return RUN_STOP_UNEXPECTED_PAYLOAD_GUARD;
    }
    return stopResponse;
  });
  const sleep = vi.fn();
  const context = loadManager({ fetchAll, fetch, sleep });
  const collected = { batchSize: 1, origin, fetchAll, fetch, sleep };
  try {
    withTemporaryGlobals(context.globals, () => {
      delete require.cache[context.llmPath];
      const CacheManagerOwner = require('#backend/RequestHandlers/CacheManager.js');
      const Manager = require(context.llmPath);
      // COLD: one real valid dispatch writes the numeric result in this context.
      const cold = createRunStopAssignment('medium', 3);
      const coldManager = new Manager();
      const coldRequests = coldManager.generateRequestObjects(cold.assignment);
      expect(coldRequests.length).toBeGreaterThan(0);
      responsesBySource.set(cold.numeric[0].item.artifact.content, CACHED_STOP_NATIVE());
      coldManager.processStudentResponses([coldRequests[0]], cold.assignment);
      expect(cold.numeric[0].item.getAssessment()).toEqual(CACHED_STOP_BODY);
      expect(context.scriptCache.put).toHaveBeenCalledTimes(1);
      const coldPut = context.scriptCache.put.mock.calls[0];
      expect(typeof coldPut[1]).toBe('string');
      expect(JSON.parse(coldPut[1])).toEqual(CACHED_STOP_BODY);
      expect(coldPut[2]).toBe(CacheManagerOwner.CacheManager.CACHE_EXPIRY_SECONDS);
      expect(context.cacheStorage.get(coldPut[0])).toBe(coldPut[1]);
      const coldStoreSize = context.cacheStorage.size;
      // Clear cold history: the tested phase proves its own native budgets only.
      fetchAll.mockClear();
      fetch.mockClear();
      sleep.mockClear();
      context.scriptCache.get.mockClear();
      context.scriptCache.put.mockClear();
      // WARM: fresh manager and fresh identical model, genuine N before generation.
      const warm = createRunStopAssignment('medium', 3);
      const warmManager = new Manager();
      const template = warm.notAttempted.task.getPrimaryTemplate();
      expect(typeof template.content === 'string' && template.content.length > 0).toBe(true);
      expect(typeof template.contentHash === 'string' && template.contentHash.length > 0).toBe(
        true
      );
      warm.notAttempted.item.artifact.content = template.content;
      warm.notAttempted.item.artifact.contentHash = template.contentHash;
      const requests = warmManager.generateRequestObjects(warm.assignment);
      // Cached sibling excluded by the hit; template-copy signature excluded by N.
      expect(requests).toHaveLength(2);
      expect(requests.map((request) => request.uid)).toEqual(
        [warm.numeric[1], warm.numeric[2]].map((entry) => entry.item.artifact.getUid())
      );
      seedStaleMixedMarks(warm.numeric[1].item);
      seedStaleMixedMarks(warm.numeric[2].item);
      const cached = warm.numeric[0];
      const cachedEntries = RUN_STOP_CRITERIA.map((criterion) =>
        cached.item.getAssessment(criterion)
      );
      const signature = warm.notAttempted;
      const tracks = [
        { role: 'cached', entry: cached },
        { role: 'target', entry: warm.numeric[1] },
        { role: 'later', entry: warm.numeric[2] },
        { role: 'signature', entry: signature },
      ].map(({ role, entry }) => ({
        role,
        entry,
        artifact: entry.item.artifact,
        artifactSnapshot: structuredClone(entry.item.artifact.toJSON()),
        documentId: entry.submission.documentId,
      }));
      tracks[0].entries = cachedEntries;
      tracks[3].mapSnapshot = structuredClone(signature.item.getAssessment());
      tracks[3].entries = RUN_STOP_CRITERIA.map((criterion) =>
        signature.item.getAssessment(criterion)
      );
      targetUrl = requests[0].url;
      responsesBySource.set(
        warm.numeric[1].item.artifact.content,
        origin === 'INITIAL' ? stopResponse : initialServerResponse
      );
      const spies = {
        batchSize: vi
          .spyOn(warmManager.configManager, 'getBackendAssessorBatchSize')
          .mockImplementation(() => 1),
        engine: vi.spyOn(warmManager, '_runRetryEngine'),
        processor: vi.spyOn(warmManager, '_processSingleResponse'),
      };
      let caught = null;
      try {
        warmManager.processStudentResponses(requests, warm.assignment);
      } catch (error) {
        caught = error;
      }
      Object.assign(collected, {
        caught,
        assignment: warm.assignment,
        requests,
        tracks,
        unexpectedNativePayloads,
        stopResponse,
        initialServerResponse,
        cachedBody: CACHED_STOP_BODY,
        coldStoreSize,
        scriptCache: context.scriptCache,
        cacheStorage: context.cacheStorage,
        spies,
      });
    });
    return collected;
  } finally {
    vi.restoreAllMocks();
    context.restore();
  }
}

/**
 * Shared cached-stop assertions. Survival identities, native budgets, unread
 * bodies and routing execute BEFORE the no-abort requirement (first Red for
 * 401/403 rows); 404 rows first fail on the stopped target's canonical map, and
 * the not-attempted/cache tails stay authored behind those boundaries.
 */
function expectCachedStopSurvival(collected) {
  const { requests, tracks, stopResponse, initialServerResponse, spies, origin } = collected;
  const target = tracks.find((track) => track.role === 'target');
  const later = tracks.find((track) => track.role === 'later');
  const signature = tracks.find((track) => track.role === 'signature');
  const cached = tracks.find((track) => track.role === 'cached');
  const canonical = canonicalRunStoppedAssessments();

  // Tested native budget: one single-member batch carrying the target's real
  // content; the LATER sibling is never dispatched; no unexpected member ever.
  expect(collected.fetchAll).toHaveBeenCalledTimes(1);
  expect(collected.fetchAll.mock.calls[0][0]).toHaveLength(1);
  expect(JSON.parse(collected.fetchAll.mock.calls[0][0][0].payload).studentResponse).toBe(
    target.entry.item.artifact.content
  );
  expect(collected.unexpectedNativePayloads).toEqual([]);
  if (origin === 'INITIAL') {
    expect(collected.fetch).not.toHaveBeenCalled();
    expect(collected.sleep).not.toHaveBeenCalled();
    expect(spies.engine).not.toHaveBeenCalled();
  } else {
    expect(collected.fetch).toHaveBeenCalledTimes(1);
    expect(collected.fetch.mock.calls[0][0]).toBe(requests[0].url);
    expect(collected.fetch.mock.calls[0][1].payload).toBe(requests[0].payload);
    expect(collected.sleep.mock.calls.map((call) => call[0])).toEqual([5000]);
    expect(spies.engine).toHaveBeenCalledTimes(1);
    const engineOutcome = spies.engine.mock.results[0].value;
    expect(engineOutcome.uid).toBe(requests[0].uid);
    expect(engineOutcome.response).toBe(stopResponse);
    expect(engineOutcome.attempts).toBe(2);
  }

  // Neither the stop body nor the initial 500 body is ever read.
  expect(stopResponse.getContentText).not.toHaveBeenCalled();
  if (initialServerResponse) expect(initialServerResponse.getContentText).not.toHaveBeenCalled();

  // Routing identity: the original routed request and received response objects.
  expect(spies.processor).toHaveBeenCalledTimes(1);
  expect(spies.processor.mock.calls[0][0]).toBe(stopResponse);
  expect(spies.processor.mock.calls[0][1]).toBe(requests[0]);
  expect(spies.processor.mock.calls[0][2]).toBe(collected.assignment);

  // Survival identities: current artefact references, detached full snapshots
  // and parent document IDs execute before every stop-domain requirement.
  tracks.forEach((track) => {
    expect(track.entry.item.artifact).toBe(track.artifact);
    expect(track.entry.item.artifact.toJSON()).toEqual(track.artifactSnapshot);
    expect(track.entry.item.taskId).toBe(track.entry.task.getId());
    expect(track.entry.submission.documentId).toBe(track.documentId);
  });

  // The cached numeric result survives exactly, by map value and entry identity.
  expect(cached.entry.item.getAssessment()).toEqual(collected.cachedBody);
  ['completeness', 'accuracy', 'spag'].forEach((criterion, index) => {
    expect(cached.entry.item.getAssessment(criterion)).toBe(cached.entries[index]);
    expect(cached.entry.item.getAssessment(criterion)).toEqual(collected.cachedBody[criterion]);
  });

  // The genuine template-copy N result survives with its exact map and entries.
  expect(signature.entry.item.getAssessment()).toEqual(signature.mapSnapshot);
  ['completeness', 'accuracy', 'spag'].forEach((criterion, index) => {
    expect(signature.entry.item.getAssessment(criterion)).toBe(signature.entries[index]);
  });

  // The stop must be domain completion-with-errors, never an unhandled run
  // abort; the current 401/403 logAndThrowError abort is the intended business
  // Red here (404 reaches the terminal maps below instead).
  expect(collected.caught).toBe(null);

  // Both the stopped and the LATER-unprocessed item must be terminal with the
  // exact canonical LLM_RUN_STOPPED map, replacing every stale mark.
  [target, later].forEach((track) => expect(track.entry.item.getAssessment()).toEqual(canonical));

  // No cache write of any kind in the tested phase: the stored cached numeric
  // value is the untouched cold write, never relabelled and never an E entry.
  expect(collected.scriptCache.put).not.toHaveBeenCalled();
  expect(collected.cacheStorage.size).toBe(collected.coldStoreSize);
  [...collected.cacheStorage.values()].forEach((storedJson) => {
    expect(typeof storedJson).toBe('string');
    expect(JSON.parse(storedJson)).toEqual(collected.cachedBody);
  });
}

describe('LLM cached numeric result survives a real run-stop', () => {
  it.each([
    [401, 'INITIAL'],
    [403, 'INITIAL'],
    [404, 'INITIAL'],
    [401, 'TRANSPORT_RETRY'],
    [403, 'TRANSPORT_RETRY'],
    [404, 'TRANSPORT_RETRY'],
  ])(
    'keeps the cached hit and genuine N terminal while HTTP %s from %s origin terminalises both remaining candidates',
    (status, origin) => {
      expectCachedStopSurvival(runCachedStopControl(status, origin));
    }
  );
});
