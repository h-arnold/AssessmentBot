/**
 * Feature hook that owns queue progress state, modal visibility, cancellation,
 * and the workflow-active boundary for queued bulk actions on the Classes
 * settings page.
 *
 * @remarks
 * - `isQueueActive` is true from the start of `runQueuedBulkAction` until
 *   `onComplete` finishes, and is fed into the panel's existing workflow
 *   mutation boundary.
 * - Dismissing the modal only hides it; the queue continues processing.
 * - The dismissed flag resets when the queue drains so the next bulk action
 *   re-opens the modal automatically.
 * - Cancellation via `onCancelQueue` calls `cancelApiQueued` with the shared
 *   `classesBulkMutation` job name, which removes pending items from the queue
 *   but does not stop the active in-flight request.
 */

import { useCallback, useRef, useState } from 'react';
import { cancelApiQueued } from '../../services/apiService';
import type { RowMutationResult } from './bulk/batchMutationEngine';
import type { BatchProgressSnapshot } from './bulk/runQueuedBatchMutation';
import type { ClassesManagementRow } from './classesManagementViewModel';

const INITIAL_PROGRESS: BatchProgressSnapshot = {
  currentItem: null,
  completed: 0,
  pendingCount: 0,
  total: 0,
  isInProgress: false,
};

export type UseClassesBulkMutationQueueResult = Readonly<{
  isQueueActive: boolean;
  progress: BatchProgressSnapshot;
  isProgressModalOpen: boolean;
  onDismissProgressModal: () => void;
  onCancelQueue: () => void;
  runQueuedBulkAction: (options: {
    mutate: (
      onProgress: (snapshot: BatchProgressSnapshot) => void
    ) => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
    onComplete: (results: RowMutationResult<ClassesManagementRow, unknown>[]) => Promise<void>;
  }) => Promise<void>;
}>;

/**
 * Provides queue progress state, modal visibility, cancellation, and the
 * workflow-active boundary for queued bulk class mutations.
 *
 * @returns {UseClassesBulkMutationQueueResult} Hook result.
 */
export function useClassesBulkMutationQueue(): UseClassesBulkMutationQueueResult {
  const [isQueueActive, setIsQueueActive] = useState(false);
  const [progress, setProgress] = useState<BatchProgressSnapshot>(INITIAL_PROGRESS);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const dismissedReference = useRef(false);
  const activeReference = useRef(false);

  /**
   * Stable progress callback passed to `mutate`. Updates hook state from
   * the engine's progress snapshot and derives `isQueueActive` from the
   * snapshot's `isInProgress` flag.
   */
  const onProgress = useCallback((snapshot: BatchProgressSnapshot) => {
    setProgress(snapshot);
    setIsQueueActive(snapshot.isInProgress);
  }, []);

  /** Hides the progress modal without cancelling the queue. */
  const onDismissProgressModal = useCallback(() => {
    setIsProgressModalOpen(false);
    dismissedReference.current = true;
  }, []);

  /** Cancels all pending queued mutations for the shared job name. */
  const onCancelQueue = useCallback(() => {
    cancelApiQueued('classesBulkMutation');
  }, []);

  /**
   * Runs a queued bulk action, opening the progress modal (unless the user
   * has dismissed it), calling `mutate` with a progress callback, and
   * calling `onComplete` with the settled results.
   *
   * @param {object} options - Action options.
   * @param {function} options.mutate - Mutation function that receives a
   *   progress callback and returns the aggregated row results.
   * @param {function} options.onComplete - Completion callback receiving
   *   the aggregated row results.
   * @returns {Promise<void>} A promise that resolves when the action is
   *   fully settled.
   */
  const runQueuedBulkAction = useCallback(
    async ({
      mutate,
      onComplete,
    }: {
      mutate: (
        onProgress: (snapshot: BatchProgressSnapshot) => void
      ) => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
      onComplete: (results: RowMutationResult<ClassesManagementRow, unknown>[]) => Promise<void>;
    }): Promise<void> => {
      if (activeReference.current) {
        return;
      }
      activeReference.current = true;
      setIsQueueActive(true);
      if (!dismissedReference.current) {
        setIsProgressModalOpen(true);
      }

      try {
        const results = await mutate(onProgress);
        await onComplete(results);
      } finally {
        setIsQueueActive(false);
        setIsProgressModalOpen(false);
        dismissedReference.current = false;
        activeReference.current = false;
      }
    },
    [onProgress]
  );

  return {
    isQueueActive,
    progress,
    isProgressModalOpen,
    onDismissProgressModal,
    onCancelQueue,
    runQueuedBulkAction,
  };
}
