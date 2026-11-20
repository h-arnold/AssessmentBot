import {
  CanonicalMetadataTimestampSchema,
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

/** Maximum number of persisted recent-assignment history entries. */
export const RECENT_ASSIGNMENT_LIMIT = 3;
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

  const candidates = classFull.assignments.map((assignment) => {
    return {
      assignment,
      updatedAt: CanonicalMetadataTimestampSchema.parse(assignment.updatedAt),
    };
  });
  candidates.sort((a, b) => {
    return compareAssignmentNewestFirst(
      { ...a.assignment, updatedAt: a.updatedAt },
      { ...b.assignment, updatedAt: b.updatedAt }
    );
  });
  const { assignment: target, updatedAt } = candidates[0];
  const recent = classFull.metadata?.recentAssignments;
  const matching = recent?.find((entry) => entry.assignmentId === target.assignmentId);
  if (matching?.updatedAt === updatedAt) return { status: 'skipped', reason: 'unchanged' };
  if (isStaleSource(updatedAt, matching, recent)) {
    return { status: 'skipped', reason: 'staleSource' };
  }
  return { status: 'changed', target };
}

/**
 * Checks stored version bounds without comparing scores or summary timestamps.
 * @param {string} updatedAt - Canonical candidate timestamp.
 * @param {RecentAssignment | undefined} matching - Stored entry for the same ID.
 * @param {RecentAssignment[] | undefined} recent - Existing recent history.
 * @returns {boolean} Whether the source would regress a stored snapshot.
 */
function isStaleSource(
  updatedAt: string,
  matching: RecentAssignment | undefined,
  recent: RecentAssignment[] | undefined
): boolean {
  return Boolean(
    (matching && updatedAt < matching.updatedAt) ||
    recent?.some((entry) => updatedAt < entry.updatedAt)
  );
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
 * @param {number} scoreCount - Persisted history length to align each entry with.
 * @returns {StudentStandings} Persisted standings with aligned score arrays.
 * @remarks Each entry's per-assignment scores are trimmed to the persisted
 * `recentAssignments` length, keeping the newest-first prefix. Rolling history is
 * owned by the projection and is never rebuilt from live assignment definitions,
 * so a fresh single-entry write cannot emit a three-score array rejected by the
 * persisted schema.
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
 * it is never recomputed from live assignment definitions. Every standing's
 * `recentAssignmentScores` is trimmed to the persisted history length (newest
 * first) so summary score alignment and the persisted history stay in step.
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
  const persistedRecent = recent.slice(0, RECENT_ASSIGNMENT_LIMIT);
  const scoreCount = persistedRecent.length;
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
