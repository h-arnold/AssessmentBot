/**
 * Bulk active-state flow — unit tests.
 *
 * Covers canonical row-contract eligibility for active/inactive transitions and
 * the ineligible row states that must stay excluded.
 */

import { describe, expect, it } from 'vitest';

import { filterEligibleForActiveState } from './bulkActiveStateFlow';
import type { ClassesManagementRow } from './classesManagementViewModel';

/**
 * Builds a canonical classes-management row for active-state flow tests.
 *
 * @param {Partial<ClassesManagementRow>} overrides Field overrides for the returned row.
 * @returns {ClassesManagementRow} The composed test row.
 */
function makeRow(overrides: Partial<ClassesManagementRow> = {}): ClassesManagementRow {
  return {
    classId: 'class-001',
    className: 'Year 10 Maths',
    status: 'active',
    cohortKey: 'cohort-2024',
    cohortLabel: 'Cohort 2024',
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    courseLength: 1,
    active: true,
    ...overrides,
  };
}
describe('filterEligibleForActiveState', () => {
  it('keeps active and inactive rows eligible while excluding orphaned and notCreated rows', () => {
    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'active-1', status: 'active', active: true }),
      makeRow({ classId: 'inactive-1', status: 'inactive', active: false }),
      makeRow({ classId: 'orphaned-1', status: 'orphaned', active: false }),
      makeRow({ classId: 'missing-1', status: 'notCreated', active: null, cohortKey: null, cohortLabel: null, yearGroupKey: null, yearGroupLabel: null, courseLength: null }),
    ];

    const eligibleForActivate = filterEligibleForActiveState(rows, true);
    const eligibleForDeactivate = filterEligibleForActiveState(rows, false);

    expect(eligibleForActivate.map((row) => row.classId)).toEqual(['inactive-1']);
    expect(eligibleForDeactivate.map((row) => row.classId)).toEqual(['active-1']);
  });
});
