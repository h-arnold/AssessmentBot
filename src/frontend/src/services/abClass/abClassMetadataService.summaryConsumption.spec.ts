/**
 * Writer consumption of the single `ClassSummary` entry point.
 *
 * The controlled summary carries distinctive analyser-native values so a saved
 * snapshot proves the writer maps the summary rather than recalculating scores.
 * History is seeded from canonical `large-representative` / `class-1` assignments
 * so the stored rolling list is three entries long and the summary's aligned
 * per-assignment scores satisfy the persisted metadata schema.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataAnalysisService } from '../dataAnalysis/dataAnalysisService';
import { MetricResultSchema, type MetricResult } from '../dataAnalysis/dataAnalysis.zod';
import {
  ClassSummarySchema,
  type ClassSummary,
  type MetricScores,
  type MetricStanding,
  type MetricStandings,
} from '../dataAnalysis/classSummary.zod';
import type { RecentAssignment, StudentStanding } from '@/services/abClass/abClassMetadata.zod';
import {
  createMetadataRefreshFixture,
  newestAssignment,
  recentEntry,
  SUMMARY_TIME,
} from '@/test/abClass/metadataRefreshFixtures';
import { installMetadataRefreshTransport } from '@/test/abClass/metadataRefreshTransport';
import { refreshABClassMetadata } from '../dataAnalysis/postAnalysis/refreshABClassMetadata';
import {
  compareAssignmentNewestFirst,
  projectAverageScores,
} from '../dataAnalysis/postAnalysis/metadataProjection';

const THREE_RECENT = 3;
const OLDER_HISTORY_INDEX = 1;
const OLDEST_HISTORY_INDEX = 0;
const ONE_POINT = 1;
const NO_WEIGHT = 0;
const ONE_DATA_POINT = 1;
const CLASS_COMPLETENESS = 4.2;
const CLASS_OVERALL = 2.75;
const BASELINE_COMPLETENESS = 1.1;
const BASELINE_ACCURACY = 2.2;
const BASELINE_SPAG = 3.3;
const BASELINE_OVERALL = 4.4;
const TARGET_COMPLETENESS = 5;
const TARGET_ACCURACY = 4;
const TARGET_OVERALL = 3;
const HALF_POINT = 0.5;
const QUARTER_POINT = 0.25;
const THREE_QUARTER_POINT = 0.75;
const TOP_COMPLETENESS = 4.5;
const TOP_ACCURACY = 3.5;
const TOP_OVERALL = 4.1;
const BOTTOM_COMPLETENESS = 1.5;
const BOTTOM_SPAG = 2.5;
const BOTTOM_OVERALL = 1.9;

/** Builds a schema-valid computed analyser metric for the controlled summary.
 * @param {number} value - Numeric metric value.
 * @returns {MetricResult} Validated computed metric.
 */
function computed(value: number): MetricResult {
  return MetricResultSchema.parse({
    state: 'computed',
    value,
    totalWeight: ONE_POINT,
    applicableDataPoints: ONE_DATA_POINT,
    totalDataPoints: ONE_DATA_POINT,
  });
}

/** Builds a schema-valid marker analyser metric for the controlled summary.
 * @param {'notAttempted' | 'error' | 'excluded'} state - Marker state.
 * @returns {MetricResult} Validated marker metric.
 */
function marker(state: 'notAttempted' | 'error' | 'excluded'): MetricResult {
  let value: 'N' | 'E' | null = null;
  if (state === 'notAttempted') value = 'N';
  else if (state === 'error') value = 'E';
  return MetricResultSchema.parse({
    state,
    value,
    totalWeight: state === 'notAttempted' ? ONE_POINT : NO_WEIGHT,
    applicableDataPoints: NO_WEIGHT,
    totalDataPoints: ONE_DATA_POINT,
  });
}

/** Composes the four analyser-native criterion results of one score set.
 * @param {MetricResult} completeness - Completeness metric.
 * @param {MetricResult} accuracy - Accuracy metric.
 * @param {MetricResult} spag - SPaG metric.
 * @param {MetricResult} overall - Overall metric.
 * @returns {MetricScores} The composed score set.
 */
function metricScores(
  completeness: MetricResult,
  accuracy: MetricResult,
  spag: MetricResult,
  overall: MetricResult
): MetricScores {
  return { completeness, accuracy, spag, overall };
}

/** Builds distinctive class-average scores that prove summary consumption.
 * @returns {MetricScores} Controlled all-task class averages.
 */
function controlledClassScores(): MetricScores {
  return metricScores(
    computed(CLASS_COMPLETENESS),
    marker('notAttempted'),
    marker('error'),
    computed(CLASS_OVERALL)
  );
}

/** Builds baseline scores separable from the class and target score sets.
 * @returns {MetricScores} Controlled baseline class averages.
 */
function controlledBaselineScores(): MetricScores {
  return metricScores(
    computed(BASELINE_COMPLETENESS),
    computed(BASELINE_ACCURACY),
    computed(BASELINE_SPAG),
    computed(BASELINE_OVERALL)
  );
}

/** Builds distinctive target scores for the persisted newest recent entry.
 * @returns {MetricScores} Controlled target averages.
 */
function controlledTargetScores(): MetricScores {
  return metricScores(
    computed(TARGET_COMPLETENESS),
    computed(TARGET_ACCURACY),
    marker('excluded'),
    computed(TARGET_OVERALL)
  );
}

/** Builds one ranked standing entry with aligned per-assignment scores.
 * @param {string} basis - Basis label used for the student identity.
 * @param {string} suffix - Top or bottom label.
 * @param {MetricScores[]} recent - One score set per recent assignment.
 * @param {MetricScores} scores - Basis scores for the student.
 * @returns {MetricStanding} The controlled standing entry.
 */
function controlledEntry(
  basis: string,
  suffix: string,
  recent: MetricScores[],
  scores: MetricScores
): MetricStanding {
  return {
    studentId: `${basis}-${suffix}`,
    studentName: `${basis} ${suffix} student`,
    scores,
    recentAssignmentScores: recent,
  };
}

/** Builds a disjoint top/bottom pair with one aligned score set per recent assignment.
 * @param {string} basis - Basis label used for the student identities.
 * @returns {MetricStandings} The controlled standings for one basis.
 */
function controlledStandings(basis: string): MetricStandings {
  const recent = Array.from({ length: THREE_RECENT }, (_, index) => {
    return metricScores(
      computed(index + ONE_POINT),
      computed(index + HALF_POINT),
      computed(index + QUARTER_POINT),
      computed(index + THREE_QUARTER_POINT)
    );
  });
  return {
    top: [
      controlledEntry(
        basis,
        'top',
        recent,
        metricScores(
          computed(TOP_COMPLETENESS),
          computed(TOP_ACCURACY),
          marker('excluded'),
          computed(TOP_OVERALL)
        )
      ),
    ],
    bottom: [
      controlledEntry(
        basis,
        'bottom',
        recent,
        metricScores(
          computed(BOTTOM_COMPLETENESS),
          marker('notAttempted'),
          computed(BOTTOM_SPAG),
          computed(BOTTOM_OVERALL)
        )
      ),
    ],
  };
}

/** Seeds two older canonical history entries so the newest assignment stays eligible.
 * @param {ReturnType<typeof createMetadataRefreshFixture>} fixture - Canonical source context.
 * @returns {RecentAssignment[]} The seeded, unchanged history entries.
 */
function seedOlderHistory(fixture: ReturnType<typeof createMetadataRefreshFixture>) {
  const history: RecentAssignment[] = [
    recentEntry(fixture.classFull, OLDER_HISTORY_INDEX),
    recentEntry(fixture.classFull, OLDEST_HISTORY_INDEX),
  ];
  fixture.classFull.metadata = {
    classAverages: { ...history[0].averages, updatedAt: SUMMARY_TIME },
    recentAssignments: history,
    baselineAverages: null,
    allTaskStandings: null,
    baselineStandings: null,
  };
  return history;
}

/** Builds a schema-valid ClassSummary with distinctive values for mapping checks.
 * @param {ReturnType<typeof createMetadataRefreshFixture>} fixture - Canonical source context.
 * @param {boolean} hasBaseline - Whether to emit a populated baseline basis.
 * @returns {ClassSummary} The validated controlled summary.
 */
function createControlledSummary(
  fixture: ReturnType<typeof createMetadataRefreshFixture>,
  hasBaseline: boolean
): ClassSummary {
  const recent = fixture.classFull.assignments
    .toSorted(compareAssignmentNewestFirst)
    .slice(0, THREE_RECENT);
  const target = recent[0];
  if (!target) throw new Error('Controlled summary requires a target assignment');
  return ClassSummarySchema.parse({
    classId: fixture.classFull.classId,
    allTasks: {
      classAverages: controlledClassScores(),
      standings: controlledStandings('all-tasks'),
    },
    baseline: hasBaseline
      ? {
          available: true,
          classAverages: controlledBaselineScores(),
          standings: controlledStandings('baseline'),
        }
      : { available: false, classAverages: null, standings: null },
    target: {
      assignmentId: target.assignmentId,
      assignmentDefinitionKey: target.assignmentDefinitionKey,
      updatedAt: target.updatedAt,
      averages: controlledTargetScores(),
    },
    recentAssignments: recent.map((assignment) => {
      return {
        assignmentId: assignment.assignmentId,
        assignmentDefinitionKey: assignment.assignmentDefinitionKey,
        updatedAt: assignment.updatedAt,
      };
    }),
  });
}

/** Maps one standing list's analyser-native scores to persisted score sets.
 * @param {readonly MetricStanding[]} entries - Ranked standing entries.
 * @returns {StudentStanding[]} Mapped persisted standing entries.
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

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ABClass metadata writer consumes one class summary', () => {
  it('calls analyseClassSummary once with the fresh-class input and newest-three options', async () => {
    const context = createMetadataRefreshFixture('large-representative');
    seedOlderHistory(context);
    const backend = installMetadataRefreshTransport(context.classFull);
    const summary = createControlledSummary(context, true);
    const analyseSummary = vi
      .spyOn(DataAnalysisService.prototype, 'analyseClassSummary')
      .mockImplementation(() => summary);
    const now = vi.fn(() => SUMMARY_TIME);

    await expect(refreshABClassMetadata(context, now)).resolves.toMatchObject({
      status: 'saved',
      confirmedPersistence: true,
    });

    expect(analyseSummary).toHaveBeenCalledTimes(1);
    expect(analyseSummary).toHaveBeenCalledWith(
      {
        classes: [context.classFull],
        assignmentDefinitionPartials: context.assignmentDefinitionPartials,
        filter: { classIds: [context.classFull.classId], analysisMode: 'absolute' },
      },
      {
        target: newestAssignment(context.classFull),
        recentAssignments: context.classFull.assignments
          .toSorted(compareAssignmentNewestFirst)
          .slice(0, THREE_RECENT),
      }
    );
    expect(backend.events).toEqual(['getABClass', 'updateABClass']);
    expect(now).toHaveBeenCalledTimes(1);
  });

  it('writes the five-field snapshot mapped from the summary and retains stored history', async () => {
    const context = createMetadataRefreshFixture('large-representative');
    const history = seedOlderHistory(context);
    const backend = installMetadataRefreshTransport(context.classFull);
    const summary = createControlledSummary(context, true);
    vi.spyOn(DataAnalysisService.prototype, 'analyseClassSummary').mockImplementation(
      () => summary
    );

    const result = await refreshABClassMetadata(context, () => SUMMARY_TIME);

    const target = newestAssignment(context.classFull);
    const saved = backend.readStored()!.metadata!;
    expect(saved.classAverages).toEqual({
      ...projectAverageScores(summary.allTasks.classAverages),
      updatedAt: SUMMARY_TIME,
    });
    expect(saved.allTaskStandings).toEqual(projectStandings(summary.allTasks.standings));
    expect(saved.baselineAverages).toEqual({
      ...projectAverageScores(summary.baseline.classAverages!),
      updatedAt: SUMMARY_TIME,
    });
    expect(saved.baselineStandings).toEqual(projectStandings(summary.baseline.standings!));
    expect(saved.recentAssignments).toEqual([
      {
        assignmentId: target.assignmentId,
        assignmentDefinitionKey: target.assignmentDefinitionKey,
        updatedAt: target.updatedAt,
        averages: projectAverageScores(summary.target.averages),
      },
      ...history,
    ]);
    if (result.status !== 'saved') throw new Error('Expected confirmed persistence');
    expect(result.classPartial.metadata).toEqual(saved);
  });

  it('writes populated all-task fields with null baseline fields when the summary baseline is unavailable', async () => {
    const context = createMetadataRefreshFixture('large-representative');
    seedOlderHistory(context);
    const backend = installMetadataRefreshTransport(context.classFull);
    const summary = createControlledSummary(context, false);
    vi.spyOn(DataAnalysisService.prototype, 'analyseClassSummary').mockImplementation(
      () => summary
    );

    await expect(refreshABClassMetadata(context, () => SUMMARY_TIME)).resolves.toMatchObject({
      status: 'saved',
      confirmedPersistence: true,
    });

    const saved = backend.readStored()!.metadata!;
    expect(summary.baseline).toEqual({
      available: false,
      classAverages: null,
      standings: null,
    });
    expect(saved.baselineAverages).toBeNull();
    expect(saved.baselineStandings).toBeNull();
    expect(saved.allTaskStandings).toEqual(projectStandings(summary.allTasks.standings));
    if (saved.allTaskStandings === null) throw new Error('Expected populated all-task standings');
    expect(saved.allTaskStandings.top.length).toBeGreaterThan(0);
    expect(saved.classAverages).toEqual({
      ...projectAverageScores(summary.allTasks.classAverages),
      updatedAt: SUMMARY_TIME,
    });
  });
});
