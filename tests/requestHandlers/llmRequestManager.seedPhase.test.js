/**
 * RED-phase contract suite for issue #309 §2: seed partition and two-phase
 * dispatch. Assertions run through `processStudentResponses()`; the future
 * sibling module is never imported, so the suite loads and fails for behaviour.
 */
import { describe, it, expect, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withTemporaryGlobals } from '../helpers/globalMockManager.js';
import { createMultiTaskRunStopAssignment } from '../helpers/llmRunStopHarness.js';
import {
  canonicalRunStoppedAssessments,
  catalogueHTTPAssessments,
  createAssignment,
  httpResponse,
  loadManager,
  VALID_RESULT_DATA,
  validHttpResponse,
} from '../helpers/llmRequestManagerHarness.js';

const CRITERIA = ['completeness', 'accuracy', 'spag'];
const BATCH = 10;
const ONE = 1;

const sourceOf = (request) => JSON.parse(request.payload).studentResponse;

// Corpus-backed realism gate mirroring the run-stop harness.
function isNumericTextCandidate(task, item) {
  const artifact = item.artifact;
  const reference = task?.artifacts?.reference?.[0];
  const template = task?.artifacts?.template?.[0];
  const matched =
    artifact?.type === 'TEXT' && reference?.type === 'TEXT' && template?.type === 'TEXT';
  const numeric =
    Object.keys(item.assessments ?? {}).length === CRITERIA.length &&
    CRITERIA.every((criterion) => Number.isFinite(item.assessments[criterion]?.score));
  const usable = [
    artifact?.content,
    artifact?.contentHash,
    reference?.contentHash,
    template?.contentHash,
  ].every((value) => typeof value === 'string' && value.length > 0);
  return Boolean(
    matched &&
    numeric &&
    usable &&
    artifact.contentHash !== template.contentHash &&
    artifact.content !== template.content
  );
}

// First corpus assignment with enough TEXT tasks holding numeric healthy rows.
function findSeedHost(profile, taskCount, perTask) {
  for (const source of Object.values(loadBackendModelInputs(profile).assignmentsByKey)) {
    const byTask = new Map();
    for (const submission of source.submissions ?? []) {
      for (const [taskId, item] of Object.entries(submission.items ?? {})) {
        if (!isNumericTextCandidate(source.assignmentDefinition.tasks[taskId], item)) continue;
        if (!byTask.has(taskId)) byTask.set(taskId, []);
        byTask.get(taskId).push({ submission, item });
      }
    }
    const groups = [...byTask.entries()]
      .filter(([, rows]) => rows.length >= perTask)
      .slice(0, taskCount)
      .map(([taskId, rows]) => ({ taskId, rows: rows.slice(0, perTask) }));
    if (groups.length === taskCount) return { source, groups };
  }
  throw new Error(`${profile}: no ${taskCount}-task x ${perTask} candidate assignment.`);
}

// Restores a narrowed corpus assignment whose selected rows are dispatch-eligible.
function buildSeedFixture(profile = 'medium', taskCount = 2, perTask = 2) {
  const { source, groups } = findSeedHost(profile, taskCount, perTask);
  const assignment = globalThis.Assignment.fromJSON(structuredClone(source));
  const submissions = new Set();
  const tracked = [];
  groups.forEach((group) =>
    group.rows.forEach((candidate) => {
      const submission = assignment.submissions.find(
        (s) => s.studentId === candidate.submission.studentId
      );
      const item = submission?.getItem(group.taskId);
      if (!submission || !item) throw new Error('Seed fixture lost a selected canonical pair.');
      item.assessments = {};
      submissions.add(submission);
      tracked.push({ taskId: group.taskId, submission, item });
    })
  );
  const sources = tracked.map((entry) => entry.item.artifact.content);
  if (new Set(sources).size !== sources.length) throw new Error('Duplicate seed content.');
  assignment.submissions = [...submissions];
  submissions.forEach((submission) => {
    submission.items = Object.fromEntries(
      Object.entries(submission.items).filter(([taskId]) =>
        tracked.some((entry) => entry.submission === submission && entry.taskId === taskId)
      )
    );
  });
  return { assignment, tracked };
}

// One-request-per-task harness fixture: template-copy signature stays not attempted.
function buildHarnessFixture() {
  const fixture = createMultiTaskRunStopAssignment('medium', 2);
  const template = fixture.notAttempted.task.getPrimaryTemplate();
  fixture.notAttempted.item.artifact.content = template.content;
  fixture.notAttempted.item.artifact.contentHash = template.contentHash;
  return fixture;
}

// Independent oracle: first eligible request per task identity, then the rest.
function expectedPartition(manager, requests) {
  const seeds = [];
  const remainder = [];
  const seen = new Set();
  for (const request of requests) {
    const taskId = manager.uidIndex[request.uid]?.taskDefinition?.getId();
    if (!taskId) throw new Error(`Partition oracle: no task for UID ${request.uid}.`);
    if (seen.has(taskId)) remainder.push(request);
    else {
      seen.add(taskId);
      seeds.push(request);
    }
  }
  return { seeds, remainder };
}

function withLoadedManager(body, options = {}) {
  const natives = { fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() };
  const context = loadManager(natives);
  try {
    withTemporaryGlobals({ ...context.globals, ...(options.globals ?? {}) }, () => {
      delete require.cache[context.llmPath];
      body({ manager: new (require(context.llmPath))(), context, natives });
    });
  } finally {
    vi.restoreAllMocks();
    context.restore();
  }
}

// Stateful progress tracker that models ProgressTracker message replacement.
function createStatefulProgressTracker(initialMessage = 'Assessing') {
  let message = initialMessage;
  const tracker = {
    updateProgress: vi.fn((nextMessage) => {
      message = nextMessage;
    }),
    getCurrentProgress: vi.fn(() => ({ message })),
    logError: vi.fn(),
    logAndThrowError: vi.fn((text) => {
      throw new Error(text);
    }),
  };
  return tracker;
}

function answerAllValid({ bySource, requests }) {
  requests.forEach((request) => bySource.set(sourceOf(request), validHttpResponse()));
  return {};
}

function answerAllExcept(source, response) {
  return ({ bySource, requests }) => {
    requests.forEach((request) =>
      bySource.set(sourceOf(request), sourceOf(request) === source ? response : validHttpResponse())
    );
    return {};
  };
}

// Runs generation and processing, capturing observable call data as plain values.
function runSeedCase({ buildFixture, batchSize, configure, globals, progressTracker }) {
  const bySource = new Map();
  const unexpected = [];
  const events = [];
  const state = {};
  withLoadedManager(
    ({ manager, context, natives }) => {
      const fixture = buildFixture();
      const requests = manager.generateRequestObjects(fixture.assignment);
      context.logger.info.mockClear();
      natives.fetchAll.mockImplementation((nativeRequests) => {
        events.push({ type: 'fetchAll', count: nativeRequests.length });
        return nativeRequests.map((nativeRequest) => {
          const source = sourceOf({ payload: nativeRequest.payload });
          if (!bySource.has(source)) {
            unexpected.push(source);
            return httpResponse(600, 'Unexpected dispatch guard.');
          }
          return bySource.get(source);
        });
      });
      if (Number.isInteger(batchSize)) {
        vi.spyOn(manager.configManager, 'getBackendAssessorBatchSize').mockImplementation(
          () => batchSize
        );
      }
      const oracle = expectedPartition(manager, requests);
      const tracker = progressTracker ?? context.progressTracker;
      const progressSpy = vi.spyOn(tracker, 'updateProgress');
      const originalSend = manager.sendRequestsInBatches.bind(manager);
      const sendSpy = vi
        .spyOn(manager, 'sendRequestsInBatches')
        .mockImplementation((batchRequests, options) => {
          events.push({
            type: 'send',
            batchSize: options.batchSize,
            uidCount: batchRequests.length,
          });
          return originalSend(batchRequests, options);
        });
      const originalProcess = manager._processSingleResponse.bind(manager);
      const procSpy = vi
        .spyOn(manager, '_processSingleResponse')
        .mockImplementation((response, request, attempts) => {
          events.push({ type: 'process', uid: request.uid });
          return originalProcess(response, request, attempts);
        });
      const config = configure
        ? configure({ bySource, requests, oracle, fixture, manager, context, natives })
        : {};
      let caught = null;
      try {
        manager.processStudentResponses(config.requests ?? requests, fixture.assignment);
      } catch (error) {
        caught = error;
      }
      Object.assign(state, {
        manager,
        fixture,
        requests,
        oracle,
        caught,
        events,
        sendCalls: sendSpy.mock.calls.map((call) => ({
          requests: call[0],
          batchSize: call[1].batchSize,
        })),
        procCalls: procSpy.mock.calls.map((call) => ({ request: call[1] })),
        progressCalls: progressSpy.mock.calls.map((call) => [...call]),
        infoLogs: context.logger.info.mock.calls.map((call) => [...call]),
        cachePuts: context.scriptCache.put.mock.calls.length,
        fetchCalls: natives.fetchAll.mock.calls.map((call) =>
          call[0].map((native) => sourceOf({ payload: native.payload }))
        ),
        fetchCount: natives.fetchAll.mock.calls.length,
        unexpected: [...unexpected],
      });
    },
    { globals }
  );
  return state;
}

describe('LLM seed partition derived from generated requests', () => {
  it('selects the first eligible request per task and preserves generation order in both phases', () => {
    const state = runSeedCase({
      buildFixture: () => buildSeedFixture('medium', 2, 2),
      batchSize: BATCH,
      configure: answerAllValid,
    });
    const { oracle, sendCalls, requests, manager, caught, unexpected } = state;
    expect(caught).toBe(null);
    expect(unexpected).toEqual([]);
    expect(oracle.seeds.length).toBeGreaterThan(0);
    expect(oracle.remainder.length).toBeGreaterThan(0);
    const seedTaskIds = oracle.seeds.map((request) =>
      manager.uidIndex[request.uid].taskDefinition.getId()
    );
    expect(new Set(seedTaskIds).size).toBe(seedTaskIds.length);
    expect(sendCalls).toHaveLength(2);
    expect(sendCalls[0].requests.map((r) => r.uid)).toEqual(oracle.seeds.map((r) => r.uid));
    expect(sendCalls[1].requests.map((r) => r.uid)).toEqual(oracle.remainder.map((r) => r.uid));
    expect([...sendCalls[0].requests, ...sendCalls[1].requests].map((r) => r.uid)).toEqual(
      requests.map((r) => r.uid)
    );
  });
});

describe('LLM seed partition fail-fast faults', () => {
  it('names the offending UID and dispatches nothing when a request has no route-map entry', () => {
    const state = runSeedCase({
      buildFixture: () => buildSeedFixture(),
      batchSize: BATCH,
      configure: ({ bySource, requests }) => {
        answerAllValid({ bySource, requests });
        return { requests: [{ ...requests[0], uid: 'orphan-no-route-uid' }, ...requests] };
      },
    });
    expect(state.caught).toBeInstanceOf(Error);
    expect(state.caught.message).toContain('orphan-no-route-uid');
    expect(state.fetchCount).toBe(0);
    expect(state.sendCalls).toHaveLength(0);
    expect(state.cachePuts).toBe(0);
  });

  it('names the offending UID and dispatches nothing when a route entry lacks a taskDefinition', () => {
    const state = runSeedCase({
      buildFixture: () => buildSeedFixture(),
      batchSize: BATCH,
      configure: ({ bySource, requests, manager }) => {
        answerAllValid({ bySource, requests });
        delete manager.uidIndex[requests[0].uid].taskDefinition;
        return {};
      },
    });
    expect(state.caught).toBeInstanceOf(Error);
    expect(state.caught.message).toContain(state.requests[0].uid);
    expect(state.fetchCount).toBe(0);
    expect(state.sendCalls).toHaveLength(0);
    expect(state.cachePuts).toBe(0);
  });

  it('names the duplicated UID and dispatches nothing when a UID is supplied twice', () => {
    const state = runSeedCase({
      buildFixture: () => buildSeedFixture(),
      batchSize: BATCH,
      configure: ({ bySource, requests }) => {
        answerAllValid({ bySource, requests });
        return { requests: [requests[0], { ...requests[0] }, ...requests.slice(1)] };
      },
    });
    expect(state.caught).toBeInstanceOf(Error);
    expect(state.caught.message).toContain(state.requests[0].uid);
    expect(state.fetchCount).toBe(0);
  });
});

describe('LLM two-phase dispatch orchestration', () => {
  it('dispatches a seed round at seed-count batch size before a throttled remainder', () => {
    const state = runSeedCase({
      buildFixture: () => buildSeedFixture('medium', 2, 2),
      batchSize: BATCH,
      configure: answerAllValid,
    });
    expect(state.caught).toBe(null);
    expect(state.sendCalls).toHaveLength(2);
    expect(state.sendCalls[0].batchSize).toBe(state.oracle.seeds.length);
    expect(state.sendCalls[1].batchSize).toBe(BATCH);
    expect(state.fetchCalls).toHaveLength(2);
    expect(state.fetchCalls[0]).toEqual(state.oracle.seeds.map(sourceOf));
    expect(state.fetchCalls[1]).toEqual(state.oracle.remainder.map(sourceOf));
  });

  it('makes only one sender call when every eligible task has a single request', () => {
    const state = runSeedCase({
      buildFixture: buildHarnessFixture,
      batchSize: BATCH,
      configure: answerAllValid,
    });
    expect(state.caught).toBe(null);
    expect(state.oracle.remainder).toHaveLength(0);
    expect(state.infoLogs.filter(([m]) => /seed/i.test(String(m)))).toEqual([]);
    expect(state.sendCalls).toHaveLength(1);
    expect(state.sendCalls[0].batchSize).toBe(state.oracle.seeds.length);
    expect(state.sendCalls[0].requests.map((r) => r.uid)).toEqual(state.requests.map((r) => r.uid));
  });

  it('skips phase 2 and terminalises never-dispatched remainder items after a seed stop', () => {
    const state = runSeedCase({
      buildFixture: () => buildSeedFixture('medium', 2, 2),
      batchSize: BATCH,
      configure: ({ bySource, oracle, requests }) =>
        answerAllExcept(
          sourceOf(oracle.seeds[0]),
          httpResponse(401, 'Stop body withheld.')
        )({ bySource, requests }),
    });
    expect(state.caught).toBe(null);
    expect(state.sendCalls).toHaveLength(1);
    expect(state.sendCalls[0].batchSize).toBe(state.oracle.seeds.length);
    expect(state.fetchCalls).toHaveLength(1);
    expect(state.fetchCalls[0]).toEqual(state.oracle.seeds.map(sourceOf));
    state.oracle.remainder.forEach((request) => {
      expect(state.manager.uidIndex[request.uid].item.getAssessment()).toEqual(
        canonicalRunStoppedAssessments()
      );
    });
    expect(state.procCalls).toHaveLength(state.oracle.seeds.length);
  });

  it('keeps dispatching the remainder when a seed fails without a stop status', () => {
    const state = runSeedCase({
      buildFixture: () => buildSeedFixture('medium', 2, 2),
      batchSize: BATCH,
      configure: ({ bySource, oracle, requests }) =>
        answerAllExcept(
          sourceOf(oracle.seeds[0]),
          httpResponse(400, 'Permanent rejection body.')
        )({ bySource, requests }),
    });
    expect(state.caught).toBe(null);
    expect(state.sendCalls).toHaveLength(2);
    expect(state.fetchCalls).toHaveLength(2);
    expect(
      state.oracle.remainder.every((request) => state.fetchCalls[1].includes(sourceOf(request)))
    ).toBe(true);
    expect(state.manager.uidIndex[state.oracle.seeds[0].uid].item.getAssessment()).toEqual(
      catalogueHTTPAssessments('The assessment service rejected the request.', 'LLM_HTTP_FAILED')
    );
    expect(state.procCalls).toHaveLength(state.requests.length);
  });
});

describe('LLM shared seed and remainder outcome consumer', () => {
  it('routes both phases through one consumer with sort, writeback and cache puts', () => {
    const state = runSeedCase({
      buildFixture: () => buildSeedFixture('medium', 2, 2),
      batchSize: BATCH,
      configure: ({ bySource, oracle, requests }) =>
        answerAllExcept(
          sourceOf(oracle.seeds[0]),
          httpResponse(400, 'Rejected seed body.')
        )({
          bySource,
          requests,
        }),
    });
    const routedUids = state.procCalls.map((call) => call.request.uid);
    expect(state.caught).toBe(null);
    expect(new Set(routedUids).size).toBe(routedUids.length);
    expect([...routedUids].sort()).toEqual(state.requests.map((r) => r.uid).sort());
    expect(state.cachePuts).toBe(state.requests.length - 1);
    const healthySeed = state.oracle.seeds[1];
    expect(state.manager.uidIndex[healthySeed.uid].item.getAssessment()).toEqual(VALID_RESULT_DATA);
    const firstProcess = state.events.findIndex((event) => event.type === 'process');
    const secondSend = state.events.findIndex((event, index) => event.type === 'send' && index > 0);
    expect(secondSend).toBeGreaterThan(-1);
    expect(firstProcess).toBeLessThan(secondSend);
    expect(state.events.filter((event) => event.type === 'process')[0].uid).not.toBe(
      state.oracle.seeds[0].uid
    );
  });
});

describe('LLM seed-round progress and logging', () => {
  it('derives the increment count from the two-phase call sequence without composing phase messages', () => {
    const tracker = createStatefulProgressTracker();
    const baseMessage = tracker.getCurrentProgress().message;
    const state = runSeedCase({
      buildFixture: () => buildSeedFixture('medium', 2, 2),
      batchSize: ONE,
      globals: { ProgressTracker: () => ({ getInstance: () => tracker }) },
      progressTracker: tracker,
      configure: answerAllValid,
    });
    const increments = state.progressCalls.filter((call) => call[1] === true);
    const expectedIncrements = ONE + Math.ceil(state.oracle.remainder.length / ONE);
    expect(state.caught).toBe(null);
    expect(state.oracle.seeds.length).toBeGreaterThan(ONE);
    expect(increments).toHaveLength(expectedIncrements);
    const sending = state.progressCalls
      .map((call) => call[0])
      .filter((message) => message.includes('Sending batch'));
    sending.forEach((message) => {
      expect(message.startsWith(`${baseMessage}: Sending batch`)).toBe(true);
      expect(message).not.toContain('Double-checking');
    });
  });

  it('logs the seed-round size at info level without any payload content', () => {
    const state = runSeedCase({
      buildFixture: () => buildSeedFixture('medium', 2, 2),
      batchSize: BATCH,
      configure: answerAllValid,
    });
    const seedLogs = state.infoLogs.filter(([message]) => /seed/i.test(String(message)));
    expect(seedLogs.length).toBeGreaterThan(0);
    expect(seedLogs[0][1].seedCount).toBe(state.oracle.seeds.length);
    expect(seedLogs[0][1].requestCount).toBe(state.requests.length);
    const allLogText = state.infoLogs
      .flat()
      .map((value) => String(value))
      .join(' ');
    state.requests.forEach((request) => {
      const payload = JSON.parse(request.payload);
      expect(allLogText).not.toContain(payload.studentResponse);
      expect(allLogText).not.toContain(payload.reference);
      expect(allLogText).not.toContain(payload.template);
    });
  });
});

describe('LLM unchanged zero-request and Sheets paths', () => {
  it('leaves zero-request and Sheets paths with no seed dispatch or log', () => {
    withLoadedManager(({ manager, context, natives }) => {
      const text = createAssignment('TEXT');
      manager.processStudentResponses([], text.assignment);
      const sheets = createAssignment('SPREADSHEET');
      const requests = manager.generateRequestObjects(sheets.assignment);
      expect(requests).toEqual([]);
      manager.processStudentResponses(requests, sheets.assignment);
      expect(natives.fetchAll).not.toHaveBeenCalled();
      expect(natives.fetch).not.toHaveBeenCalled();
      expect(context.scriptCache.put).not.toHaveBeenCalled();
      expect(context.logger.info.mock.calls.filter(([m]) => /seed/i.test(String(m)))).toEqual([]);
    });
  });
});
