import {
  CanonicalMetadataTimestampSchema,
  MAX_LIST_ENTRIES,
  NonNullableABClassMetadataSchema,
  type ABClassMetadata,
  type AverageScore,
  type AverageScores,
  type RecentAssignment,
  type StudentStanding,
  type StudentStandings,
} from '@/services/abClass/abClassMetadata.zod';
import type {
  AssignmentPartial,
  ClassFull,
} from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassSummary, MetricStanding, MetricStandings } from '../classSummary.zod';
import type { MetricResult, PerClassResult } from '../dataAnalysis.zod';

const NOT_FOUND_INDEX = -1;

/** Timestamp-only no-op outcome with a task-owned skip reason. */
export type MetadataRefreshSkipped = {
  status: 'skipped';
  reason: 'noAssignments' | 'unchanged' | 'staleSource';
};

/** Freshness decision: a skipped no-op or the newest assignment requiring refresh. */
export type MetadataRefreshDecision =
  MetadataRefreshSkipped | { status: 'changed'; target: AssignmentPartial };

/** Orders assignment source versions newest first, then by ascending ID.
 * @param {Pick<AssignmentPartial, 'updatedAt' | 'assignmentId'>} a - First source.
 * @param {Pick<AssignmentPartial, 'updatedAt' | 'assignmentId'>} b - Second source.
 * @returns {number} Comparator result.
 */
export function compareAssignmentNewestFirst(
  a: Pick<AssignmentPartial, 'updatedAt' | 'assignmentId'>,
  b: Pick<AssignmentPartial, 'updatedAt' | 'assignmentId'>
): number {
  return b.updatedAt!.localeCompare(a.updatedAt!) || a.assignmentId.localeCompare(b.assignmentId);
}

/**
 * Selects the complete class's newest canonical assignment version without I/O.
 * @param {ClassFull} classFull - Complete validated class, never a display selection.
 * @returns {MetadataRefreshDecision} Target requiring refresh or a timestamp-only no-op.
 * @remarks Every candidate timestamp is validated before selection. Definition,
 * weighting and roster-only changes intentionally do not refresh this snapshot.
 */
export function getMetadataRefreshDecision(classFull: ClassFull): MetadataRefreshDecision {
  if (classFull.assignments.length === 0) return { status: 'skipped', reason: 'noAssignments' };

  const { assignment: target, updatedAt } = selectNewestAssignment(classFull.assignments);
  const recent = classFull.metadata?.recentAssignments;
  const matching = recent?.find((entry) => entry.assignmentId === target.assignmentId);
  if (matching?.updatedAt === updatedAt) return { status: 'skipped', reason: 'unchanged' };
  if (isStaleSource(updatedAt, recent)) {
    return { status: 'skipped', reason: 'staleSource' };
  }
  return { status: 'changed', target };
}

/**
 * Selects the newest canonical assignment version in one linear scan.
 * @param {AssignmentPartial[]} assignments - Complete validated class assignments.
 * @returns {{ assignment: AssignmentPartial; updatedAt: string }} Newest assignment
 * paired with its canonical timestamp.
 * @remarks Every timestamp is parsed before selection; equal times break by ID.
 * The comparator receives only the two fields it reads, not whole assignments.
 */
function selectNewestAssignment(assignments: AssignmentPartial[]): {
  assignment: AssignmentPartial;
  updatedAt: string;
} {
  const [firstAssignment, ...remainingAssignments] = assignments;
  let newest = {
    assignment: firstAssignment,
    updatedAt: CanonicalMetadataTimestampSchema.parse(firstAssignment.updatedAt),
  };
  for (const assignment of remainingAssignments) {
    const updatedAt = CanonicalMetadataTimestampSchema.parse(assignment.updatedAt);
    if (
      compareAssignmentNewestFirst(
        { updatedAt, assignmentId: assignment.assignmentId },
        { updatedAt: newest.updatedAt, assignmentId: newest.assignment.assignmentId }
      ) < 0
    ) {
      newest = { assignment, updatedAt };
    }
  }
  return newest;
}

/**
 * Checks stored version bounds without comparing scores or summary timestamps.
 * @param {string} updatedAt - Canonical candidate timestamp.
 * @param {RecentAssignment[] | undefined} recent - Existing recent history.
 * @returns {boolean} Whether the source would regress a stored snapshot.
 */
function isStaleSource(updatedAt: string, recent: RecentAssignment[] | undefined): boolean {
  return Boolean(recent?.some((entry) => updatedAt < entry.updatedAt));
}

/**
 * Projects an existing weighted aggregate without recalculation or rounding.
 * @param {PerClassResult} result - Validated full-class or isolated-instance result.
 * @returns {AverageScores} Compact wire scores preserving all four states.
 */
export function projectAverageScores(result: PerClassResult): AverageScores {
  return {
    completeness: projectMetric(result.completeness),
    accuracy: projectMetric(result.accuracy),
    spag: projectMetric(result.spag),
    overall: projectMetric(result.overall),
  };
}

/**
 * Maps each aggregate state explicitly rather than treating markers as zero.
 * @param {MetricResult} metric - Validated metric.
 * @returns {AverageScore} Numeric score or exact persistence marker.
 */
function projectMetric(metric: MetricResult): AverageScore {
  switch (metric.state) {
    case 'computed': {
      return metric.value;
    }
    case 'notAttempted': {
      return 'N';
    }
    case 'error': {
      return 'E';
    }
    case 'excluded': {
      return 'excluded';
    }
  }
}

/**
 * Projects one analyser-native standings basis into persisted score sets.
 * @param {MetricStandings} standings - The basis's ranked top and bottom lists.
 * @param {number} scoreCount - Common count shared by the persisted history and score arrays.
 * @returns {StudentStandings} Persisted standings with aligned score arrays.
 * @remarks Each entry's per-assignment scores are trimmed to `scoreCount`, the
 * newest-first prefix shared with the emitted `recentAssignments`. That count is
 * the smaller of the stored history length and the summary's own score count, so
 * the two emitted lengths always match. When stored history is longer than the
 * summary's scores it is narrowed: a stored assignment with no fresh score is
 * dropped rather than given a fabricated score set.
 */
function projectStandings(standings: MetricStandings, scoreCount: number): StudentStandings {
  const projectList = (entries: readonly MetricStanding[]): StudentStanding[] => {
    return entries.map((entry) => {
      return {
        studentId: entry.studentId,
        studentName: entry.studentName,
        scores: projectAverageScores(entry.scores),
        recentAssignmentScores: entry.recentAssignmentScores
          .slice(0, scoreCount)
          .map((scores) => projectAverageScores(scores)),
      };
    });
  };
  return { top: projectList(standings.top), bottom: projectList(standings.bottom) };
}

/**
 * Builds a detached, validated replacement with stable rolling instance history.
 * @param {ABClassMetadata} previous - Existing validated metadata or null.
 * @param {ClassSummary} summary - Single validated summary acting as the score source.
 * @param {string} summaryUpdatedAt - Supplied canonical write-preparation time.
 * @returns {NonNullable<ABClassMetadata>} Complete replacement snapshot.
 * @remarks Source updatedAt is copied exactly, not inferred as assessment
 * completion. Equal-time history retains its supplied positions, not ID order.
 * Rolling history is taken from the previous snapshot plus the summary target;
 * it is never recomputed from live assignment definitions. The emitted history
 * and every standing's `recentAssignmentScores` are trimmed to one common count:
 * the smaller of the stored history length and the summary's score count, capped
 * at `MAX_LIST_ENTRIES`. When a stored assignment has no fresh score, the history
 * is narrowed to drop it rather than fabricate a score set; this differs from the
 * usual rule that rolling history is unchanged.
 */
export function mergeClassMetadata(
  previous: ABClassMetadata,
  summary: ClassSummary,
  summaryUpdatedAt: string
): NonNullable<ABClassMetadata> {
  const replacement = {
    assignmentId: summary.target.assignmentId,
    assignmentDefinitionKey: summary.target.assignmentDefinitionKey,
    averages: projectAverageScores(summary.target.averages),
    updatedAt: CanonicalMetadataTimestampSchema.parse(summary.target.updatedAt),
  };
  const recent = previous === null ? [] : [...previous.recentAssignments];
  const position = recent.findIndex((entry) => entry.assignmentId === replacement.assignmentId);
  if (position === NOT_FOUND_INDEX) recent.push(replacement);
  else recent[position] = replacement;
  recent.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const scoreCount = Math.min(recent.length, summary.recentAssignments.length, MAX_LIST_ENTRIES);
  const persistedRecent = recent.slice(0, scoreCount);
  const baselineAverages =
    summary.baseline.available && summary.baseline.classAverages !== null
      ? {
          ...projectAverageScores(summary.baseline.classAverages),
          updatedAt: summaryUpdatedAt,
        }
      : null;
  const baselineStandings =
    summary.baseline.available && summary.baseline.standings !== null
      ? projectStandings(summary.baseline.standings, scoreCount)
      : null;

  return NonNullableABClassMetadataSchema.parse({
    classAverages: {
      ...projectAverageScores(summary.allTasks.classAverages),
      updatedAt: summaryUpdatedAt,
    },
    recentAssignments: persistedRecent,
    baselineAverages,
    allTaskStandings: projectStandings(summary.allTasks.standings, scoreCount),
    baselineStandings,
  });
}
