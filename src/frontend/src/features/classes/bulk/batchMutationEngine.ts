/**
 * Shared batch mutation engine.
 *
 * Dispatches one mutation call per row in parallel and aggregates the settled
 * results in submitted-row order, regardless of the order in which individual
 * promises resolve.
 *
 * Design notes:
 * - Each row promise is normalised with `.then`/`.catch` in the same `map`
 *   call, so a failure in one row does not prevent other rows from being
 *   attempted.  The normalised promises are then collected with `Promise.all`,
 *   which preserves submitted-row order without requiring index-based array
 *   access.  (`Promise.allSettled` is intentionally avoided because its
 *   index-based result mapping would trigger the `security/detect-object-injection`
 *   lint rule.)
 * - Deliberately contains no retry logic; retries are the caller's concern.
 * - Single-row and multi-row callers use the identical code path.
 */

/** A successfully completed row mutation. */
export type FulfilledRowResult<TRow, TData> = {
  status: 'fulfilled';
  row: TRow;
  data: TData;
};

/** A row mutation that threw or rejected. */
export type RejectedRowResult<TRow> = {
  status: 'rejected';
  row: TRow;
  error: unknown;
};

/** The union type returned for each row in the batch. */
export type RowMutationResult<TRow, TData> =
  | FulfilledRowResult<TRow, TData>
  | RejectedRowResult<TRow>;

/**
 * Runs a caller-supplied mutation function against every row in parallel and
 * returns a results array that preserves submitted-row order.
 *
 * @template TRow - The shape of each input row.
 * @template TData - The shape of a successful mutation response.
 * @param {TRow[]} rows - Rows to mutate; an empty array returns an empty result immediately.
 * @param {(row: TRow) => Promise<TData>} mutateFunction - Called once per row; must return a Promise.
 * @returns {Promise<RowMutationResult<TRow, TData>[]>} A Promise that resolves to one result entry per row in submitted order.
 */
export async function runBatchMutation<TRow, TData>(
  rows: TRow[],
  mutateFunction: (row: TRow) => Promise<TData>,
): Promise<RowMutationResult<TRow, TData>[]> {
  if (rows.length === 0) {
    return [];
  }

  // Pair each row with its settled outcome in the same `map` call so that
  // results are ordered by submission without index-based array access.
  const rowResults = rows.map(
    (row): Promise<RowMutationResult<TRow, TData>> =>
      mutateFunction(row)
        .then((data): FulfilledRowResult<TRow, TData> => ({ status: 'fulfilled', row, data }))
        .catch((error): RejectedRowResult<TRow> => ({ status: 'rejected', row, error })),
  );

  return Promise.all(rowResults);
}
