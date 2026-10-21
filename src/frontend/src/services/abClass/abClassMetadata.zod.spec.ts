import { describe, expect, it } from 'vitest';
import { ABClassMetadataSchema } from './abClassMetadata.zod';
import {
  METADATA_PROFILES,
  cloneMetadata,
  METADATA_PROFILE_CLASS_PARTIALS,
  type MetadataProfile,
} from '@/test/abClass/abClassMetadataFixtures';
import {
  DEFAULT_CLASS_AVERAGES,
  metadataCandidate,
  readClassAverage,
  requireMetadataObject,
  type MetadataCandidateValues,
} from '@/test/abClass/abClassMetadataTestBuilders';

const BELOW_MINIMUM = -0.1;
const ABOVE_MAXIMUM = 5.1;

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

describe('ABClass metadata schema', () => {
  it('preserves canonical snapshots from every metadata profile', () => {
    const profiles = Object.keys(METADATA_PROFILE_CLASS_PARTIALS);
    expect(profiles).toEqual([...METADATA_PROFILES]);
    for (const profile of profiles as MetadataProfile[]) {
      const rows = cloneMetadata(METADATA_PROFILE_CLASS_PARTIALS[profile]);
      for (const row of rows) {
        expect(ABClassMetadataSchema.parse(cloneMetadata(row.metadata))).toEqual(row.metadata);
      }
    }
  });

  it('accepts null and preserves the exact average score union', () => {
    expect(ABClassMetadataSchema.parse(null)).toBeNull();
    const defaultCandidate = metadataCandidate(DEFAULT_CLASS_AVERAGES, []);
    expect(ABClassMetadataSchema.parse(defaultCandidate)).toEqual(defaultCandidate);
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
