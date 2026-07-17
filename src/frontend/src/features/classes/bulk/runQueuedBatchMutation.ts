/**
 * Queued batch mutation engine.
 *
 * Enqueues each item through `callApiQueued` using the supplied job name,
 * processes them sequentially (FIFO), and tracks per-item progress. The
 * returned Promise resolves to the aggregated row results when every item
 * has settled.
 *
 * @remarks
 * Progress snapshots are derived from the submitted-row promise order, which
 * matches `callApiQueued` FIFO order for the same job name. The engine calls
 * `onProgress` synchronously — once before each await (showing the new
 * current item) and once after each await (incrementing completed). Cancelled
 * items (with `{ reason: 'CANCELLED' }`) are naturally captured as rejected
 * results — no special handling is needed.
 */

import { callApiQueued } from '../../../services/apiService';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import type {
  RowMutationResult,
  FulfilledRowResult,
  RejectedRowResult,
} from './batchMutationEngine';

/** A single queued batch item describing one mutation call to enqueue. */
export interface QueuedBatchItem {
  /** The classes-management row this mutation applies to. */
  row: ClassesManagementRow;
  /** The backend method to call. */
  method: 'upsertABClass' | 'updateABClass' | 'deleteABClass';
  /** Parameters passed to the backend method. */
  parameters: unknown;
  /** User-facing verb for progress display (e.g. "Creating", "Deleting"). */
  verb: string;
  /** User-facing class name for progress display. */
  className: string;
}

/** A point-in-time snapshot of the batch mutation progress. */
export interface BatchProgressSnapshot {
  /** The item currently being processed, or null when all items are settled. */
  currentItem: { verb: string; className: string } | null;
  /** Number of items that have settled (fulfilled or rejected). */
  completed: number;
  /** Number of items enqueued but not yet settled, excluding the current item. */
  pendingCount: number;
  /** Total number of items submitted. */
  total: number;
  /** Whether any item is still unsettled. */
  isInProgress: boolean;
}

/**
 * Runs a queued batch mutation by enqueuing each item through `callApiQueued`
 * and processing them sequentially.
 *
 * @template TData - The shape of a successful mutation response.
 * @param {QueuedBatchItem[]} items - The batch items to enqueue and process.
 *   An empty array returns an empty result immediately.
 * @param {object} options - Configuration options.
 * @param {string} options.jobName - The `callApiQueued` job name for queue
 *   serialisation.
 * @param {(snapshot: BatchProgressSnapshot) => void} [options.onProgress] -
 *   Optional callback invoked synchronously after each item starts and after
 *   each item settles.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, TData>[]>}
 *   A Promise that resolves to one result entry per submitted item, in
 *   submitted order.
 */
export async function runQueuedBatchMutation<TData>(
  items: QueuedBatchItem[],
  options: {
    jobName: string;
    onProgress?: (snapshot: BatchProgressSnapshot) => void;
  }
): Promise<RowMutationResult<ClassesManagementRow, TData>[]> {
  if (items.length === 0) {
    return [];
  }

  const { jobName, onProgress } = options;
  const total = items.length;
  const results: RowMutationResult<ClassesManagementRow, TData>[] = [];
  let completed = 0;

  // Enqueue all items first so that cancelApiQueued can cancel pending items
  // before they are dispatched.  The queue processes them FIFO; we await the
  // returned Promises in submission order to keep the engine sequential.
  const promises = items.map((item) => callApiQueued<TData>(item.method, item.parameters, jobName));

  for (const [index, item] of items.entries()) {
    // --- starting progress ---
    onProgress?.({
      currentItem: { verb: item.verb, className: item.className },
      completed,
      pendingCount: total - completed - 1,
      total,
      isInProgress: true,
    });

    try {
      const data = await promises[index];
      results.push({ status: 'fulfilled', row: item.row, data } as FulfilledRowResult<
        ClassesManagementRow,
        TData
      >);
    } catch (error: unknown) {
      results.push({
        status: 'rejected',
        row: item.row,
        error,
      } as RejectedRowResult<ClassesManagementRow>);
    }

    completed++;

    // --- settled progress ---
    const allDone = completed >= total;
    onProgress?.({
      currentItem: null,
      completed,
      pendingCount: total - completed,
      total,
      isInProgress: !allDone,
    });
  }

  return results;
}
