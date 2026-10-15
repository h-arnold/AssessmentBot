import type { ReactElement } from 'react';
import { vi } from 'vitest';
import type { BatchProgressSnapshot } from '../../features/classes/bulk/runQueuedBatchMutation';

export interface ClassesManagementPanelMocks {
  classesManagementStateMock: ReturnType<typeof vi.fn>;
  runQueuedBatchMutationMock: ReturnType<typeof vi.fn>;
  runQueuedBulkActionMock: ReturnType<typeof vi.fn>;
  queueStateMock: { isQueueActive: boolean; isProgressModalOpen: boolean };
  bulkCreateModalMock: ReturnType<typeof vi.fn>;
}

/**
 * Creates isolated module mocks for one ClassesManagementPanel spec.
 * @returns {ReturnType<typeof createClassesManagementPanelMocks>} Fresh mocks and their local module mock shapes.
 */
export function createClassesManagementPanelMocks() {
  const mocks: ClassesManagementPanelMocks = {
    classesManagementStateMock: vi.fn(),
    runQueuedBatchMutationMock: vi.fn(),
    runQueuedBulkActionMock: vi.fn(),
    queueStateMock: { isQueueActive: false, isProgressModalOpen: false },
    bulkCreateModalMock: vi.fn((properties: {
      open: boolean;
      onConfirm: (options: { cohortKey: string; yearGroupKey: string; courseLength?: number }) => Promise<void>;
    }) => {
      if (!properties.open) {
        return null;
      }

      return (
        <dialog open aria-label="Create ABClass">
          <button
            type="button"
            onClick={() => {
              void properties.onConfirm({
                cohortKey: 'cohort-2025',
                yearGroupKey: 'year-11',
                courseLength: 3,
              });
            }}
          >
            OK
          </button>
        </dialog>
      );
    }),
  };

  return {
    ...mocks,
    useClassesManagementModule: { useClassesManagement: mocks.classesManagementStateMock },
    batchMutationModule: { runQueuedBatchMutation: mocks.runQueuedBatchMutationMock },
    queueModule: {
      useClassesBulkMutationQueue: () => {
        return {
          get isQueueActive() { return mocks.queueStateMock.isQueueActive; },
          set isQueueActive(value: boolean) { mocks.queueStateMock.isQueueActive = value; },
          progress: { currentItem: null, completed: 0, pendingCount: 0, total: 0, isInProgress: false },
          get isProgressModalOpen() { return mocks.queueStateMock.isProgressModalOpen; },
          set isProgressModalOpen(value: boolean) { mocks.queueStateMock.isProgressModalOpen = value; },
          onDismissProgressModal: vi.fn(),
          onCancelQueue: vi.fn(),
          runQueuedBulkAction: mocks.runQueuedBulkActionMock,
        };
      },
    },
    progressModalModule: {
      ClassesBulkProgressModal(properties: Readonly<{
        open: boolean; progress: BatchProgressSnapshot; verb: string;
        onCancel: () => void; onDismiss: () => void;
      }>): ReactElement | null {
        return properties.open ? <dialog open aria-label="Bulk class update in progress">
          <span>{properties.progress.completed} / {properties.progress.total}</span>
          <span>{properties.verb} class {properties.progress.currentItem?.className ?? ''}</span>
        </dialog> : null;
      },
    },
    bulkCreateModule: { BulkCreateModal: mocks.bulkCreateModalMock },
    bulkDeleteModule: {
      BulkDeleteModal(properties: Readonly<{ open: boolean; onConfirm: () => void; onCancel: () => void; confirmLoading?: boolean }>): ReactElement | null {
        return properties.open ? <dialog open aria-label="Delete classes">
          <button type="button" onClick={properties.onConfirm}>Delete</button>
        </dialog> : null;
      },
    },
  };
}
