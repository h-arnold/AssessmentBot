/**
 * Pure view-model builder for the Class page Student Averages table.
 *
 * Applies user-controlled search filtering and sorting to the adapter's
 * canonical output. The model is a synchronous, side-effect-free function
 * that trusts its input (no validation).
 *
 * @see SPEC_CLASS_PAGE.md § "classPageModel — view-model builder"
 */

import type { ClassPageAdapterResult, StudentAverageRowModel } from './classPageAdapter.zod';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';

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
// Internal constants
// ---------------------------------------------------------------------------

const HIGHEST_METRIC_STATE_RANK = 2;

/** Rank lookup for ascending metric column sort: computed → notAttempted → error. */
const METRIC_STATE_RANK_ASC: ReadonlyMap<MetricResult['state'], number> = new Map([
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
 * Extract the metric result for a given column from a student row.
 *
 * This accessor exists to avoid lint `security/detect-object-injection`
 * warnings from computed property access on the metrics object.
 *
 * @param {StudentAverageRowModel} row - The student row model.
 * @param {'completeness' | 'accuracy' | 'spag' | 'average'} column - The metric column key.
 * @returns {MetricResult} The metric result for the given column.
 */
function getMetricForColumn(
  row: StudentAverageRowModel,
  column: 'completeness' | 'accuracy' | 'spag' | 'average'
): MetricResult {
  switch (column) {
    case 'completeness': {
      return row.metrics.completeness;
    }
    case 'accuracy': {
      return row.metrics.accuracy;
    }
    case 'spag': {
      return row.metrics.spag;
    }
    case 'average': {
      return row.metrics.average;
    }
  }
}

/**
 * Build a comparator function for a metric column with state-aware ordering.
 *
 * @param {'completeness' | 'accuracy' | 'spag' | 'average'} column - The metric column to compare by.
 * @param {'asc' | 'desc'} direction - Sort direction (`'asc'` or `'desc'`).
 * @returns {(a: StudentAverageRowModel, b: StudentAverageRowModel) => number} A comparator suitable for `Array.prototype.toSorted()`.
 */
function buildMetricComparator(
  column: 'completeness' | 'accuracy' | 'spag' | 'average',
  direction: 'asc' | 'desc'
): (a: StudentAverageRowModel, b: StudentAverageRowModel) => number {
  return (a, b) => {
    const aMetric = getMetricForColumn(a, column);
    const bMetric = getMetricForColumn(b, column);

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
const DEFAULT_SORT: {
  column: 'studentName';
  direction: 'asc';
} = { column: 'studentName', direction: 'asc' };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the final view model from the adapter result plus user-controlled
 * search and sort state.
 *
 * @param {object} input - The view-model input bundle.
 * @param {ClassPageAdapterResult} input.adapterResult - The adapter's canonical output.
 * @param {{ searchTerm: string }} input.filters - User-controlled filters.
 * @param {string} input.filters.searchTerm - Substring filter on student name (case-insensitive).
 *   Empty string means no filter.
 * @param {({ column: 'studentName' | 'completeness' | 'accuracy' | 'spag' | 'average'; direction: 'asc' | 'desc' }) | null} [input.sort] - User-controlled sort column and direction.
 *   When `null` or `undefined`, defaults to `studentName` ascending.
 * @returns {ClassPageViewModel} The filtered and sorted view model.
 */
export function buildClassPageViewModel(input: {
  adapterResult: ClassPageAdapterResult;
  filters: { searchTerm: string };
  sort?: {
    column: 'studentName' | 'completeness' | 'accuracy' | 'spag' | 'average';
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
      // Name comparison respects direction; studentId tie-break is always ascending
      // per spec: "tie-broken by studentId ascending" regardless of direction.
      const nameCmp = a.studentName.localeCompare(b.studentName, undefined, {
        sensitivity: 'base',
      });
      if (nameCmp !== 0) return direction === 'asc' ? nameCmp : -nameCmp;
      return a.studentId.localeCompare(b.studentId);
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
