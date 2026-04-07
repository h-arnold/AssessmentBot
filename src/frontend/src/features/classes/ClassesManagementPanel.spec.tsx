import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import {
  buildClassesManagementState,
  createFulfilledClassResult,
  createRejectedClassResult,
} from './classesTestHelpers';
import type { ClassesManagementRow } from './classesManagementViewModel';

const classesManagementStateMock = vi.fn();
const runBatchMutationMock = vi.fn();

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

vi.mock('./batchMutationEngine', async () => {
  const actual = await vi.importActual('./batchMutationEngine');

  return {
    ...actual,
    runBatchMutation: runBatchMutationMock,
  };
});

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

vi.mock('./BulkCreateModal', () => ({
  BulkCreateModal: bulkCreateModalMock,
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
  classesManagementStateMock.mockReset();
  runBatchMutationMock.mockReset();
});

describe('ClassesManagementPanel', () => {
  it('renders a loading feature state shell while classes data resolves', async () => {
    mockClassesManagementState({ classesManagementViewState: 'loading', classesCount: null, rows: [] });

    await renderPanel();

    expect(screen.getByText('Classes feature is loading.')).toBeInTheDocument();
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

  it('shows a top-level warning and keeps failed rows selected when bulk delete partially fails', async () => {
    const onSelectedRowKeysChange = vi.fn();
    mockClassesManagementState({
      onSelectedRowKeysChange,
      selectedRowKeys: ['active-1', 'orphaned-1'],
    });
    runBatchMutationMock.mockResolvedValue([
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
    runBatchMutationMock.mockResolvedValue([
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
    runBatchMutationMock.mockResolvedValue([createFulfilledClassResult('not-created-1')]);

    const { queryClient } = await renderPanel();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Create ABClass' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Create ABClass' })).getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(runBatchMutationMock).toHaveBeenCalledTimes(1));
    const submittedRows = runBatchMutationMock.mock.calls[0][0] as ClassesManagementRow[];
    expect(submittedRows).toHaveLength(1);
    expect(submittedRows[0]?.classId).toBe('not-created-1');
    expect(submittedRows[0]?.status).toBe('notCreated');
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
    runBatchMutationMock.mockImplementationOnce(
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
    runBatchMutationMock.mockResolvedValue([
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
    runBatchMutationMock.mockResolvedValue([
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
});
