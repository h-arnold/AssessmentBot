import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BatchProgressSnapshot } from './bulk/runQueuedBatchMutation';
import type { RowMutationResult } from './bulk/batchMutationEngine';
import type { ClassesManagementRow } from './classesManagementViewModel';
import { useClassesBulkMutationQueue } from './useClassesBulkMutationQueue';

// ── Mocks ──────────────────────────────────────────────────────────────────

const { cancelApiQueuedMock } = vi.hoisted(() => ({
  cancelApiQueuedMock: vi.fn(),
}));

vi.mock('../../services/apiService', () => ({
  cancelApiQueued: cancelApiQueuedMock,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

const initialProgress: BatchProgressSnapshot = {
  currentItem: null,
  completed: 0,
  pendingCount: 0,
  total: 0,
  isInProgress: false,
};

/**
 * Creates a deferred promise and a function to resolve it.
 *
 * @returns {[Promise<RowMutationResult<ClassesManagementRow, unknown>[]>, (results: RowMutationResult<ClassesManagementRow, unknown>[]) => void]} A tuple of [promise, resolve].
 */
function createDeferredPromise(): [
  Promise<RowMutationResult<ClassesManagementRow, unknown>[]>,
  (results: RowMutationResult<ClassesManagementRow, unknown>[]) => void,
] {
  let resolve!: (results: RowMutationResult<ClassesManagementRow, unknown>[]) => void;
  const promise = new Promise<RowMutationResult<ClassesManagementRow, unknown>[]>(
    (resolveResults) => {
      resolve = resolveResults;
    }
  );
  return [promise, resolve];
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe('useClassesBulkMutationQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state: modal closed, queue inactive, zeroed progress', () => {
    const { result } = renderHook(() => useClassesBulkMutationQueue());

    expect(result.current.isProgressModalOpen).toBe(false);
    expect(result.current.isQueueActive).toBe(false);
    expect(result.current.progress).toEqual(initialProgress);
    expect(typeof result.current.onDismissProgressModal).toBe('function');
    expect(typeof result.current.onCancelQueue).toBe('function');
    expect(typeof result.current.runQueuedBulkAction).toBe('function');
  });

  it('opens the modal and publishes progress updates when an action runs', async () => {
    const [mutatePromise, resolveMutate] = createDeferredPromise();
    const progressSnapshot: BatchProgressSnapshot = {
      currentItem: { verb: 'Creating', className: 'Alpha' },
      completed: 0,
      pendingCount: 2,
      total: 3,
      isInProgress: true,
    };

    const mutate = vi.fn((onProgress: (snapshot: BatchProgressSnapshot) => void) => {
      onProgress(progressSnapshot);
      return mutatePromise;
    });
    const onComplete = vi.fn(async () => {});

    const { result } = renderHook(() => useClassesBulkMutationQueue());

    // Start the action (do not await — we need to inspect intermediate state)
    act(() => {
      result.current.runQueuedBulkAction({ mutate, onComplete });
    });

    // Modal should be open and progress published
    expect(result.current.isProgressModalOpen).toBe(true);
    expect(result.current.isQueueActive).toBe(true);
    expect(result.current.progress).toEqual(progressSnapshot);

    // Drain the queue to clean up
    await act(async () => {
      resolveMutate([]);
    });
  });

  it('closes the modal and sets isQueueActive to false when the queue drains', async () => {
    const [mutatePromise, resolveMutate] = createDeferredPromise();
    const mutate = vi.fn(() => mutatePromise);
    const onComplete = vi.fn(async () => {});

    const { result } = renderHook(() => useClassesBulkMutationQueue());

    // Start action
    act(() => {
      result.current.runQueuedBulkAction({ mutate, onComplete });
    });

    expect(result.current.isProgressModalOpen).toBe(true);
    expect(result.current.isQueueActive).toBe(true);

    // Drain the queue
    await act(async () => {
      resolveMutate([]);
    });

    await waitFor(() => {
      expect(result.current.isProgressModalOpen).toBe(false);
      expect(result.current.isQueueActive).toBe(false);
    });

    // onComplete should have been called with the results
    expect(onComplete).toHaveBeenCalledWith([]);
  });

  it('dismissing the modal hides it but keeps isQueueActive true until drain', async () => {
    const [mutatePromise, resolveMutate] = createDeferredPromise();
    const mutate = vi.fn(() => mutatePromise);
    const onComplete = vi.fn(async () => {});

    const { result } = renderHook(() => useClassesBulkMutationQueue());

    // Start action
    act(() => {
      result.current.runQueuedBulkAction({ mutate, onComplete });
    });

    expect(result.current.isProgressModalOpen).toBe(true);
    expect(result.current.isQueueActive).toBe(true);

    // Dismiss the modal
    act(() => {
      result.current.onDismissProgressModal();
    });

    expect(result.current.isProgressModalOpen).toBe(false);
    expect(result.current.isQueueActive).toBe(true);

    // Drain the queue
    await act(async () => {
      resolveMutate([]);
    });

    await waitFor(() => {
      expect(result.current.isQueueActive).toBe(false);
    });

    expect(result.current.isProgressModalOpen).toBe(false);
  });

  it('re-opens the modal when a new action starts after drain', async () => {
    const [mutatePromise1, resolveMutate1] = createDeferredPromise();
    const [mutatePromise2, resolveMutate2] = createDeferredPromise();

    const mutate1 = vi.fn(() => mutatePromise1);
    const mutate2 = vi.fn(() => mutatePromise2);
    const onComplete = vi.fn(async () => {});

    const { result } = renderHook(() => useClassesBulkMutationQueue());

    // First action
    act(() => {
      result.current.runQueuedBulkAction({ mutate: mutate1, onComplete });
    });

    expect(result.current.isProgressModalOpen).toBe(true);

    // Drain first action
    await act(async () => {
      resolveMutate1([]);
    });

    await waitFor(() => {
      expect(result.current.isProgressModalOpen).toBe(false);
    });

    // Second action
    act(() => {
      result.current.runQueuedBulkAction({ mutate: mutate2, onComplete });
    });

    expect(result.current.isProgressModalOpen).toBe(true);

    // Drain second action to clean up
    await act(async () => {
      resolveMutate2([]);
    });
  });

  it('calls cancelApiQueued with the correct job name', () => {
    const { result } = renderHook(() => useClassesBulkMutationQueue());

    result.current.onCancelQueue();

    expect(cancelApiQueuedMock).toHaveBeenCalledTimes(1);
    expect(cancelApiQueuedMock).toHaveBeenCalledWith('classesBulkMutation');
  });

  it('passes a progress callback to mutate and calling it updates hook state', async () => {
    let capturedOnProgress: ((snapshot: BatchProgressSnapshot) => void) | undefined;

    const mutate = vi.fn((onProgress: (snapshot: BatchProgressSnapshot) => void) => {
      capturedOnProgress = onProgress;
      return Promise.resolve([]);
    });
    const onComplete = vi.fn(async () => {});

    const { result } = renderHook(() => useClassesBulkMutationQueue());

    await act(async () => {
      await result.current.runQueuedBulkAction({ mutate, onComplete });
    });

    // Verify mutate received a function as its argument
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(typeof mutate.mock.calls[0][0]).toBe('function');
    expect(capturedOnProgress).toBeDefined();

    // Calling the progress callback should update hook state
    const updatedSnapshot: BatchProgressSnapshot = {
      currentItem: { verb: 'Creating', className: 'Beta' },
      completed: 1,
      pendingCount: 0,
      total: 1,
      isInProgress: false,
    };

    act(() => {
      capturedOnProgress!(updatedSnapshot);
    });

    expect(result.current.progress).toEqual(updatedSnapshot);
  });

  it('resets the dismissed flag after drain so a subsequent action re-opens the modal', async () => {
    const [mutatePromise1, resolveMutate1] = createDeferredPromise();
    const [mutatePromise2, resolveMutate2] = createDeferredPromise();

    const mutate1 = vi.fn(() => mutatePromise1);
    const mutate2 = vi.fn(() => mutatePromise2);
    const onComplete = vi.fn(async () => {});

    const { result } = renderHook(() => useClassesBulkMutationQueue());

    // Start first action
    act(() => {
      result.current.runQueuedBulkAction({ mutate: mutate1, onComplete });
    });

    expect(result.current.isProgressModalOpen).toBe(true);

    // Dismiss during first action
    act(() => {
      result.current.onDismissProgressModal();
    });

    expect(result.current.isProgressModalOpen).toBe(false);
    expect(result.current.isQueueActive).toBe(true);

    // Drain first action
    await act(async () => {
      resolveMutate1([]);
    });

    await waitFor(() => {
      expect(result.current.isQueueActive).toBe(false);
    });

    // Start second action — modal should re-open
    act(() => {
      result.current.runQueuedBulkAction({ mutate: mutate2, onComplete });
    });

    expect(result.current.isProgressModalOpen).toBe(true);

    // Clean up
    await act(async () => {
      resolveMutate2([]);
    });
  });
});
