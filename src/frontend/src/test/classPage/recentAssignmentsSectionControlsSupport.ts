/**
 * Shared fixtures, probes and expectation helpers for the Assignments table's
 * sort controls. Kept apart from the main Class page test helper so both files
 * stay within the frontend line limit.
 *
 * Realistic history comes from the committed synthetic corpus; the boundary
 * date fixture clones canonical rows and changes only the fields under test.
 */

import type { RecentAssignmentCardModel } from '@/features/classPage/classPageAdapter.zod';
import {
  canonicalAssignments,
  EXPECTED_HEADINGS,
  INITIAL_VISIBLE_ASSIGNMENTS,
  requireFourCanonicalRows,
} from './recentAssignmentsSectionTestHelpers';

/** Boundary UTC timestamps in deliberately non-chronological adapter order. */
const BOUNDARY_DATE_TIMESTAMPS = [
  '2026-01-02T00:00:00.000Z',
  '2025-11-15T00:00:00.000Z',
  '2026-02-01T00:00:00.000Z',
  '2025-12-31T00:00:00.000Z',
] as const;

/**
 * Build rows whose date labels sort differently from their raw timestamps.
 *
 * Algorithmic boundary: the selected class shares one calendar date, so only a
 * controlled fixture spans month and year boundaries. Clone canonical rows and
 * overwrite just the timestamp and its formatted label.
 *
 * @returns {RecentAssignmentCardModel[]} Four canonical rows with boundary dates.
 */
export function buildBoundaryDateHistory(): RecentAssignmentCardModel[] {
  const canonicalRows = requireFourCanonicalRows();
  const rows = BOUNDARY_DATE_TIMESTAMPS.map((lastAssessedAt, index) => {
    const row = canonicalRows[index];
    if (!row) {
      throw new Error('Boundary date fixture needs a canonical row for every timestamp.');
    }
    return {
      ...row,
      lastAssessedAt,
      lastAssessedAtLabel: new Date(lastAssessedAt).toLocaleDateString('en-GB', {
        timeZone: 'UTC',
      }),
    };
  });
  const byTimestamp = expectedTextSortNames(rows, (row) => row.lastAssessedAt, 'asc');
  const byLabel = expectedTextSortNames(rows, (row) => row.lastAssessedAtLabel, 'asc');
  if (byTimestamp.every((name, index) => name === byLabel[index])) {
    throw new Error('Boundary date fixture needs label order to differ from timestamp order.');
  }
  return rows;
}

/**
 * Derive the preview rows for a text-column sort, breaking ties by id.
 *
 * @param {RecentAssignmentCardModel[]} rows - The rendered history.
 * @param {(row: RecentAssignmentCardModel) => string} valueOf - The sorted column's value.
 * @param {'asc' | 'desc'} direction - The requested sort direction.
 * @returns {RecentAssignmentCardModel[]} The rows in expected preview order.
 */
export function expectedTextSortRows(
  rows: RecentAssignmentCardModel[],
  valueOf: (row: RecentAssignmentCardModel) => string,
  direction: 'asc' | 'desc'
): RecentAssignmentCardModel[] {
  return [...rows]
    .toSorted((left, right) => {
      const primary = valueOf(left).localeCompare(valueOf(right));
      return (
        (direction === 'asc' ? primary : -primary) ||
        left.assignmentId.localeCompare(right.assignmentId)
      );
    })
    .slice(0, INITIAL_VISIBLE_ASSIGNMENTS);
}

/**
 * Derive the preview names in the history's supplied adapter order.
 *
 * @param {RecentAssignmentCardModel[]} rows - The rendered history.
 * @returns {string[]} The names in adapter order.
 */
export function expectedAdapterOrderNames(rows: RecentAssignmentCardModel[]): string[] {
  return rows.slice(0, INITIAL_VISIBLE_ASSIGNMENTS).map((row) => row.assignmentName);
}

/**
 * Derive the preview names for a text-column sort, breaking ties by id.
 *
 * @param {RecentAssignmentCardModel[]} rows - The rendered history.
 * @param {(row: RecentAssignmentCardModel) => string} valueOf - The sorted column's value.
 * @param {'asc' | 'desc'} direction - The requested sort direction.
 * @returns {string[]} The names in expected preview order.
 */
export function expectedTextSortNames(
  rows: RecentAssignmentCardModel[],
  valueOf: (row: RecentAssignmentCardModel) => string,
  direction: 'asc' | 'desc'
): string[] {
  return expectedTextSortRows(rows, valueOf, direction).map((row) => row.assignmentName);
}

/**
 * Read assignment IDs from rendered row keys in row order.
 *
 * @param {HTMLTableElement} table - The Assignments table.
 * @returns {string[]} The rendered assignment IDs.
 */
export function getRenderedAssignmentIds(table: HTMLTableElement): string[] {
  return [...table.querySelectorAll<HTMLElement>(':scope tbody tr.ant-table-row')].map((row) => {
    const assignmentId = row.dataset.rowKey;
    if (!assignmentId) {
      throw new TypeError('Expected a rendered assignment row key.');
    }
    return assignmentId;
  });
}

/** One text column's sort case: the heading, the rendered history and its value. */
type TextSortCase = Readonly<{
  heading: string;
  rows: RecentAssignmentCardModel[];
  valueOf: (row: RecentAssignmentCardModel) => string;
}>;

/** Sort cases pairing each text heading with the history it renders. */
export const TEXT_SORT_CASES: readonly TextSortCase[] = [
  {
    heading: EXPECTED_HEADINGS[0],
    rows: canonicalAssignments,
    valueOf: (row) => row.assignmentName,
  },
  {
    heading: EXPECTED_HEADINGS[5],
    rows: buildBoundaryDateHistory(),
    valueOf: (row) => row.lastAssessedAt,
  },
];
