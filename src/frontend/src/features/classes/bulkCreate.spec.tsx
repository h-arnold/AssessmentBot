/**
 * Bulk create flow — unit tests.
 *
 * Covers: notCreated-only row filtering, cohortKey/yearGroupKey/courseLength payload
 * construction, courseLength default of 1, batch engine integration, and empty-list
 * short-circuit.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted is required here because bulkCreateFlow is imported statically above,
// causing the vi.mock factory to run during module initialisation — before a plain
// `const callApiMock = vi.fn()` would be initialised.
const callApiMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/apiService', () => ({
  callApi: callApiMock,
}));

import {
  filterBulkCreateRows,
  bulkCreate,
  type ClassTableRow,
} from './bulkCreateFlow';

const TWO_ROWS = 2;
const THREE_ROWS = 3;

/**
 * Builds a test ClassTableRow with sensible defaults and optional overrides.
 *
 * @param {Partial<ClassTableRow>} overrides Field overrides for the returned row.
 * @returns {ClassTableRow} The composed test row.
 */
function makeRow(overrides: Partial<ClassTableRow> = {}): ClassTableRow {
  return {
    rowKey: 'row-001',
    status: 'notCreated',
    classId: 'gcr-class-001',
    cohortKey: null,
    yearGroupKey: null,
    courseLength: 1,
    active: null,
    className: 'Year 10 Maths',
    ...overrides,
  };
}

describe('filterBulkCreateRows', () => {
  it('returns only rows with notCreated status', () => {
    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r1', status: 'notCreated', classId: 'gcr-001' }),
      makeRow({ rowKey: 'r2', status: 'partial', classId: 'gcr-002' }),
      makeRow({ rowKey: 'r3', status: 'linked', classId: 'gcr-003' }),
      makeRow({ rowKey: 'r4', status: 'notCreated', classId: 'gcr-004' }),
    ];

    const result = filterBulkCreateRows(rows);

    expect(result).toHaveLength(TWO_ROWS);
    expect(result[0].classId).toBe('gcr-001');
    expect(result[1].classId).toBe('gcr-004');
  });

  it('returns an empty array when no rows have notCreated status', () => {
    const rows: ClassTableRow[] = [
      makeRow({ status: 'partial' }),
      makeRow({ status: 'linked' }),
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

    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r1', classId: 'gcr-001' }),
      makeRow({ rowKey: 'r2', classId: 'gcr-002' }),
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

    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r5', classId: 'gcr-005' }),
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

    const rows: ClassTableRow[] = [
      makeRow({ rowKey: 'r1', classId: 'gcr-001' }),
      makeRow({ rowKey: 'r2', classId: 'gcr-002' }),
      makeRow({ rowKey: 'r3', classId: 'gcr-003' }),
    ];

    const batchPromise = bulkCreate(rows, { cohortKey: '2025', yearGroupKey: 'yg-10' });

    // Resolve out of order: third, first, second
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

    const rows: ClassTableRow[] = [makeRow({ rowKey: 'r1', classId: 'gcr-001' })];

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
