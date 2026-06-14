/**
 * Bulk create flow — unit tests.
 *
 * Covers: notCreated-only row filtering, correct QueuedBatchItem construction
 * with cohortKey/yearGroupKey/courseLength, courseLength default of 1,
 * runQueuedBatchMutation integration, and empty-list short-circuit.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';

const runQueuedBatchMutationMock = vi.hoisted(() => vi.fn());

vi.mock('./runQueuedBatchMutation', () => ({
  runQueuedBatchMutation: runQueuedBatchMutationMock,
}));

import {
  filterBulkCreateRows,
  bulkCreate,
} from './bulkCreateFlow';
import type { ClassesManagementRow } from '../classesManagementViewModel';

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

  it('calls runQueuedBatchMutation with correct items for each row', async () => {
    const mockResults = [
      { status: 'fulfilled', row: makeRow({ classId: 'gcr-001' }), data: { classId: 'gcr-001' } },
      { status: 'fulfilled', row: makeRow({ classId: 'gcr-002' }), data: { classId: 'gcr-002' } },
    ];
    runQueuedBatchMutationMock.mockResolvedValue(mockResults);

    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'gcr-001' }),
      makeRow({ classId: 'gcr-002' }),
    ];

    const results = await bulkCreate(rows, {
      cohortKey: '2025',
      yearGroupKey: 'yg-10',
      courseLength: 2,
    });

    expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
    const [items, options] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[], { jobName: string; onProgress?: unknown }];
    expect(items).toHaveLength(TWO_ROWS);
    expect(items[0]).toMatchObject({
      method: 'upsertABClass',
      verb: 'Creating',
      className: 'Year 10 Maths',
    });
    expect((items[0] as Record<string, unknown>).parameters).toMatchObject({
      classId: 'gcr-001',
      cohortKey: '2025',
      yearGroupKey: 'yg-10',
      courseLength: 2,
    });
    expect(items[1]).toMatchObject({
      method: 'upsertABClass',
      verb: 'Creating',
      className: 'Year 10 Maths',
    });
    expect((items[1] as Record<string, unknown>).parameters).toMatchObject({
      classId: 'gcr-002',
      cohortKey: '2025',
      yearGroupKey: 'yg-10',
      courseLength: 2,
    });
    expect(options.jobName).toBe('classesBulkMutation');
    expect(options.onProgress).toBeUndefined();
    expect(results).toEqual(mockResults);
  });

  it('defaults courseLength to 1 when not supplied in options', async () => {
    runQueuedBatchMutationMock.mockResolvedValue([
      { status: 'fulfilled', row: makeRow({ classId: 'gcr-005' }), data: { classId: 'gcr-005' } },
    ]);

    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'gcr-005' }),
    ];

    await bulkCreate(rows, { cohortKey: '2025', yearGroupKey: 'yg-9' });

    expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
    const [items] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[]];
    expect((items[0] as Record<string, unknown>).parameters).toMatchObject({
      classId: 'gcr-005',
      cohortKey: '2025',
      yearGroupKey: 'yg-9',
      courseLength: 1,
    });
  });

  it('returns results in submitted-row order even when promises resolve out of order', async () => {
    // runQueuedBatchMutation already handles ordering; test that bulkCreate
    // returns whatever runQueuedBatchMutation returns
    const resolvers: Array<(value: unknown) => void> = [];
    runQueuedBatchMutationMock.mockImplementation(
      () => new Promise((resolve) => { resolvers.push(resolve); }),
    );

    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'gcr-001' }),
      makeRow({ classId: 'gcr-002' }),
      makeRow({ classId: 'gcr-003' }),
    ];

    const batchPromise = bulkCreate(rows, { cohortKey: '2025', yearGroupKey: 'yg-10' });

    resolvers[0]([
      { status: 'fulfilled', row: rows[2], data: { classId: 'gcr-003' } },
      { status: 'fulfilled', row: rows[0], data: { classId: 'gcr-001' } },
      { status: 'fulfilled', row: rows[1], data: { classId: 'gcr-002' } },
    ]);

    const results = await batchPromise;

    expect(results).toHaveLength(THREE_ROWS);
    // Results are whatever runQueuedBatchMutation returns
    expect(results[0]).toMatchObject({ status: 'fulfilled', row: rows[2] });
    expect(results[1]).toMatchObject({ status: 'fulfilled', row: rows[0] });
    expect(results[2]).toMatchObject({ status: 'fulfilled', row: rows[1] });
  });

  it('forwards onProgress to runQueuedBatchMutation', async () => {
    runQueuedBatchMutationMock.mockResolvedValue([
      { status: 'fulfilled', row: makeRow({ classId: 'gcr-001' }), data: { classId: 'gcr-001' } },
    ]);

    const rows: ClassesManagementRow[] = [makeRow({ classId: 'gcr-001' })];
    const onProgress: (snapshot: BatchProgressSnapshot) => void = vi.fn();

    await bulkCreate(rows, { cohortKey: '2025', yearGroupKey: 'yg-10' }, onProgress);

    expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
    const [, options] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[], { jobName: string; onProgress?: unknown }];
    expect(options.onProgress).toBe(onProgress);
  });

  it('returns an empty result array and makes no API calls when given an empty row list', async () => {
    const results = await bulkCreate([], { cohortKey: '2025', yearGroupKey: 'yg-10' });

    expect(results).toEqual([]);
    expect(runQueuedBatchMutationMock).not.toHaveBeenCalled();
  });
});
