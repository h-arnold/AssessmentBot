import { describe, it, expect, vi } from 'vitest';
import {
  VALID_RESULT_DATA,
  createAssignment,
  expectSourceRetained,
  observeLookup,
  validHttpResponse,
  withCacheManager,
} from '../helpers/llmRequestManagerHarness.js';

const CANONICAL_CRITERIA = ['completeness', 'accuracy', 'spag'];
const COMPLETE_KEYSET = [...CANONICAL_CRITERIA];

/** Valid not-attempted entry for the whole-N cache row (existing domain wording). */
const NOT_ATTEMPTED_ENTRY = { score: 'N', reasoning: 'Task not attempted' };

/**
 * Distinctive raw markers used ONLY by the dedicated privacy row. They are
 * bound into the existing string reasoning fields of two otherwise valid
 * criteria — never into new root metadata — and must never appear in any
 * captured diagnostic argument.
 */
const SENTINEL_MARKERS = {
  serviceReasoning: 'RAW-LLM-REASONING-SENTINEL chain token 7gH2kL9q',
  studentName: 'STUDENT-NAME-SENTINEL Jamie Example',
  credential: 'CREDENTIAL-SENTINEL sk-live-9f8e7d6c',
};

/** Developer diagnostic channels owned by ABLogger in the harness context. */
const DEVELOPER_DIAGNOSTICS = ['info', 'warn', 'error'];

/**
 * Progress diagnostic channels owned by ProgressTracker. getCurrentProgress is
 * a regular read method, never a diagnostic spy, and is deliberately absent.
 */
const PROGRESS_DIAGNOSTICS = ['updateProgress', 'logError', 'logAndThrowError'];

/**
 * Gathers the exact known diagnostic spies; a missing expected spy fails the
 * fixture loudly instead of being silently skipped.
 */
function diagnosticSpies(collected) {
  const pick = (channel, channelName, method) => {
    const spy = channel[method];
    expect(typeof spy === 'function' && typeof spy.mockClear === 'function').toBe(true);
    return { spy, label: `${channelName}.${method}` };
  };
  return [
    ...DEVELOPER_DIAGNOSTICS.map((method) => pick(collected.logger, 'logger', method)),
    ...PROGRESS_DIAGNOSTICS.map((method) =>
      pick(collected.progressTracker, 'progressTracker', method)
    ),
  ];
}

/** Clears only the known priming/setup diagnostics before the tested generation. */
function clearDiagnostics(collected) {
  diagnosticSpies(collected).forEach(({ spy }) => spy.mockClear());
}

/** Every argument captured on ALL developer and progress diagnostic channels. */
function allDiagnosticArguments(collected) {
  return diagnosticSpies(collected)
    .flatMap(({ spy }) => spy.mock.calls)
    .flat();
}

/**
 * Serialises captured diagnostics through real Error name/message/stack/cause,
 * so a plain `JSON.stringify(Error) === '{}'` result can never fake secrecy.
 */
function errorAwareReplacer(_key, value) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack, cause: value.cause };
  }
  return value;
}

/** Standard native fixtures for one live valid-200 case: batched dispatch only. */
function liveBatchNatives() {
  return { fetchAll: vi.fn(() => [validHttpResponse()]), fetch: vi.fn(), sleep: vi.fn() };
}

/** Captures the retained source identity on a fixture for expectSourceRetained. */
function withRetainedSource(fixture) {
  fixture.artefact = fixture.item.artifact;
  fixture.artefactSnapshot = structuredClone(fixture.item.artifact.toJSON());
  fixture.documentId = fixture.assignment.submissions[0].documentId;
  return fixture;
}

/**
 * Required inputs for every seed factory, built INSIDE the active cache context
 * so the catalogue entry comes from the real Assessment owner under the active
 * globals, never from module-load GAS work. No factory uses defaults.
 */
function createRowSeedInputs() {
  return {
    body: structuredClone(VALID_RESULT_DATA),
    catalogueEntry: globalThis.Assessment.createError(
      'assessment',
      'LLM_INVALID_RESPONSE'
    ).toJSON(),
  };
}

/**
 * One row per invalid cached hit: pure local boundary mutations of ONE valid
 * body, whole-domain N/E maps and the raw `1e999` Infinity splice. Only the
 * extra-criterion row carries an extra key, and no row carries sentinel
 * metadata. Each row declares its expected decoded keyset, the criteria that
 * must still validate through the real Assessment owner, its decoded-defect
 * assertion and its leak tokens (empty for every semantic row).
 */
const CACHED_RESULT_MISS_ROWS = [
  {
    label: 'missing criterion',
    expectedKeys: ['accuracy', 'spag'],
    validCriteria: ['accuracy', 'spag'],
    leakTokens: [],
    seed: ({ body }) => {
      delete body.completeness;
      return JSON.stringify(body);
    },
    assertDecodedSeed: (parsed) => {
      expect(parsed).not.toHaveProperty('completeness');
    },
  },
  {
    label: 'extra criterion',
    expectedKeys: ['completeness', 'accuracy', 'spag', 'extra'],
    validCriteria: CANONICAL_CRITERIA,
    leakTokens: [],
    seed: ({ body }) => {
      body.extra = { score: 1, reasoning: 'Unexpected new.' };
      return JSON.stringify(body);
    },
    assertDecodedSeed: (parsed) => {
      expect(parsed.extra).toEqual({ score: 1, reasoning: 'Unexpected new.' });
    },
  },
  {
    label: 'null criterion',
    expectedKeys: COMPLETE_KEYSET,
    validCriteria: ['completeness', 'spag'],
    leakTokens: [],
    seed: ({ body }) => {
      body.accuracy = null;
      return JSON.stringify(body);
    },
    assertDecodedSeed: (parsed) => {
      expect(parsed.accuracy).toBe(null);
    },
  },
  {
    label: 'wrong-type score',
    expectedKeys: COMPLETE_KEYSET,
    validCriteria: ['accuracy', 'spag'],
    leakTokens: [],
    seed: ({ body }) => {
      body.completeness.score = '2';
      return JSON.stringify(body);
    },
    assertDecodedSeed: (parsed) => {
      expect(parsed.completeness.score).toBe('2');
    },
  },
  {
    label: 'out-of-range score',
    expectedKeys: COMPLETE_KEYSET,
    validCriteria: ['accuracy', 'spag'],
    leakTokens: [],
    seed: ({ body }) => {
      body.completeness.score = 6;
      return JSON.stringify(body);
    },
    assertDecodedSeed: (parsed) => {
      expect(parsed.completeness.score).toBe(6);
    },
  },
  {
    label: 'wrong or null reasoning',
    expectedKeys: COMPLETE_KEYSET,
    validCriteria: ['accuracy', 'spag'],
    leakTokens: [],
    seed: ({ body }) => {
      body.completeness.reasoning = null;
      return JSON.stringify(body);
    },
    assertDecodedSeed: (parsed) => {
      expect(parsed.completeness.reasoning).toBe(null);
    },
  },
  {
    label: 'whole N map',
    expectedKeys: COMPLETE_KEYSET,
    validCriteria: CANONICAL_CRITERIA,
    leakTokens: [],
    seed: () =>
      JSON.stringify({
        completeness: { ...NOT_ATTEMPTED_ENTRY },
        accuracy: { ...NOT_ATTEMPTED_ENTRY },
        spag: { ...NOT_ATTEMPTED_ENTRY },
      }),
    assertDecodedSeed: (parsed) => {
      CANONICAL_CRITERIA.forEach((criterion) => {
        expect(parsed[criterion].score).toBe('N');
        expect(globalThis.Assessment.fromJSON(parsed[criterion]).toJSON()).toEqual(
          parsed[criterion]
        );
      });
    },
  },
  {
    label: 'whole catalogue error map',
    expectedKeys: COMPLETE_KEYSET,
    validCriteria: CANONICAL_CRITERIA,
    leakTokens: [],
    seed: ({ catalogueEntry }) =>
      JSON.stringify({
        completeness: { ...catalogueEntry },
        accuracy: { ...catalogueEntry },
        spag: { ...catalogueEntry },
      }),
    assertDecodedSeed: (parsed) => {
      CANONICAL_CRITERIA.forEach((criterion) => {
        expect(parsed[criterion].score).toBe('E');
        expect(globalThis.Assessment.fromJSON(parsed[criterion]).toJSON()).toEqual(
          parsed[criterion]
        );
      });
    },
  },
  {
    label: 'numeric criterion with error metadata',
    expectedKeys: COMPLETE_KEYSET,
    validCriteria: ['completeness', 'spag'],
    leakTokens: [],
    seed: ({ body }) => {
      body.accuracy.error = { stage: 'assessment', code: 'LLM_INVALID_RESPONSE' };
      return JSON.stringify(body);
    },
    assertDecodedSeed: (parsed) => {
      expect(parsed.accuracy.error).toEqual({ stage: 'assessment', code: 'LLM_INVALID_RESPONSE' });
    },
  },
  {
    label: 'numeric Infinity score',
    expectedKeys: COMPLETE_KEYSET,
    validCriteria: ['completeness', 'accuracy'],
    leakTokens: [],
    seed: ({ body }) => {
      const base = JSON.stringify(body);
      const spliced = base.replace(
        '"spag":{"score":5,"reasoning"',
        '"spag":{"score":1e999,"reasoning"'
      );
      if (spliced === base) {
        throw new Error('Infinity cache row splice did not match the finite valid body literal.');
      }
      return spliced;
    },
    assertDecodedSeed: (parsed) => {
      expect(Number.isFinite(parsed.spag.score)).toBe(false);
      expect(parsed.spag.score).toBe(Number.POSITIVE_INFINITY);
    },
  },
];

/**
 * The ONE dedicated privacy row: two otherwise valid criteria whose real
 * reasoning fields carry the raw service-reasoning, student-name and
 * credential markers, with the single structural defect of a missing spag
 * criterion. No root metadata is added and no semantic seed carries tokens.
 */
const SENTINEL_CACHED_MISS_ROW = {
  expectedKeys: ['completeness', 'accuracy'],
  validCriteria: ['completeness', 'accuracy'],
  leakTokens: Object.values(SENTINEL_MARKERS),
  seed: ({ body }) => {
    body.completeness = {
      score: 3,
      reasoning: `Marking notes: ${SENTINEL_MARKERS.serviceReasoning}`,
    };
    body.accuracy = {
      score: 2,
      reasoning: `${SENTINEL_MARKERS.studentName} ${SENTINEL_MARKERS.credential}`,
    };
    delete body.spag;
    return JSON.stringify(body);
  },
  assertDecodedSeed: (parsed) => {
    expect(parsed).not.toHaveProperty('spag');
  },
};

/**
 * Shared runner for every invalid cached hit. Priming reveals the runtime's
 * own opaque key with one real generation (no dispatch); the known priming
 * diagnostics are cleared explicitly; the row's seed factory then runs inside
 * the active context and its product is preflighted before the first business
 * Red boundary. Everything after the first validator assertion is the authored
 * Green tail: it is unreachable while the blind cache apply stays in place.
 */
function runInvalidCacheHitCase(row) {
  const natives = liveBatchNatives();
  withCacheManager(natives, (collected) => {
    const primed = observeLookup(collected, createAssignment('TEXT').assignment);
    expect(primed.requests).toHaveLength(1); // real priming generation
    expect(primed.keys).toHaveLength(1);
    expect(typeof primed.keys[0] === 'string' && primed.keys[0].length > 0).toBe(true);
    const observedKey = primed.keys[0];
    clearDiagnostics(collected);
    const seedJson = row.seed(createRowSeedInputs());
    const parsedSeed = JSON.parse(seedJson);
    // REACHED fixture preflight: exact expected keyset, every declared-valid
    // criterion validates through the real Assessment owner, the decoded
    // defect is really present, and every leak token is really bound.
    expect(Object.keys(parsedSeed)).toEqual(row.expectedKeys);
    row.validCriteria.forEach((criterion) => {
      expect(globalThis.Assessment.isValidRawResult(parsedSeed[criterion])).toBe(true);
    });
    row.assertDecodedSeed(parsedSeed);
    row.leakTokens.forEach((token) => {
      expect(typeof token === 'string' && token.length > 0).toBe(true);
      expect(seedJson.includes(token)).toBe(true);
    });
    expect(collected.cacheStorage.set(observedKey, seedJson).get(observedKey)).toBe(seedJson);
    const tested = withRetainedSource(createAssignment('TEXT'));
    const testedManager = new collected.manager.constructor();
    expect(testedManager).not.toBe(collected.manager);
    const validator = vi.spyOn(testedManager, 'validateAssessmentData');
    const lookup = observeLookup({ ...collected, manager: testedManager }, tested.assignment);
    // FIRST RED BOUNDARY: the real shared validator must inspect the decoded
    // cached value exactly once and reject it; the blind apply never calls it.
    expect(validator.mock.calls).toHaveLength(1);
    expect(validator.mock.calls[0][0]).toEqual(JSON.parse(seedJson));
    expect(validator.mock.results[0].value).toBe(false);
    expect(lookup.requests).toHaveLength(1);
    expect(lookup.requests[0].uid).toBe(tested.artefact.getUid());
    expect(tested.item.getAssessment()).toEqual({});
    testedManager.processStudentResponses(lookup.requests, tested.assignment);
    expect(natives.fetchAll).toHaveBeenCalledTimes(1);
    expect(natives.fetch.mock.calls.length + natives.sleep.mock.calls.length).toBe(0);
    expect(tested.item.getAssessment()).toEqual(VALID_RESULT_DATA);
    expectSourceRetained(tested);
    // Overwritten with the validated numeric JSON at the observed key/TTL only.
    const putCalls = collected.scriptCache.put.mock.calls;
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0][0]).toBe(observedKey);
    expect(JSON.parse(putCalls[0][1])).toEqual(VALID_RESULT_DATA);
    expect(putCalls[0][2]).toBe(collected.cacheManagerClass.CACHE_EXPIRY_SECONDS);
    expect([...collected.cacheStorage.keys()]).toEqual([observedKey]);
    // One bounded failed-hit diagnostic across the known error channels; the
    // ordinary info generation summary stays separate; nothing leaks through
    // ANY developer or progress channel, with Errors inspected for real.
    const failedHitSpies = [
      collected.logger.warn,
      collected.logger.error,
      collected.progressTracker.logError,
      collected.progressTracker.logAndThrowError,
    ];
    expect(failedHitSpies.reduce((tally, spy) => tally + spy.mock.calls.length, 0)).toBe(1);
    expect(collected.logger.info).toHaveBeenCalledTimes(1);
    const failedHitArguments = failedHitSpies.flatMap((spy) => spy.mock.calls.flat());
    const failedHitText = JSON.stringify(failedHitArguments, errorAwareReplacer);
    expect(failedHitText.length).toBeLessThan(1000);
    expect(failedHitText).not.toContain(seedJson);
    const everyDiagnosticText = JSON.stringify(
      allDiagnosticArguments(collected),
      errorAwareReplacer
    );
    expect(everyDiagnosticText).not.toContain(seedJson);
    row.leakTokens.forEach((token) => {
      expect(everyDiagnosticText.includes(token)).toBe(false);
    });
  });
}

describe('LLM cached structured invalid results are safely logged misses', () => {
  it.each(CACHED_RESULT_MISS_ROWS)(
    'rejects the $label cached value as a shared-validator miss and re-requests it',
    (row) => {
      runInvalidCacheHitCase(row);
    }
  );

  it('re-requests a malformed cached result with distinctive reasoning sentinels without leaking them', () => {
    runInvalidCacheHitCase(SENTINEL_CACHED_MISS_ROW);
  });
});

describe('LLM warm cache hit shares the live validation owner', () => {
  /**
   * Control beside the unchanged cold/live/warm case: the live response is
   * validated once and a fresh warm manager reuses the same shared validator.
   */
  it('validates the warm cached numeric result through the shared validator once', () => {
    const natives = liveBatchNatives();
    withCacheManager(natives, (collected) => {
      const live = withRetainedSource(createAssignment('TEXT'));
      const performedLive = observeLookup(collected, live.assignment);
      expect(performedLive.requests).toHaveLength(1);
      expect(performedLive.keys).toHaveLength(1);
      const liveValidator = vi.spyOn(collected.manager, 'validateAssessmentData');
      collected.manager.processStudentResponses(performedLive.requests, live.assignment);
      expect(liveValidator.mock.calls).toHaveLength(1);
      expect(liveValidator.mock.results[0].value).toBe(true);
      expect(live.item.getAssessment()).toEqual(VALID_RESULT_DATA);
      expectSourceRetained(live);
      expect(collected.scriptCache.put).toHaveBeenCalledTimes(1);
      const warmManager = new collected.manager.constructor();
      expect(warmManager).not.toBe(collected.manager);
      const warmValidator = vi.spyOn(warmManager, 'validateAssessmentData');
      const warm = withRetainedSource(createAssignment('TEXT'));
      const warmLookup = observeLookup({ ...collected, manager: warmManager }, warm.assignment);
      expect(warmValidator.mock.calls).toHaveLength(1);
      expect(warmValidator.mock.calls[0][0]).toEqual(VALID_RESULT_DATA);
      expect(warmValidator.mock.results[0].value).toBe(true);
      expect(warmValidator.mock.calls[0][0]).toEqual(liveValidator.mock.calls[0][0]);
      expect(warmLookup.requests).toEqual([]);
      expect(warmLookup.keys).toEqual([performedLive.keys[0]]);
      expect(natives.fetchAll).toHaveBeenCalledTimes(1);
      expect(natives.fetch.mock.calls.length + natives.sleep.mock.calls.length).toBe(0);
      expect(collected.scriptCache.put).toHaveBeenCalledTimes(1);
      expect(warm.item.getAssessment()).toEqual(VALID_RESULT_DATA);
      expectSourceRetained(warm);
    });
  });
});

describe('LLM shared validator applies the existing Assessment result union', () => {
  it('rejects a three-criterion numeric result whose accuracy entry carries error metadata', () => {
    withCacheManager({ fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() }, (collected) => {
      const result = structuredClone(VALID_RESULT_DATA);
      result.accuracy.error = { stage: 'assessment', code: 'LLM_INVALID_RESPONSE' };
      // Existing union control: the real Assessment owner rejects numeric
      // entries carrying error metadata, so the numeric entry is excluded
      // from the valid-criteria preflight of the cached row above.
      expect(globalThis.Assessment.isValidRawResult(result.accuracy)).toBe(false);
      // RED: the shared validator must apply that same union and reject the
      // whole root; it currently certifies the error-bearing numeric entry.
      expect(collected.manager.validateAssessmentData(result)).toBe(false);
    });
  });
});

/**
 * Retained-writeback wiring pair. One real generation with the real canonical
 * model, then ONE owned route-field corruption, then PUBLIC processing against
 * a valid native 200. The required contract is a loud internal wiring fault
 * before any pretend success and no cache write; no rollback of an assignment
 * that already occurred before the fault is invented.
 */
function runWritebackWiringCase(corruptRoute) {
  const natives = liveBatchNatives();
  withCacheManager(natives, (collected) => {
    const fixture = withRetainedSource(createAssignment('TEXT'));
    const lookup = observeLookup(collected, fixture.assignment);
    expect(lookup.requests).toHaveLength(1);
    expect(lookup.keys).toHaveLength(1);
    const uid = lookup.requests[0].uid;
    expect(collected.manager.uidIndex[uid].item).toBe(fixture.item);
    expect(typeof collected.manager.uidIndex[uid].cacheKey).toBe('string');
    corruptRoute(collected.manager.uidIndex[uid]);
    let caught = null;
    try {
      collected.manager.processStudentResponses(lookup.requests, fixture.assignment);
    } catch (error) {
      caught = error;
    }
    // RED: broken owned route state must fail loudly; the current source
    // warns/returns for a missing item and silently skips a missing key.
    expect(caught).toBeInstanceOf(Error);
    // No pretend success: no cache write reaches the native store.
    expect(collected.scriptCache.put).not.toHaveBeenCalled();
    expect([...collected.cacheStorage.keys()]).toEqual([]);
    // Source retained; no rollback beyond that is demanded.
    expectSourceRetained(fixture);
    expect(fixture.item.artifact).toBe(fixture.artefact);
  });
}

describe('LLM retained writeback wiring faults fail loudly', () => {
  it('fails loudly without a cache write when the routed entry has no item', () => {
    runWritebackWiringCase((entry) => {
      delete entry.item;
    });
  });

  it('fails loudly without a cache write when the routed entry has no retained cacheKey', () => {
    runWritebackWiringCase((entry) => {
      delete entry.cacheKey;
    });
  });
});
