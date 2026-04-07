import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cohort } from '../../services/referenceData.zod';
import type { ClassesManagementRow } from './classesManagementViewModel';
import type * as BulkSetCohortFlowModule from './bulkSetCohortFlow';

const callApiMock = vi.hoisted(() => vi.fn());
const TWO_CALLS = 2;

vi.mock('../../services/apiService', () => ({
  callApi: callApiMock,
}));

/**
 * Loads the bulk cohort flow lazily so the test can import the current implementation shape.
 *
 * @returns {Promise<typeof BulkSetCohortFlowModule>} The cohort flow module.
 */
function loadBulkSetCohortFlow(): Promise<typeof BulkSetCohortFlowModule> {
  return import('./bulkSetCohortFlow');
}

/**
 * Builds a canonical classes-management row for cohort flow tests.
 *
 * @param {Partial<ClassesManagementRow>} overrides Field overrides for the returned row.
 * @returns {ClassesManagementRow} The composed test row.
 */
function makeRow(overrides: Partial<ClassesManagementRow> = {}): ClassesManagementRow {
  return {
    classId: 'class-001',
    className: 'Year 10 Maths',
    status: 'active',
    cohortKey: 'cohort-current',
    cohortLabel: 'Cohort Current',
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    courseLength: 2,
    active: true,
    ...overrides,
  };
}

describe('bulkSetCohortFlow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps active and inactive rows eligible while excluding orphaned and notCreated rows', async () => {
    const { filterEligibleForBulkSetCohort } = await loadBulkSetCohortFlow();
    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'active-1', status: 'active', active: true }),
      makeRow({ classId: 'inactive-1', status: 'inactive', active: false }),
      makeRow({ classId: 'orphaned-1', status: 'orphaned', active: false }),
      makeRow({ classId: 'missing-1', status: 'notCreated', active: null, cohortKey: null, cohortLabel: null, yearGroupKey: null, yearGroupLabel: null, courseLength: null }),
    ];

    const eligibleRows = filterEligibleForBulkSetCohort(rows);

    expect(eligibleRows.map((row) => row.classId)).toEqual(['active-1', 'inactive-1']);
  });

  it('builds cohort selector options from active cohorts only', async () => {
    const { getActiveCohortOptions } = await loadBulkSetCohortFlow();
    const cohorts: Cohort[] = [
      {
        key: 'cohort-2025',
        name: 'Cohort 2025',
        active: true,
        startYear: 2025,
        startMonth: 9,
      },
      {
        key: 'cohort-2024',
        name: 'Cohort 2024',
        active: false,
        startYear: 2024,
        startMonth: 9,
      },
    ];

    expect(getActiveCohortOptions(cohorts)).toEqual([
      { label: 'Cohort 2025', value: 'cohort-2025' },
    ]);
  });

  it('updates each selected class with the chosen cohort key through updateABClass', async () => {
    const { bulkSetCohort } = await loadBulkSetCohortFlow();
    callApiMock.mockResolvedValue({ ok: true });
    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'class-001', status: 'active' }),
      makeRow({ classId: 'class-002', status: 'inactive', active: false }),
    ];

    const results = await bulkSetCohort(rows, 'cohort-2025');

    expect(callApiMock).toHaveBeenCalledTimes(TWO_CALLS);
    expect(callApiMock).toHaveBeenNthCalledWith(1, 'updateABClass', {
      classId: 'class-001',
      cohortKey: 'cohort-2025',
    });
    expect(callApiMock).toHaveBeenNthCalledWith(TWO_CALLS, 'updateABClass', {
      classId: 'class-002',
      cohortKey: 'cohort-2025',
    });
    expect(results.map((result) => result.row.classId)).toEqual(['class-001', 'class-002']);
  });

  it('uses the same batch path for a single selected row edit', async () => {
    const { bulkSetCohort } = await loadBulkSetCohortFlow();
    callApiMock.mockResolvedValue({ ok: true });
    const row = makeRow({ classId: 'class-single', status: 'inactive', active: false });

    const results = await bulkSetCohort([row], 'cohort-2026');

    expect(callApiMock).toHaveBeenCalledTimes(1);
    expect(callApiMock).toHaveBeenCalledWith('updateABClass', {
      classId: 'class-single',
      cohortKey: 'cohort-2026',
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'fulfilled', row });
  });
});
