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
import { compareStudentNames } from '../../services/dataAnalysis/compareStudentNames';
import { compareMetricsByStateRank } from '../../services/dataAnalysis/metricDisplay/metricComparator';
import { compareStudentNamePart } from '../../utils/splitStudentName';
import type { ClassPageAdapterResult, StudentAverageRowModel } from './classPageAdapter.zod';
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
 * @remarks
 * Delegates the ordering composition (state rank → numeric value → ascending
 * `studentId` tie-break) to the shared services-layer comparator
 * (`compareMetricsByStateRank`); this wrapper only resolves which metric each
 * row is compared by.
 *
 * @param {MetricColumnKey} column - The metric column to compare by.
 * @param {'asc' | 'desc'} direction - Sort direction (`'asc'` or `'desc'`).
 * @returns {(a: StudentAverageRowModel, b: StudentAverageRowModel) => number} A comparator suitable for `Array.prototype.toSorted()`.
 */
function buildMetricComparator(
  column: MetricColumnKey,
  direction: 'asc' | 'desc'
): (a: StudentAverageRowModel, b: StudentAverageRowModel) => number {
  return (a, b) =>
    compareMetricsByStateRank(
      getStudentMetric(a.metrics, column),
      getStudentMetric(b.metrics, column),
      a.studentId,
      b.studentId,
      direction
    );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
 * Build the final view model from the adapter result plus user-controlled
 * search and sort state.
 *
 * @param {object} input - The view-model input bundle.
 * @param {ClassPageAdapterResult} input.adapterResult - The adapter's canonical output.
 * @param {{ searchTerm: string }} input.filters - User-controlled filters.
 * @param {string} input.filters.searchTerm - Substring filter on student name (case-insensitive).
 *   Empty string means no filter.
 * @param {({ column: 'forename' | 'surname' | MetricColumnKey; direction: 'asc' | 'desc' }) | null} [input.sort] - User-controlled sort column and direction.
 *   When `null` or `undefined`, defaults to full-name ascending order via the
 *   unchanged `compareStudentNames` comparator. An explicit `forename` or
 *   `surname` sort orders by that derived value (via the shared
 *   `compareStudentNamePart` comparator) with a `studentId` tie-break.
 * @returns {ClassPageViewModel} The filtered and sorted view model.
 */
export function buildClassPageViewModel(input: {
  adapterResult: ClassPageAdapterResult;
  filters: { searchTerm: string };
  sort?: {
    column: 'forename' | 'surname' | MetricColumnKey;
    direction: 'asc' | 'desc';
  } | null;
}): ClassPageViewModel {
  const { adapterResult, filters, sort } = input;

  // Apply search filter (case-insensitive substring on studentName)
  let studentAverages = adapterResult.studentAverages;
  const searchTerm = filters.searchTerm;
  if (searchTerm.length > 0) {
    const lowerSearch = searchTerm.toLowerCase();
    studentAverages = studentAverages.filter((row) =>
      row.studentName.toLowerCase().includes(lowerSearch)
    );
  }

  // Apply sort — a missing or cleared sort resolves to full-name ascending
  // via the unchanged `compareStudentNames` ordering, so the default initial
  // order is unchanged by the column split.
  if (sort === null || sort === undefined) {
    studentAverages = studentAverages.toSorted((a, b) => compareStudentNames(a, b));
  } else {
    const { column, direction } = sort;
    if (column === 'forename' || column === 'surname') {
      studentAverages = studentAverages.toSorted((a, b) => {
        const cmp = compareStudentNamePart(column, a, b);
        return direction === 'asc' ? cmp : -cmp;
      });
    } else {
      const comparator = buildMetricComparator(column, direction);
      studentAverages = studentAverages.toSorted(comparator);
    }
  }

  return {
    recentAssignments: adapterResult.recentAssignments,
    studentAverages,
    classMetrics: adapterResult.classMetrics,
  };
}
