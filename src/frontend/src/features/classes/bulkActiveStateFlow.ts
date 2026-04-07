/**
 * Bulk active-state flow.
 *
 * Exports the shared ClassTableRow type (re-exported from bulkCreateFlow so
 * callers have a single import point) and the eligibility-filter helper that
 * gates the set-active and set-inactive bulk actions.
 */

export type { ClassStatus, ClassTableRow } from './bulkCreateFlow';

import type { ClassTableRow } from './bulkCreateFlow';

/**
 * Returns only rows that are eligible for a transition to `targetState`.
 *
 * A row is ineligible when:
 * - its `status` is `notCreated` (class does not yet exist in AssessmentBot), or
 * - its `active` field is `null` (active state is unknown), or
 * - its current `active` value already equals `targetState` (no change needed).
 *
 * @param {ClassTableRow[]} rows Candidate rows.
 * @param {boolean} targetState `true` to activate; `false` to deactivate.
 * @returns {ClassTableRow[]} Rows eligible for the requested transition.
 */
export function filterEligibleForActiveState(
  rows: ClassTableRow[],
  targetState: boolean,
): ClassTableRow[] {
  return rows.filter(
    (row) =>
      row.status !== 'notCreated' &&
      row.active !== null &&
      row.active !== targetState,
  );
}
