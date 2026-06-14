/**
 * Shared batch mutation type definitions.
 *
 * This module contains only type declarations for batch mutation results.
 * The actual runtime dispatch that performs one mutation call per row and
 * aggregates settled results lives in {@link runQueuedBatchMutation}.
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
