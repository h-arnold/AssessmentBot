import { describe, expect, it } from 'vitest';
import {
  calculateExpectedScores,
  canonicalRefreshClass,
  createMetadataRefreshFixture,
  newestAssignment,
  PROFILES,
} from '@/test/abClass/metadataRefreshFixtures';
import { calculateNumericEvidence } from '@/test/abClass/metadataEvidenceOracle';

const PRECISION = 12;
const OMIT_FINAL_ASSIGNMENT = -1;

describe('metadata calculation canonical evidence oracle', () => {
  it.each(PROFILES)(
    'derives numeric expectations from assessment evidence, not supplied snapshots (%s)',
    (profile) => {
      const context = createMetadataRefreshFixture(profile);
      const committed = canonicalRefreshClass(profile, context.classFull.classId);
      expect(context.classFull.assignments).toEqual(
        committed.assignments.slice(0, OMIT_FINAL_ASSIGNMENT)
      );
      expect(context.classFull.metadata).toEqual(committed.metadata);
      const expected = calculateNumericEvidence(
        context.classFull,
        context.assignmentDefinitionPartials
      );
      const actual = calculateExpectedScores(context, context.classFull);
      expect(actual.completeness).toBeCloseTo(expected.completeness, PRECISION);
      expect(actual.accuracy).toEqual(expected.accuracy);
      if (typeof expected.spag !== 'number')
        throw new TypeError('Expected full-class numeric SPaG');
      expect(actual.spag).toBeCloseTo(expected.spag, PRECISION);
      expect(actual.overall).toBeCloseTo(expected.overall, PRECISION);
      const cloned = structuredClone(context.classFull);
      cloned.metadata = null;
      expect(calculateExpectedScores(context, cloned)).toEqual(actual);
      const isolated = { ...cloned, assignments: [newestAssignment(cloned)] };
      const targetExpected = calculateNumericEvidence(
        isolated,
        context.assignmentDefinitionPartials
      );
      const targetActual = calculateExpectedScores(context, isolated);
      for (const criterion of ['completeness', 'accuracy', 'spag', 'overall'] as const) {
        if (typeof targetExpected[criterion] === 'number') {
          expect(targetActual[criterion]).toBeCloseTo(targetExpected[criterion], PRECISION);
        } else {
          expect(targetActual[criterion]).toEqual(targetExpected[criterion]);
        }
      }
    }
  );
});
