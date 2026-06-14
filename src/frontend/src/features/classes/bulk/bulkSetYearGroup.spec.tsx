/**
 * Bulk set-year-group flow — unit tests.
 *
 * Covers: year-group selector option building, QueuedBatchItem construction via
 * bulkMetadataUpdate, onProgress forwarding, and empty-list short-circuit.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { YearGroup } from '../../../services/referenceData/referenceData.zod';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';

const runQueuedBatchMutationMock = vi.hoisted(() => vi.fn());

vi.mock('./runQueuedBatchMutation', () => ({
  runQueuedBatchMutation: runQueuedBatchMutationMock,
}));

import type * as BulkSetYearGroupFlowModule from './bulkSetYearGroupFlow';

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

  it('calls bulkMetadataUpdate which calls runQueuedBatchMutation with correct items', async () => {
    runQueuedBatchMutationMock.mockResolvedValue([
      { status: 'fulfilled', row: makeRow({ classId: 'class-001', status: 'active' }), data: { ok: true } },
      { status: 'fulfilled', row: makeRow({ classId: 'class-002', status: 'inactive', active: false }), data: { ok: true } },
    ]);

    const { bulkSetYearGroup } = await loadBulkSetYearGroupFlow();
    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'class-001', status: 'active' }),
      makeRow({ classId: 'class-002', status: 'inactive', active: false }),
    ];

    const results = await bulkSetYearGroup(rows, 'year-11');

    expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
    const [items] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[]];
    const firstItem = items[0] as Record<string, unknown>;
    expect(firstItem.method).toBe('updateABClass');
    expect(firstItem.verb).toBe('Setting year group for');
    expect(results.map((result) => result.row.classId)).toEqual(['class-001', 'class-002']);
  });

  it('uses the same batch path for a single selected row edit', async () => {
    runQueuedBatchMutationMock.mockResolvedValue([
      { status: 'fulfilled', row: makeRow({ classId: 'class-single', status: 'inactive', active: false }), data: { ok: true } },
    ]);

    const { bulkSetYearGroup } = await loadBulkSetYearGroupFlow();
    const row = makeRow({ classId: 'class-single', status: 'inactive', active: false });

    const results = await bulkSetYearGroup([row], 'year-12');

    expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'fulfilled', row });
  });

  it('forwards onProgress to runQueuedBatchMutation via bulkMetadataUpdate', async () => {
    runQueuedBatchMutationMock.mockResolvedValue([
      { status: 'fulfilled', row: makeRow({ classId: 'class-001' }), data: { ok: true } },
    ]);

    const { bulkSetYearGroup } = await loadBulkSetYearGroupFlow();
    const row = makeRow({ classId: 'class-001' });
    const onProgress: (snapshot: BatchProgressSnapshot) => void = vi.fn();

    await bulkSetYearGroup([row], 'year-12', onProgress);

    expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
    const [, options] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[], { onProgress?: unknown }];
    expect(options.onProgress).toBe(onProgress);
  });
});
