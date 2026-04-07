/**
 * Bulk active-state flow.
 *
 * Provides eligibility filtering for the canonical ClassesManagementRow contract.
 */

import type { ClassesManagementRow } from './classesManagementViewModel';

/**
 * Returns only rows that are eligible for a transition to `targetState`.
 *
 * A row is ineligible when:
 * - its `status` is `notCreated` or `orphaned`, or
 * - its `active` field is `null`, or
 * - its current `active` value already equals `targetState`.
 *
 * @param {ClassesManagementRow[]} rows Candidate rows.
 * @param {boolean} targetState `true` to activate; `false` to deactivate.
 * @returns {ClassesManagementRow[]} Rows eligible for the requested transition.
 */
export function filterEligibleForActiveState(
  rows: ClassesManagementRow[],
  targetState: boolean,
): ClassesManagementRow[] {
  return rows.filter(
    (row) =>
      (row.status === 'active' || row.status === 'inactive') &&
      row.active !== null &&
      row.active !== targetState,
  );
}
