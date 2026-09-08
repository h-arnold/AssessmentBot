/**
 * Bulk set-year-group flow — unit tests.
 *
 * Covers: year-group selector option building, QueuedBatchItem construction via
 * bulkMetadataUpdate, onProgress forwarding, and empty-list short-circuit.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { YearGroup } from '../../../services/referenceData/referenceData.zod';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';
import {
  assertQueuedBatchMutationCalledOnce,
  assertSingleSelectedRowEdit,
  makeRow,
} from '../../../test/classes/bulkFlowTestHelpers';

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

describe('bulkSetYearGroupFlow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('builds year-group selector options with stable keys as option values', async () => {
    const { getYearGroupOptions } = await loadBulkSetYearGroupFlow();
    const yearGroups: YearGroup[] = [
      { key: 'year-11', name: 'Year 11' },
      { key: 'year-10', name: 'Year 10' },
      { key: 'year-9', name: 'Year 9' },
    ];

    expect(getYearGroupOptions(yearGroups)).toEqual([
      { label: 'Year 9', value: 'year-9' },
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

    assertQueuedBatchMutationCalledOnce(runQueuedBatchMutationMock, 'updateABClass', 'Setting year group for');
    expect(results.map((result) => result.row.classId)).toEqual(['class-001', 'class-002']);
  });

  it('uses the same batch path for a single selected row edit', async () => {
    const { bulkSetYearGroup } = await loadBulkSetYearGroupFlow();
    await assertSingleSelectedRowEdit(runQueuedBatchMutationMock, bulkSetYearGroup, 'year-12');
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
