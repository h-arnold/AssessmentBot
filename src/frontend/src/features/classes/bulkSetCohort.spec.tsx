import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cohort } from '../../services/referenceData.zod';
import type { ClassTableRow } from './bulkCreateFlow';

const callApiMock = vi.hoisted(() => vi.fn());
const TWO_CALLS = 2;

vi.mock('../../services/apiService', () => ({
  callApi: callApiMock,
}));

type BulkSetCohortFlowModule = Readonly<{
  filterEligibleForBulkSetCohort: (rows: ClassTableRow[]) => ClassTableRow[];
  getActiveCohortOptions: (cohorts: Cohort[]) => Array<{ label: string; value: string }>;
  bulkSetCohort: (
    rows: ClassTableRow[],
    cohortKey: string,
  ) => Promise<Array<{ status: string; row: ClassTableRow }>>;
}>;

/**
 * Loads the future bulk cohort flow module lazily so this RED spec can compile
 * before the implementation exists.
 *
 * @returns {Promise<BulkSetCohortFlowModule>} The bulk cohort flow module.
 */
function loadBulkSetCohortFlow(): Promise<BulkSetCohortFlowModule> {
  return import('./bulkSetCohortFlow') as Promise<BulkSetCohortFlowModule>;
}

/**
 * Builds a representative existing class row for flow tests.
 *
 * @param {Partial<ClassTableRow>} overrides Optional field overrides.
 * @returns {ClassTableRow} The composed class row.
 */
function makeRow(overrides: Partial<ClassTableRow> = {}): ClassTableRow {
  return {
    rowKey: 'row-001',
    status: 'linked',
    classId: 'class-001',
    cohortKey: 'cohort-current',
    yearGroupKey: 'year-10',
    courseLength: 2,
    active: true,
    className: 'Year 10 Maths',
    ...overrides,
  };
}

describe('bulkSetCohortFlow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns only active and inactive existing rows for bulk cohort editing', async () => {
    const { filterEligibleForBulkSetCohort } = await loadBulkSetCohortFlow();
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'linked-active', classId: 'class-active', active: true }),
      makeRow({ rowKey: 'linked-inactive', classId: 'class-inactive', active: false }),
      makeRow({ rowKey: 'not-created', classId: 'class-missing', status: 'notCreated', active: null }),
      makeRow({ rowKey: 'orphaned', classId: 'class-orphaned', status: 'partial', active: false }),
    ];

    expect(filterEligibleForBulkSetCohort(rows).map((row) => row.classId)).toEqual([
      'class-active',
      'class-inactive',
    ]);
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
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r1', classId: 'class-001' }),
      makeRow({ rowKey: 'r2', classId: 'class-002', active: false }),
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
    const row = makeRow({ classId: 'class-single' });

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
