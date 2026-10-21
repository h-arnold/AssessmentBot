import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetricResultSchema } from '../dataAnalysis.zod';
import { ABClassMetadataSchema } from '@/services/abClass/abClassMetadata.zod';
import {
  createMetadataRefreshFixture,
  NEW_SOURCE_TIME,
  PROFILES,
  recentEntry,
  SUMMARY_TIME,
} from '@/test/abClass/metadataRefreshFixtures';
import { mergeClassMetadata, projectAverageScores } from './metadataProjection';
import type { RecentAssignment } from '@/services/abClass/abClassMetadata.zod';

const PRECISE_SCORE = 1.2345678912345;
const HISTORY_LIMIT = 3;
const SECOND_INDEX = 2;
const LAST_INDEX = -1;
const TWO_RECENT_ENTRIES = 2;

/** Builds a schema-validated metric boundary probe.
 * @param {string} state - Metric state.
 * @param {unknown} value - Corresponding value.
 * @param {number} totalWeight - Contribution weight.
 * @param {number} applicableDataPoints - Numeric count.
 * @returns {import('../dataAnalysis.zod').MetricResult} Validated metric.
 */
function metric(state: string, value: unknown, totalWeight: number, applicableDataPoints: number) {
  return MetricResultSchema.parse({
    state,
    value,
    totalWeight,
    applicableDataPoints,
    totalDataPoints: 1,
  });
}

afterEach(() => vi.restoreAllMocks());

describe('projectAverageScores explicit metric states', () => {
  it('retains computed precision and weighted overall while mapping N, E and excluded explicitly', () => {
    const computed = metric('computed', PRECISE_SCORE, 1, 1);
    const n = metric('notAttempted', 'N', 1, 0);
    const e = metric('error', 'E', 0, 0);
    const excluded = metric('excluded', null, 0, 0);
    expect(
      projectAverageScores({ completeness: computed, accuracy: n, spag: e, overall: excluded })
    ).toEqual({ completeness: 1.2345678912345, accuracy: 'N', spag: 'E', overall: 'excluded' });
    expect(
      projectAverageScores({ completeness: n, accuracy: e, spag: excluded, overall: computed })
    ).toEqual({ completeness: 'N', accuracy: 'E', spag: 'excluded', overall: 1.2345678912345 });
  });
});

describe('mergeClassMetadata stable rolling history', () => {
  it.each([
    ['medium', TWO_RECENT_ENTRIES],
    ['large-representative', HISTORY_LIMIT],
  ] as const)('retains independently supplied %s history with %i entries', (profile, count) => {
    const { classFull } = createMetadataRefreshFixture(profile);
    const previous = classFull.metadata;
    if (previous === null) throw new Error('Expected canonical stored history');
    expect(previous.recentAssignments).toHaveLength(count);
    const before = structuredClone(previous);
    const target = { ...classFull.assignments[0], updatedAt: NEW_SOURCE_TIME };
    expect(
      previous.recentAssignments.some((entry) => entry.assignmentId === target.assignmentId)
    ).toBe(false);
    const scores = recentEntry(classFull, 0).averages;

    const result = mergeClassMetadata(previous, scores, target, scores, SUMMARY_TIME);

    expect(result.recentAssignments).toEqual([
      {
        assignmentId: target.assignmentId,
        assignmentDefinitionKey: target.assignmentDefinitionKey,
        updatedAt: NEW_SOURCE_TIME,
        averages: scores,
      },
      ...before.recentAssignments.slice(0, HISTORY_LIMIT - 1),
    ]);
    expect(previous).toEqual(before);
    result.recentAssignments[1].averages.overall = 0;
    expect(previous).toEqual(before);
  });

  it.each(PROFILES)('starts with exactly one target entry for null metadata (%s)', (profile) => {
    const { classFull } = createMetadataRefreshFixture(profile);
    const target = classFull.assignments.at(LAST_INDEX)!;
    const scores = recentEntry(classFull, 0).averages;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Pure merge read clock');
    });
    const result = mergeClassMetadata(null, scores, target, scores, SUMMARY_TIME);
    expect(result).toEqual({
      classAverages: { ...scores, updatedAt: SUMMARY_TIME },
      recentAssignments: [
        {
          assignmentId: target.assignmentId,
          assignmentDefinitionKey: target.assignmentDefinitionKey,
          averages: scores,
          updatedAt: target.updatedAt,
        },
      ],
    });
    expect(ABClassMetadataSchema.parse(result)).toEqual(result);
    expect(clock).not.toHaveBeenCalled();
  });

  it('appends one to two to three, then evicts only the oldest of four instances', () => {
    const { classFull } = createMetadataRefreshFixture('medium');
    const scores = recentEntry(classFull, 0).averages;
    let metadata = mergeClassMetadata(null, scores, classFull.assignments[0], scores, SUMMARY_TIME);
    for (const index of [1, SECOND_INDEX, HISTORY_LIMIT]) {
      const before = structuredClone(metadata);
      metadata = mergeClassMetadata(
        metadata,
        scores,
        classFull.assignments[index],
        scores,
        SUMMARY_TIME
      );
      expect(
        metadata.recentAssignments.map((entry: RecentAssignment) => entry.assignmentId)
      ).toEqual(
        classFull.assignments
          .slice(Math.max(0, index - SECOND_INDEX), index + 1)
          .toReversed()
          .map((entry) => entry.assignmentId)
      );
      expect(before.recentAssignments).toHaveLength(Math.min(index, HISTORY_LIMIT));
    }
  });

  it('replaces a reassessed ID and preserves equal-time positions, even when definitions repeat', () => {
    const { classFull } = createMetadataRefreshFixture('large-representative');
    const entries = [0, 1, SECOND_INDEX].map((index) => {
      const entry = recentEntry(classFull, index);
      return { ...entry, updatedAt: SUMMARY_TIME };
    });
    entries.forEach((entry) => {
      entry.assignmentDefinitionKey = entries[0].assignmentDefinitionKey;
    });
    const previous = {
      classAverages: { ...entries[0].averages, updatedAt: SUMMARY_TIME },
      recentAssignments: entries,
    };
    const before = structuredClone(previous);
    const target = {
      ...classFull.assignments[1],
      updatedAt: SUMMARY_TIME,
      assignmentDefinitionKey: entries[0].assignmentDefinitionKey,
    };
    const replacement = {
      completeness: 0,
      accuracy: 5,
      spag: 'excluded',
      overall: 2.3456789,
    } as const;
    const result = mergeClassMetadata(previous, replacement, target, replacement, SUMMARY_TIME);
    expect(result.recentAssignments.map((entry: RecentAssignment) => entry.assignmentId)).toEqual(
      entries.map((entry) => entry.assignmentId)
    );
    expect(result.recentAssignments[1].averages).toEqual(replacement);
    expect(result.recentAssignments[0]).toEqual(entries[0]);
    expect(result.recentAssignments[2]).toEqual(entries[2]);
    expect(previous).toEqual(before);
    result.recentAssignments[0].averages.overall = 0;
    expect(previous).toEqual(before);
  });

  it('appends a different ID at equal time without alphabetically re-sorting stored ties', () => {
    const { classFull } = createMetadataRefreshFixture('medium');
    const entries = [SECOND_INDEX, 1].map((index) => {
      const entry = recentEntry(classFull, index);
      return { ...entry, updatedAt: SUMMARY_TIME };
    });
    const previous = {
      classAverages: { ...entries[0].averages, updatedAt: SUMMARY_TIME },
      recentAssignments: entries,
    };
    const target = { ...classFull.assignments[0], updatedAt: SUMMARY_TIME };
    const result = mergeClassMetadata(
      previous,
      entries[0].averages,
      target,
      entries[0].averages,
      SUMMARY_TIME
    );
    expect(result.recentAssignments.map((entry: RecentAssignment) => entry.assignmentId)).toEqual([
      ...entries.map((entry) => entry.assignmentId),
      target.assignmentId,
    ]);
  });
});
