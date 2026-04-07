import { afterEach, describe, expect, it, vi } from 'vitest';
import type { YearGroup } from '../../services/referenceData.zod';
import type { ClassTableRow } from './bulkCreateFlow';

const callApiMock = vi.hoisted(() => vi.fn());
const TWO_CALLS = 2;

vi.mock('../../services/apiService', () => ({
  callApi: callApiMock,
}));

type BulkSetYearGroupFlowModule = Readonly<{
  filterEligibleForBulkSetYearGroup: (rows: ClassTableRow[]) => ClassTableRow[];
  getYearGroupOptions: (yearGroups: YearGroup[]) => Array<{ label: string; value: string }>;
  bulkSetYearGroup: (
    rows: ClassTableRow[],
    yearGroupKey: string,
  ) => Promise<Array<{ status: string; row: ClassTableRow }>>;
}>;

/**
 * Loads the future bulk year-group flow module lazily so this RED spec can
 * compile before the implementation exists.
 *
 * @returns {Promise<BulkSetYearGroupFlowModule>} The bulk year-group flow module.
 */
function loadBulkSetYearGroupFlow(): Promise<BulkSetYearGroupFlowModule> {
  return import('./bulkSetYearGroupFlow') as Promise<BulkSetYearGroupFlowModule>;
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

describe('bulkSetYearGroupFlow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns only active and inactive existing rows for bulk year-group editing', async () => {
    const { filterEligibleForBulkSetYearGroup } = await loadBulkSetYearGroupFlow();
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'linked-active', classId: 'class-active', active: true }),
      makeRow({ rowKey: 'linked-inactive', classId: 'class-inactive', active: false }),
      makeRow({ rowKey: 'not-created', classId: 'class-missing', status: 'notCreated', active: null }),
      makeRow({ rowKey: 'orphaned', classId: 'class-orphaned', status: 'partial', active: false }),
    ];

    expect(filterEligibleForBulkSetYearGroup(rows).map((row) => row.classId)).toEqual([
      'class-active',
      'class-inactive',
    ]);
  });

  it('builds year-group selector options with stable keys as option values', async () => {
    const { getYearGroupOptions } = await loadBulkSetYearGroupFlow();
    const yearGroups: YearGroup[] = [
      { key: 'year-10', name: 'Year 10' },
      { key: 'year-11', name: 'Year 11' },
    ];

    expect(getYearGroupOptions(yearGroups)).toEqual([
      { label: 'Year 10', value: 'year-10' },
      { label: 'Year 11', value: 'year-11' },
    ]);
  });

  it('updates each selected class with the chosen yearGroupKey rather than the display label', async () => {
    const { bulkSetYearGroup } = await loadBulkSetYearGroupFlow();
    callApiMock.mockResolvedValue({ ok: true });
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r1', classId: 'class-001', yearGroupKey: 'year-10' }),
      makeRow({ rowKey: 'r2', classId: 'class-002', yearGroupKey: 'year-9', active: false }),
    ];

    const results = await bulkSetYearGroup(rows, 'year-11');

    expect(callApiMock).toHaveBeenCalledTimes(TWO_CALLS);
    expect(callApiMock).toHaveBeenNthCalledWith(1, 'updateABClass', {
      classId: 'class-001',
      yearGroupKey: 'year-11',
    });
    expect(callApiMock).toHaveBeenNthCalledWith(TWO_CALLS, 'updateABClass', {
      classId: 'class-002',
      yearGroupKey: 'year-11',
    });
    expect(results.map((result) => result.row.classId)).toEqual(['class-001', 'class-002']);
  });

  it('uses the same batch path for a single selected row edit', async () => {
    const { bulkSetYearGroup } = await loadBulkSetYearGroupFlow();
    callApiMock.mockResolvedValue({ ok: true });
    const row = makeRow({ classId: 'class-single' });

    const results = await bulkSetYearGroup([row], 'year-12');

    expect(callApiMock).toHaveBeenCalledTimes(1);
    expect(callApiMock).toHaveBeenCalledWith('updateABClass', {
      classId: 'class-single',
      yearGroupKey: 'year-12',
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'fulfilled', row });
  });
});
