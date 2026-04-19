import { afterEach, describe, expect, it, vi } from 'vitest';
import type { YearGroup } from '../../services/referenceData.zod';
import type { ClassesManagementRow } from './classesManagementViewModel';
import type * as BulkSetYearGroupFlowModule from './bulkSetYearGroupFlow';

const callApiMock = vi.hoisted(() => vi.fn());
const TWO_CALLS = 2;

vi.mock('../../services/apiService', () => ({
  callApi: callApiMock,
}));

/**
 * Loads the bulk year-group flow lazily so the test can import the current implementation shape.
 *
 * @returns {Promise<typeof BulkSetYearGroupFlowModule>} The year-group flow module.
 */
function loadBulkSetYearGroupFlow(): Promise<typeof BulkSetYearGroupFlowModule> {
  return import('./bulkSetYearGroupFlow');
}

/**
 * Builds a canonical classes-management row for year-group flow tests.
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

describe('bulkSetYearGroupFlow', () => {
  afterEach(() => {
    vi.clearAllMocks();
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
    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'class-001', status: 'active' }),
      makeRow({ classId: 'class-002', status: 'inactive', active: false }),
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
    const row = makeRow({ classId: 'class-single', status: 'inactive', active: false });

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
