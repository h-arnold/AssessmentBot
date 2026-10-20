import '@/test/classes/ClassesManagementPanel.mockSetup';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClassesManagementPanelHarness } from '@/test/classes/classesManagementPanelHarness';
import type { MutableQueueState } from '@/test/classes/classesManagementPanelHarness';
import { createFulfilledClassResult } from '@/test/classes/classesTestHelpers';

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

describe('ClassesManagementPanel progress integration', () => {
  it('opens the progress modal and disables the toolbar when a queued bulk action runs', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      onSelectedRowKeysChange,
      selectedRowKeys: ['inactive-1', 'inactive-2'],
    });

    // Simulate queue active: mutate resolves slowly, exposing progress modal
    let resolveBatch!: (results: Array<ReturnType<typeof createFulfilledClassResult>>) => void;
    runQueuedBatchMutationMock.mockImplementationOnce(() => {
      const { promise, resolve } =
        Promise.withResolvers<Array<ReturnType<typeof createFulfilledClassResult>>>();
      resolveBatch = resolve;
      return promise;
    });

    await renderPanel();

    const setActiveButton = screen.getByRole('button', { name: 'Set active' });
    fireEvent.click(setActiveButton);

    // Progress modal should open and toolbar should be disabled
    await waitFor(() => {
      expect(
        screen.getByRole('dialog', { name: 'Bulk class update in progress' })
      ).toBeInTheDocument();
      expect(setActiveButton).toBeDisabled();
    });

    // Allow the progress modal to close by settling the mutation
    resolveBatch([
      createFulfilledClassResult('inactive-1'),
      createFulfilledClassResult('inactive-2'),
    ]);
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Bulk class update in progress' })
      ).not.toBeInTheDocument();
    });
  });

  it('closes the input modal before the progress modal opens for bulk create', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      cohorts: [
        { key: 'cohort-2025', name: 'Cohort 2025', active: true, startYear: 2025, startMonth: 9 },
      ],
      onSelectedRowKeysChange,
      selectedRowKeys: ['not-created-1'],
      yearGroups: [{ key: 'year-11', name: 'Year 11' }],
    });

    let resolveBatch!: (results: Array<ReturnType<typeof createFulfilledClassResult>>) => void;
    runQueuedBatchMutationMock.mockImplementationOnce(() => {
      const { promise, resolve } =
        Promise.withResolvers<Array<ReturnType<typeof createFulfilledClassResult>>>();
      resolveBatch = resolve;
      return promise;
    });

    await renderPanel();

    // Open the create modal
    fireEvent.click(screen.getByRole('button', { name: 'Create ABClass' }));
    expect(await screen.findByRole('dialog', { name: 'Create ABClass' })).toBeInTheDocument();

    // Confirm — this should close the input modal and open the progress modal
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      // Input modal should have closed
      expect(screen.queryByRole('dialog', { name: 'Create ABClass' })).not.toBeInTheDocument();
      // Progress modal should have opened
      expect(
        screen.getByRole('dialog', { name: 'Bulk class update in progress' })
      ).toBeInTheDocument();
    });

    resolveBatch([createFulfilledClassResult('not-created-1')]);
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Bulk class update in progress' })
      ).not.toBeInTheDocument();
    });
  });
});
