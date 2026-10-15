import '../../test/classes/ClassesManagementPanel.mockSetup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { queryKeys } from '../../query/queryKeys';
import { createClassesManagementPanelHarness } from '../../test/classes/classesManagementPanelHarness';
import type { MutableQueueState } from '../../test/classes/classesManagementPanelHarness';
import {
  buildClassesManagementState,
  createFulfilledClassResult,
  createRejectedClassResult,
} from '../../test/classes/classesTestHelpers';
import type { ClassesManagementState } from './useClassesManagement';
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

/**
 * Builds a mocked hook state with the planned refresh-boundary contract.
 *
 * @param {Partial<ClassesManagementState>} [overrides] Hook-state overrides.
 * @returns {ClassesManagementState} Mocked state at the current hook boundary.
 */
function buildRefreshingClassesManagementState(
  overrides: Partial<ClassesManagementState> = {}
): ClassesManagementState {
  const refreshingState: ClassesManagementState = {
    ...buildClassesManagementState(overrides),
    isRefreshing: true,
  };

  return refreshingState;
}

/**
 * Asserts that class partials were invalidated with the expected refetch mode.
 *
 * @param {MockInstance} invalidateQueriesSpy Query invalidation spy.
 * @returns {void}
 */
function expectClassPartialsInvalidated(invalidateQueriesSpy: MockInstance) {
  expect(invalidateQueriesSpy).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: queryKeys.classPartials(), refetchType: 'none' })
  );
}

beforeEach(() => harness.reset());

describe('ClassesManagementPanel', () => {
  it('renders a skeleton status region while classes data resolves', async () => {
    mockClassesManagementState({
      classesManagementViewState: 'loading',
      classesCount: null,
      rows: [],
    });

    await renderPanel();
    const panel = screen.getByRole('region', { name: 'Classes management panel' });

    expect(within(panel).getByRole('status', { name: 'Loading classes' })).toBeInTheDocument();
    expect(panel.querySelector('.ant-skeleton')).not.toBeNull();
    expect(within(panel).queryByText('Classes feature is loading.')).not.toBeInTheDocument();
    expect(within(panel).queryByText('Summary')).not.toBeInTheDocument();
    expect(within(panel).queryByText('Selected rows: 0')).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Create ABClass' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('table')).not.toBeInTheDocument();
  });

  it.each([
    ['Classes failed to load.', 'Classes failed to load.'],
    ['Unable to load active Google Classrooms right now.', 'Unable to load classes right now.'],
  ])(
    'renders an error feature state message when classes management fails: %s',
    async (blockingErrorMessage, errorMessage) => {
      mockClassesManagementState({
        blockingErrorMessage,
        classesManagementViewState: 'error',
        classesCount: null,
        errorMessage,
        rows: [],
      });

      await renderPanel();

      expect(screen.getByText('Classes feature is unavailable.')).toBeInTheDocument();
      expect(screen.getAllByText(blockingErrorMessage)).toHaveLength(1);
    }
  );

  it('renders a ready feature state summary once classes are available', async () => {
    mockClassesManagementState();

    await renderPanel();

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Selected rows: 0')).toBeInTheDocument();
  });

  it('keeps only the classes data workflow busy during background refresh while alerts stay in the outer panel chrome', async () => {
    classesManagementStateMock.mockReturnValue(
      buildRefreshingClassesManagementState({
        nonBlockingWarningMessage: 'Classes data is refreshing in the background.',
      })
    );

    await renderPanel();

    const panel = screen.getByRole('region', { name: 'Classes management panel' });
    const workflow = within(panel).getByRole('region', { name: 'Classes data workflow' });

    expect(panel).toContainElement(workflow);
    expect(workflow).not.toBe(panel);
    expect(workflow).toHaveAttribute('aria-busy', 'true');
    expect(panel).not.toHaveAttribute('aria-busy', 'true');
    expect(within(panel).getByText('Some classes data may be stale.')).toBeInTheDocument();
    expect(
      within(panel).getByText('Classes data is refreshing in the background.')
    ).toBeInTheDocument();
    expect(within(workflow).queryByText('Some classes data may be stale.')).not.toBeInTheDocument();
    expect(
      within(workflow).queryByText('Classes data is refreshing in the background.')
    ).not.toBeInTheDocument();
    expect(within(workflow).getByText('Summary')).toBeInTheDocument();
    expect(within(workflow).getByRole('button', { name: 'Create ABClass' })).toBeInTheDocument();
    expect(within(workflow).getByRole('table', { name: 'Classes table' })).toBeInTheDocument();
  });

  it('shows a top-level warning and keeps failed rows selected when bulk delete partially fails', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      onSelectedRowKeysChange,
      selectedRowKeys: ['active-1', 'orphaned-1'],
    });
    runQueuedBatchMutationMock.mockResolvedValue([
      createFulfilledClassResult('active-1'),
      createRejectedClassResult('orphaned-1'),
    ]);

    const { queryClient } = await renderPanel();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

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
    expectClassPartialsInvalidated(invalidateQueriesSpy);
  });

  it('shows a top-level warning and keeps failed rows selected when setting active partially fails', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      onSelectedRowKeysChange,
      selectedRowKeys: ['inactive-1', 'inactive-2'],
    });
    runQueuedBatchMutationMock.mockResolvedValue([
      createFulfilledClassResult('inactive-1'),
      createRejectedClassResult('inactive-2'),
    ]);

    const { queryClient } = await renderPanel();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Set active' }));

    expect(
      await screen.findByText('Some selected classes were not set to active.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '1 of 2 selected classes could not be set to active. Successful rows were refreshed. Please review the remaining selection and try again.'
      )
    ).toBeInTheDocument();
    expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith(['inactive-2']);
    expectClassPartialsInvalidated(invalidateQueriesSpy);
  });

  it('opens bulk create and dispatches create requests for selected notCreated rows', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      cohorts: [
        { key: 'cohort-2025', name: 'Cohort 2025', active: true, startYear: 2025, startMonth: 9 },
      ],
      onSelectedRowKeysChange,
      selectedRowKeys: ['not-created-1'],
      yearGroups: [{ key: 'year-11', name: 'Year 11' }],
    });
    runQueuedBatchMutationMock.mockResolvedValue([createFulfilledClassResult('not-created-1')]);

    const { queryClient } = await renderPanel();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Create ABClass' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Create ABClass' })).getByRole('button', {
        name: 'OK',
      })
    );

    await waitFor(() => expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1));
    const [items] = runQueuedBatchMutationMock.mock.calls[0];
    expect(items).toHaveLength(1);
    const firstItem = items[0];
    const firstRow = firstItem.row;
    expect(firstRow.classId).toBe('not-created-1');
    expect(firstRow.status).toBe('notCreated');
    expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith([]);
    expectClassPartialsInvalidated(invalidateQueriesSpy);
  });

  it('disables set-active while its batch mutation is in flight', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      onSelectedRowKeysChange,
      selectedRowKeys: ['inactive-1'],
    });

    let resolveBatch!: (results: Array<ReturnType<typeof createFulfilledClassResult>>) => void;
    runQueuedBatchMutationMock.mockImplementationOnce(() => {
      const { promise, resolve } =
        Promise.withResolvers<Array<ReturnType<typeof createFulfilledClassResult>>>();
      resolveBatch = resolve;
      return promise;
    });

    await renderPanel();

    const setActiveButton = screen.getByRole('button', { name: 'Set active' });
    expect(setActiveButton).toBeEnabled();

    fireEvent.click(setActiveButton);
    await waitFor(() => expect(setActiveButton).toBeDisabled());

    resolveBatch([createFulfilledClassResult('inactive-1')]);
    await waitFor(() => expect(onSelectedRowKeysChange).toHaveBeenCalledWith([]));
  });

  it('shows a top-level error and keeps failed rows selected when setting inactive fully fails', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      onSelectedRowKeysChange,
      selectedRowKeys: ['active-1', 'active-2'],
    });
    runQueuedBatchMutationMock.mockResolvedValue([
      createRejectedClassResult('active-1'),
      createRejectedClassResult('active-2'),
    ]);

    const { queryClient } = await renderPanel();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Set inactive' }));

    expect(
      await screen.findByText('Could not set selected classes to inactive.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Unable to set any of the 2 selected classes to inactive. Please review the remaining selection and try again.'
      )
    ).toBeInTheDocument();
    expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith(['active-1', 'active-2']);
    expectClassPartialsInvalidated(invalidateQueriesSpy);
  });

  it('shows refresh-failure-specific guidance and hides stale rows when a partial delete refresh fails', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      onSelectedRowKeysChange,
      selectedRowKeys: ['active-1', 'orphaned-1'],
    });
    runQueuedBatchMutationMock.mockResolvedValue([
      createFulfilledClassResult('active-1'),
      createRejectedClassResult('orphaned-1'),
    ]);

    const { queryClient } = await renderPanel();
    vi.spyOn(queryClient, 'refetchQueries').mockRejectedValueOnce(
      new ApiTransportError({
        requestId: 'request-refresh',
        error: {
          code: 'RATE_LIMITED',
          message: 'Transport refresh text.',
          isRetriable: true,
        },
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete ABClass' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' })
    );

    expect(await screen.findByText('Some selected classes were not deleted.')).toBeInTheDocument();
    expect(
      screen.getByText(
        '1 of 2 selected classes could not be deleted. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('The classes are busy updating right now. Please try again shortly.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Classes table' })).not.toBeInTheDocument();
    expect(screen.queryByText('Transport refresh text.')).not.toBeInTheDocument();
    expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith(['orphaned-1']);
  });

  // ---------------------------------------------------------------------------
  // Panel integration tests
  // ---------------------------------------------------------------------------

  it('closes the confirmation modal before the progress modal opens for bulk delete (no modal stacking)', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      onSelectedRowKeysChange,
      selectedRowKeys: ['active-1', 'orphaned-1'],
    });

    let resolveBatch!: (results: Array<ReturnType<typeof createFulfilledClassResult>>) => void;
    runQueuedBatchMutationMock.mockImplementationOnce(() => {
      const { promise, resolve } =
        Promise.withResolvers<Array<ReturnType<typeof createFulfilledClassResult>>>();
      resolveBatch = resolve;
      return promise;
    });

    await renderPanel();

    // Open the delete modal
    fireEvent.click(screen.getByRole('button', { name: 'Delete ABClass' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Confirm — should close delete modal and open progress modal
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      // Confirmation modal should have closed
      expect(screen.queryByRole('dialog', { name: /delete/i })).not.toBeInTheDocument();
      // Progress modal should be the only modal
      expect(
        screen.getByRole('dialog', { name: 'Bulk class update in progress' })
      ).toBeInTheDocument();
    });

    // No other dialogs should be present
    const dialogs = screen.queryAllByRole('dialog');
    expect(dialogs).toHaveLength(1);

    resolveBatch([createFulfilledClassResult('active-1'), createRejectedClassResult('orphaned-1')]);
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Bulk class update in progress' })
      ).not.toBeInTheDocument();
    });
  });
});
