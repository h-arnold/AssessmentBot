import { describe, it, expect, vi } from 'vitest';
import {
  VALID_RESULT_DATA,
  createAssignment,
  expectSourceRetained,
  mutateFingerprint,
  observeLookup,
  twoHashKey,
  validHttpResponse,
  withCacheManager,
} from '../helpers/llmRequestManagerHarness.js';

// Same bootstrap-registered CommonJS class the harness restores through, so this
// suite reuses the existing domain raw-item validator, never a duplicate.
const {
  StudentSubmissionItem,
} = require('#backend/Models/StudentSubmission/00_StudentSubmissionItem.js');

/** Documented IMAGE body contract: data-URL media type followed by a base64 payload. */
const CANONICAL_IMAGE_BODY_CONTRACT = /^data:image\/[\w.+-]+;base64,[A-Za-z0-9+/]+=*$/u;

/**
 * Captures the EXPLICIT aligned body triple from a real canonical IMAGE
 * fixture's primary reference, template and student artefacts. No placeholder
 * body, no relabelled TEXT artefact and no default or global fallback: the
 * caller must supply this captured triple to every fixture it aligns.
 */
function canonicalImageBodyTriple(imageFixture) {
  return {
    reference: imageFixture.task.getPrimaryReference().content,
    template: imageFixture.task.getPrimaryTemplate().content,
    student: imageFixture.item.artifact.content,
  };
}

/**
 * Reached fixture preflight on the documented body-only contract: all three
 * values are strings, pairwise distinct, and genuinely usable image data URLs.
 * This is a test-fixture gate, not a second production validator; the full
 * submission identity validator applies only to the actual student item.
 */
function expectUsableDistinctImageBodies(bodies) {
  expect(Object.values(bodies).every((body) => typeof body === 'string')).toBe(true);
  expect(bodies.reference).not.toBe(bodies.template);
  expect(bodies.reference).not.toBe(bodies.student);
  expect(bodies.template).not.toBe(bodies.student);
  expect(bodies.reference).toMatch(CANONICAL_IMAGE_BODY_CONTRACT);
  expect(bodies.template).toMatch(CANONICAL_IMAGE_BODY_CONTRACT);
  expect(bodies.student).toMatch(CANONICAL_IMAGE_BODY_CONTRACT);
}

/**
 * Reached validity gate after alignment, before generation: the actually
 * mutated IMAGE artefacts must carry exactly the captured triple, the student
 * and template fingerprints must stay distinct through the real ensureHash
 * path, and the real student item must satisfy the existing domain raw-item
 * validator in full mode. Reference/template artefacts hold different roles
 * and are deliberately not passed to that submission validator.
 */
function expectMutatedImageBodiesUsable(bodies, imageFixture) {
  expect(imageFixture.task.getPrimaryReference().content).toBe(bodies.reference);
  expect(imageFixture.task.getPrimaryTemplate().content).toBe(bodies.template);
  expect(imageFixture.item.artifact.content).toBe(bodies.student);
  expect(imageFixture.item.artifact.contentHash).not.toBe(
    imageFixture.task.getPrimaryTemplate().contentHash
  );
  expect(
    StudentSubmissionItem.validateCurrentRawArtifact(
      imageFixture.item.toJSON(),
      imageFixture.task.getId(),
      'full'
    )
  ).toBe(true);
}

/** Aligns the three content fingerprints on genuinely typed canonical fixtures using an explicit captured body triple. */
function alignTypeFingerprints(fixture, bodies) {
  const reference = fixture.task.getPrimaryReference();
  reference.content = bodies.reference;
  reference.ensureHash();
  const template = fixture.task.getPrimaryTemplate();
  template.content = bodies.template;
  template.ensureHash();
  const artefact = fixture.item.artifact;
  artefact.content = bodies.student;
  artefact.ensureHash();
}

describe('LLM shared harness native cache fidelity', () => {
  it('reads the last write for a key and null on a miss', () => {
    withCacheManager({ fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() }, (collected) => {
      collected.scriptCache.put('cache-a', 'first', 60);
      collected.scriptCache.put('cache-a', 'second', 60);
      expect(collected.scriptCache.get('cache-a')).toBe('second');
      expect(collected.scriptCache.get('cache-miss')).toBe(null);
      expect(collected.cacheStorage.get('cache-a')).toBe('second');
    });
  });
});

describe('LLM assessment cache cold, live and warm identity', () => {
  it('caches the validated numeric result under the observed cold key and reuses it in a fresh model and manager', () => {
    const natives = {
      fetchAll: vi.fn(() => [validHttpResponse()]),
      fetch: vi.fn(),
      sleep: vi.fn(),
    };
    withCacheManager(natives, (collected) => {
      // COLD: real canonical TEXT model with an in-flight item. The runtime key is
      // observed OPAQUE: exactly one usable non-empty string key is required, and
      // its observed value — not any locally computed format — becomes the expected
      // key shared by the live write and the warm read.
      const cold = createAssignment('TEXT');
      const coldArtefact = cold.item.artifact;
      const coldDocumentId = cold.assignment.submissions[0].documentId;
      const coldArtefactSnapshot = structuredClone(coldArtefact.toJSON());
      const coldLookup = observeLookup(collected, cold.assignment);
      expect(coldLookup.requests).toHaveLength(1);
      expect(coldLookup.requests[0].uid).toBe(coldArtefact.getUid());
      expect(coldLookup.keys).toHaveLength(1);
      expect(typeof coldLookup.keys[0]).toBe('string');
      expect(coldLookup.keys[0].length).toBeGreaterThan(0);
      const expectedKey = coldLookup.keys[0];

      // LIVE: real processing of the valid native HTTP 200 numeric body.
      collected.manager.processStudentResponses(coldLookup.requests, cold.assignment);
      expect(natives.fetchAll).toHaveBeenCalledTimes(1);
      expect(natives.fetch).not.toHaveBeenCalled();
      expect(collected.scriptCache.get).toHaveBeenCalledTimes(1);
      expect(collected.scriptCache.put).toHaveBeenCalledTimes(1);
      const putCalls = collected.scriptCache.put.mock.calls;
      expect(putCalls[0][0]).toBe(expectedKey);
      expect(typeof putCalls[0][1]).toBe('string');
      expect(JSON.parse(putCalls[0][1])).toEqual(VALID_RESULT_DATA);
      expect(putCalls[0][2]).toBe(collected.cacheManagerClass.CACHE_EXPIRY_SECONDS);
      expect(cold.item.getAssessment()).toEqual(VALID_RESULT_DATA);
      expect(cold.item.artifact).toBe(coldArtefact);
      expect(cold.item.artifact.toJSON()).toEqual(coldArtefactSnapshot);
      expect(cold.item.taskId).toBe(cold.task.getId());
      expect(cold.assignment.submissions[0].documentId).toBe(coldDocumentId);

      // WARM: a DIFFERENT fresh real manager (same real class) serves a fresh
      // identical model inside the SAME active globals, native script cache and
      // shared per-context Map. Different manager identity, same observed key.
      const warmManager = new collected.manager.constructor();
      expect(warmManager).not.toBe(collected.manager);
      expect(warmManager.cacheManager).not.toBe(collected.manager.cacheManager);
      const warmObserved = { ...collected, manager: warmManager };
      const warm = createAssignment('TEXT');
      const warmArtefact = warm.item.artifact;
      const warmDocumentId = warm.assignment.submissions[0].documentId;
      const warmArtefactSnapshot = structuredClone(warmArtefact.toJSON());
      const warmLookup = observeLookup(warmObserved, warm.assignment);
      expect(warmLookup.requests).toEqual([]);
      expect(warmLookup.keys).toEqual([expectedKey]);
      // Exactly the one observed key is present in the native cache, holding the
      // same serialised string written during the live pass.
      expect([...collected.cacheStorage.keys()]).toEqual([expectedKey]);
      expect(collected.cacheStorage.get(expectedKey)).toBe(putCalls[0][1]);
      expect(warm.item.getAssessment()).toEqual(VALID_RESULT_DATA);
      expect(natives.fetchAll).toHaveBeenCalledTimes(1);
      expect(natives.fetch).not.toHaveBeenCalled();
      expect(collected.scriptCache.put).toHaveBeenCalledTimes(1);
      expect(warm.item.artifact).toBe(warmArtefact);
      expect(warm.item.artifact.toJSON()).toEqual(warmArtefactSnapshot);
      expect(warm.item.taskId).toBe(warm.task.getId());
      expect(warm.assignment.submissions[0].documentId).toBe(warmDocumentId);
      expect(warmArtefact.content).toBe(coldArtefact.content);
      expect(warmArtefact.contentHash).toBe(coldArtefact.contentHash);
    });
  });
});

describe('LLM assessment cache stable opaque key generation', () => {
  it('derives the same cold lookup key across fresh identical canonical models', () => {
    withCacheManager({ fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() }, (collected) => {
      const first = createAssignment('TEXT');
      const firstLookup = observeLookup(collected, first.assignment);
      expect(firstLookup.requests).toHaveLength(1);
      // One usable opaque key observed instead of any locally computed format.
      expect(firstLookup.keys).toHaveLength(1);
      expect(typeof firstLookup.keys[0]).toBe('string');
      expect(firstLookup.keys[0].length).toBeGreaterThan(0);
      const observedFirstKey = firstLookup.keys[0];
      const second = createAssignment('TEXT');
      const secondLookup = observeLookup(collected, second.assignment);
      expect(secondLookup.requests).toHaveLength(1);
      expect(secondLookup.keys).toEqual([observedFirstKey]);
    });
  });
});

describe('LLM assessment cache key identity sensitivity', () => {
  it.each([
    ['reference content hash', 'reference'],
    ['template content hash', 'template'],
    ['student content hash', 'student'],
  ])('changes the observed cold key when only the %s changes', (_label, component) => {
    withCacheManager({ fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() }, (collected) => {
      const baseline = createAssignment('TEXT');
      const baselineLookup = observeLookup(collected, baseline.assignment);
      expect(baselineLookup.keys).toHaveLength(1);
      const mutated = createAssignment('TEXT');
      mutateFingerprint(mutated, component);
      const mutatedLookup = observeLookup(collected, mutated.assignment);
      expect(mutatedLookup.requests).toHaveLength(1);
      expect(mutatedLookup.keys).toHaveLength(1);
      expect(mutatedLookup.keys[0]).not.toBe(baselineLookup.keys[0]);
    });
  });

  it('keeps genuinely typed canonical artefacts while a real IMAGE task changes the observed key', () => {
    withCacheManager({ fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() }, (collected) => {
      const text = createAssignment('TEXT');
      const image = createAssignment('IMAGE');
      // Real canonical completed IMAGE identities, never relabelled artefacts.
      expect(image.item.getType()).toBe('IMAGE');
      expect(image.item.artifact.getType()).toBe('IMAGE');
      expect(image.task.getPrimaryReference().getType()).toBe('IMAGE');
      expect(image.task.getPrimaryTemplate().getType()).toBe('IMAGE');

      // Reached fixture-validity preflight before any generation: the aligned
      // bodies are the canonical IMAGE fixture's own reference/template/student
      // payloads — three distinct usable image data URLs under the documented
      // body contract — captured explicitly and supplied to BOTH real fixtures
      // so only the task type differs between their aligned fingerprints.
      const alignedBodies = canonicalImageBodyTriple(image);
      expectUsableDistinctImageBodies(alignedBodies);
      alignTypeFingerprints(text, alignedBodies);
      alignTypeFingerprints(image, alignedBodies);
      // The actually mutated IMAGE artefacts must carry exactly the captured
      // triple, keep distinct student/template fingerprints through the real
      // ensureHash path, and the real student item must still satisfy the
      // existing domain raw-item validator in full mode. Reference/template
      // artefacts carry definition roles and are asserted by the body-only
      // contract above, never by the submission identity validator.
      expectMutatedImageBodiesUsable(alignedBodies, image);
      expect(text.item.artifact.contentHash).toBe(image.item.artifact.contentHash);
      expect(text.task.getPrimaryReference().contentHash).toBe(
        image.task.getPrimaryReference().contentHash
      );
      expect(text.task.getPrimaryTemplate().contentHash).toBe(
        image.task.getPrimaryTemplate().contentHash
      );
      const textLookup = observeLookup(collected, text.assignment);
      const imageLookup = observeLookup(collected, image.assignment);
      expect(textLookup.requests).toHaveLength(1);
      expect(imageLookup.requests).toHaveLength(1);
      expect(textLookup.keys).toHaveLength(1);
      expect(imageLookup.keys).toHaveLength(1);
      expect(textLookup.keys[0]).not.toBe(imageLookup.keys[0]);
    });
  });
});

describe('LLM assessment cache legacy two-hash keys', () => {
  it('treats a seeded historical two-hash entry as a miss and dispatches instead', () => {
    const natives = {
      fetchAll: vi.fn(() => [validHttpResponse()]),
      fetch: vi.fn(),
      sleep: vi.fn(),
    };
    withCacheManager(natives, (collected) => {
      const fixture = createAssignment('TEXT');
      const legacyKey = twoHashKey(fixture);
      const seededValue = JSON.stringify(VALID_RESULT_DATA);
      collected.cacheStorage.set(legacyKey, seededValue);
      expect(collected.cacheStorage.get(legacyKey)).toBe(seededValue);

      const lookup = observeLookup(collected, fixture.assignment);
      // Historical two-hash namespace misses and forces dispatch; the seeded
      // entry is never certified without an HTTP round trip.
      expect(lookup.requests).toHaveLength(1);
      expect(fixture.item.getAssessment()).toEqual({});
      // The versioned runtime read key and later write key both move off the legacy entry; no purge, migration or public prefix is implied.
      expect(lookup.keys[0]).not.toBe(legacyKey);
      collected.manager.processStudentResponses(lookup.requests, fixture.assignment);
      expect(collected.scriptCache.put).toHaveBeenCalledTimes(1);
      expect(collected.scriptCache.put.mock.calls[0][0]).not.toBe(legacyKey);
      // The untouched legacy entry remains exactly as seeded.
      expect(collected.cacheStorage.get(legacyKey)).toBe(seededValue);
    });
  });
});

describe('LLM assessment cache retained write identity', () => {
  it.each([
    ['reference fingerprint', 'reference'],
    ['template fingerprint', 'template'],
    ['student fingerprint', 'student'],
  ])(
    'retains the originally looked-up key for a %s mutated after generation',
    (_label, component) => {
      const natives = {
        fetchAll: vi.fn(() => [validHttpResponse()]),
        fetch: vi.fn(),
        sleep: vi.fn(),
      };
      withCacheManager(natives, (collected) => {
        const fixture = createAssignment('TEXT');
        const artefact = fixture.item.artifact;
        const documentId = fixture.assignment.submissions[0].documentId;
        const lookup = observeLookup(collected, fixture.assignment);
        expect(lookup.requests).toHaveLength(1);
        expect(lookup.keys).toHaveLength(1);
        expect(lookup.requests[0].uid).toBe(artefact.getUid());
        const originalLookupKey = lookup.keys[0];
        const originalPayload = lookup.requests[0].payload;
        // The fingerprint is mutated only after generation/lookup, before the valid response is processed.
        mutateFingerprint(fixture, component);
        // The source is captured AFTER the deliberate mutation for retention.
        const mutatedArtefactSnapshot = structuredClone(artefact.toJSON());
        collected.manager.processStudentResponses(lookup.requests, fixture.assignment);
        // The native write must use the ORIGINALLY looked-up opaque key, never a key recomputed from the now-mutated hashes.
        expect(collected.scriptCache.put).toHaveBeenCalledTimes(1);
        expect(collected.scriptCache.put.mock.calls[0][0]).toBe(originalLookupKey);
        // The original generated request payload is never recomputed or changed.
        expect(lookup.requests[0].payload).toBe(originalPayload);
        expect(fixture.item.artifact).toBe(artefact);
        expect(artefact.toJSON()).toEqual(mutatedArtefactSnapshot);
        expect(fixture.item.taskId).toBe(fixture.task.getId());
        expect(fixture.assignment.submissions[0].documentId).toBe(documentId);
      });
    }
  );
});

/** Clears the exact known priming diagnostics before a tested generation. */
function clearKnownDiagnostics(collected) {
  [
    [collected.logger, 'info'],
    [collected.logger, 'warn'],
    [collected.logger, 'error'],
    [collected.progressTracker, 'updateProgress'],
    [collected.progressTracker, 'logError'],
    [collected.progressTracker, 'logAndThrowError'],
  ].forEach(([channel, method]) => {
    expect(
      typeof channel[method] === 'function' && typeof channel[method].mockClear === 'function'
    ).toBe(true);
    channel[method].mockClear();
  });
}

/** Captures the retained source identity on a fixture for expectSourceRetained. */
function withSourceCapture(fixture) {
  fixture.artefact = fixture.item.artifact;
  fixture.artefactSnapshot = structuredClone(fixture.item.artifact.toJSON());
  fixture.documentId = fixture.assignment.submissions[0].documentId;
  return fixture;
}

/** Asserts the terminal result is exactly the numeric contract with string reasonings and no E. */
function expectTerminalNumericWithoutError(fixture) {
  const assessment = fixture.item.getAssessment();
  expect(assessment).toEqual(VALID_RESULT_DATA);
  expect(
    Object.values(assessment).every(
      (entry) => entry.score !== 'E' && typeof entry.reasoning === 'string'
    )
  ).toBe(true);
}

/** Identical live-batch natives shared by the outage and malformed-entry variants. */
function liveNativeBatch() {
  return { fetchAll: vi.fn(() => [validHttpResponse()]), fetch: vi.fn(), sleep: vi.fn() };
}

/** Asserts the opaque single lookup key, real UID and retained task/source association. */
function expectRealLookupIdentity(fixture, lookup) {
  expect(lookup.requests).toHaveLength(1);
  expect(lookup.requests[0].uid).toBe(fixture.artefact.getUid());
  expect(lookup.keys).toHaveLength(1);
  expect(typeof lookup.keys[0]).toBe('string');
  expect(lookup.keys[0].length).toBeGreaterThan(0);
  expect(fixture.item.taskId).toBe(fixture.task.getId());
}

/** Asserts the validated numeric native write contract put args at the observed key. */
function expectObservedKeyNumericWrite(collected, observedKey) {
  const putCalls = collected.scriptCache.put.mock.calls;
  expect(putCalls).toHaveLength(1);
  expect(putCalls[0][0]).toBe(observedKey);
  expect(typeof putCalls[0][1]).toBe('string');
  expect(JSON.parse(putCalls[0][1])).toEqual(VALID_RESULT_DATA);
  expect(putCalls[0][2]).toBe(collected.cacheManagerClass.CACHE_EXPIRY_SECONDS);
}

describe('LLM assessment cache native outage and malformed-entry resilience', () => {
  it('treats a native cache read outage during generation as a logged miss and still dispatches one real request', () => {
    const natives = liveNativeBatch();
    withCacheManager(natives, (collected) => {
      const readFailure = new Error('NATIVE_CACHE_READ_OUTAGE sentinel');
      // The EXACT native seam throws during the tested real generation; no manager cache method is stubbed.
      collected.scriptCache.get.mockImplementationOnce(() => {
        throw readFailure;
      });
      const fixture = withSourceCapture(createAssignment('TEXT'));
      const lookup = observeLookup(collected, fixture.assignment);
      // Fault reached: the miss still produced one real UID request rather than an E; item stayed inflight.
      expect(collected.scriptCache.get).toHaveBeenCalledTimes(1);
      expectRealLookupIdentity(fixture, lookup);
      expect(fixture.item.getAssessment()).toEqual({});
      // The original Error was logged exactly once through the existing generic owner.
      expect(collected.logger.error).toHaveBeenCalledTimes(1);
      expect(collected.logger.error.mock.calls[0][0]).toBe('Error reading from cache:');
      expect(collected.logger.error.mock.calls[0][1]).toBe(readFailure);
      expect(collected.logger.warn).not.toHaveBeenCalled();
      expect(collected.progressTracker.logError).not.toHaveBeenCalled();
      expect(collected.progressTracker.logAndThrowError).not.toHaveBeenCalled();
      // LIVE: the genuinely missed item is dispatched and validated normally.
      collected.manager.processStudentResponses(lookup.requests, fixture.assignment);
      expect(natives.fetchAll).toHaveBeenCalledTimes(1);
      expect(natives.fetch).not.toHaveBeenCalled();
      expect(natives.sleep).not.toHaveBeenCalled();
      expectTerminalNumericWithoutError(fixture);
      expectSourceRetained(fixture);
      // The validated numeric result is written as the actual JSON string at the observed key with the explicit shared TTL.
      expectObservedKeyNumericWrite(collected, lookup.keys[0]);
      expect([...collected.cacheStorage.keys()]).toEqual([lookup.keys[0]]);
    });
  });

  it('recovers a malformed native JSON entry as a logged miss and replaces it with a validated numeric live result', () => {
    const natives = liveNativeBatch();
    withCacheManager(natives, (collected) => {
      // Prime the runtime's own opaque key with one real generation (no dispatch).
      const primed = observeLookup(collected, createAssignment('TEXT').assignment);
      expect(primed.requests).toHaveLength(1);
      expect(primed.keys).toHaveLength(1);
      const observedKey = primed.keys[0];
      // Seed the malformed string at the observed key directly in the native store.
      collected.cacheStorage.set(observedKey, 'not-json');
      clearKnownDiagnostics(collected);
      // A fresh real manager and a fresh identical model perform the tested generation.
      const testedManager = new collected.manager.constructor();
      expect(testedManager).not.toBe(collected.manager);
      const tested = withSourceCapture(createAssignment('TEXT'));
      const lookup = observeLookup({ ...collected, manager: testedManager }, tested.assignment);
      // Same observed opaque key with one real UID request and no partial assessment before live.
      expectRealLookupIdentity(tested, lookup);
      expect(lookup.keys).toEqual([observedKey]);
      expect(tested.item.getAssessment()).toEqual({});
      // The generic owner logged the ACTUAL parse fault exactly once, not a fabricated diagnostic.
      expect(collected.logger.error).toHaveBeenCalledTimes(1);
      expect(collected.logger.error.mock.calls[0][0]).toBe('Error parsing cached value:');
      const parseFailure = collected.logger.error.mock.calls[0][1];
      expect(parseFailure).toBeInstanceOf(Error);
      expect(parseFailure.message).toContain('not-json');
      expect(collected.logger.warn).not.toHaveBeenCalled();
      expect(collected.progressTracker.logError).not.toHaveBeenCalled();
      expect(collected.progressTracker.logAndThrowError).not.toHaveBeenCalled();
      testedManager.processStudentResponses(lookup.requests, tested.assignment);
      expect(natives.fetchAll).toHaveBeenCalledTimes(1);
      expect(natives.fetch).not.toHaveBeenCalled();
      expect(natives.sleep).not.toHaveBeenCalled();
      expectTerminalNumericWithoutError(tested);
      expectSourceRetained(tested);
      // The malformed entry is replaced by the actual numeric JSON string at the observed key only.
      expectObservedKeyNumericWrite(collected, observedKey);
      expect(collected.cacheStorage.get(observedKey)).toBe(
        collected.scriptCache.put.mock.calls[0][1]
      );
      expect([...collected.cacheStorage.keys()]).toEqual([observedKey]);
    });
  });

  it('keeps a validated live result terminal when the native cache write throws and logs the original error best-effort', () => {
    const natives = liveNativeBatch();
    withCacheManager(natives, (collected) => {
      const fixture = withSourceCapture(createAssignment('TEXT'));
      const lookup = observeLookup(collected, fixture.assignment);
      expectRealLookupIdentity(fixture, lookup);
      expect(fixture.item.getAssessment()).toEqual({});
      const observedKey = lookup.keys[0];
      const writeFailure = new Error('NATIVE_CACHE_WRITE_OUTAGE sentinel');
      // The EXACT native seam throws when the validated live result is cached; no stubbed manager cache method.
      collected.scriptCache.put.mockImplementationOnce(() => {
        throw writeFailure;
      });
      collected.manager.processStudentResponses(lookup.requests, fixture.assignment);
      // Real dispatch and live validation produced the exact successful numeric terminal result.
      expect(natives.fetchAll).toHaveBeenCalledTimes(1);
      expect(natives.fetch).not.toHaveBeenCalled();
      expect(natives.sleep).not.toHaveBeenCalled();
      expectTerminalNumericWithoutError(fixture);
      expectSourceRetained(fixture);
      // Native put received the actual JSON string, the original observed key and shared TTL, once.
      expectObservedKeyNumericWrite(collected, observedKey);
      expect(collected.logger.error).toHaveBeenCalledTimes(1);
      expect(collected.logger.error.mock.calls[0][0]).toBe('Error writing to cache:');
      expect(collected.logger.error.mock.calls[0][1]).toBe(writeFailure);
      expect(collected.logger.warn).not.toHaveBeenCalled();
      expect(collected.cacheStorage.size).toBe(0);
      expect(collected.cacheStorage.has(observedKey)).toBe(false);
    });
  });
});
