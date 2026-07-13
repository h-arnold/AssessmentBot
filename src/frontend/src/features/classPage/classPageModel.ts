/**
 * Pure view-model builder for the Class page Student Averages table.
 *
 * Applies user-controlled search filtering and sorting to the adapter's
 * canonical output. The model is a synchronous, side-effect-free function
 * that trusts its input (no validation).
 *
 * @see SPEC_CLASS_PAGE.md § "classPageModel — view-model builder"
 */

import { ListTodo, Merge, SpellCheck, Target } from 'lucide-react';
import type { LucideIconComponent } from '../../components/icons/LucideIcon';
import { getStudentMetric } from './classPageAdapter.zod';
import type { ClassPageAdapterResult, StudentAverageRowModel } from './classPageAdapter.zod';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { HeatmapRow } from '../../services/dataAnalysis/heatmapAdapter';

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

// ---------------------------------------------------------------------------
// Metric display metadata
// ---------------------------------------------------------------------------

/** The metric keys that appear as sub-columns under each heatmap task group. */
export type HeatmapMetricKey = 'completeness' | 'accuracy' | 'spag';

/** All metric column keys (heatmap sub-columns plus the average rollup). */
export type MetricColumnKey = 'completeness' | 'accuracy' | 'spag' | 'average';

/** Shared metric display metadata: label and icon for each metric key. */
export const METRIC_DISPLAY_META: ReadonlyMap<
  MetricColumnKey,
  { readonly label: string; readonly icon: LucideIconComponent }
> = new Map([
  ['completeness', { label: 'Completeness', icon: ListTodo }],
  ['accuracy', { label: 'Accuracy', icon: Target }],
  ['spag', { label: 'SPaG', icon: SpellCheck }],
  ['average', { label: 'Average', icon: Merge }],
]);

/** The three metric keys appearing as sub-columns under each heatmap task group. */
export const HEATMAP_METRIC_KEYS: readonly HeatmapMetricKey[] = [
  'completeness',
  'accuracy',
  'spag',
];

const HIGHEST_METRIC_STATE_RANK = 2;

/** Rank lookup for ascending metric column sort: computed → notAttempted → error. */
export const METRIC_STATE_RANK_ASC: ReadonlyMap<MetricResult['state'], number> = new Map([
  ['computed', 0],
  ['notAttempted', 1],
  ['error', HIGHEST_METRIC_STATE_RANK],
]);

/** Rank lookup for descending metric column sort: error → notAttempted → computed. */
const METRIC_STATE_RANK_DESC: ReadonlyMap<MetricResult['state'], number> = new Map([
  ['error', 0],
  ['notAttempted', 1],
  ['computed', HIGHEST_METRIC_STATE_RANK],
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return a numeric rank for a `MetricResult` state, used for state-aware
 * metric column sorting.
 *
 * The rank order flips with direction:
 * - `asc`:  computed (0) → notAttempted (1) → error (2)
 * - `desc`: error (0) → notAttempted (1) → computed (2)
 *
 * @param {MetricResult} metric - The metric result to rank.
 * @param {'asc' | 'desc'} direction - Sort direction.
 * @returns {number} A numeric rank (lower = earlier in sort order).
 */
function getMetricStateRank(metric: MetricResult, direction: 'asc' | 'desc'): number {
  const rankMap = direction === 'asc' ? METRIC_STATE_RANK_ASC : METRIC_STATE_RANK_DESC;
  return rankMap.get(metric.state) ?? 0;
}

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
