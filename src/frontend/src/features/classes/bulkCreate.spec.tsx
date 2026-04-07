/**
 * Bulk create flow — unit tests.
 *
 * Covers: notCreated-only row filtering, cohortKey/yearGroupKey/courseLength payload
 * construction, courseLength default of 1, batch engine integration, and empty-list
 * short-circuit.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/apiService', () => ({
  callApi: callApiMock,
}));

import {
  filterBulkCreateRows,
  bulkCreate,
} from './bulkCreateFlow';
import type { ClassesManagementRow } from './classesManagementViewModel';

const TWO_ROWS = 2;
const THREE_ROWS = 3;

/**
 * Builds a test ClassesManagementRow with sensible defaults and optional overrides.
 *
 * @param {Partial<ClassesManagementRow>} overrides Field overrides for the returned row.
 * @returns {ClassesManagementRow} The composed test row.
 */
function makeRow(overrides: Partial<ClassesManagementRow> = {}): ClassesManagementRow {
  return {
    classId: 'gcr-class-001',
    className: 'Year 10 Maths',
    status: 'notCreated',
    cohortKey: null,
    cohortLabel: null,
    yearGroupKey: null,
    yearGroupLabel: null,
    courseLength: null,
    active: null,
    ...overrides,
  };
}

describe('filterBulkCreateRows', () => {
  it('returns only rows with notCreated status', () => {
    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'gcr-001', status: 'notCreated' }),
      makeRow({ classId: 'gcr-002', status: 'active', active: true, cohortKey: 'cohort-a', cohortLabel: 'Cohort A', yearGroupKey: 'year-10', yearGroupLabel: 'Year 10', courseLength: 2 }),
      makeRow({ classId: 'gcr-003', status: 'inactive', active: false, cohortKey: 'cohort-b', cohortLabel: 'Cohort B', yearGroupKey: 'year-11', yearGroupLabel: 'Year 11', courseLength: 3 }),
      makeRow({ classId: 'gcr-004', status: 'orphaned', active: false, cohortKey: 'cohort-c', cohortLabel: 'Cohort C', yearGroupKey: 'year-12', yearGroupLabel: 'Year 12', courseLength: 4 }),
      makeRow({ classId: 'gcr-005', status: 'notCreated' }),
    ];

    const result = filterBulkCreateRows(rows);

    expect(result).toHaveLength(TWO_ROWS);
    expect(result[0].classId).toBe('gcr-001');
    expect(result[1].classId).toBe('gcr-005');
  });

  it('returns an empty array when no rows have notCreated status', () => {
    const rows: ClassesManagementRow[] = [
      makeRow({ status: 'active', active: true, cohortKey: 'cohort-a', cohortLabel: 'Cohort A', yearGroupKey: 'year-10', yearGroupLabel: 'Year 10', courseLength: 2 }),
      makeRow({ status: 'inactive', active: false, cohortKey: 'cohort-b', cohortLabel: 'Cohort B', yearGroupKey: 'year-11', yearGroupLabel: 'Year 11', courseLength: 3 }),
    ];

    expect(filterBulkCreateRows(rows)).toEqual([]);
  });

  it('returns an empty array when given an empty row list', () => {
    expect(filterBulkCreateRows([])).toEqual([]);
  });
});

describe('bulkCreate', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls upsertABClass for each row using cohortKey, yearGroupKey, and courseLength', async () => {
    callApiMock.mockResolvedValue({ classId: 'gcr-001' });

    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'gcr-001' }),
      makeRow({ classId: 'gcr-002' }),
    ];

    await bulkCreate(rows, {
      cohortKey: '2025',
      yearGroupKey: 'yg-10',
      courseLength: 2,
    });

    expect(callApiMock).toHaveBeenCalledTimes(TWO_ROWS);
    expect(callApiMock).toHaveBeenCalledWith('upsertABClass', {
      classId: 'gcr-001',
      cohortKey: '2025',
      yearGroupKey: 'yg-10',
      courseLength: 2,
    });
    expect(callApiMock).toHaveBeenCalledWith('upsertABClass', {
      classId: 'gcr-002',
      cohortKey: '2025',
      yearGroupKey: 'yg-10',
      courseLength: 2,
    });
  });

  it('defaults courseLength to 1 when not supplied in options', async () => {
    callApiMock.mockResolvedValue({ classId: 'gcr-005' });

    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'gcr-005' }),
    ];

    await bulkCreate(rows, { cohortKey: '2025', yearGroupKey: 'yg-9' });

    expect(callApiMock).toHaveBeenCalledWith('upsertABClass', {
      classId: 'gcr-005',
      cohortKey: '2025',
      yearGroupKey: 'yg-9',
      courseLength: 1,
    });
  });

  it('returns results in submitted-row order even when promises resolve out of order', async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    callApiMock.mockImplementation(
      () => new Promise((resolve) => resolvers.push(resolve)),
    );

    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'gcr-001' }),
      makeRow({ classId: 'gcr-002' }),
      makeRow({ classId: 'gcr-003' }),
    ];

    const batchPromise = bulkCreate(rows, { cohortKey: '2025', yearGroupKey: 'yg-10' });

    resolvers[2]({ classId: 'gcr-003' });
    resolvers[0]({ classId: 'gcr-001' });
    resolvers[1]({ classId: 'gcr-002' });

    const results = await batchPromise;

    expect(results).toHaveLength(THREE_ROWS);
    expect(results[0]).toMatchObject({ status: 'fulfilled', row: rows[0] });
    expect(results[1]).toMatchObject({ status: 'fulfilled', row: rows[1] });
    expect(results[2]).toMatchObject({ status: 'fulfilled', row: rows[2] });
  });

  it('marks a row as rejected when upsertABClass fails for that row', async () => {
    const failureError = new Error('upsertABClass failed: class not found');
    callApiMock.mockRejectedValue(failureError);

    const rows: ClassesManagementRow[] = [makeRow({ classId: 'gcr-001' })];

    const results = await bulkCreate(rows, { cohortKey: '2025', yearGroupKey: 'yg-10' });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'rejected', row: rows[0] });
  });

  it('returns an empty result array and makes no API calls when given an empty row list', async () => {
    const results = await bulkCreate([], { cohortKey: '2025', yearGroupKey: 'yg-10' });

    expect(results).toEqual([]);
    expect(callApiMock).not.toHaveBeenCalled();
  });
});
