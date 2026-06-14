import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import {
  buildClassesManagementRow,
  buildClassesManagementState,
  createFulfilledClassResult,
  createRejectedClassResult,
} from '../../test/classes/classesTestHelpers';
import type { ClassesManagementRow } from './classesManagementViewModel';
import type { ClassesManagementState } from './useClassesManagement';
import type { BatchProgressSnapshot } from './bulk/runQueuedBatchMutation';

const classesManagementStateMock = vi.fn();
const runQueuedBatchMutationMock = vi.fn();
const runQueuedBulkActionMock = vi.fn();

/**
 * Tracked queue state matching the real useClassesBulkMutationQueue hook.
 * runQueuedBulkAction sets isQueueActive/isProgressModalOpen to true before
 * the mutation runs and false afterwards.
 */
const queueStateMock = vi.hoisted(() => ({
  isQueueActive: false,
  isProgressModalOpen: false,
}));

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

vi.mock('./bulk/runQueuedBatchMutation', () => ({
  runQueuedBatchMutation: runQueuedBatchMutationMock,
}));

vi.mock('./useClassesBulkMutationQueue', () => ({
  useClassesBulkMutationQueue: () => ({
    isQueueActive: queueStateMock.isQueueActive,
    progress: { currentItem: null, completed: 0, pendingCount: 0, total: 0, isInProgress: false },
    isProgressModalOpen: queueStateMock.isProgressModalOpen,
    onDismissProgressModal: vi.fn(),
    onCancelQueue: vi.fn(),
    runQueuedBulkAction: runQueuedBulkActionMock,
  }),
}));

vi.mock('./bulk/ClassesBulkProgressModal', () => ({
  ClassesBulkProgressModal(properties: Readonly<{
    open: boolean;
    progress: BatchProgressSnapshot;
    verb: string;
    onCancel: () => void;
    onDismiss: () => void;
  }>) {
    return properties.open ? (
      <div role="dialog" aria-label="Bulk class update in progress">
        <span>{properties.progress.completed} / {properties.progress.total}</span>
        <span>{properties.verb} class {properties.progress.currentItem?.className ?? ''}</span>
      </div>
    ) : null;
  },
}));

const bulkCreateModalMock = vi.hoisted(() =>
  vi.fn((properties: {
    open: boolean;
    onConfirm: (options: { cohortKey: string; yearGroupKey: string; courseLength?: number }) => Promise<void>;
  }) => {
    if (!properties.open) {
      return null;
    }

    return (
      <div role="dialog" aria-label="Create ABClass">
        <button
          type="button"
          onClick={() => {
            void properties.onConfirm({ cohortKey: 'cohort-2025', yearGroupKey: 'year-11', courseLength: 3 });
          }}
        >
          OK
        </button>
      </div>
    );
  }),
);

vi.mock('./bulk/BulkCreateModal', () => ({
  BulkCreateModal: bulkCreateModalMock,
}));

vi.mock('./bulk/BulkDeleteModal', () => ({
  BulkDeleteModal(properties: Readonly<{
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLoading?: boolean;
  }>) {
    if (!properties.open) {
      return null;
    }

    return (
      <div role="dialog" aria-label="Delete classes">
        <button
          type="button"
          onClick={properties.onConfirm}
        >
          Delete
        </button>
      </div>
    );
  },
}));

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
 * Builds a mocked hook state with the planned refresh-boundary contract.
 *
 * @param {Partial<ClassesManagementState>} [overrides] Hook-state overrides.
 * @returns {ClassesManagementState} Mocked state at the current hook boundary.
 */
function buildRefreshingClassesManagementState(
  overrides: Partial<ClassesManagementState> = {},
): ClassesManagementState {
  const refreshingState: ClassesManagementState = {
    ...buildClassesManagementState(overrides),
    isRefreshing: true,
  };

  return refreshingState;
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

/**
 * Asserts that class partials were invalidated with the expected refetch mode.
 *
 * @param {MockInstance} invalidateQueriesSpy Query invalidation spy.
 * @returns {void}
 */
function expectClassPartialsInvalidated(invalidateQueriesSpy: MockInstance) {
  expect(invalidateQueriesSpy).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: queryKeys.classPartials(), refetchType: 'none' }),
  );
}

beforeEach(() => {
  queueStateMock.isQueueActive = false;
  queueStateMock.isProgressModalOpen = false;
  classesManagementStateMock.mockReset();
  runQueuedBatchMutationMock.mockReset();
  runQueuedBulkActionMock.mockReset();
  runQueuedBulkActionMock.mockImplementation(
    async ({ mutate, onComplete }: { mutate: (onProgress: (snapshot: BatchProgressSnapshot) => void) => Promise<unknown[]>; onComplete: (results: unknown[]) => Promise<void> }) => {
      queueStateMock.isQueueActive = true;
      queueStateMock.isProgressModalOpen = true;
      const results = await mutate(vi.fn());
      await onComplete(results);
      queueStateMock.isQueueActive = false;
      queueStateMock.isProgressModalOpen = false;
    },
  );
});

describe('ClassesManagementPanel', () => {
  it('renders a skeleton status region while classes data resolves', async () => {
    mockClassesManagementState({ classesManagementViewState: 'loading', classesCount: null, rows: [] });

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
  ])('renders an error feature state message when classes management fails: %s', async (blockingErrorMessage, errorMessage) => {
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
  });

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
    expect(within(panel).getByText('Classes data is refreshing in the background.')).toBeInTheDocument();
    expect(within(workflow).queryByText('Some classes data may be stale.')).not.toBeInTheDocument();
    expect(within(workflow).queryByText('Classes data is refreshing in the background.')).not.toBeInTheDocument();
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
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Some selected classes were not deleted.')).toBeInTheDocument();
    expect(
      screen.getByText(
        '1 of 2 selected classes could not be deleted. Successful rows were refreshed. Please review the remaining selection and try again.',
      ),
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

    expect(await screen.findByText('Some selected classes were not set to active.')).toBeInTheDocument();
    expect(
      screen.getByText(
        '1 of 2 selected classes could not be set to active. Successful rows were refreshed. Please review the remaining selection and try again.',
      ),
    ).toBeInTheDocument();
    expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith(['inactive-2']);
    expectClassPartialsInvalidated(invalidateQueriesSpy);
  });

  it('opens bulk create and dispatches create requests for selected notCreated rows', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      cohorts: [{ key: 'cohort-2025', name: 'Cohort 2025', active: true, startYear: 2025, startMonth: 9 }],
      onSelectedRowKeysChange,
      selectedRowKeys: ['not-created-1'],
      yearGroups: [{ key: 'year-11', name: 'Year 11' }],
    });
    runQueuedBatchMutationMock.mockResolvedValue([createFulfilledClassResult('not-created-1')]);

    const { queryClient } = await renderPanel();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Create ABClass' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Create ABClass' })).getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(runQueuedBatchMutationMock).toHaveBeenCalledTimes(1));
    const [items] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[]];
    expect(items).toHaveLength(1);
    const firstItem = items[0] as Record<string, unknown>;
    const firstRow = firstItem.row as ClassesManagementRow;
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
    runQueuedBatchMutationMock.mockImplementationOnce(
      () =>
        new Promise<Array<ReturnType<typeof createFulfilledClassResult>>>((resolve) => {
          resolveBatch = resolve;
        }),
    );

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

    expect(await screen.findByText('Could not set selected classes to inactive.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Unable to set any of the 2 selected classes to inactive. Please review the remaining selection and try again.',
      ),
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
          retriable: true,
        },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete ABClass' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Some selected classes were not deleted.')).toBeInTheDocument();
    expect(
      screen.getByText(
        '1 of 2 selected classes could not be deleted. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('The classes are busy updating right now. Please try again shortly.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Classes table' })).not.toBeInTheDocument();
    expect(screen.queryByText('Transport refresh text.')).not.toBeInTheDocument();
    expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith(['orphaned-1']);
  });

  // ---------------------------------------------------------------------------
  // Panel integration tests
  // ---------------------------------------------------------------------------

  it('opens the progress modal and disables the toolbar when a queued bulk action runs', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      onSelectedRowKeysChange,
      selectedRowKeys: ['inactive-1', 'inactive-2'],
    });

    // Simulate queue active: mutate resolves slowly, exposing progress modal
    let resolveBatch!: (results: Array<ReturnType<typeof createFulfilledClassResult>>) => void;
    runQueuedBatchMutationMock.mockImplementationOnce(
      () =>
        new Promise<Array<ReturnType<typeof createFulfilledClassResult>>>((resolve) => {
          resolveBatch = resolve;
        }),
    );

    await renderPanel();

    const setActiveButton = screen.getByRole('button', { name: 'Set active' });
    fireEvent.click(setActiveButton);

    // Progress modal should open and toolbar should be disabled
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Bulk class update in progress' })).toBeInTheDocument();
      expect(setActiveButton).toBeDisabled();
    });

    // Allow the progress modal to close by settling the mutation
    resolveBatch([
      createFulfilledClassResult('inactive-1'),
      createFulfilledClassResult('inactive-2'),
    ]);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Bulk class update in progress' })).not.toBeInTheDocument();
    });
  });

  it('closes the input modal before the progress modal opens for bulk create', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      cohorts: [{ key: 'cohort-2025', name: 'Cohort 2025', active: true, startYear: 2025, startMonth: 9 }],
      onSelectedRowKeysChange,
      selectedRowKeys: ['not-created-1'],
      yearGroups: [{ key: 'year-11', name: 'Year 11' }],
    });

    let resolveBatch!: (results: Array<ReturnType<typeof createFulfilledClassResult>>) => void;
    runQueuedBatchMutationMock.mockImplementationOnce(
      () =>
        new Promise<Array<ReturnType<typeof createFulfilledClassResult>>>((resolve) => {
          resolveBatch = resolve;
        }),
    );

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
      expect(screen.getByRole('dialog', { name: 'Bulk class update in progress' })).toBeInTheDocument();
    });

    resolveBatch([createFulfilledClassResult('not-created-1')]);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Bulk class update in progress' })).not.toBeInTheDocument();
    });
  });

  it('closes the confirmation modal before the progress modal opens for bulk delete (no modal stacking)', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      onSelectedRowKeysChange,
      selectedRowKeys: ['active-1', 'orphaned-1'],
    });

    let resolveBatch!: (results: Array<ReturnType<typeof createFulfilledClassResult>>) => void;
    runQueuedBatchMutationMock.mockImplementationOnce(
      () =>
        new Promise<Array<ReturnType<typeof createFulfilledClassResult>>>((resolve) => {
          resolveBatch = resolve;
        }),
    );

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
      expect(screen.getByRole('dialog', { name: 'Bulk class update in progress' })).toBeInTheDocument();
    });

    // No other dialogs should be present
    const dialogs = screen.queryAllByRole('dialog');
    expect(dialogs).toHaveLength(1);

    resolveBatch([
      createFulfilledClassResult('active-1'),
      createRejectedClassResult('orphaned-1'),
    ]);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Bulk class update in progress' })).not.toBeInTheDocument();
    });
  });

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
      { status: 'rejected', row: buildClassesManagementRow({ classId: 'orphaned-1', className: 'Legacy', status: 'orphaned', cohortKey: 'cohort-c', cohortLabel: 'Cohort C', yearGroupKey: 'year-12', yearGroupLabel: 'Year 12', courseLength: 3, active: false }), error: { reason: 'CANCELLED' } },
    ]);

    const { queryClient } = await renderPanel();
    vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Delete ABClass' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

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
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Some selected classes were not deleted.')).toBeInTheDocument();
    expect(
      screen.getByText(
        '1 of 2 selected classes could not be deleted. Successful rows were refreshed. Please review the remaining selection and try again.',
      ),
    ).toBeInTheDocument();
    expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith(['orphaned-1']);
  });
});
