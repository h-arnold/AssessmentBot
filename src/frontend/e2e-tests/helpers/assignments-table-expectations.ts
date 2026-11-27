/**
 * Shared expectation data for the Class page's Assignments table preview.
 *
 * @remarks
 * Both the interaction and screenshot specs derive their initial three-row
 * preview from the canonical `medium` class snapshot, so the newest-first
 * ordering contract has a single home. The derivation sorts by `updatedAt`
 * descending with an ascending `assignmentId` tie-break, matching the
 * adapter's order, then maps each assignment to its rendered name-button
 * label. The guard fails loudly when the corpus cannot exercise the preview.
 *
 * @see docs/developer/frontend/frontend-playwright-e2e.md
 */

import { assignmentCardTitle, CANONICAL_CLASS } from './assessment-error-preview-fixtures';

/** Rows rendered before the title-bar disclosure is activated. */
export const INITIAL_VISIBLE_ROWS = 3;

/** Newest-first name-button labels derived from the canonical class snapshot. */
export const EXPECTED_ASSIGNMENT_TITLES: ReadonlyArray<string> = CANONICAL_CLASS.assignments
  .toSorted((left, right) => {
    return (
      String(right.updatedAt).localeCompare(String(left.updatedAt)) ||
      left.assignmentId.localeCompare(right.assignmentId)
    );
  })
  .map((assignment) => assignmentCardTitle(assignment.assignmentId));

if (EXPECTED_ASSIGNMENT_TITLES.length <= INITIAL_VISIBLE_ROWS) {
  throw new Error('Canonical class must supply more than three assignments for the preview.');
}
