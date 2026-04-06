/**
 * Batch mutation engine — unit tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runBatchMutation, type FulfilledRowResult, type RejectedRowResult } from './batchMutationEngine';

const ROW_COUNT_THREE = 3;
const ROW_INDEX_ZERO = 0;
const ROW_INDEX_ONE = 1;
const ROW_INDEX_TWO = 2;
const NTH_CALL_FIRST = 1;
const NTH_CALL_SECOND = 2;
const NTH_CALL_THIRD = 3;
const SINGLE_CALL = 1;

describe('runBatchMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches a mutation for every row without waiting for earlier rows to settle', async () => {
    const pendingResolvers: Array<(value: unknown) => void> = [];
    const mutateFunction = vi.fn(
      () => new Promise((resolve) => pendingResolvers.push(resolve))
    );

    const rows = [{ classId: 'a' }, { classId: 'b' }, { classId: 'c' }];
    const batchPromise = runBatchMutation(rows, mutateFunction);

    // All three must be dispatched before any has settled
    expect(mutateFunction).toHaveBeenCalledTimes(ROW_COUNT_THREE);
    expect(mutateFunction).toHaveBeenNthCalledWith(NTH_CALL_FIRST, rows[ROW_INDEX_ZERO]);
    expect(mutateFunction).toHaveBeenNthCalledWith(NTH_CALL_SECOND, rows[ROW_INDEX_ONE]);
    expect(mutateFunction).toHaveBeenNthCalledWith(NTH_CALL_THIRD, rows[ROW_INDEX_TWO]);

    pendingResolvers.forEach((resolve, index) => resolve({ classId: rows[index].classId }));
    await batchPromise;
  });

  it('preserves submitted-row order in results even when promises resolve out of order', async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    const mutateFunction = vi.fn(
      () => new Promise((resolve) => resolvers.push(resolve))
    );

    const rows = [{ classId: 'first' }, { classId: 'second' }, { classId: 'third' }];
    const batchPromise = runBatchMutation(rows, mutateFunction);

    expect(resolvers).toHaveLength(ROW_COUNT_THREE);

    // Resolve out of order: third, then first, then second
    resolvers[ROW_INDEX_TWO]({ classId: 'third', updated: true });
    resolvers[ROW_INDEX_ZERO]({ classId: 'first', updated: true });
    resolvers[ROW_INDEX_ONE]({ classId: 'second', updated: true });

    const results = await batchPromise;

    expect(results).toHaveLength(ROW_COUNT_THREE);
    // Result positions must match submitted-row positions, not resolution order
    expect(results[ROW_INDEX_ZERO]).toMatchObject({ status: 'fulfilled', row: rows[ROW_INDEX_ZERO] });
    expect(results[ROW_INDEX_ONE]).toMatchObject({ status: 'fulfilled', row: rows[ROW_INDEX_ONE] });
    expect(results[ROW_INDEX_TWO]).toMatchObject({ status: 'fulfilled', row: rows[ROW_INDEX_TWO] });
    expect((results[ROW_INDEX_ZERO] as FulfilledRowResult<typeof rows[0], { classId: string; updated: boolean }>).data.classId).toBe('first');
    expect((results[ROW_INDEX_ONE] as FulfilledRowResult<typeof rows[0], { classId: string; updated: boolean }>).data.classId).toBe('second');
    expect((results[ROW_INDEX_TWO] as FulfilledRowResult<typeof rows[0], { classId: string; updated: boolean }>).data.classId).toBe('third');
  });

  it('marks failed rows with status rejected and includes the thrown error', async () => {
    const failureError = new Error('Mutation failed: class not found');
    const mutateFunction = vi.fn().mockRejectedValue(failureError);

    const rows = [{ classId: 'fail-001' }];
    const results = await runBatchMutation(rows, mutateFunction);

    expect(results).toHaveLength(SINGLE_CALL);
    expect(results[ROW_INDEX_ZERO]).toMatchObject({
      status: 'rejected',
      row: rows[ROW_INDEX_ZERO],
    });
    expect((results[ROW_INDEX_ZERO] as RejectedRowResult<typeof rows[0]>).error).toBe(failureError);
  });

  it('returns succeeded and failed rows in submitted-row order when results are mixed', async () => {
    const failureError = new Error('Row failed');
    const mutateFunction = vi
      .fn()
      .mockResolvedValueOnce({ classId: 'ok-001' })
      .mockRejectedValueOnce(failureError)
      .mockResolvedValueOnce({ classId: 'ok-003' });

    const rows = [{ classId: 'ok-001' }, { classId: 'fail-002' }, { classId: 'ok-003' }];
    const results = await runBatchMutation(rows, mutateFunction);

    expect(results).toHaveLength(ROW_COUNT_THREE);
    expect(results[ROW_INDEX_ZERO]).toMatchObject({ status: 'fulfilled', row: rows[ROW_INDEX_ZERO] });
    expect(results[ROW_INDEX_ONE]).toMatchObject({ status: 'rejected', row: rows[ROW_INDEX_ONE] });
    expect(results[ROW_INDEX_TWO]).toMatchObject({ status: 'fulfilled', row: rows[ROW_INDEX_TWO] });
  });

  it('handles a single-row mutation identically to a multi-row batch', async () => {
    const singleRow = { classId: 'single-001' };
    const responseData = { classId: 'single-001', className: 'Year 10 Maths' };
    const mutateFunction = vi.fn().mockResolvedValue(responseData);

    const results = await runBatchMutation([singleRow], mutateFunction);

    expect(mutateFunction).toHaveBeenCalledTimes(SINGLE_CALL);
    expect(mutateFunction).toHaveBeenCalledWith(singleRow);
    expect(results).toHaveLength(SINGLE_CALL);
    expect(results[ROW_INDEX_ZERO]).toMatchObject({
      status: 'fulfilled',
      row: singleRow,
      data: responseData,
    });
  });

  it('does not retry a failing row — mutateFunction is called exactly once per row', async () => {
    const mutateFunction = vi.fn().mockRejectedValue(new Error('permanent failure'));

    const rows = [{ classId: 'row-001' }, { classId: 'row-002' }];
    await runBatchMutation(rows, mutateFunction);

    // Each row must be attempted exactly once — the engine must not add its own retry loop
    expect(mutateFunction).toHaveBeenCalledTimes(rows.length);
  });

  it('returns an empty array when given an empty row list', async () => {
    const mutateFunction = vi.fn();
    const results = await runBatchMutation([], mutateFunction);

    expect(results).toEqual([]);
    expect(mutateFunction).not.toHaveBeenCalled();
  });
});
