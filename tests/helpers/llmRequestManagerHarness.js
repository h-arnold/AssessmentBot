import { expect, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { createMockUtils } from './mockFactories.js';
import { simpleHash } from './testUtils.js';
import { withTemporaryGlobals } from './globalMockManager.js';

const { Validate } = require('#backend/Utils/Validate.js');

/** Strictly expected numeric LLM result body used by cache/live/warm controls. */
export const VALID_RESULT_DATA = {
  completeness: { score: 0, reasoning: 'Complete response.' },
  accuracy: { score: 2.5, reasoning: '' },
  spag: { score: 5, reasoning: 'Some errors.' },
};

/** Complete valid native HTTP 200 carrying strictly expected numeric JSON. */
export function validHttpResponse() {
  return {
    getResponseCode: () => 200,
    getContentText: vi.fn(() => JSON.stringify(VALID_RESULT_DATA)),
  };
}

/**
 * The HISTORICAL two-hash cache key through the real simpleHash contract
 * (`referenceHash::studentHash`). Used ONLY to seed and assert the intentional
 * legacy-entry case. Every other control observes the runtime's own opaque key
 * instead; no future key format, version prefix or tuple encoding is asserted.
 * Never the obsolete generateCacheKey wrapper.
 */
export function twoHashKey(fixture) {
  return simpleHash(
    `${fixture.task.getPrimaryReference().contentHash}::${fixture.item.artifact.contentHash}`
  );
}

function createAssignment(type) {
  const source = Object.values(loadBackendModelInputs('small').assignmentsByKey)
    .flatMap((assignment) =>
      Object.values(assignment.submissions ?? {}).flatMap((submission) =>
        Object.entries(submission.items ?? {}).map(([taskId, item]) => ({
          assignment,
          submission,
          taskId,
          item,
          task: assignment.assignmentDefinition.tasks[taskId],
        }))
      )
    )
    .find(({ item, task }) => {
      const healthyAssessments =
        item.assessments &&
        Object.keys(item.assessments).length === 3 &&
        ['completeness', 'accuracy', 'spag'].every((criterion) =>
          Number.isFinite(item.assessments[criterion]?.score)
        );
      const matchingTypes =
        item.artifact?.type === type &&
        task?.artifacts?.reference?.[0]?.type === type &&
        task?.artifacts?.template?.[0]?.type === type;
      const usableHashes =
        typeof item.artifact.contentHash === 'string' &&
        item.artifact.contentHash.length > 0 &&
        typeof task.artifacts.template[0].contentHash === 'string' &&
        task.artifacts.template[0].contentHash.length > 0;
      let typeSpecificContent;
      if (type === 'TEXT') {
        typeSpecificContent =
          typeof item.artifact.content === 'string' &&
          item.artifact.contentHash !== task.artifacts.template[0].contentHash &&
          item.artifact.content !== task.artifacts.template[0].content;
      } else if (type === 'IMAGE') {
        // Completed documented IMAGE artefact: real image data-URL body with a
        // usable string hash, never a pending null-content match, and never a
        // relabelled TEXT or wrong-typed artefact.
        typeSpecificContent =
          typeof item.artifact.content === 'string' &&
          item.artifact.content.startsWith('data:image/') &&
          item.artifact.contentHash !== task.artifacts.template[0].contentHash;
      } else {
        typeSpecificContent =
          Array.isArray(item.artifact.content) && item.artifact.content.length > 0;
      }
      return healthyAssessments && matchingTypes && usableHashes && typeSpecificContent;
    });
  if (!source)
    throw new Error(`Small canonical inputs contain no healthy distinct-hash ${type} item.`);
  const assignment = globalThis.Assignment.fromJSON(structuredClone(source.assignment));
  const submission = assignment.submissions.find(
    (entry) => entry.studentId === source.submission.studentId
  );
  const item = submission.getItem(source.taskId);
  // Eligibility controls need an in-flight item; spreadsheet controls retain their completed results.
  if (type === 'TEXT') item.assessments = {};
  assignment.submissions = [submission];
  submission.items = { [source.taskId]: item };
  const task = assignment.assignmentDefinition.tasks[source.taskId];
  return { assignment, task, item };
}

function loadManager({ fetchAll, fetch, sleep }) {
  const basePath = require.resolve('#backend/RequestHandlers/BaseRequestManager.js');
  const llmPath = require.resolve('#backend/RequestHandlers/LLMRequestManager.js');
  const previousLlmModule = require.cache[llmPath];
  const BaseRequestManager = require(basePath);
  // Faithful native script-cache storage for repeated writes: one per-context
  // Map; native get returns the LAST value written for a key and null on miss;
  // native put stores the actual serialised argument it receives and remains
  // observable as vi.fn.
  const cacheStorage = new Map();
  const progressTracker = {
    updateProgress: vi.fn(),
    getCurrentProgress: () => ({ message: 'Assessing' }),
    logError: vi.fn(),
    logAndThrowError: vi.fn((message) => {
      throw new Error(message);
    }),
  };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const scriptCache = {
    get: vi.fn((key) => (cacheStorage.has(key) ? cacheStorage.get(key) : null)),
    put: vi.fn((key, value) => cacheStorage.set(key, value)),
  };
  const restore = () => {
    delete require.cache[llmPath];
    if (previousLlmModule) require.cache[llmPath] = previousLlmModule;
  };
  const globals = {
    BaseRequestManager: () => BaseRequestManager,
    ConfigurationManager: () => ({
      getInstance: () => ({
        getBackendUrl: () => 'https://llm.test',
        getApiKey: () => 'test-key',
        getBackendAssessorBatchSize: () => 10,
      }),
    }),
    CacheService: () => ({ getScriptCache: () => scriptCache }),
    ProgressTracker: () => ({ getInstance: () => progressTracker }),
    ABLogger: () => ({ getInstance: () => logger }),
    UrlFetchApp: () => ({ fetchAll, fetch }),
    Utilities: () => ({ sleep }),
    Utils: () => createMockUtils(vi),
    Validate: () => Validate,
  };
  return { llmPath, restore, globals, scriptCache, cacheStorage, progressTracker, logger };
}

const TRANSPORT_CRITERIA = ['completeness', 'accuracy', 'spag'];

/** Complete native HTTP response with an unused but observable content text. */
function httpResponse(status, body) {
  return {
    getResponseCode: () => status,
    getContentText: vi.fn(() => body),
  };
}

// Exact atomic all-three catalogue replacement required from every transport outcome.
function catalogueHTTPAssessments(reasoning, code) {
  return Object.fromEntries(
    TRANSPORT_CRITERIA.map((criterion) => [
      criterion,
      { score: 'E', reasoning, error: { stage: 'assessment', code } },
    ])
  );
}

// Mixed stale numeric/N seeding through the existing domain API; never a prior E
// so request generation stays eligible in both the Red and the later Green runs.
function seedStaleMixedMarks(item) {
  item.addAssessment('completeness', { score: 4, reasoning: 'stale numeric mark' });
  item.addAssessment('accuracy', { score: 'N', reasoning: 'stale N mark' });
  item.addAssessment('spag', { score: 1, reasoning: 'stale numeric mark' });
}

/** The exact stale mixed numeric/N map seeded by seedStaleMixedMarks. */
const STALE_MIXED_MARKS = {
  completeness: { score: 4, reasoning: 'stale numeric mark' },
  accuracy: { score: 'N', reasoning: 'stale N mark' },
  spag: { score: 1, reasoning: 'stale numeric mark' },
};

/**
 * Shared transport runner. It establishes the real canonical TEXT model, seeds
 * mixed stale numeric/N marks, captures the mutated source identity, generates
 * one real request, then runs the real processStudentResponses against the
 * caller's complete native HTTP fixtures. Spies installed through the required
 * prepareManager call-through seam observe the real seams (no mock ever
 * returns an outcome; a caller that needs none passes a no-op recorder). The
 * caught value is captured explicitly so a swallowed or propagated fault can
 * never masquerade as a catalogue Red.
 */
function runTransportCase(natives, prepareManager) {
  const context = loadManager(natives);
  const collected = { ...natives };
  try {
    withTemporaryGlobals(context.globals, () => {
      delete require.cache[context.llmPath];
      const manager = new (require(context.llmPath))();
      const { assignment, item } = createAssignment('TEXT');
      seedStaleMixedMarks(item);
      const artefact = item.artifact;
      const artefactSnapshot = structuredClone(artefact.toJSON());
      const documentId = assignment.submissions[0].documentId;
      const requests = manager.generateRequestObjects(assignment);
      expect(requests).toHaveLength(1);
      expect(requests[0].uid).toBe(artefact.getUid());
      const spies = prepareManager(manager);
      let caught = null;
      try {
        manager.processStudentResponses(requests, assignment);
      } catch (error) {
        caught = error;
      }
      Object.assign(collected, {
        manager,
        assignment,
        item,
        artefact,
        artefactSnapshot,
        documentId,
        requests,
        caught,
        scriptCache: context.scriptCache,
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
 * Executed transport-budget proof: the exact native dispatch counts and waits
 * happen before the catalogued outcome is asserted, and any escape from
 * processing surfaces here instead of behind the catalogue expectation.
 */
function expectExecutedTransportCounts(collected, { fetchCalls, sleeps }) {
  expect(collected.fetchAll).toHaveBeenCalledTimes(1);
  expect(collected.fetch).toHaveBeenCalledTimes(fetchCalls);
  expect(collected.sleep.mock.calls.map((call) => call[0])).toEqual(sleeps);
  expect(collected.caught).toBe(null);
}

// Current item.artifact reference plus detached full snapshot and parent ID,
// captured after every fixture mutation and required unchanged after processing.
function expectSourceRetained(collected) {
  const { item, artefact, artefactSnapshot, documentId, assignment } = collected;
  expect(item.artifact).toBe(artefact);
  expect(artefact.toJSON()).toEqual(artefactSnapshot);
  expect(assignment.submissions[0].documentId).toBe(documentId);
}

/**
 * Test-only shared cache runner: one fresh real LLM manager inside one context
 * and cache under the real temporary globals. Required arguments, no defaults.
 * The collected object also exposes the context's stable logger and progress
 * tracker so suites can assert cached-hit diagnostics on real channels.
 */
function withCacheManager(natives, callback) {
  const context = loadManager(natives);
  try {
    return withTemporaryGlobals(context.globals, () => {
      delete require.cache[context.llmPath];
      const manager = new (require(context.llmPath))();
      const collected = {
        manager,
        scriptCache: context.scriptCache,
        cacheStorage: context.cacheStorage,
        cacheManagerClass: manager.cacheManager.constructor,
        logger: context.logger,
        progressTracker: context.progressTracker,
      };
      callback(collected);
      return collected;
    });
  } finally {
    vi.restoreAllMocks();
    context.restore();
  }
}

/** Runs one real generation and returns the native get keys it issued. */
function observeLookup(collected, assignment) {
  const before = collected.scriptCache.get.mock.calls.length;
  const requests = collected.manager.generateRequestObjects(assignment);
  return {
    requests,
    keys: collected.scriptCache.get.mock.calls.slice(before).map((call) => call[0]),
  };
}

/** Changes exactly one canonical content fingerprint on a real cloned model. */
function mutateFingerprint(fixture, component) {
  if (component === 'reference') {
    const reference = fixture.task.getPrimaryReference();
    reference.content = 'Controlled changed reference content for cache key sensitivity.';
    reference.ensureHash();
  } else if (component === 'template') {
    const template = fixture.task.getPrimaryTemplate();
    template.content = 'Controlled changed template content for cache key sensitivity.';
    template.ensureHash();
  } else if (component === 'student') {
    const artefact = fixture.item.artifact;
    artefact.content = 'Controlled changed student response for cache key sensitivity.';
    artefact.ensureHash();
  } else {
    throw new Error(`Unknown cache fingerprint component: ${component}`);
  }
}

const RUN_STOP_CRITERIA = ['completeness', 'accuracy', 'spag'];
const RUN_STOP_REASONING =
  'Assessment stopped because the service credentials or endpoint were rejected.';

/** Exact canonical all-three LLM_RUN_STOPPED JSON required from terminal stop rows. */
function canonicalRunStoppedAssessments() {
  return Object.fromEntries(
    RUN_STOP_CRITERIA.map((criterion) => [
      criterion,
      {
        score: 'E',
        reasoning: RUN_STOP_REASONING,
        error: { stage: 'assessment', code: 'LLM_RUN_STOPPED' },
      },
    ])
  );
}

/**
 * Proof-first shared assertions for the mixed run-stop rows. Native budgets,
 * routed identities and retained sources are proven BEFORE any catalogue
 * expectation. Rows with a stop-cancelled retryable sibling
 * (collected.cancelled) also prove that sibling's cancelled-outcome
 * provenance: the untouched initial retryable response with attempts 1 from
 * the real batch consumption, plus its canonical LLM_RUN_STOPPED map — the
 * current source mislabels it LLM_UNAVAILABLE, the intended business Red.
 */
function expectRunStopTerminalStops(collected) {
  const canonical = canonicalRunStoppedAssessments();
  const { stop, requests, numeric, caught, spies, scriptCache } = collected;
  const target = numeric.find((entry) => entry.role === 'target');
  const unprocessed = numeric.find((entry) => entry.role === 'unprocessed');
  const healthy = numeric.find((entry) => entry.role === 'healthy');
  const cancelled = collected.cancelled || null;
  const permanent = collected.permanent || null;
  expect(target).toBeDefined();
  if (!cancelled) {
    expect(unprocessed).toBeDefined();
    if (!permanent) expect(healthy).toBeDefined();
  }

  // Exactly three ordered unique UID requests excluding the genuine N sibling.
  expect(requests).toHaveLength(3);
  expect(new Set(requests.map((request) => request.uid)).size).toBe(3);
  expect(requests.map((request) => request.uid)).toEqual(
    numeric.map((entry) => entry.item.artifact.getUid())
  );

  // Native budgets before any catalogue failure: one fetchAll per dispatched
  // batch, no later batch after the stop, exact waits and attempts.
  const expectedFetchAllLengths = collected.batchSize === 1 ? [1, 1] : [collected.batchSize];
  expect(collected.fetchAll).toHaveBeenCalledTimes(expectedFetchAllLengths.length);
  expect(collected.fetchAll.mock.calls.map((call) => call[0].length)).toEqual(
    expectedFetchAllLengths
  );
  if (stop.origin === 'INITIAL') {
    expect(collected.fetch).not.toHaveBeenCalled();
    expect(collected.sleep).not.toHaveBeenCalled();
    expect(spies.engine).not.toHaveBeenCalled();
  } else {
    expect(collected.fetch).toHaveBeenCalledTimes(1);
    expect(collected.fetch.mock.calls[0][0]).toBe(target.request.url);
    expect(collected.fetch.mock.calls[0][1].payload).toBe(target.request.payload);
    expect(collected.sleep.mock.calls.map((call) => call[0])).toEqual([5000]);
    expect(spies.engine).toHaveBeenCalledTimes(1);
    const engineOutcome = spies.engine.mock.results[0].value;
    expect(engineOutcome.uid).toBe(target.request.uid);
    expect(engineOutcome.response).toBe(collected.stopResponse);
    expect(engineOutcome.attempts).toBe(2);
  }
  // Outcomes are routed to the original request objects with the original
  // received response objects, pinned by identity; batch consumption carries
  // the cancelled sibling's real attempts-1 provenance, size-3 its healthy member.
  expect(spies.processor).toHaveBeenCalledTimes(cancelled && healthy ? 3 : 2);
  const routings = new Map(
    spies.processor.mock.calls.map((pair) => [pair[1].uid, { response: pair[0], request: pair[1] }])
  );
  expect(routings.get(target.request.uid).response).toBe(collected.stopResponse);
  expect(routings.get(target.request.uid).request).toBe(target.request);
  if (cancelled) {
    expect(routings.get(cancelled.request.uid).response).toBe(collected.cancelledResponse);
    expect(routings.get(cancelled.request.uid).request).toBe(cancelled.request);
    const cancelledOutcome = spies.consume.mock.results[0].value.find(
      (outcome) => outcome.uid === cancelled.request.uid
    );
    expect(cancelledOutcome.response).toBe(collected.cancelledResponse);
    expect(cancelledOutcome.error).toBe(null);
    expect(cancelledOutcome.attempts).toBe(1);
  }
  expect(collected.unexpectedNativePayloads).toEqual([]);

  // Error bodies are never read: neither the stop response nor an initial 500.
  expect(collected.stopResponse.getContentText).not.toHaveBeenCalled();
  if (collected.initialServerResponse) {
    expect(collected.initialServerResponse.getContentText).not.toHaveBeenCalled();
  }
  if (cancelled) expect(collected.cancelledResponse.getContentText).not.toHaveBeenCalled();

  // The three numeric source identities, detached snapshots and parent IDs
  // are preserved; the signature's fourth source identity is proven below.
  numeric.forEach((entry) => {
    expect(entry.item.artifact).toBe(entry.artifact);
    expect(entry.item.artifact.toJSON()).toEqual(entry.artifactSnapshot);
    expect(entry.item.taskId).toBe(entry.task.getId());
    expect(entry.submission.documentId).toBe(entry.documentId);
  });
  if (healthy) {
    expect(routings.get(healthy.request.uid).response).toBe(collected.healthyNativeResponse);
    expect(routings.get(healthy.request.uid).request).toBe(healthy.request);
    expect(spies.healthyAddAssessment).toHaveBeenCalledTimes(3);
    spies.healthyAddAssessment.mock.calls.forEach((call) =>
      expect(call[1]).toBeInstanceOf(globalThis.Assessment)
    );
    expect(healthy.item.getAssessment()).toEqual(healthy.expectedBody);
  }
  if (permanent) {
    // Permanent per-request protection: the sibling beside a latched stop keeps
    // its canonical LLM_HTTP_FAILED outcome and its rejection body stays unread.
    expect(collected.permanentResponse.getContentText).not.toHaveBeenCalled();
    expect(collected.permanent.item.getAssessment()).toEqual(
      catalogueHTTPAssessments('The assessment service rejected the request.', 'LLM_HTTP_FAILED')
    );
  }

  // The genuine N sibling keeps its current source identity, detached
  // snapshot, task association and parent document ID, plus its exact N map
  // and all three entry references, proven before the stop-domain Reds below.
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
  RUN_STOP_CRITERIA.forEach((criterion, index) => {
    expect(signature.item.getAssessment(criterion)).toBe(signature.entries[index]);
  });

  // The stop must be domain completion-with-errors, never an unhandled run
  // abort; the current 401/403 abort is the intended business Red here (404
  // reaches the terminal maps below instead).
  expect(caught).toBe(null);

  // The stopped target, the unprocessed sibling and the stop-cancelled
  // retryable sibling (when configured) must each be terminal with the exact
  // canonical LLM_RUN_STOPPED map. The cancelled sibling currently receives
  // LLM_UNAVAILABLE instead — the new Red boundary for stop-cancelled work.
  [target, unprocessed, cancelled].filter(Boolean).forEach((entry) => {
    expect(entry.item.getAssessment()).toEqual(canonical);
  });

  // Exactly one healthy cache put per healthy row and no E cache write;
  // cancelled-only rows must not write any cache entry at all.
  expect(scriptCache.put).toHaveBeenCalledTimes(healthy ? 1 : 0);
  if (healthy) {
    const nativeCachePutValue = scriptCache.put.mock.calls[0][1];
    expect(typeof nativeCachePutValue).toBe('string');
    expect(JSON.parse(nativeCachePutValue)).toEqual(healthy.expectedBody);
  }
}

export {
  catalogueHTTPAssessments,
  canonicalRunStoppedAssessments,
  createAssignment,
  expectExecutedTransportCounts,
  expectRunStopTerminalStops,
  expectSourceRetained,
  httpResponse,
  loadManager,
  mutateFingerprint,
  observeLookup,
  RUN_STOP_CRITERIA,
  runTransportCase,
  seedStaleMixedMarks,
  STALE_MIXED_MARKS,
  withCacheManager,
};
