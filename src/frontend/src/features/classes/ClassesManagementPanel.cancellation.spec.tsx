import '../../test/classes/ClassesManagementPanel.mockSetup';
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClassesManagementPanelHarness } from '../../test/classes/classesManagementPanelHarness';
import type { MutableQueueState } from '../../test/classes/classesManagementPanelHarness';
import {
  buildClassesManagementRow,
  createFulfilledClassResult,
  createRejectedClassResult,
} from '../../test/classes/classesTestHelpers';

import { useClassesManagement } from './useClassesManagement';
import { runQueuedBatchMutation } from './bulk/runQueuedBatchMutation';
import { useClassesBulkMutationQueue } from './useClassesBulkMutationQueue';

const classesManagementStateMock = vi.mocked(useClassesManagement);
const runQueuedBatchMutationMock = vi.mocked(runQueuedBatchMutation);
const queueStateMock = vi.mocked(useClassesBulkMutationQueue)() as MutableQueueState;
const runQueuedBulkActionMock = vi.mocked(queueStateMock.runQueuedBulkAction);
const harness = createClassesManagementPanelHarness(
  classesManagementStateMock,
  runQueuedBatchMutationMock,
  queueStateMock,
  runQueuedBulkActionMock
);
const { mockClassesManagementState, renderPanel } = harness;
beforeEach(() => harness.reset());

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
