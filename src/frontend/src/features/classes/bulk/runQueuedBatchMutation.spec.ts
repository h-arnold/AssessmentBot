/**
 * Queued batch mutation engine — unit tests (RED phase).
 *
 * The source module `runQueuedBatchMutation.ts` does not exist yet. All tests
 * fail at import resolution until the engine is implemented.
 *
 * Covers: empty input, single item, sequential dispatch, progress snapshots,
 * backend failure recovery, cancellation aggregation, and order preservation.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiQueuedMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/apiService', () => ({
  callApiQueued: callApiQueuedMock,
}));

import { runQueuedBatchMutation } from './runQueuedBatchMutation';
import type { QueuedBatchItem, BatchProgressSnapshot } from './runQueuedBatchMutation';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import type { FulfilledRowResult, RejectedRowResult } from './batchMutationEngine';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Builds a test ClassesManagementRow with minimal defaults.
 *
 * @param {Partial<ClassesManagementRow>} overrides Field overrides for the returned row.
 * @returns {ClassesManagementRow} The composed test row.
 */
function makeRow(overrides: Partial<ClassesManagementRow> = {}): ClassesManagementRow {
  return {
    classId: 'class-001',
    className: 'Test Class',
    status: 'active',
    cohortKey: null,
    cohortLabel: null,
    yearGroupKey: null,
    yearGroupLabel: null,
    courseLength: null,
    active: true,
    ...overrides,
  };
}

/**
 * Builds a QueuedBatchItem fixture.
 *
 * @param {Partial<QueuedBatchItem>} overrides Field overrides.
 * @returns {QueuedBatchItem} The composed queued batch item.
 */
function makeItem(overrides: Partial<QueuedBatchItem> = {}): QueuedBatchItem {
  return {
    row: makeRow(),
    method: 'upsertABClass',
    parameters: {},
    verb: 'Creating',
    className: 'Test Class',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared test constants
// ---------------------------------------------------------------------------

const SINGLE_ITEM = 1;
const TWO_ITEMS = 2;
const THREE_ITEMS = 3;
const FOUR_SNAPSHOTS = 4;

// ---------------------------------------------------------------------------
// Engine tests
// ---------------------------------------------------------------------------

describe('runQueuedBatchMutation', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('empty items array resolves to empty results', async () => {
    const results = await runQueuedBatchMutation([], { jobName: 'test-job' });

    expect(results).toEqual([]);
    expect(callApiQueuedMock).not.toHaveBeenCalled();
  });

  it('single item resolves to fulfilled result', async () => {
    const responseData = { classId: 'class-001', className: 'Created Class' };
    callApiQueuedMock.mockResolvedValue(responseData);

    const items = [makeItem()];
    const results = await runQueuedBatchMutation<{ classId: string; className: string }>(items, {
      jobName: 'test-job',
    });

    expect(callApiQueuedMock).toHaveBeenCalledTimes(SINGLE_ITEM);
    expect(results).toHaveLength(SINGLE_ITEM);
    expect(results[0]).toMatchObject({
      status: 'fulfilled',
      row: items[0].row,
      data: responseData,
    });
  });

  it('multiple items processed sequentially', async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    callApiQueuedMock.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));

    const items = [
      makeItem({ className: 'Class A', parameters: { classId: 'a' } }),
      makeItem({ className: 'Class B', parameters: { classId: 'b' } }),
    ];
    const batchPromise = runQueuedBatchMutation(items, { jobName: 'test-job' });

    // Only the first item should have been dispatched so far
    expect(callApiQueuedMock).toHaveBeenCalledTimes(SINGLE_ITEM);

    // Release the first deferred promise
    resolvers[0]('data-A');

    // Flush microtasks so the engine processes the resolution and dispatches the next item
    await Promise.resolve();

    // Now the second item should have been dispatched
    expect(callApiQueuedMock).toHaveBeenCalledTimes(TWO_ITEMS);

    // Release the second deferred promise
    resolvers[1]('data-B');

    const results = await batchPromise;

    expect(results).toHaveLength(TWO_ITEMS);
    expect(results[0]).toMatchObject({ status: 'fulfilled', row: items[0].row });
    expect(results[1]).toMatchObject({ status: 'fulfilled', row: items[1].row });
  });

  it('progress callback fires with correct snapshots', async () => {
    callApiQueuedMock.mockResolvedValue('ok');

    const snapshots: BatchProgressSnapshot[] = [];
    const items = [
      makeItem({ verb: 'Creating', className: 'Class A' }),
      makeItem({ verb: 'Deleting', className: 'Class B' }),
    ];

    await runQueuedBatchMutation(items, {
      jobName: 'test-job',
      onProgress: (snapshot) => snapshots.push({ ...snapshot }),
    });

    expect(snapshots).toHaveLength(FOUR_SNAPSHOTS);

    // 1 — After item A dispatched (current item set, nothing settled yet)
    expect(snapshots[0]).toMatchObject({
      currentItem: { verb: 'Creating', className: 'Class A' },
      completed: 0,
      pendingCount: 1,
      total: 2,
      isInProgress: true,
    });

    // 2 — After item A settled (completed incremented, no current item)
    expect(snapshots[1]).toMatchObject({
      currentItem: null,
      completed: 1,
      pendingCount: 1,
      total: 2,
      isInProgress: true,
    });

    // 3 — After item B dispatched (current item set)
    expect(snapshots[2]).toMatchObject({
      currentItem: { verb: 'Deleting', className: 'Class B' },
      completed: 1,
      pendingCount: 0,
      total: 2,
      isInProgress: true,
    });

    // 4 — After item B settled (all done, inProgress false)
    expect(snapshots[3]).toMatchObject({
      currentItem: null,
      completed: 2,
      pendingCount: 0,
      total: 2,
      isInProgress: false,
    });
  });

  it('backend failure captured as rejected row result, engine continues', async () => {
    const backendError = new Error('Backend failure: invalid data');
    callApiQueuedMock
      .mockResolvedValueOnce('data-A')
      .mockRejectedValueOnce(backendError)
      .mockResolvedValueOnce('data-C');

    const items = [
      makeItem({ className: 'Class A', parameters: { classId: 'a' } }),
      makeItem({ className: 'Class B', parameters: { classId: 'b' } }),
      makeItem({ className: 'Class C', parameters: { classId: 'c' } }),
    ];

    const results = await runQueuedBatchMutation(items, { jobName: 'test-job' });

    expect(callApiQueuedMock).toHaveBeenCalledTimes(THREE_ITEMS);
    expect(results).toHaveLength(THREE_ITEMS);

    // Item A — succeeded
    expect(results[0]).toMatchObject({
      status: 'fulfilled',
      row: items[0].row,
    });
    expect((results[0] as FulfilledRowResult<ClassesManagementRow, unknown>).data).toBe('data-A');

    // Item B — failed, error preserved
    expect(results[1]).toMatchObject({
      status: 'rejected',
      row: items[1].row,
    });
    expect((results[1] as RejectedRowResult<ClassesManagementRow>).error).toBe(backendError);

    // Item C — succeeded (engine did not stop after failure)
    expect(results[2]).toMatchObject({
      status: 'fulfilled',
      row: items[2].row,
    });
    expect((results[2] as FulfilledRowResult<ClassesManagementRow, unknown>).data).toBe('data-C');
  });

  it('cancellation via reject aggregates CANCELLED results correctly', async () => {
    const cancellers: Array<(value: unknown) => void> = [];
    callApiQueuedMock
      .mockImplementationOnce(() => new Promise((resolve) => cancellers.push(resolve)))
      // Items 2 and 3 simulate cancellation via callApiQueued rejection
      .mockRejectedValue({ reason: 'CANCELLED' })
      .mockRejectedValue({ reason: 'CANCELLED' });

    const items = [
      makeItem({ className: 'Class A', parameters: { classId: 'a' } }),
      makeItem({ className: 'Class B', parameters: { classId: 'b' } }),
      makeItem({ className: 'Class C', parameters: { classId: 'c' } }),
    ];

    const batchPromise = runQueuedBatchMutation(items, { jobName: 'test-job' });

    // Only item 1 should have been dispatched
    expect(callApiQueuedMock).toHaveBeenCalledTimes(SINGLE_ITEM);

    // Release item 1 — the engine then enqueues items 2 and 3 (both reject)
    cancellers[0]('data-A');

    const results = await batchPromise;

    expect(results).toHaveLength(THREE_ITEMS);

    // Item 1 — fulfilled (was running when cancelled, completes normally)
    expect(results[0]).toMatchObject({
      status: 'fulfilled',
      row: items[0].row,
    });

    // Item 2 — rejected with CANCELLED
    expect(results[1]).toMatchObject({
      status: 'rejected',
      row: items[1].row,
    });
    expect((results[1] as RejectedRowResult<ClassesManagementRow>).error).toMatchObject({
      reason: 'CANCELLED',
    });

    // Item 3 — rejected with CANCELLED
    expect(results[2]).toMatchObject({
      status: 'rejected',
      row: items[2].row,
    });
    expect((results[2] as RejectedRowResult<ClassesManagementRow>).error).toMatchObject({
      reason: 'CANCELLED',
    });
  });

  it('results preserve submitted-row order', async () => {
    // Use immediately-resolved promises so all items settle instantly.
    // The engine must yield results in submission order, not mock-order.
    callApiQueuedMock
      .mockResolvedValueOnce('data-A')
      .mockResolvedValueOnce('data-B')
      .mockResolvedValueOnce('data-C');

    const items = [
      makeItem({ className: 'Class Alpha', parameters: { classId: 'a' } }),
      makeItem({ className: 'Class Beta', parameters: { classId: 'b' } }),
      makeItem({ className: 'Class Gamma', parameters: { classId: 'c' } }),
    ];

    const results = await runQueuedBatchMutation(items, { jobName: 'test-job' });

    expect(results).toHaveLength(THREE_ITEMS);

    // Each result must refer to the row at the same index as submitted
    expect(results[0]).toMatchObject({ status: 'fulfilled', row: items[0].row });
    expect(results[1]).toMatchObject({ status: 'fulfilled', row: items[1].row });
    expect(results[2]).toMatchObject({ status: 'fulfilled', row: items[2].row });

    // Data payloads match the mock order (which is the submission order
    // since the engine awaits sequentially)
    expect((results[0] as FulfilledRowResult<ClassesManagementRow, unknown>).data).toBe('data-A');
    expect((results[1] as FulfilledRowResult<ClassesManagementRow, unknown>).data).toBe('data-B');
    expect((results[2] as FulfilledRowResult<ClassesManagementRow, unknown>).data).toBe('data-C');
  });
});
