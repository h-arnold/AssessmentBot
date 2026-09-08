/**
 * Shared test helpers for the bulk-set flow specs (bulkSetYearGroup and bulkSetCohort).
 *
 * These two specs mirror each other closely (identical `makeRow` factory, the same
 * queued-batch-call assertion block, and structurally identical single-row-edit test
 * bodies), so the shared token streams are extracted here to keep the suites DRY and
 * to keep SonarCloud cross-file duplication quiet.
 *
 * The helper accepts the per-file `vi.hoisted` mock and the loaded flow function as
 * parameters so each spec keeps ownership of its own module mock and flow loader.
 */

import type { vi } from 'vitest';
import type { ClassesManagementRow } from '../../features/classes/classesManagementViewModel';
import type { BatchProgressSnapshot } from '../../features/classes/bulk/runQueuedBatchMutation';
import type { RowMutationResult } from '../../features/classes/bulk/batchMutationEngine';

/** A bulk-set flow entry point shared by `bulkSetYearGroup` and `bulkSetCohort`. */
export type BulkSetFlow = (
  rows: ClassesManagementRow[],
  key: string,
  onProgress?: (snapshot: BatchProgressSnapshot) => void
) => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;

/**
 * Builds a canonical classes-management row for bulk-set flow tests.
 *
 * @param {Partial<ClassesManagementRow>} overrides Field overrides for the returned row.
 * @returns {ClassesManagementRow} The composed test row.
 */
export function makeRow(overrides: Partial<ClassesManagementRow> = {}): ClassesManagementRow {
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

/**
 * Asserts that `runQueuedBatchMutation` was invoked exactly once and that the first
 * enqueued item carried the expected backend method and progress verb.
 *
 * @param {ReturnType<typeof vi.fn>} runQueuedBatchMutationMock The hoisted mock under test.
 * @param {string} expectedMethod The expected backend method (e.g. `'updateABClass'`).
 * @param {string} expectedVerb The expected user-facing progress verb.
 */
export function assertQueuedBatchMutationCalledOnce(
  runQueuedBatchMutationMock: ReturnType<typeof vi.fn>,
  expectedMethod: string,
  expectedVerb: string
): void {
  expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
  const [items] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[]];
  const firstItem = items[0] as Record<string, unknown>;
  expect(firstItem.method).toBe(expectedMethod);
  expect(firstItem.verb).toBe(expectedVerb);
}

/**
 * Asserts the single-selected-row edit path: the flow resolves one fulfilled result
 * for the supplied row and invokes the queued batch mutation exactly once.
 *
 * @param {ReturnType<typeof vi.fn>} runQueuedBatchMutationMock The hoisted mock under test.
 * @param {BulkSetFlow} flow The loaded bulk-set flow function.
 * @param {string} selectedKey The key to apply to the single row.
 */
export async function assertSingleSelectedRowEdit(
  runQueuedBatchMutationMock: ReturnType<typeof vi.fn>,
  flow: BulkSetFlow,
  selectedKey: string
): Promise<void> {
  runQueuedBatchMutationMock.mockResolvedValue([
    {
      status: 'fulfilled',
      row: makeRow({ classId: 'class-single', status: 'inactive', active: false }),
      data: { ok: true },
    },
  ]);

  const row = makeRow({ classId: 'class-single', status: 'inactive', active: false });

  const results = await flow([row], selectedKey);

  expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1);
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({ status: 'fulfilled', row });
}
