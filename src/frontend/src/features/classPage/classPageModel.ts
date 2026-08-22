/**
 * Pure view-model builder for the Class page Student Averages table.
 *
 * Applies user-controlled search filtering and sorting to the adapter's
 * canonical output. The model is a synchronous, side-effect-free function
 * that trusts its input (no validation).
 *
 * @see SPEC_CLASS_PAGE.md § "classPageModel — view-model builder"
 */

import { getStudentMetric } from './classPageAdapter.zod';
import { getMetricStateRank } from '../../services/dataAnalysis/metricDisplay/metricStateRank';
import type { ClassPageAdapterResult, StudentAverageRowModel } from './classPageAdapter.zod';
import type { HeatmapRow } from '../../services/dataAnalysis/heatmapAdapter';
import type { MetricColumnKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/**
 * The final view-model shape consumed by the Student Averages table.
 *
 * `recentAssignments` and `classMetrics` are passed through from the adapter
 * result verbatim. Only `studentAverages` is transformed (filtered and sorted).
 */
export type ClassPageViewModel = {
  recentAssignments: ClassPageAdapterResult['recentAssignments'];
  studentAverages: StudentAverageRowModel[];
  classMetrics: ClassPageAdapterResult['classMetrics'];
};

/**
 * Build a comparator function for a metric column with state-aware ordering.
 *
 * @param {MetricColumnKey} column - The metric column to compare by.
 * @param {'asc' | 'desc'} direction - Sort direction (`'asc'` or `'desc'`).
 * @returns {(a: StudentAverageRowModel, b: StudentAverageRowModel) => number} A comparator suitable for `Array.prototype.toSorted()`.
 */
function buildMetricComparator(
  column: MetricColumnKey,
  direction: 'asc' | 'desc'
): (a: StudentAverageRowModel, b: StudentAverageRowModel) => number {
  return (a, b) => {
    const aMetric = getStudentMetric(a.metrics, column);
    const bMetric = getStudentMetric(b.metrics, column);

    const aRank = getMetricStateRank(aMetric, direction);
    const bRank = getMetricStateRank(bMetric, direction);

    if (aRank !== bRank) return aRank - bRank;

    // Same state band — sort by numeric value when both are computed
    if (aMetric.state === 'computed' && bMetric.state === 'computed') {
      const diff = aMetric.value - bMetric.value;
      if (diff !== 0) return direction === 'asc' ? diff : -diff;
    }

    // Tie-break by studentId ascending
    return a.studentId.localeCompare(b.studentId);
  };
}

/**
 * Default sort configuration used when no explicit sort is provided.
 * Sorts by student name in ascending order.
 */
export const DEFAULT_SORT: {
  column: 'studentName';
  direction: 'asc';
} = { column: 'studentName', direction: 'asc' };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare two student rows by student name (locale-aware, case-insensitive)
 * with a deterministic `studentId` ascending tie-break.
 *
 * @remarks
 * This is the single source of truth for student-name ordering in the Class
 * page. Call sites that need direction apply `direction === 'asc' ? cmp : -cmp`.
 *
 * @param {StudentAverageRowModel} a - The first row to compare.
 * @param {StudentAverageRowModel} b - The second row to compare.
 * @returns {number} Negative if `a < b`, positive if `a > b`, zero if equal.
 */
export function compareStudentNames(a: StudentAverageRowModel, b: StudentAverageRowModel): number {
  const nameCmp = a.studentName.localeCompare(b.studentName, undefined, {
    sensitivity: 'base',
  });
  if (nameCmp !== 0) return nameCmp;
  return a.studentId.localeCompare(b.studentId);
}

/**
 * Compare two assignments by `updatedAt` descending, with `assignmentId` ascending
 * as a deterministic tie-break when `updatedAt` values are equal.
 *
 * @remarks
 * Shared by the ClassPage prefetch (top-3 recency selection) and the adapter's
 * `recentAssignments` pipeline so the prefetched set and the displayed cards always
 * use identical ordering. The minimal `{ updatedAt, assignmentId }` shape lets both
 * call sites map their own element shapes into the comparator without structural coupling.
 *
 * @param {{ updatedAt: string; assignmentId: string }} a - The first assignment.
 * @param {string} a.updatedAt - The ISO timestamp string for `a`.
 * @param {string} a.assignmentId - The identifier for `a`.
 * @param {{ updatedAt: string; assignmentId: string }} b - The second assignment.
 * @param {string} b.updatedAt - The ISO timestamp string for `b`.
 * @param {string} b.assignmentId - The identifier for `b`.
 * @returns {number} Negative if `a` is more recent, positive if `b` is, zero if equal.
 */
export function compareAssignmentUpdatedAtDesc(
  a: { updatedAt: string; assignmentId: string },
  b: { updatedAt: string; assignmentId: string }
): number {
  const updatedAtCmp = b.updatedAt.localeCompare(a.updatedAt);
  if (updatedAtCmp !== 0) return updatedAtCmp;
  return a.assignmentId.localeCompare(b.assignmentId);
}

/**
 * Compare two `HeatmapRow`s by student name (locale-aware, case-insensitive)
 * with a deterministic `studentId` ascending tie-break.
 *
 * @remarks
 * Thin `HeatmapRow`-compatible wrapper around the locale-aware logic of
 * `compareStudentNames`. The heatmap table must NOT import the
 * `StudentAverageRowModel`-typed `compareStudentNames` directly because the
 * row shapes differ (`HeatmapRow` carries `cells`, not `metrics`).
 *
 * @param {HeatmapRow} a - The first row.
 * @param {HeatmapRow} b - The second row.
 * @returns {number} Negative if `a < b`, positive if `a > b`, zero if equal.
 */
export function compareHeatmapStudentName(a: HeatmapRow, b: HeatmapRow): number {
  // Delegate to the canonical `StudentAverageRowModel` comparator via cast
  // because both types share the same `studentName` and `studentId` shape.
  return compareStudentNames(
    a as unknown as StudentAverageRowModel,
    b as unknown as StudentAverageRowModel
  );
}

/**
 * Build the final view model from the adapter result plus user-controlled
 * search and sort state.
 *
 * @param {object} input - The view-model input bundle.
 * @param {ClassPageAdapterResult} input.adapterResult - The adapter's canonical output.
 * @param {{ searchTerm: string }} input.filters - User-controlled filters.
 * @param {string} input.filters.searchTerm - Substring filter on student name (case-insensitive).
 *   Empty string means no filter.
 * @param {({ column: 'studentName' | MetricColumnKey; direction: 'asc' | 'desc' }) | null} [input.sort] - User-controlled sort column and direction.
 *   When `null` or `undefined`, defaults to `studentName` ascending.
 * @returns {ClassPageViewModel} The filtered and sorted view model.
 */
export function buildClassPageViewModel(input: {
  adapterResult: ClassPageAdapterResult;
  filters: { searchTerm: string };
  sort?: {
    column: 'studentName' | MetricColumnKey;
    direction: 'asc' | 'desc';
  } | null;
}): ClassPageViewModel {
  const { adapterResult, filters, sort } = input;

  // Resolve the effective sort — default to studentName ascending
  const effectiveSort = sort ?? DEFAULT_SORT;

  // Apply search filter (case-insensitive substring on studentName)
  let studentAverages = adapterResult.studentAverages;
  const searchTerm = filters.searchTerm;
  if (searchTerm.length > 0) {
    const lowerSearch = searchTerm.toLowerCase();
    studentAverages = studentAverages.filter((row) =>
      row.studentName.toLowerCase().includes(lowerSearch)
    );
  }

  // Apply sort
  const { column, direction } = effectiveSort;
  if (column === 'studentName') {
    studentAverages = studentAverages.toSorted((a, b) => {
      const cmp = compareStudentNames(a, b);
      return direction === 'asc' ? cmp : -cmp;
    });
  } else {
    const comparator = buildMetricComparator(column, direction);
    studentAverages = studentAverages.toSorted(comparator);
  }

  return {
    recentAssignments: adapterResult.recentAssignments,
    studentAverages,
    classMetrics: adapterResult.classMetrics,
  };
}
