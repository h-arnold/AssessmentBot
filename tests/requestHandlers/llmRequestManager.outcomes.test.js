import { describe, it, expect, vi } from 'vitest';
import { withTemporaryGlobals } from '../helpers/globalMockManager.js';
import {
  catalogueHTTPAssessments,
  createAssignment,
  expectSourceRetained,
  loadManager,
  runTransportCase,
  STALE_MIXED_MARKS,
} from '../helpers/llmRequestManagerHarness.js';

function withManager(callback) {
  const context = loadManager({ fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() });
  try {
    withTemporaryGlobals(context.globals, () => {
      delete require.cache[context.llmPath];
      callback(new (require(context.llmPath))());
    });
  } finally {
    context.restore();
  }
}

const validResult = () => ({
  completeness: { score: 4, reasoning: 'ok' },
  accuracy: { score: 3, reasoning: 'ok' },
  spag: { score: 2, reasoning: 'ok' },
});
const malformedBody = (label, criterion, change) => {
  const result = validResult();
  change(result, criterion);
  return [label, JSON.stringify(result)];
};
const invalidBodies = [
  ['invalid JSON', '{'],
  ...[
    ['null root', null],
    ['array root', []],
    ['string root', 'malformed'],
  ].map(([label, root]) => [label, JSON.stringify(root)]),
  malformedBody('missing completeness', 'completeness', (data, key) => delete data[key]),
  malformedBody('null accuracy', 'accuracy', (data, key) => (data[key] = null)),
  malformedBody('malformed spag', 'spag', (data, key) => (data[key] = [])),
  malformedBody('missing score', 'completeness', (data, key) => delete data[key].score),
  malformedBody('null score', 'accuracy', (data, key) => (data[key].score = null)),
  malformedBody('string score', 'spag', (data, key) => (data[key].score = '2')),
  malformedBody('negative score', 'completeness', (data, key) => (data[key].score = -1)),
  malformedBody('null reasoning', 'accuracy', (data, key) => (data[key].reasoning = null)),
  malformedBody('missing criterion', 'spag', (data, key) => delete data[key]),
  malformedBody('null criterion', 'accuracy', (data, key) => (data[key] = null)),
  malformedBody('missing reasoning', 'completeness', (data, key) => delete data[key].reasoning),
  malformedBody('non-string reasoning', 'accuracy', (data, key) => (data[key].reasoning = 42)),
  malformedBody(
    'extra criterion',
    'extra',
    (data, key) => (data[key] = { score: 1, reasoning: 'unexpected' })
  ),
  [
    'infinite score',
    '{"completeness":{"score":4,"reasoning":"ok"},"accuracy":{"score":3,"reasoning":"ok"},"spag":{"score":1e999,"reasoning":"ok"}}',
  ],
  [
    'negative infinite score',
    '{"completeness":{"score":4,"reasoning":"ok"},"accuracy":{"score":3,"reasoning":"ok"},"spag":{"score":-1e999,"reasoning":"ok"}}',
  ],
  malformedBody('out-of-range score', 'completeness', (data, key) => (data[key].score = 6)),
  malformedBody(
    'numeric criterion with error metadata',
    'accuracy',
    (data, key) => (data[key].error = { stage: 'assessment', code: 'LLM_INVALID_RESPONSE' })
  ),
];

describe('LLM successful-result numeric validation', () => {
  it.each([0, 2.5, 5])('accepts valid numeric score %s', (score) => {
    withManager((manager) => {
      const result = validResult();
      result.completeness.score = score;
      expect(manager.validateAssessmentData(result)).toBe(true);
    });
  });

  it.each([NaN, Infinity, -Infinity, 'N', 'E'])(
    'rejects non-numeric score %s (direct validator unit proof)',
    (score) => {
      withManager((manager) => {
        const result = validResult();
        result.accuracy.score = score;
        expect(manager.validateAssessmentData(result)).toBe(false);
      });
    }
  );
});

describe('LLMRequestManager terminal assessment outcomes', () => {
  it.each([200, 201])('accepts a healthy HTTP %s response without retrying', (status) => {
    const body = JSON.stringify({
      completeness: { score: 0, reasoning: 'Complete response.' },
      accuracy: { score: 2.5, reasoning: '' },
      spag: { score: 5, reasoning: 'Some errors.' },
    });
    const getContentText = vi.fn(() => body);
    const response = { getResponseCode: () => status, getContentText };
    const fetchAll = vi.fn(() => [response]);
    const fetch = vi.fn();
    const sleep = vi.fn();
    const context = loadManager({ fetchAll, fetch, sleep });
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const Manager = require(context.llmPath);
        const manager = new Manager();
        const { assignment, item, task } = createAssignment('TEXT');
        const artifact = item.artifact;
        const source = artifact.toJSON();
        const taskId = item.taskId;
        const documentId = assignment.submissions[0].documentId;
        const expectedPayload = {
          taskType: 'TEXT',
          reference: task.getPrimaryReference().content,
          template: task.getPrimaryTemplate().content,
          studentResponse: artifact.content,
        };
        const requests = manager.generateRequestObjects(assignment);
        expect(requests).toHaveLength(1);
        expect(requests[0].uid).toBe(artifact.getUid());
        const payload = JSON.parse(requests[0].payload);
        expect(payload).toEqual(expectedPayload);
        const addAssessment = vi.spyOn(item, 'addAssessment');
        const processSingleResponse = vi.spyOn(manager, '_processSingleResponse');
        const validate = vi.spyOn(manager, 'validateAssessmentData');
        const parse = vi.spyOn(JSON, 'parse');
        manager.processStudentResponses(requests, assignment);
        expect(fetchAll).toHaveBeenCalledTimes(1);
        const nativeRequests = fetchAll.mock.calls[0][0];
        expect(nativeRequests).toHaveLength(1);
        // The exact projected shape also proves no internal uid leaks into the
        // native request: UrlFetchApp receives only the projected fields, and
        // this equality fails whenever an extra uid key is present.
        expect(nativeRequests[0]).toEqual({
          url: 'https://llm.test/v1/assessor',
          method: 'post',
          contentType: 'application/json',
          payload: requests[0].payload,
          headers: { Authorization: 'Bearer test-key' },
          muteHttpExceptions: true,
        });
        // Call-through routing identity: the processed arguments are the exact
        // native response object and the generated request object, not copies.
        expect(processSingleResponse).toHaveBeenCalledTimes(1);
        const [routedResponse, routedRequest] = processSingleResponse.mock.calls[0];
        expect(routedResponse).toBe(response);
        expect(routedRequest).toBe(requests[0]);
        expect(fetch).not.toHaveBeenCalled();
        expect(sleep).not.toHaveBeenCalled();
        expect(getContentText).toHaveBeenCalledTimes(1);
        expect(parse).toHaveBeenCalledTimes(1);
        expect(validate).toHaveBeenCalledTimes(1);
        expect(addAssessment).toHaveBeenCalledTimes(3);
        const assignedAssessments = new Map(
          addAssessment.mock.calls.map(([criterion, assessment]) => [criterion, assessment])
        );
        expect([...assignedAssessments.keys()].sort()).toEqual([
          'accuracy',
          'completeness',
          'spag',
        ]);
        const expectedStoredAssessments = {
          completeness: { score: 0, reasoning: 'Complete response.' },
          accuracy: { score: 2.5, reasoning: '' },
          spag: { score: 5, reasoning: 'Some errors.' },
        };
        assignedAssessments.forEach((assessment, criterion) => {
          // The addAssessment argument is the real Assessment instance; the
          // stored item map is its serialised JSON and is never an instance.
          expect(assessment).toBeInstanceOf(globalThis.Assessment);
          expect(assessment.toJSON()).toEqual(expectedStoredAssessments[criterion]);
        });
        expect(item.getAssessment()).toEqual(expectedStoredAssessments);
        expect(artifact.toJSON()).toEqual(source);
        expect(item.artifact).toBe(artifact);
        expect(item.taskId).toBe(taskId);
        expect(assignment.submissions[0].documentId).toBe(documentId);
      });
    } finally {
      vi.restoreAllMocks();
      context.restore();
    }
  });

  it.each(invalidBodies)(
    'turns a successful response with %s into an atomic invalid-response outcome without retry',
    (_caseName, body) => {
      const nativeResponse = { getResponseCode: () => 200, getContentText: () => body };
      const fetchAll = vi.fn(() => [nativeResponse]);
      const fetch = vi.fn(() => nativeResponse);
      const sleep = vi.fn();
      const context = loadManager({ fetchAll, fetch, sleep });
      try {
        withTemporaryGlobals(context.globals, () => {
          delete require.cache[context.llmPath];
          const Manager = require(context.llmPath);
          const manager = new Manager();
          const { assignment, item } = createAssignment('TEXT');
          item.addAssessment('completeness', { score: 4, reasoning: 'old mark' });
          item.addAssessment('accuracy', { score: 'N', reasoning: 'old not attempted' });
          item.addAssessment('spag', { score: 3, reasoning: 'old mark' });
          const artifact = item.artifact;
          const source = artifact.toJSON();
          const sourceIds = {
            uid: artifact.getUid(),
            taskId: item.taskId,
            documentId: assignment.submissions[0].documentId,
            pageId: artifact.pageId,
          };
          const requests = manager.generateRequestObjects(assignment);

          manager.processStudentResponses(requests, assignment);

          expect(fetchAll).toHaveBeenCalledTimes(1);
          expect(fetch).not.toHaveBeenCalled();
          expect(sleep).not.toHaveBeenCalled();
          expect(item.getAssessment()).toEqual(
            Object.fromEntries(
              ['completeness', 'accuracy', 'spag'].map((criterion) => [
                criterion,
                {
                  score: 'E',
                  reasoning: 'The assessment service returned an invalid result.',
                  error: { stage: 'assessment', code: 'LLM_INVALID_RESPONSE' },
                },
              ])
            )
          );
          expect(artifact.toJSON()).toEqual(source);
          // Alias-identity guard: a plain toJSON comparison on the captured
          // alias alone would not notice an item-artefact replacement.
          expect(item.artifact).toBe(artifact);
          expect({
            uid: artifact.getUid(),
            taskId: item.taskId,
            documentId: assignment.submissions[0].documentId,
            pageId: artifact.pageId,
          }).toEqual(sourceIds);
          expect(context.scriptCache.put).not.toHaveBeenCalled();
        });
      } finally {
        vi.restoreAllMocks();
        context.restore();
      }
    }
  );

  it('keeps malformed response diagnostics bounded and free of payload content', () => {
    const sentinels = [
      'STUDENT_SENTINEL',
      'NAME_SENTINEL',
      'CREDENTIAL_SENTINEL',
      'SERVICE_REASONING_SENTINEL',
    ];
    const body = JSON.stringify({
      completeness: { score: 1, reasoning: sentinels[3] },
      accuracy: { score: 2, reasoning: 'ok' },
      spag: { score: 'invalid', reasoning: sentinels.join(' ') },
      studentName: sentinels[1],
      credential: sentinels[2],
    });
    const response = { getResponseCode: () => 200, getContentText: () => body };
    const fetchAll = vi.fn(() => [response]);
    const fetch = vi.fn(() => response);
    const sleep = vi.fn();
    const context = loadManager({ fetchAll, fetch, sleep });
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const manager = new (require(context.llmPath))();
        const { assignment, item } = createAssignment('TEXT');

        // Separate request generation from response processing so that the
        // generation summary info log cannot satisfy the processing diagnostic
        // budget asserted below.
        const requests = manager.generateRequestObjects(assignment);
        context.logger.info.mockClear();
        context.logger.warn.mockClear();
        context.logger.error.mockClear();
        context.progressTracker.logError.mockClear();
        context.progressTracker.logAndThrowError.mockClear();
        context.progressTracker.updateProgress.mockClear();

        manager.processStudentResponses(requests, assignment);

        const developerDiagnosticCalls = [
          ...context.logger.info.mock.calls,
          ...context.logger.warn.mock.calls,
          ...context.logger.error.mock.calls,
        ];
        const progressDiagnosticCalls = [
          ...context.progressTracker.logError.mock.calls,
          ...context.progressTracker.logAndThrowError.mock.calls,
        ];
        const progressUpdateCalls = context.progressTracker.updateProgress.mock.calls;
        const diagnostics = JSON.stringify({
          developerDiagnosticCalls,
          progressDiagnosticCalls,
          progressUpdateCalls,
        });
        expect(developerDiagnosticCalls).toHaveLength(1);
        expect(diagnostics).not.toContain(body);
        sentinels.forEach((sentinel) => expect(diagnostics).not.toContain(sentinel));
        expect(diagnostics.length).toBeLessThan(1000);
        // Authored against the Section 6 terminal completion path; while the
        // existing semantic retry still dispatches, these stay Red after the
        // primary diagnostic assertions and are unreachable this cycle.
        expect(fetch).not.toHaveBeenCalled();
        expect(sleep).not.toHaveBeenCalled();
        expect(context.scriptCache.put).not.toHaveBeenCalled();
        expect(item.getAssessment()).toEqual(
          Object.fromEntries(
            ['completeness', 'accuracy', 'spag'].map((criterion) => [
              criterion,
              {
                score: 'E',
                reasoning: 'The assessment service returned an invalid result.',
                error: { stage: 'assessment', code: 'LLM_INVALID_RESPONSE' },
              },
            ])
          )
        );
      });
    } finally {
      vi.restoreAllMocks();
      context.restore();
    }
  });
});

/**
 * Real-normaliser runner: installs the REAL Utils.normaliseKeysToLowerCase
 * locally (call-through) because the shared mock's null-guard early return
 * masks the real behaviour on parsed service roots.
 */
function runRealNormaliserCase(body) {
  const nativeResponse = { getResponseCode: () => 200, getContentText: vi.fn(() => body) };
  const fetchAll = vi.fn(() => [nativeResponse]);
  const fetch = vi.fn();
  const sleep = vi.fn();
  const context = loadManager({ fetchAll, fetch, sleep });
  const collected = { nativeResponse, fetch, sleep };
  try {
    withTemporaryGlobals(context.globals, () => {
      delete require.cache[context.llmPath];
      const manager = new (require(context.llmPath))();
      const fixture = createAssignment('TEXT');
      const requests = manager.generateRequestObjects(fixture.assignment);
      expect(requests).toHaveLength(1);
      const artefact = fixture.item.artifact;
      // Preservation baselines captured BEFORE processing, beside the reference.
      const artefactSnapshot = structuredClone(artefact.toJSON());
      const documentId = fixture.assignment.submissions[0].documentId;
      const realNormaliser = require('#backend/Utils/Utils.js').normaliseKeysToLowerCase;
      const normaliser = vi
        .spyOn(globalThis.Utils, 'normaliseKeysToLowerCase')
        .mockImplementation(realNormaliser);
      let caught = null;
      try {
        manager.processStudentResponses(requests, fixture.assignment);
      } catch (error) {
        caught = error;
      }
      // Both captures are returned unchanged: tail assertions compare pre-state.
      Object.assign(collected, {
        assignment: fixture.assignment,
        item: fixture.item,
        artefact,
        artefactSnapshot,
        documentId,
        scriptCache: context.scriptCache,
        normaliser,
        caught,
      });
    });
    return collected;
  } finally {
    vi.restoreAllMocks();
    context.restore();
  }
}

/** Exact atomic all-three LLM_INVALID_RESPONSE terminalisation and isolation. */
function expectInvalidResponseTerminalisation(collected) {
  expect(collected.caught).toBe(null);
  expect(collected.item.getAssessment()).toEqual(
    catalogueHTTPAssessments(
      'The assessment service returned an invalid result.',
      'LLM_INVALID_RESPONSE'
    )
  );
  expect(collected.nativeResponse.getContentText).toHaveBeenCalledTimes(1);
  expect(collected.fetch).not.toHaveBeenCalled();
  expect(collected.sleep).not.toHaveBeenCalled();
  expect(collected.scriptCache.put).not.toHaveBeenCalled();
  expect(collected.item.artifact).toBe(collected.artefact);
  expect(collected.artefact.toJSON()).toEqual(collected.artefactSnapshot);
  expect(collected.assignment.submissions[0].documentId).toBe(collected.documentId);
}

describe('LLM successful decode through the real normaliser', () => {
  it('terminalises a successful null service body atomically through the real normaliser', () => {
    const collected = runRealNormaliserCase('null');
    expectInvalidResponseTerminalisation(collected);
  });

  // Review-probe bodies judged on the REAL normaliser's exact behaviour:
  // JSON.parse creates an own '__proto__' key, so normalisation must not let
  // inherited or colliding keys erase evidence before validation.
  const REAL_NORMALISER_BODIES = [
    [
      'keeps case-insensitive canonical criterion names valid',
      'numeric',
      '{"COMPLETENESS":{"score":3,"reasoning":"uppercase root"},"Accuracy":{"score":2,"reasoning":"mixed case"},"SPAG":{"score":1,"reasoning":"uppercase"}}',
    ],
    [
      'rejects an inherited-key route erasing completeness before normalisation',
      'invalid',
      '{"__proto__":{"completeness":{"score":3,"reasoning":"inherited"}},"accuracy":{"score":2,"reasoning":"ok"},"spag":{"score":4,"reasoning":"ok"},"extra":{"score":1,"reasoning":"unexpected"}}',
    ],
    [
      'rejects colliding case-variant duplicate criterion keys before normalisation',
      'invalid',
      '{"COMPLETENESS":{"score":5,"reasoning":"first"},"completeness":{"score":1,"reasoning":"second"},"accuracy":{"score":2,"reasoning":"ok"},"spag":{"score":4,"reasoning":"ok"}}',
    ],
  ];

  it.each(REAL_NORMALISER_BODIES)('%s', (_label, expectedOutcome, body) => {
    const collected = runRealNormaliserCase(body);
    if (expectedOutcome === 'invalid') {
      // RED (exploit rows): the normalised object carries exactly three own
      // keys — the '__proto__' assignment became the prototype and the
      // colliding duplicate resolved by last-write — so the validator accepts
      // the root and the atomic invalid-response contract never runs.
      expectInvalidResponseTerminalisation(collected);
      return;
    }
    expect(collected.normaliser.mock.calls.length).toBeGreaterThan(0);
    const expectedBody = {
      completeness: { score: 3, reasoning: 'uppercase root' },
      accuracy: { score: 2, reasoning: 'mixed case' },
      spag: { score: 1, reasoning: 'uppercase' },
    };
    expect(collected.item.getAssessment()).toEqual(expectedBody);
    expect(collected.scriptCache.put).toHaveBeenCalledTimes(1);
    expect(JSON.parse(collected.scriptCache.put.mock.calls[0][1])).toEqual(expectedBody);
    expect(collected.fetch).not.toHaveBeenCalled();
    expect(collected.sleep).not.toHaveBeenCalled();
  });
});

describe('LLM response reader faults propagate by identity', () => {
  /** Shared reader-fault isolation: identity, no retry, no cache, stale marks. */
  function expectReaderFaultIsolation(collected, thrown) {
    expect(collected.caught).toBe(thrown);
    expect(collected.fetch).not.toHaveBeenCalled();
    expect(collected.sleep).not.toHaveBeenCalled();
    expect(collected.scriptCache.put).not.toHaveBeenCalled();
    // No invalid-response relabel: the stale mixed marks are untouched.
    expect(collected.item.getAssessment()).toEqual(STALE_MIXED_MARKS);
    expectSourceRetained(collected);
  }

  it.each([
    ['a TypeError', new TypeError('READER_TYPE_FAULT sentinel')],
    ['a ReferenceError', new ReferenceError('READER_REFERENCE_FAULT sentinel')],
    ['a non-Error sentinel', 'READER_NON_ERROR sentinel'],
  ])('propagates %s thrown by the native body read without relabelling', (_label, thrown) => {
    const nativeResponse = {
      getResponseCode: () => 200,
      getContentText: vi.fn(() => {
        throw thrown;
      }),
    };
    const collected = runTransportCase(
      { fetchAll: vi.fn(() => [nativeResponse]), fetch: vi.fn(), sleep: vi.fn() },
      () => ({})
    );
    expectReaderFaultIsolation(collected, thrown);
  });

  it('propagates the native missing-read-method TypeError instead of a new exact message', () => {
    const collected = runTransportCase(
      { fetchAll: vi.fn(() => [{ getResponseCode: () => 200 }]), fetch: vi.fn(), sleep: vi.fn() },
      () => ({})
    );
    expect(collected.caught).toBeInstanceOf(TypeError);
    expect(collected.caught.message).toContain('getContentText');
    expectReaderFaultIsolation(collected, collected.caught);
  });
});
