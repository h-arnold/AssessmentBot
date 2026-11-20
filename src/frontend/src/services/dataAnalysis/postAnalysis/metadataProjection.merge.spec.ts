import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AveragingAnalyserInputSchema,
  MetricResultSchema,
  type MetricResult,
} from '../dataAnalysis.zod';
import { DataAnalysisService } from '../dataAnalysisService';
import {
  ClassSummarySchema,
  type ClassSummary,
  type MetricScores,
  type MetricStanding,
  type MetricStandings,
} from '../classSummary.zod';
import type {
  AssignmentPartial,
  ClassFull,
} from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import {
  ABClassMetadataSchema,
  MAX_LIST_ENTRIES,
  NonNullableABClassMetadataSchema,
  type AverageScore,
  type AverageScores,
  type RecentAssignment,
  type StudentStanding,
} from '@/services/abClass/abClassMetadata.zod';
import {
  createMetadataRefreshFixture,
  NEW_SOURCE_TIME,
  PROFILES,
  recentEntry,
  SUMMARY_TIME,
} from '@/test/abClass/metadataRefreshFixtures';
import {
  getMetadataRefreshDecision,
  mergeClassMetadata,
  projectAverageScores,
} from './metadataProjection';

const PRECISE_SCORE = 1.2345678912345;
const HISTORY_LIMIT = 3;
const SECOND_INDEX = 2;
const LAST_INDEX = -1;
const TWO_RECENT_ENTRIES = 2;
const ONE_WEIGHT = 1;
const NO_WEIGHT = 0;
const ONE_DATA_POINT = 1;

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

/** Converts a projected metadata score back into its analyser-native metric.
 * @param {AverageScore} score - Projected metadata score.
 * @returns {MetricResult} Validated analyser-native metric.
 */
function metricForScore(score: AverageScore): MetricResult {
  if (typeof score === 'number') return metric('computed', score, ONE_WEIGHT, ONE_DATA_POINT);
  if (score === 'N') return metric('notAttempted', 'N', ONE_WEIGHT, NO_WEIGHT);
  if (score === 'E') return metric('error', 'E', NO_WEIGHT, NO_WEIGHT);
  return metric('excluded', null, NO_WEIGHT, NO_WEIGHT);
}

/** Wraps projected scores in the strict in-memory MetricScores shape.
 * @param {AverageScores} scores - Projected metadata score set.
 * @returns {MetricScores} The analyser-native score set.
 */
function asMetricScores(scores: AverageScores): MetricScores {
  return {
    completeness: metricForScore(scores.completeness),
    accuracy: metricForScore(scores.accuracy),
    spag: metricForScore(scores.spag),
    overall: metricForScore(scores.overall),
  };
}

/** Copies an assignment's summary identity fields.
 * @param {AssignmentPartial} assignment - Source assignment.
 * @returns {object} Identity fields for a summary entry.
 */
function identityOf(assignment: AssignmentPartial) {
  return {
    assignmentId: assignment.assignmentId,
    assignmentDefinitionKey: assignment.assignmentDefinitionKey,
    updatedAt: assignment.updatedAt,
  };
}

/** Builds a schema-valid ClassSummary carrying the supplied projected scores.
 * @param {ClassFull} classFull - Fresh class supplying three recent assignment identities.
 * @param {AssignmentPartial} target - Assignment supplying the target identity.
 * @param {AverageScores} classScores - Scores placed in the all-task basis.
 * @param {AverageScores} assignmentScores - Scores placed on the target.
 * @returns {ClassSummary} The validated summary with empty standings.
 * @remarks The recent identities mirror a real summary (the newest three, target
 * first) so the merge's shared count is governed by stored history, not an empty
 * list. Empty standings carry no entries, so they impose no score-alignment bound.
 */
function summaryForScores(
  classFull: ClassFull,
  target: AssignmentPartial,
  classScores: AverageScores,
  assignmentScores: AverageScores
): ClassSummary {
  const recentIdentities = classFull.assignments
    .toSorted((a, b) => {
      return (
        String(b.updatedAt).localeCompare(String(a.updatedAt)) ||
        a.assignmentId.localeCompare(b.assignmentId)
      );
    })
    .slice(0, MAX_LIST_ENTRIES)
    .map((assignment) => identityOf(assignment));
  recentIdentities[0] = identityOf(target);
  return ClassSummarySchema.parse({
    classId: classFull.classId,
    allTasks: { classAverages: asMetricScores(classScores), standings: { top: [], bottom: [] } },
    baseline: { available: false, classAverages: null, standings: null },
    target: { ...identityOf(target), averages: asMetricScores(assignmentScores) },
    recentAssignments: recentIdentities,
  });
}

/** Builds a schema-valid summary whose standings carry one score set per recent assignment.
 * @param {string} classId - Class identity carried by the summary.
 * @param {ReadonlyArray<{ assignment: AssignmentPartial; scores: AverageScores }>} recent - Newest-first recent assignments with corpus-derived scores; entry zero is the target.
 * @param {AverageScores} basisScores - Basis scores for each standing entry.
 * @returns {ClassSummary} The validated controlled summary with both bases populated.
 */
function summaryWithRecentAssignments(
  classId: string,
  recent: readonly { assignment: AssignmentPartial; scores: AverageScores }[],
  basisScores: AverageScores
): ClassSummary {
  if (recent.length === 0) throw new Error('Controlled summary requires a target assignment');
  const alignedScores = () => recent.map(({ scores }) => asMetricScores(scores));
  const entry = (label: string, suffix: string): MetricStanding => {
    return {
      studentId: `${label}-${suffix}`,
      studentName: `${label} ${suffix} student`,
      scores: asMetricScores(basisScores),
      recentAssignmentScores: alignedScores(),
    };
  };
  const standings = (label: string): MetricStandings => {
    return {
      top: [entry(label, 'top')],
      bottom: [entry(label, 'bottom')],
    };
  };
  const target = recent[0].assignment;
  return ClassSummarySchema.parse({
    classId,
    allTasks: {
      classAverages: asMetricScores(basisScores),
      standings: standings('all-tasks'),
    },
    baseline: {
      available: true,
      classAverages: asMetricScores(basisScores),
      standings: standings('baseline'),
    },
    target: { ...identityOf(target), averages: asMetricScores(basisScores) },
    recentAssignments: recent.map(({ assignment }) => identityOf(assignment)),
  });
}

/** Asserts both standings bases align every top/bottom score array with the shared count.
 * @param {ReturnType<typeof mergeClassMetadata>} result - Emitted metadata snapshot.
 * @param {AverageScores[]} expectedScores - Expected newest-first score arrays.
 * @returns {void}
 */
function expectAlignedStandings(
  result: ReturnType<typeof mergeClassMetadata>,
  expectedScores: AverageScores[]
): void {
  for (const standings of [result.allTaskStandings, result.baselineStandings]) {
    if (standings === null) throw new Error('Expected a populated standings basis');
    for (const list of ['top', 'bottom'] as const) {
      expect(standings[list]).toHaveLength(1);
      expect(standings[list][0].recentAssignmentScores).toEqual(expectedScores);
    }
  }
}

/** Maps one list of analyser-native standings to persisted score sets.
 * @param {readonly MetricStanding[]} entries - Ranked standing entries.
 * @returns {StudentStanding[]} Mapped standing entries.
 */
function projectStandingList(entries: readonly MetricStanding[]): StudentStanding[] {
  return entries.map((entry) => {
    return {
      studentId: entry.studentId,
      studentName: entry.studentName,
      scores: projectAverageScores(entry.scores),
      recentAssignmentScores: entry.recentAssignmentScores.map((scores) =>
        projectAverageScores(scores)
      ),
    };
  });
}

/** Maps both standing lists of one basis to the persisted score union.
 * @param {MetricStandings} standings - Analyser-native standings basis.
 * @returns {{ top: StudentStanding[]; bottom: StudentStanding[] }} Mapped standings.
 */
function projectStandings(standings: MetricStandings) {
  return {
    top: projectStandingList(standings.top),
    bottom: projectStandingList(standings.bottom),
  };
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

    const result = mergeClassMetadata(
      previous,
      summaryForScores(classFull, target, scores, scores),
      SUMMARY_TIME
    );

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
    const result = mergeClassMetadata(
      null,
      summaryForScores(classFull, target, scores, scores),
      SUMMARY_TIME
    );
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
      baselineAverages: null,
      allTaskStandings: { top: [], bottom: [] },
      baselineStandings: null,
    });
    expect(ABClassMetadataSchema.parse(result)).toEqual(result);
    expect(clock).not.toHaveBeenCalled();
  });

  it('appends one to two to three, then evicts only the oldest of four instances', () => {
    const { classFull } = createMetadataRefreshFixture('medium');
    const scores = recentEntry(classFull, 0).averages;
    let metadata = mergeClassMetadata(
      null,
      summaryForScores(classFull, classFull.assignments[0], scores, scores),
      SUMMARY_TIME
    );
    for (const index of [1, SECOND_INDEX, HISTORY_LIMIT]) {
      const before = structuredClone(metadata);
      metadata = mergeClassMetadata(
        metadata,
        summaryForScores(classFull, classFull.assignments[index], scores, scores),
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
      baselineAverages: null,
      allTaskStandings: null,
      baselineStandings: null,
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
    const result = mergeClassMetadata(
      previous,
      summaryForScores(classFull, target, replacement, replacement),
      SUMMARY_TIME
    );
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
      baselineAverages: null,
      allTaskStandings: null,
      baselineStandings: null,
    };
    const target = { ...classFull.assignments[0], updatedAt: SUMMARY_TIME };
    const result = mergeClassMetadata(
      previous,
      summaryForScores(classFull, target, entries[0].averages, entries[0].averages),
      SUMMARY_TIME
    );
    expect(result.recentAssignments.map((entry: RecentAssignment) => entry.assignmentId)).toEqual([
      ...entries.map((entry) => entry.assignmentId),
      target.assignmentId,
    ]);
  });

  it('projects a validated ClassSummary into the five-field snapshot while retaining history', () => {
    const { classFull, assignmentDefinitionPartials } =
      createMetadataRefreshFixture('large-representative');
    const previous = classFull.metadata;
    if (previous === null) throw new Error('Expected canonical stored history');
    const input = AveragingAnalyserInputSchema.parse({
      filter: { classIds: [classFull.classId], analysisMode: 'absolute' },
      classes: [classFull],
      assignmentDefinitionPartials,
    });
    const recent = [...classFull.assignments].toReversed().slice(0, HISTORY_LIMIT);
    const summary = new DataAnalysisService().analyseClassSummary(input, {
      target: recent[0],
      recentAssignments: recent,
    });
    if (!summary.baseline.available || summary.baseline.classAverages === null)
      throw new Error('Expected baseline-eligible canonical class');

    const result = mergeClassMetadata(previous, summary, SUMMARY_TIME);

    expect(result.classAverages).toEqual({
      ...projectAverageScores(summary.allTasks.classAverages),
      updatedAt: SUMMARY_TIME,
    });
    expect(result.allTaskStandings).toEqual(projectStandings(summary.allTasks.standings));
    expect(result.baselineAverages).toEqual({
      ...projectAverageScores(summary.baseline.classAverages),
      updatedAt: SUMMARY_TIME,
    });
    expect(result.baselineStandings).toEqual(projectStandings(summary.baseline.standings!));
    expect(ABClassMetadataSchema.parse(result)).toEqual(result);
  });

  it('narrows three stored entries to two when the fresh summary has fewer recent assignments', () => {
    const { classFull } = createMetadataRefreshFixture('large-representative');
    const previous = classFull.metadata;
    if (previous === null) throw new Error('Expected canonical stored history');
    if (previous.recentAssignments.length !== HISTORY_LIMIT)
      throw new Error('Expected three stored history entries');

    // One stored assignment was deleted; the two survivors are reassessed so the
    // newer one sits above every stored version and the freshness gate returns changed.
    const survivors = classFull.assignments.slice(0, TWO_RECENT_ENTRIES);
    if (survivors.length !== TWO_RECENT_ENTRIES)
      throw new Error('Expected two surviving fresh assignments');
    const target = { ...survivors[1], updatedAt: NEW_SOURCE_TIME };
    classFull.assignments = [survivors[0], target];
    expect(getMetadataRefreshDecision(classFull)).toEqual({ status: 'changed', target });

    const targetRecentScore = recentEntry(classFull, 1).averages;
    const olderRecentScore = recentEntry(classFull, 0).averages;
    const summary = summaryWithRecentAssignments(
      classFull.classId,
      [
        { assignment: target, scores: targetRecentScore },
        { assignment: survivors[0], scores: olderRecentScore },
      ],
      olderRecentScore
    );

    const result = mergeClassMetadata(previous, summary, SUMMARY_TIME);

    expect(result.recentAssignments).toHaveLength(TWO_RECENT_ENTRIES);
    expect(result.recentAssignments.map((entry) => entry.assignmentId)).toEqual([
      target.assignmentId,
      previous.recentAssignments[0].assignmentId,
    ]);
    expectAlignedStandings(result, [targetRecentScore, olderRecentScore]);
    expect(NonNullableABClassMetadataSchema.parse(result)).toEqual(result);
  });

  it('shares one length between history and scores when a fresh summary lists three assignments', () => {
    const { classFull } = createMetadataRefreshFixture('small');
    const recent = classFull.assignments
      .map((assignment, index) => ({ assignment, scores: recentEntry(classFull, index).averages }))
      .toReversed()
      .slice(0, HISTORY_LIMIT);
    if (recent.length !== HISTORY_LIMIT) throw new Error('Expected three fresh recent assignments');
    const basisScores = recent[0].scores;
    const summary = summaryWithRecentAssignments(classFull.classId, recent, basisScores);

    const result = mergeClassMetadata(null, summary, SUMMARY_TIME);

    expect(result.recentAssignments).toHaveLength(1);
    expect(result.recentAssignments[0].assignmentId).toBe(recent[0].assignment.assignmentId);
    expectAlignedStandings(result, [basisScores]);
    expect(NonNullableABClassMetadataSchema.parse(result)).toEqual(result);
  });
});
