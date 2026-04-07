/**
 * Bulk active-state flow — unit tests.
 *
 * Covers: ineligible-row rejection before the flow opens (notCreated rows, rows
 * already at the target active state), and eligible-row filtering for both
 * activate and deactivate directions.
 */

import { describe, expect, it } from 'vitest';

import {
  filterEligibleForActiveState,
  type ClassTableRow,
} from './bulkActiveStateFlow';

const TWO_ROWS = 2;

/**
 * Builds a test ClassTableRow with sensible defaults and optional overrides.
 *
 * @param {Partial<ClassTableRow>} overrides Field overrides for the returned row.
 * @returns {ClassTableRow} The composed test row.
 */
function makeRow(overrides: Partial<ClassTableRow> = {}): ClassTableRow {
  return {
    rowKey: 'row-001',
    status: 'linked',
    classId: 'class-001',
    cohortKey: '2025',
    yearGroupKey: 'yg-10',
    courseLength: 1,
    active: false,
    className: 'Year 10 Maths',
    ...overrides,
  };
}

describe('filterEligibleForActiveState', () => {
  it('rejects rows with notCreated status — they cannot be made active or inactive', () => {
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r1', status: 'notCreated', active: null }),
      makeRow({ rowKey: 'r2', status: 'linked', active: false }),
    ];

    const eligible = filterEligibleForActiveState(rows, true);

    expect(eligible).toHaveLength(1);
    expect(eligible[0].rowKey).toBe('r2');
  });

  it('rejects rows that are already at the target active state', () => {
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r1', status: 'linked', active: true }),
      makeRow({ rowKey: 'r2', status: 'linked', active: true }),
      makeRow({ rowKey: 'r3', status: 'linked', active: true }),
    ];

    const eligible = filterEligibleForActiveState(rows, true);

    expect(eligible).toHaveLength(0);
  });

  it('returns only inactive rows when the target state is active', () => {
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r1', status: 'linked', active: false }),
      makeRow({ rowKey: 'r2', status: 'linked', active: true }),
      makeRow({ rowKey: 'r3', status: 'partial', active: false }),
    ];

    const eligible = filterEligibleForActiveState(rows, true);

    expect(eligible).toHaveLength(TWO_ROWS);
    expect(eligible.map((r) => r.rowKey)).toEqual(['r1', 'r3']);
  });

  it('returns only active rows when the target state is inactive', () => {
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r1', status: 'linked', active: true }),
      makeRow({ rowKey: 'r2', status: 'linked', active: false }),
      makeRow({ rowKey: 'r3', status: 'partial', active: true }),
    ];

    const eligible = filterEligibleForActiveState(rows, false);

    expect(eligible).toHaveLength(TWO_ROWS);
    expect(eligible.map((r) => r.rowKey)).toEqual(['r1', 'r3']);
  });

  it('rejects rows with null active state when targeting either direction', () => {
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r1', status: 'partial', active: null }),
      makeRow({ rowKey: 'r2', status: 'linked', active: false }),
    ];

    const eligibleForActivate = filterEligibleForActiveState(rows, true);
    const eligibleForDeactivate = filterEligibleForActiveState(rows, false);

    // null-active row is ineligible for either transition
    expect(eligibleForActivate.map((r) => r.rowKey)).toEqual(['r2']);
    expect(eligibleForDeactivate).toHaveLength(0);
  });

  it('returns an empty array when given an empty row list', () => {
    expect(filterEligibleForActiveState([], true)).toEqual([]);
    expect(filterEligibleForActiveState([], false)).toEqual([]);
  });

  it('rejects notCreated rows even when they have a non-null active value', () => {
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r1', status: 'notCreated', active: false }),
    ];

    expect(filterEligibleForActiveState(rows, true)).toEqual([]);
  });
});
