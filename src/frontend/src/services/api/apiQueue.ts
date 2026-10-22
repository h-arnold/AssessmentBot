import { z } from 'zod';
import { ApiRequestSchema, callApi } from '../apiService';

const JobNameSchema = z.string().min(1);

// ── Queue infrastructure ─────────────────────────────────────────────────

interface QueueEntry {
  task: () => unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

interface QueueStateInternal {
  pending: Set<QueueEntry>;
  active: boolean;
}

const queues = new Map<string, QueueStateInternal>();

export interface QueueState {
  pending: number;
  active: boolean;
}

/**
 * Enqueues an API call for sequential execution within a job-name queue.
 *
 * @template TResponse - The expected response data type.
 * @param {string} method - Backend method name (must be non-empty).
 * @param {unknown} parameters - Request parameters.
 * @param {string} jobName - Queue job name (must be non-empty).
 * @returns {Promise<TResponse>} A Promise that resolves when the queued request completes.
 *
 * @remarks
 * Input validation for `method` intentionally mirrors `callApi`'s `ApiRequestSchema`
 * (via {@link ApiRequestSchema.shape.method}) as defence-in-depth — early rejection at
 * the call site prevents malformed requests from entering the queue. The `parameters`
 * field is validated later by `callApi` during dispatch.
 */
export function callApiQueued<TResponse>(
  method: string,
  parameters: unknown,
  jobName: string
): Promise<TResponse> {
  ApiRequestSchema.shape.method.parse(method);
  return runApiQueuedTask(jobName, () => callApi<TResponse>(method, parameters));
}

/**
 * Enqueues a local callback in the existing per-job FIFO.
 *
 * @template T - The callback's result type.
 * @param {string} jobName - Queue job name (must be non-empty).
 * @param {() => T | Promise<T>} task - Callback invoked only when its slot is active.
 * @returns {Promise<T>} The callback's result, or its original rejection.
 *
 * @remarks
 * FIFO is per job name, not global: different jobs can run in parallel. The full
 * slot is held until the callback settles, including all of its awaited work.
 * The callback stays local and is never sent to GAS; any network calls inside it
 * must still use `callApi`, whose central retry policy is unchanged.
 * Never await another enqueue on the same lane from inside a task: that
 * deadlocks because the nested entry cannot start until this slot is released.
 * Pending tasks can be cancelled with `{ reason: 'CANCELLED' }`; active work
 * continues and is not aborted.
 */
export function runApiQueuedTask<T>(jobName: string, task: () => T | Promise<T>): Promise<T> {
  JobNameSchema.parse(jobName);

  // Locate or create queue for this jobName
  let queue = queues.get(jobName);
  if (!queue) {
    queue = { pending: new Set<QueueEntry>(), active: false };
    queues.set(jobName, queue);
  }
  const targetQueue = queue;

  const wasIdle = !targetQueue.active;

  // Set insertion order preserves FIFO without reindexing pending entries.
  return new Promise<T>((resolve, reject) => {
    targetQueue.pending.add({
      task,
      resolve: resolve as (value: unknown) => void,
      reject,
    });

    // Synchronously mark active before any await, preventing duplicate loops
    if (!wasIdle) return;
    targetQueue.active = true;
    void processQueue(targetQueue);
  });
}

// ── Processing loop ────────────────────────────────────────────────────────────

/**
 * Processes queued callbacks for a given job name in FIFO order.
 *
 * Runs asynchronously (fire-and-forget from the enqueuer). Removes the first
 * pending item, awaits its callback, and resolves or rejects the
 * stored promise. Repeats until the queue is empty, then marks the queue
 * as inactive.
 *
 * @param {QueueStateInternal} queue - The queue to process.
 * @returns {Promise<void>} A promise that resolves when the queue is drained.
 */
async function processQueue(queue: QueueStateInternal): Promise<void> {
  if (queue.pending.size > 0) {
    const entry = queue.pending.values().next().value!;
    queue.pending.delete(entry); // Remove immediately, before dispatch.
    try {
      const data = await entry.task();
      entry.resolve(data);
    } catch (error: unknown) {
      entry.reject(error);
      // A synchronous throw reaches this catch before the await above suspends.
      // Yield before continuing so a long run of failed callbacks cannot recurse
      // on the JavaScript stack or wedge the lane on overflow.
      await Promise.resolve();
    }
    await processQueue(queue);
    return;
  }
  queue.active = false;
}

/**
 * Returns a snapshot of the current queue state for a given job name.
 *
 * @param {string} jobName - Queue job name (must be non-empty).
 * @returns {QueueState} The current queue state.
 *
 * @remarks
 * This returns a point-in-time snapshot. Callers polling for progress should not
 * assume monotonicity between calls — the queue may advance between a read and
 * the caller's next statement.
 */
export function getQueueState(jobName: string): QueueState {
  JobNameSchema.parse(jobName);
  const queue = queues.get(jobName);
  if (!queue) {
    return { pending: 0, active: false };
  }
  return { pending: queue.pending.size, active: queue.active };
}

/**
 * Cancels all pending queued entries for a given job name.
 *
 * Removes every pending {@link QueueEntry} from the internal queue and rejects
 * each removed entry's Promise with `{ reason: 'CANCELLED' }`. The currently
 * active in-flight request, if any, is **not** affected — `google.script.run`
 * does not support transport-level abort.
 *
 * @param {string} jobName - Queue job name (must be non-empty). Validated by
 *   {@link JobNameSchema}.
 * @returns {number} The number of pending items removed (excludes the active
 *   in-flight request).
 *
 * @remarks
 * - For an unknown or idle job name, the function is a no-op and returns `0`.
 * - After cancellation the queue structure remains in the map so subsequent
 *   `getQueueState` calls return `{ pending: 0, active: <previous> }`.
 * - Repeat calls on the same job name after the first cancellation return `0`
 *   because there are no pending items left to cancel.
 *
 * @example
 * ```ts
 * const cancelledCount = cancelApiQueued('classesBulkMutation');
 * if (cancelledCount > 0) {
 *   handleCancelledRequests(cancelledCount);
 * }
 * ```
 */
export function cancelApiQueued(jobName: string): number {
  // 1. Validate jobName (throws synchronously on empty/invalid)
  JobNameSchema.parse(jobName);

  // 2. Look up the queue
  const queue = queues.get(jobName);

  // 3. Unknown/idle job → no-op
  if (!queue) {
    return 0;
  }

  // 4. Snapshot and clear pending entries atomically before rejecting them.
  const pendingEntries = [...queue.pending];
  queue.pending.clear();

  // 5. Reject each pending entry
  for (const entry of pendingEntries) {
    entry.reject({ reason: 'CANCELLED' });
  }

  // 6. Return count of removed items
  return pendingEntries.length;
}
