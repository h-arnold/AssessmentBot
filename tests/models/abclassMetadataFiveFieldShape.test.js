import { describe, expect, it } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';

const { ABClass } = require('#backend/Models/ABClass.js');
const { ABClassMetadata } = require('#backend/Models/ABClassMetadata.js');
const { Teacher } = require('#backend/Models/Teacher.js');

const teacherGlobal = { Teacher: () => Teacher };
const NEW_FIELDS = ['baselineAverages', 'allTaskStandings', 'baselineStandings'];
const STAMP = '2024-06-01T12:00:00.000Z';
const MAX_STANDINGS = 3;

/**
 * Derives a legacy two-field probe from a committed metadata row. The new fields are
 * removed from a current-shape snapshot, so classAverages and recentAssignments still
 * come from regenerated corpus bytes and the row is selected on structure rather than
 * on a pinned class key.
 * @param {string} profile Committed compact profile name.
 * @param {Function} predicate Row filter over raw metadata snapshots.
 * @param {string} description Diagnostic describing the required row.
 * @returns {Object} A cloned, corpus-backed legacy metadata snapshot.
 */
function canonicalLegacyRow(profile, predicate, description) {
  const rows = Object.values(loadBackendModelInputs(profile).classesById)
    .map((row) => row.metadata)
    .filter((value) => value && Array.isArray(value.recentAssignments) && predicate(value));
  if (rows.length === 0) {
    throw new Error(`Expected a committed ${profile} metadata row ${description}`);
  }
  const legacy = structuredClone(rows[0]);
  for (const field of NEW_FIELDS) {
    delete legacy[field];
  }
  return legacy;
}

/**
 * Selects a committed metadata row with at least one recent assignment, so standing
 * score arrays can be aligned against a real assignment count.
 * @param {string} profile Committed compact profile name.
 * @returns {Object} A cloned, corpus-backed legacy metadata snapshot.
 */
function canonicalLegacy(profile) {
  return canonicalLegacyRow(
    profile,
    (value) => value.recentAssignments.length > 0,
    'with recent assignments'
  );
}

/**
 * Selects a committed metadata row with an exact recent-assignment count, used to
 * align standing score arrays with a known assignment count.
 * @param {string} profile Committed compact profile name.
 * @param {number} count Required number of recent assignments.
 * @returns {Object} A cloned, corpus-backed legacy metadata snapshot.
 */
function canonicalLegacyWithRecentCount(profile, count) {
  return canonicalLegacyRow(
    profile,
    (value) => value.recentAssignments.length === count,
    `with ${count} recent assignments`
  );
}

/**
 * Selects a committed metadata row with an empty recentAssignments array.
 * Used to prove null placeholders are emitted independently of recent-entry count.
 * Only `small` and `medium` carry such a row today; `large-representative` has none.
 * @param {string} profile Committed compact profile name.
 * @returns {Object} A cloned, corpus-backed legacy metadata snapshot.
 */
function canonicalLegacyWithoutRecent(profile) {
  return canonicalLegacyRow(
    profile,
    (value) => value.recentAssignments.length === 0,
    'with no recent entries'
  );
}

const scoreSet = (value = 3) => ({
  completeness: value,
  accuracy: value,
  spag: value,
  overall: value,
});

const standing = (studentId, studentName, count, value = 3) => ({
  studentId,
  studentName,
  scores: scoreSet(value),
  recentAssignmentScores: Array.from({ length: count }, () => scoreSet(value)),
});

/**
 * Builds the five-field shape on top of a committed legacy base. Only the three
 * new fields are local; classAverages and recentAssignments come from the corpus.
 * @param {Object} legacy Corpus-backed legacy metadata snapshot.
 * @returns {Object} A locally enriched current-shape snapshot.
 */
const fiveField = (legacy) => {
  const count = legacy.recentAssignments.length;
  return {
    ...structuredClone(legacy),
    baselineAverages: { ...scoreSet(2.5), updatedAt: STAMP },
    allTaskStandings: {
      top: [standing('student-a', 'Alice', count)],
      bottom: [standing('student-b', 'Bob', count)],
    },
    baselineStandings: {
      top: [standing('student-c', 'Cara', count)],
      bottom: [standing('student-d', 'Dan', count)],
    },
  };
};

/**
 * Asserts a typed, non-request metadata failure at an exact nested field path.
 * @param {Function} invoke Operation expected to throw.
 * @param {string} expectedPath Exact fieldPath carried by the error.
 * @returns {void}
 */
function expectTypedFailureAt(invoke, expectedPath) {
  let error;
  try {
    invoke();
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(globalThis.ABClassMetadataValidationError);
  expect(error.fieldPath).toBe(expectedPath);
  expect(error.message).toContain(expectedPath);
  expect(error.inputSource).not.toBe('request');
  expect(error).not.toBeInstanceOf(globalThis.ApiValidationError);
}

/**
 * Asserts a typed metadata failure whose path contains the required nested segment.
 * @param {Function} invoke Operation expected to throw.
 * @param {string} fragment Path segment the error must report.
 * @returns {void}
 */
function expectTypedFailureContaining(invoke, fragment) {
  let error;
  try {
    invoke();
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(globalThis.ABClassMetadataValidationError);
  expect(error.fieldPath).toContain(fragment);
  expect(error.message).toContain(error.fieldPath);
  expect(error.inputSource).not.toBe('request');
  expect(error).not.toBeInstanceOf(globalThis.ApiValidationError);
}

describe('ABClassMetadata legacy tolerance and five-field shape', () => {
  it('emits null placeholders for all three new fields from a committed legacy snapshot', () => {
    for (const profile of ['small', 'medium', 'large-representative']) {
      const legacy = canonicalLegacy(profile);
      const emitters = [
        (value) => new ABClassMetadata(value).toJSON(),
        (value) => new ABClass({ classId: `legacy-${profile}`, metadata: value }).toJSON().metadata,
        (value) =>
          new ABClass({ classId: `legacy-${profile}`, metadata: value }).toPartialJSON().metadata,
      ];
      for (const emit of emitters) {
        const emitted = emit(structuredClone(legacy));
        for (const field of NEW_FIELDS) {
          expect(Object.hasOwn(emitted, field)).toBe(true);
          expect(emitted[field]).toBeNull();
        }
        expect(emitted.classAverages).toStrictEqual(legacy.classAverages);
        expect(emitted.recentAssignments).toStrictEqual(legacy.recentAssignments);
      }
    }
    for (const profile of ['small', 'medium']) {
      const legacy = canonicalLegacyWithoutRecent(profile);
      const emitted = new ABClassMetadata(structuredClone(legacy)).toJSON();
      expect(emitted.recentAssignments).toStrictEqual([]);
      for (const field of NEW_FIELDS) {
        expect(Object.hasOwn(emitted, field)).toBe(true);
        expect(emitted[field]).toBeNull();
      }
    }
  });

  it('round-trips a current five-field snapshot unchanged through validation, construction and restoration', () => {
    const current = fiveField(canonicalLegacy('small'));
    expect(new ABClassMetadata(structuredClone(current)).toJSON()).toStrictEqual(current);

    const instance = new ABClass({ classId: 'current-shape', metadata: structuredClone(current) });
    expect(instance.toJSON().metadata).toStrictEqual(current);
    expect(instance.toPartialJSON().metadata).toStrictEqual(current);

    const restored = withTemporaryGlobals(teacherGlobal, () =>
      ABClass.fromJSON({ classId: 'current-shape', metadata: structuredClone(current) })
    );
    expect(restored.toJSON().metadata).toStrictEqual(current);
    expect(restored.toPartialJSON().metadata).toStrictEqual(current);
  });

  it.each(NEW_FIELDS)(
    'rejects an explicitly undefined %s but accepts an explicit null',
    (field) => {
      const legacy = canonicalLegacy('small');
      const withUndefined = { ...structuredClone(legacy), [field]: undefined };
      expectTypedFailureAt(() => new ABClassMetadata(withUndefined), `metadata.${field}`);

      const withNull = { ...structuredClone(legacy), [field]: null };
      expect(new ABClassMetadata(structuredClone(withNull)).toJSON()[field]).toBeNull();
    }
  );

  it('treats omission of all three new fields as the legacy path', () => {
    const legacy = canonicalLegacy('small');
    expect(new ABClassMetadata(structuredClone(legacy)).toJSON()).toStrictEqual({
      ...structuredClone(legacy),
      baselineAverages: null,
      allTaskStandings: null,
      baselineStandings: null,
    });
  });

  it('rejects malformed nested standings with nested field paths', () => {
    const base = canonicalLegacy('small');

    const sparse = fiveField(base);
    const holes = [];
    holes.length = 2;
    holes[1] = structuredClone(sparse.allTaskStandings.top[0]);
    sparse.allTaskStandings.top = holes;
    expectTypedFailureContaining(() => new ABClassMetadata(sparse), 'allTaskStandings.top');

    const noId = fiveField(base);
    delete noId.allTaskStandings.top[0].studentId;
    expectTypedFailureAt(
      () => new ABClassMetadata(noId),
      'metadata.allTaskStandings.top[0].studentId'
    );

    const noName = fiveField(base);
    delete noName.baselineStandings.bottom[0].studentName;
    expectTypedFailureAt(
      () => new ABClassMetadata(noName),
      'metadata.baselineStandings.bottom[0].studentName'
    );

    const badScore = fiveField(base);
    badScore.allTaskStandings.top[0].scores.overall = 9;
    expectTypedFailureAt(
      () => new ABClassMetadata(badScore),
      'metadata.allTaskStandings.top[0].scores.overall'
    );

    const badRecentScore = fiveField(base);
    badRecentScore.baselineStandings.top[0].recentAssignmentScores[0].accuracy = 'bogus';
    expectTypedFailureContaining(
      () => new ABClassMetadata(badRecentScore),
      'recentAssignmentScores[0].accuracy'
    );

    const misaligned = fiveField(base);
    misaligned.allTaskStandings.bottom[0].recentAssignmentScores = [];
    expectTypedFailureContaining(() => new ABClassMetadata(misaligned), 'recentAssignmentScores');

    const extraStandingKey = fiveField(base);
    extraStandingKey.allTaskStandings.top[0].studentYear = 11;
    expectTypedFailureAt(
      () => new ABClassMetadata(extraStandingKey),
      'metadata.allTaskStandings.top[0].studentYear'
    );

    const extraStandingsKey = fiveField(base);
    extraStandingsKey.baselineStandings.rankingUpdatedAt = STAMP;
    expectTypedFailureAt(
      () => new ABClassMetadata(extraStandingsKey),
      'metadata.baselineStandings.rankingUpdatedAt'
    );

    const extraScoresKey = fiveField(base);
    extraScoresKey.baselineStandings.bottom[0].scores.rounded = 3;
    expectTypedFailureAt(
      () => new ABClassMetadata(extraScoresKey),
      'metadata.baselineStandings.bottom[0].scores.rounded'
    );
  });

  it('rejects standings lists with more than three entries', () => {
    const base = canonicalLegacy('small');
    const count = base.recentAssignments.length;
    for (const [basis, list] of [
      ['allTaskStandings', 'top'],
      ['allTaskStandings', 'bottom'],
      ['baselineStandings', 'top'],
      ['baselineStandings', 'bottom'],
    ]) {
      const current = fiveField(base);
      current[basis][list] = Array.from({ length: 4 }, (_, index) =>
        standing(`student-${index}`, `Student ${index}`, count)
      );
      expectTypedFailureContaining(() => new ABClassMetadata(current), `${basis}.${list}`);
    }
  });

  it('accepts empty and full three-entry standings lists and round-trips them', () => {
    const empty = fiveField(canonicalLegacy('small'));
    for (const basis of ['allTaskStandings', 'baselineStandings']) {
      empty[basis].top = [];
      empty[basis].bottom = [];
    }
    expect(() => new ABClassMetadata(empty)).not.toThrow();
    expect(new ABClassMetadata(structuredClone(empty)).toJSON()).toStrictEqual(empty);

    const base = canonicalLegacyWithRecentCount('medium', MAX_STANDINGS);
    const count = base.recentAssignments.length;
    const full = fiveField(base);
    for (const basis of ['allTaskStandings', 'baselineStandings']) {
      full[basis].top = Array.from({ length: MAX_STANDINGS }, (_, index) =>
        standing(`top-${index}`, `Top ${index}`, count)
      );
      full[basis].bottom = Array.from({ length: MAX_STANDINGS }, (_, index) =>
        standing(`bottom-${index}`, `Bottom ${index}`, count)
      );
    }
    expect(() => new ABClassMetadata(full)).not.toThrow();
    const emitted = new ABClassMetadata(structuredClone(full)).toJSON();
    expect(emitted).toStrictEqual(full);
    for (const basis of ['allTaskStandings', 'baselineStandings']) {
      expect(emitted[basis].top).toHaveLength(MAX_STANDINGS);
      expect(emitted[basis].bottom).toHaveLength(MAX_STANDINGS);
      for (const entry of [...emitted[basis].top, ...emitted[basis].bottom]) {
        expect(entry.recentAssignmentScores).toHaveLength(count);
      }
    }
  });

  it('accepts duplicate students across top and bottom at the validator level', () => {
    const current = fiveField(canonicalLegacy('small'));
    const shared = standing('student-a', 'Alice', current.recentAssignments.length);
    current.allTaskStandings.top = [structuredClone(shared)];
    current.allTaskStandings.bottom = [structuredClone(shared)];
    current.baselineStandings.top = [structuredClone(shared)];
    current.baselineStandings.bottom = [structuredClone(shared)];
    expect(() => new ABClassMetadata(structuredClone(current))).not.toThrow();
    expect(new ABClassMetadata(structuredClone(current)).toJSON()).toStrictEqual(current);
  });

  it('validates stored ISO timestamps revived through DateUtils.deepConvertDates in the new fields', () => {
    const current = fiveField(canonicalLegacy('small'));
    const iso = current.baselineAverages.updatedAt;

    const withLiveDate = structuredClone(current);
    withLiveDate.baselineAverages.updatedAt = new Date(iso);
    const converted = globalThis.DateUtils.deepConvertDates(withLiveDate);
    expect(converted.baselineAverages.updatedAt).toBe(iso);
    expect(() => new ABClassMetadata(converted)).not.toThrow();
    expect(
      new ABClassMetadata(structuredClone(converted)).toJSON().baselineAverages.updatedAt
    ).toBe(iso);

    const restored = withTemporaryGlobals(teacherGlobal, () =>
      ABClass.fromJSON({ classId: 'revived', metadata: structuredClone(withLiveDate) })
    );
    expect(restored.metadata.baselineAverages.updatedAt).toBe(iso);
    expect(restored.toPartialJSON().metadata).toStrictEqual(current);
  });

  it('emits equal, independently detached full and partial snapshots with the new fields present', () => {
    const current = fiveField(canonicalLegacy('small'));
    const model = new ABClass({ classId: 'detached', metadata: structuredClone(current) });
    const full = model.toJSON().metadata;
    const partial = model.toPartialJSON().metadata;
    expect(full).toStrictEqual(current);
    expect(partial).toStrictEqual(current);
    expect(full).toStrictEqual(partial);

    expect(full).not.toBe(partial);
    expect(full.baselineAverages).not.toBe(partial.baselineAverages);
    expect(full.allTaskStandings).not.toBe(partial.allTaskStandings);
    expect(full.baselineStandings).not.toBe(partial.baselineStandings);
    expect(full.allTaskStandings.top[0]).not.toBe(partial.allTaskStandings.top[0]);
    expect(full.allTaskStandings.top[0].scores).not.toBe(partial.allTaskStandings.top[0].scores);
    expect(full.allTaskStandings.top[0].recentAssignmentScores).not.toBe(
      partial.allTaskStandings.top[0].recentAssignmentScores
    );
    expect(full.allTaskStandings.top[0].recentAssignmentScores[0]).not.toBe(
      partial.allTaskStandings.top[0].recentAssignmentScores[0]
    );

    full.baselineAverages.overall = 0;
    full.allTaskStandings.top[0].scores.overall = 0;
    full.allTaskStandings.top[0].recentAssignmentScores[0].accuracy = 0;
    full.allTaskStandings.top.pop();
    expect(partial).toStrictEqual(current);
    expect(model.toJSON().metadata).toStrictEqual(current);
  });

  it('keeps the committed legacy corpus valid and unchanged through ABClass construction', () => {
    for (const profile of ['small', 'medium', 'large-representative']) {
      const legacyRows = Object.values(loadBackendModelInputs(profile).classesById)
        .map((row) => row.metadata)
        .filter(Boolean);
      for (const metadata of legacyRows) {
        const before = structuredClone(metadata);
        const model = new ABClass({ classId: 'regression', metadata: structuredClone(metadata) });
        expect(model.metadata.classAverages).toStrictEqual(before.classAverages);
        expect(model.metadata.recentAssignments).toStrictEqual(before.recentAssignments);
        expect(metadata).toStrictEqual(before);
      }
    }
  });
});
