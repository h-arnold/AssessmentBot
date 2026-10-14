import { vi } from 'vitest';
import { renderWithFrontendProviders } from '../renderWithFrontendProviders';
import type { useClassesBulkMutationQueue } from '../../features/classes/useClassesBulkMutationQueue';
import { buildClassesManagementState } from './classesTestHelpers';

type QueueState = ReturnType<typeof useClassesBulkMutationQueue>;
export type MutableQueueState = { -readonly [Key in keyof QueueState]: QueueState[Key] };
type ResettableMock = { mockReset: () => unknown };
type StateMock = ResettableMock & {
  mockReturnValue: (value: ReturnType<typeof buildClassesManagementState>) => unknown;
};
type QueueActionMock = ResettableMock & {
  mockImplementation: (
    implementation: (options: Parameters<QueueState['runQueuedBulkAction']>[0]) => Promise<void>
  ) => unknown;
};

/**
 * Installs shared mock controls for one ClassesManagementPanel spec.
 * @param {StateMock} classesManagementStateMock Mock for the classes-management hook.
 * @param {ResettableMock} runQueuedBatchMutationMock Mock for batch mutations.
 * @param {MutableQueueState} queueStateMock Mutable queue state exposed by the mock hook.
 * @param {QueueActionMock} runQueuedBulkActionMock Mock for queued bulk actions.
 * @returns {{ mockClassesManagementState: Function, renderPanel: Function, reset: Function }} Panel helpers.
 */
export function createClassesManagementPanelHarness(
  classesManagementStateMock: StateMock,
  runQueuedBatchMutationMock: ResettableMock,
  queueStateMock: MutableQueueState,
  runQueuedBulkActionMock: QueueActionMock
) {
  return {
    mockClassesManagementState(overrides = {}) {
      classesManagementStateMock.mockReturnValue(buildClassesManagementState(overrides));
    },
    async renderPanel() {
      const { ClassesManagementPanel } =
        await import('../../features/classes/ClassesManagementPanel');
      return renderWithFrontendProviders(<ClassesManagementPanel />);
    },
    reset() {
      queueStateMock.isQueueActive = false;
      queueStateMock.isProgressModalOpen = false;
      classesManagementStateMock.mockReset();
      runQueuedBatchMutationMock.mockReset();
      runQueuedBulkActionMock.mockReset();
      runQueuedBulkActionMock.mockImplementation(async ({ mutate, onComplete }) => {
        queueStateMock.isQueueActive = true;
        queueStateMock.isProgressModalOpen = true;
        const results = await mutate(vi.fn());
        await onComplete(results);
        queueStateMock.isQueueActive = false;
        queueStateMock.isProgressModalOpen = false;
      });
    },
  };
}
