import { describe, expect, it } from 'vitest';
import { ABClassMetadataSchema, NonNullableABClassMetadataSchema } from './abClassMetadata.zod';
import {
  METADATA_PROFILES,
  METADATA_PROFILE_CLASS_PARTIALS,
  NEW_METADATA_FIELDS,
  MAX_STANDINGS,
  buildCurrentMetadata,
  committedLegacyRowWithRecent,
  committedLegacyRows,
  probeScores,
  probeStanding,
  cloneMetadata,
  type MetadataProfile,
  type ProbeStanding,
} from '@/test/abClass/abClassMetadataFixtures';
import {
  DEFAULT_CLASS_AVERAGES,
  asScratchPad,
  metadataCandidate,
  readClassAverage,
  requireMetadataObject,
  type MetadataCandidateValues,
} from '@/test/abClass/abClassMetadataTestBuilders';

const BELOW_MINIMUM = -0.1;
const ABOVE_MAXIMUM = 5.1;
const INVALID_SCORE = 9;
const OVERSIZE = MAX_STANDINGS + 1;
const SPARSE_LENGTH = 2;
const EXTRA_PROBE_VALUE = 'unexpected';

const REJECTED_SCORES = [BELOW_MINIMUM, ABOVE_MAXIMUM, NaN, Infinity, -Infinity, '2', null, 'n'];
const MARKER_VALUES = { ...DEFAULT_CLASS_AVERAGES, overall: 'excluded' };

/**
 * Creates a local metadata candidate with one replaceable score value.
 * @param {unknown} score - Completeness score the schema should judge.
 * @returns {MetadataCandidateValues} Local raw candidate.
 */
function candidateWithCompleteness(score: unknown): MetadataCandidateValues {
  return metadataCandidate({ ...DEFAULT_CLASS_AVERAGES, completeness: score }, []);
}

/**
 * Narrows a parsed metadata value to a plain record for field assertions.
 * @param {unknown} value - Parsed metadata value.
 * @returns {Record<string, unknown>} The same value as a plain record.
 */
function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a metadata record');
  }
  return value as Record<string, unknown>;
}

describe('ABClass metadata schema', () => {
  it('parses committed legacy snapshots and emits null placeholders for all three new fields', () => {
    const profiles = Object.keys(METADATA_PROFILE_CLASS_PARTIALS);
    expect(profiles).toEqual([...METADATA_PROFILES]);
    for (const profile of profiles as MetadataProfile[]) {
      for (const legacy of committedLegacyRows(profile)) {
        const emitted = asRecord(ABClassMetadataSchema.parse(cloneMetadata(legacy)));
        for (const field of NEW_METADATA_FIELDS) {
          expect(Object.hasOwn(emitted, field)).toBe(true);
          expect(emitted[field]).toBeNull();
        }
        expect(emitted.classAverages).toStrictEqual(legacy.classAverages);
        expect(emitted.recentAssignments).toStrictEqual(legacy.recentAssignments);
      }
    }
    expect(ABClassMetadataSchema.parse(null)).toBeNull();
  });

  it('accepts null and preserves the exact average score union', () => {
    expect(ABClassMetadataSchema.parse(null)).toBeNull();
    const defaultCandidate = metadataCandidate(DEFAULT_CLASS_AVERAGES, []);
    expect(ABClassMetadataSchema.parse(defaultCandidate)).toEqual({
      ...defaultCandidate,
      baselineAverages: null,
      allTaskStandings: null,
      baselineStandings: null,
    });
  });

  it.each([...REJECTED_SCORES, 'Excluded'])('rejects invalid completeness score %s', (score) => {
    const candidate = candidateWithCompleteness(score);
    expect(ABClassMetadataSchema.safeParse(candidate).success).toBe(false);
  });

  it('preserves marker values without coercion', () => {
    const parsed = requireMetadataObject(
      ABClassMetadataSchema.parse(metadataCandidate(MARKER_VALUES, []))
    );
    expect(readClassAverage(parsed, 'completeness')).toBe(DEFAULT_CLASS_AVERAGES.completeness);
    expect(readClassAverage(parsed, 'overall')).toBe('excluded');
  });
});

describe('ABClass metadata current five-field shape', () => {
  it('round-trips a populated current snapshot without dropping any field', () => {
    for (const profile of METADATA_PROFILES) {
      const current = buildCurrentMetadata(committedLegacyRowWithRecent(profile));
      const nullableParsed = ABClassMetadataSchema.parse(structuredClone(current));
      const nonNullableParsed = NonNullableABClassMetadataSchema.parse(structuredClone(current));
      expect(asRecord(nullableParsed)).toStrictEqual(current);
      expect(asRecord(nonNullableParsed)).toStrictEqual(current);
    }
  });

  it.each([...NEW_METADATA_FIELDS])('accepts an explicit null %s', (field) => {
    const current = buildCurrentMetadata(committedLegacyRowWithRecent('small'));
    const withNull = { ...current, [field]: null };
    for (const schema of [ABClassMetadataSchema, NonNullableABClassMetadataSchema] as const) {
      expect(schema.safeParse(withNull).success).toBe(true);
      const parsed = asRecord(schema.parse(withNull));
      expect(Object.hasOwn(parsed, field)).toBe(true);
      expect(parsed[field]).toBeNull();
    }
  });

  it.each([...NEW_METADATA_FIELDS])('rejects a present undefined %s', (field) => {
    const current = buildCurrentMetadata(committedLegacyRowWithRecent('small'));
    const withUndefined = { ...current, [field]: undefined };
    expect(ABClassMetadataSchema.safeParse(withUndefined).success).toBe(false);
    expect(NonNullableABClassMetadataSchema.safeParse(withUndefined).success).toBe(false);
  });

  it('rejects a current snapshot carrying an unexpected own key', () => {
    const current = buildCurrentMetadata(committedLegacyRowWithRecent('small'));
    asScratchPad(current).unexpected = true;
    expect(ABClassMetadataSchema.safeParse(current).success).toBe(false);
    expect(NonNullableABClassMetadataSchema.safeParse(current).success).toBe(false);
  });

  it('rejects malformed nested standings entries', () => {
    const base = committedLegacyRowWithRecent('small');
    const count = (base.recentAssignments as unknown[]).length;

    const missingId = buildCurrentMetadata(base);
    delete asScratchPad(missingId.allTaskStandings.top[0]).studentId;
    expect(ABClassMetadataSchema.safeParse(missingId).success).toBe(false);

    const missingName = buildCurrentMetadata(base);
    delete asScratchPad(missingName.baselineStandings.bottom[0]).studentName;
    expect(ABClassMetadataSchema.safeParse(missingName).success).toBe(false);

    const badScore = buildCurrentMetadata(base);
    badScore.allTaskStandings.top[0].scores.overall = INVALID_SCORE;
    expect(ABClassMetadataSchema.safeParse(badScore).success).toBe(false);

    const badRecentScore = buildCurrentMetadata(base);
    badRecentScore.baselineStandings.top[0].recentAssignmentScores[0].accuracy = 'bogus';
    expect(ABClassMetadataSchema.safeParse(badRecentScore).success).toBe(false);

    const extraStandingKey = buildCurrentMetadata(base);
    asScratchPad(extraStandingKey.allTaskStandings.top[0]).studentYear = EXTRA_PROBE_VALUE;
    expect(ABClassMetadataSchema.safeParse(extraStandingKey).success).toBe(false);

    const extraStandingsKey = buildCurrentMetadata(base);
    asScratchPad(extraStandingsKey.baselineStandings).rankingUpdatedAt = EXTRA_PROBE_VALUE;
    expect(ABClassMetadataSchema.safeParse(extraStandingsKey).success).toBe(false);

    const extraScoresKey = buildCurrentMetadata(base);
    asScratchPad(extraScoresKey.baselineStandings.bottom[0].scores).rounded = EXTRA_PROBE_VALUE;
    expect(ABClassMetadataSchema.safeParse(extraScoresKey).success).toBe(false);

    const sparse = buildCurrentMetadata(base);
    const holes: ProbeStanding[] = [];
    holes.length = SPARSE_LENGTH;
    holes[1] = probeStanding('student-z', 'Zoe', count);
    sparse.allTaskStandings.top = holes;
    expect(ABClassMetadataSchema.safeParse(sparse).success).toBe(false);
  });

  it.each(['allTaskStandings', 'baselineStandings'] as const)(
    'validates %s top and bottom as dense zero-to-three arrays',
    (basis) => {
      const base = committedLegacyRowWithRecent('small');
      const count = (base.recentAssignments as unknown[]).length;

      const empty = buildCurrentMetadata(base);
      empty[basis].top = [];
      empty[basis].bottom = [];
      expect(ABClassMetadataSchema.safeParse(empty).success).toBe(true);

      const full = buildCurrentMetadata(base);
      full[basis].top = Array.from({ length: MAX_STANDINGS }, (_, index) =>
        probeStanding(`top-${index}`, `Top ${index}`, count)
      );
      full[basis].bottom = Array.from({ length: MAX_STANDINGS }, (_, index) =>
        probeStanding(`bottom-${index}`, `Bottom ${index}`, count)
      );
      expect(ABClassMetadataSchema.safeParse(full).success).toBe(true);

      for (const list of ['top', 'bottom'] as const) {
        const oversized = buildCurrentMetadata(base);
        oversized[basis][list] = Array.from({ length: OVERSIZE }, (_, index) =>
          probeStanding(`${list}-${index}`, `Student ${index}`, count)
        );
        expect(ABClassMetadataSchema.safeParse(oversized).success).toBe(false);
      }
    }
  );

  it('accepts duplicate students across top and bottom because the schema adds no uniqueness rule', () => {
    const current = buildCurrentMetadata(committedLegacyRowWithRecent('small'));
    const shared = probeStanding('student-a', 'Alice', current.recentAssignments.length);
    current.allTaskStandings.top = [structuredClone(shared)];
    current.allTaskStandings.bottom = [structuredClone(shared)];
    current.baselineStandings.top = [structuredClone(shared)];
    current.baselineStandings.bottom = [structuredClone(shared)];
    expect(ABClassMetadataSchema.safeParse(current).success).toBe(true);
    const parsed = NonNullableABClassMetadataSchema.parse(structuredClone(current));
    expect(asRecord(parsed)).toStrictEqual(current);
  });

  it('enforces one recent-assignment score set per recent assignment', () => {
    const base = committedLegacyRowWithRecent('medium');
    const count = (base.recentAssignments as unknown[]).length;
    const aligned = buildCurrentMetadata(base);
    for (const basis of ['allTaskStandings', 'baselineStandings'] as const) {
      for (const entry of [...aligned[basis].top, ...aligned[basis].bottom]) {
        expect(entry.recentAssignmentScores).toHaveLength(count);
      }
    }
    expect(ABClassMetadataSchema.safeParse(aligned).success).toBe(true);

    const short = buildCurrentMetadata(base);
    short.allTaskStandings.top[0].recentAssignmentScores = [];
    expect(ABClassMetadataSchema.safeParse(short).success).toBe(false);

    const long = buildCurrentMetadata(base);
    long.baselineStandings.bottom[0].recentAssignmentScores = Array.from(
      { length: count + 1 },
      () => probeScores()
    );
    expect(ABClassMetadataSchema.safeParse(long).success).toBe(false);

    const zeroRow = committedLegacyRows('small').find(
      (row) => (row.recentAssignments as unknown[]).length === 0
    );
    if (!zeroRow) throw new Error('Expected a committed small legacy row with no recent entries');
    expect(ABClassMetadataSchema.safeParse(buildCurrentMetadata(zeroRow)).success).toBe(true);
  });
});
