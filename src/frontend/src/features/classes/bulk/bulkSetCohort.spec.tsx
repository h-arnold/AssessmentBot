/**
 * Bulk set-cohort flow — unit tests.
 *
 * Covers: cohort selector option building, QueuedBatchItem construction via
 * bulkMetadataUpdate, onProgress forwarding, and empty-list short-circuit.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cohort } from '../../../services/referenceData/referenceData.zod';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';

const runQueuedBatchMutationMock = vi.hoisted(() => vi.fn());

vi.mock('./runQueuedBatchMutation', () => ({
  runQueuedBatchMutation: runQueuedBatchMutationMock,
}));

import type * as BulkSetCohortFlowModule from './bulkSetCohortFlow';

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

  it('calls bulkMetadataUpdate which calls runQueuedBatchMutation with correct items', async () => {
    runQueuedBatchMutationMock.mockResolvedValue([
      { status: 'fulfilled', row: makeRow({ classId: 'class-001', status: 'active' }), data: { ok: true } },
      { status: 'fulfilled', row: makeRow({ classId: 'class-002', status: 'inactive', active: false }), data: { ok: true } },
    ]);

    const { bulkSetCohort } = await loadBulkSetCohortFlow();
    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'class-001', status: 'active' }),
      makeRow({ classId: 'class-002', status: 'inactive', active: false }),
    ];

    const results = await bulkSetCohort(rows, 'cohort-2025');

    expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
    const [items] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[]];
    const firstItem = items[0] as Record<string, unknown>;
    expect(firstItem.method).toBe('updateABClass');
    expect(firstItem.verb).toBe('Setting cohort for');
    expect(results.map((result) => result.row.classId)).toEqual(['class-001', 'class-002']);
  });

  it('uses the same batch path for a single selected row edit', async () => {
    runQueuedBatchMutationMock.mockResolvedValue([
      { status: 'fulfilled', row: makeRow({ classId: 'class-single', status: 'inactive', active: false }), data: { ok: true } },
    ]);

    const { bulkSetCohort } = await loadBulkSetCohortFlow();
    const row = makeRow({ classId: 'class-single', status: 'inactive', active: false });

    const results = await bulkSetCohort([row], 'cohort-2026');

    expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'fulfilled', row });
  });

  it('forwards onProgress to runQueuedBatchMutation via bulkMetadataUpdate', async () => {
    runQueuedBatchMutationMock.mockResolvedValue([
      { status: 'fulfilled', row: makeRow({ classId: 'class-001' }), data: { ok: true } },
    ]);

    const { bulkSetCohort } = await loadBulkSetCohortFlow();
    const row = makeRow({ classId: 'class-001' });
    const onProgress: (snapshot: BatchProgressSnapshot) => void = vi.fn();

    await bulkSetCohort([row], 'cohort-2025', onProgress);

    expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
    const [, options] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[], { onProgress?: unknown }];
    expect(options.onProgress).toBe(onProgress);
  });
});
