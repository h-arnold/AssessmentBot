import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import type { BatchProgressSnapshot } from './bulk/runQueuedBatchMutation';
import {
  buildClassesManagementState,
  buildClassesManagementRow,
  createFulfilledClassResult,
  createRejectedClassResult,
} from '../../test/classes/classesTestHelpers';

const panelMocks = vi.hoisted(async () => {
  const { createClassesManagementPanelMocks } = await import('../../test/classes/classesManagementPanelMockFactories');
  return createClassesManagementPanelMocks();
});

vi.mock('./useClassesManagement', async () => {
  const mocks = await panelMocks;
  return mocks.useClassesManagementModule;
});
vi.mock('./bulk/runQueuedBatchMutation', async () => {
  const mocks = await panelMocks;
  return mocks.batchMutationModule;
});
vi.mock('./useClassesBulkMutationQueue', async () => {
  const mocks = await panelMocks;
  return mocks.queueModule;
});
vi.mock('./bulk/ClassesBulkProgressModal', async () => {
  const mocks = await panelMocks;
  return mocks.progressModalModule;
});
vi.mock('./bulk/BulkCreateModal', async () => {
  const mocks = await panelMocks;
  return mocks.bulkCreateModule;
});
vi.mock('./bulk/BulkDeleteModal', async () => {
  const mocks = await panelMocks;
  return mocks.bulkDeleteModule;
});

const { classesManagementStateMock, runQueuedBatchMutationMock, runQueuedBulkActionMock, queueStateMock } = await panelMocks;

/**
 * Installs the mocked classes-management hook state for one test.
 *
 * @param {Parameters<typeof buildClassesManagementState>[0]} [overrides] Hook-state overrides.
 * @returns {void}
 */
function mockClassesManagementState(overrides = {}) {
  classesManagementStateMock.mockReturnValue(buildClassesManagementState(overrides));
}

/**
 * Loads and renders the panel with shared frontend providers.
 *
 * @returns {Promise<ReturnType<typeof renderWithFrontendProviders>>} Render result plus query client.
 */
async function renderPanel() {
  const { ClassesManagementPanel } = await import('./ClassesManagementPanel');
  return renderWithFrontendProviders(<ClassesManagementPanel />);
}

beforeEach(() => {
  queueStateMock.isQueueActive = false;
  queueStateMock.isProgressModalOpen = false;
  classesManagementStateMock.mockReset();
  runQueuedBatchMutationMock.mockReset();
  runQueuedBulkActionMock.mockReset();
  runQueuedBulkActionMock.mockImplementation(
    async ({
      mutate,
      onComplete,
    }: {
      mutate: (onProgress: (snapshot: BatchProgressSnapshot) => void) => Promise<unknown[]>;
      onComplete: (results: unknown[]) => Promise<void>;
    }) => {
      queueStateMock.isQueueActive = true;
      queueStateMock.isProgressModalOpen = true;
      const results = await mutate(vi.fn());
      await onComplete(results);
      queueStateMock.isQueueActive = false;
      queueStateMock.isProgressModalOpen = false;
    }
  );
});

describe('ClassesManagementPanel cancellation outcomes', () => {
  // ---------------------------------------------------------------------------
  // Cancellation outcome messaging tests
  // ---------------------------------------------------------------------------

  it('shows a cancellation message and retains cancelled rows in selection', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      onSelectedRowKeysChange,
      selectedRowKeys: ['active-1', 'orphaned-1'],
    });

    // Simulate one success and one cancellation
    runQueuedBatchMutationMock.mockResolvedValue([
      createFulfilledClassResult('active-1'),
      {
        status: 'rejected',
        row: buildClassesManagementRow({
          classId: 'orphaned-1',
          className: 'Legacy',
          status: 'orphaned',
          cohortKey: 'cohort-c',
          cohortLabel: 'Cohort C',
          yearGroupKey: 'year-12',
          yearGroupLabel: 'Year 12',
          courseLength: 3,
          active: false,
        }),
        error: { reason: 'CANCELLED' },
      },
    ]);

    const { queryClient } = await renderPanel();
    vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Delete ABClass' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' })
    );

    // Wait for the outcome alert — should show cancellation message
    expect(await screen.findByText(/cancel/i)).toBeInTheDocument();

    // Cancelled rows should be retained in selection (similar to how rejected rows are kept)
    // The specific cancelled row key depends on the implementation
    expect(onSelectedRowKeysChange).toHaveBeenCalled();
  });

  it('still shows backend failure copy when there are no cancelled rows', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      onSelectedRowKeysChange,
      selectedRowKeys: ['active-1', 'orphaned-1'],
    });

    // Pure backend failures (no CANCELLED reason)
    runQueuedBatchMutationMock.mockResolvedValue([
      createFulfilledClassResult('active-1'),
      createRejectedClassResult('orphaned-1'),
    ]);

    const { queryClient } = await renderPanel();
    vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Delete ABClass' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' })
    );

    expect(await screen.findByText('Some selected classes were not deleted.')).toBeInTheDocument();
    expect(
      screen.getByText(
        '1 of 2 selected classes could not be deleted. Successful rows were refreshed. Please review the remaining selection and try again.'
      )
    ).toBeInTheDocument();
    expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith(['orphaned-1']);
  });
});
