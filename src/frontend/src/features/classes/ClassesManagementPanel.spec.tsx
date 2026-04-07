import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { queryKeys } from '../../query/queryKeys';
import type { RowMutationResult } from './batchMutationEngine';
import type { ClassesManagementRow } from './classesManagementViewModel';
import type { ClassesManagementState } from './useClassesManagement';

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

const readyRows = [
  {
    classId: 'active-1',
    className: 'Alpha',
    status: 'active',
    cohortKey: 'cohort-a',
    cohortLabel: 'Cohort A',
    courseLength: 2,
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    active: true,
  },
  {
    classId: 'active-2',
    className: 'Atlas',
    status: 'active',
    cohortKey: 'cohort-a',
    cohortLabel: 'Cohort A',
    courseLength: 2,
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    active: true,
  },
  {
    classId: 'inactive-1',
    className: 'Bravo',
    status: 'inactive',
    cohortKey: 'cohort-b',
    cohortLabel: 'Cohort B',
    courseLength: 1,
    yearGroupKey: 'year-9',
    yearGroupLabel: 'Year 9',
    active: false,
  },
  {
    classId: 'inactive-2',
    className: 'Beta',
    status: 'inactive',
    cohortKey: 'cohort-b',
    cohortLabel: 'Cohort B',
    courseLength: 1,
    yearGroupKey: 'year-9',
    yearGroupLabel: 'Year 9',
    active: false,
  },
  {
    classId: 'not-created-1',
    className: 'Charlie',
    status: 'notCreated',
    cohortKey: null,
    cohortLabel: null,
    courseLength: null,
    yearGroupKey: null,
    yearGroupLabel: null,
    active: null,
  },
  {
    classId: 'orphaned-1',
    className: 'Legacy',
    status: 'orphaned',
    cohortKey: 'cohort-c',
    cohortLabel: 'Cohort C',
    courseLength: 3,
    yearGroupKey: 'year-12',
    yearGroupLabel: 'Year 12',
    active: false,
  },
] as const;

/**
 * Renders a component wrapped in a fresh QueryClientProvider for tests that
 * need access to the React Query context.
 *
 * @param {React.ReactElement} ui The component to render.
 * @returns {{
 *   queryClient: QueryClient;
 * } & ReturnType<typeof render>} Testing Library render result plus query client.
 */
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

/**
 * Builds a ready-state classes-management response for the panel.
 *
 * @param {Partial<ClassesManagementState>} overrides Per-test overrides.
 * @returns {ClassesManagementState} Ready-state hook response.
 */
function buildReadyClassesManagementState(
  overrides: Partial<ClassesManagementState> = {},
): ClassesManagementState {
  return {
    blockingErrorMessage: null,
    classesManagementViewState: 'ready' as const,
    classesCount: readyRows.length,
    cohorts: [],
    errorMessage: null,
    nonBlockingWarningMessage: null,
    refreshRequiredMessage: null,
    rows: [...readyRows],
    selectedRowKeys: [],
    yearGroups: [],
    onSelectedRowKeysChange: vi.fn(),
    ...overrides,
  };
}

/**
 * Builds a fulfilled batch result for one test row.
 *
 * @param {string} classId Selected test row id.
 * @returns {RowMutationResult<ClassesManagementRow, unknown>} Fulfilled row result.
 */
function createFulfilledResult(classId: string): RowMutationResult<ClassesManagementRow, unknown> {
  const row = readyRows.find((candidate) => candidate.classId === classId);

  if (row === undefined) {
    throw new Error('Unknown test row: ' + classId);
  }

  return {
    status: 'fulfilled',
    row,
    data: undefined,
  };
}

/**
 * Builds a rejected batch result for one test row.
 *
 * @param {string} classId Selected test row id.
 * @returns {RowMutationResult<ClassesManagementRow, unknown>} Rejected row result.
 */
function createRejectedResult(classId: string): RowMutationResult<ClassesManagementRow, unknown> {
  const row = readyRows.find((candidate) => candidate.classId === classId);

  if (row === undefined) {
    throw new Error('Unknown test row: ' + classId);
  }

  return {
    status: 'rejected',
    row,
    error: new Error('Mutation failed for ' + classId),
  };
}

beforeEach(() => {
  classesManagementStateMock.mockReset();
  runBatchMutationMock.mockReset();
});

describe('ClassesManagementPanel', () => {
  it('renders a loading feature state shell while classes data resolves', async () => {
    classesManagementStateMock.mockReturnValue({
      blockingErrorMessage: null,
      classesManagementViewState: 'loading',
      classesCount: null,
      cohorts: [],
      errorMessage: null,
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: [],
      selectedRowKeys: [],
      yearGroups: [],
      onSelectedRowKeysChange: vi.fn(),
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    renderWithQueryClient(<ClassesManagementPanel />);

    expect(screen.getByText('Classes feature is loading.')).toBeInTheDocument();
  });

  it('renders an error feature state message when classes management fails', async () => {
    classesManagementStateMock.mockReturnValue({
      blockingErrorMessage: 'Classes failed to load.',
      classesManagementViewState: 'error',
      classesCount: null,
      cohorts: [],
      errorMessage: 'Classes failed to load.',
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: [],
      selectedRowKeys: [],
      yearGroups: [],
      onSelectedRowKeysChange: vi.fn(),
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    renderWithQueryClient(<ClassesManagementPanel />);

    expect(screen.getByText('Classes feature is unavailable.')).toBeInTheDocument();
    expect(screen.getAllByText('Classes failed to load.')).toHaveLength(1);
  });

  it('renders a ready feature state summary once classes are available', async () => {
    classesManagementStateMock.mockReturnValue(buildReadyClassesManagementState());

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    renderWithQueryClient(<ClassesManagementPanel />);

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Selected rows: 0')).toBeInTheDocument();
  });

  it('renders a blocking alert message for classes errors', async () => {
    classesManagementStateMock.mockReturnValue({
      blockingErrorMessage: 'Unable to load active Google Classrooms right now.',
      classesManagementViewState: 'error',
      classesCount: null,
      cohorts: [],
      errorMessage: 'Unable to load classes right now.',
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: [],
      selectedRowKeys: [],
      yearGroups: [],
      onSelectedRowKeysChange: vi.fn(),
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    renderWithQueryClient(<ClassesManagementPanel />);

    expect(screen.getByText('Classes feature is unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Unable to load active Google Classrooms right now.')).toBeInTheDocument();
  });

  it('shows a top-level warning and keeps failed rows selected when bulk delete partially fails', async () => {
    const onSelectedRowKeysChange = vi.fn();
    classesManagementStateMock.mockReturnValue(
      buildReadyClassesManagementState({
        selectedRowKeys: ['active-1', 'orphaned-1'],
        onSelectedRowKeysChange,
      }),
    );
    runBatchMutationMock.mockResolvedValue([
      createFulfilledResult('active-1'),
      createRejectedResult('orphaned-1'),
    ]);

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');
    const { queryClient } = renderWithQueryClient(<ClassesManagementPanel />);
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Delete ABClass' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText('Some selected classes were not deleted.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '1 of 2 selected classes could not be deleted. Successful rows were refreshed. Please review the remaining selection and try again.',
      ),
    ).toBeInTheDocument();
    expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith(['orphaned-1']);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.classPartials(), refetchType: 'none' }));
  });

  it('shows a top-level warning and keeps failed rows selected when setting active partially fails', async () => {
    const onSelectedRowKeysChange = vi.fn();
    classesManagementStateMock.mockReturnValue(
      buildReadyClassesManagementState({
        selectedRowKeys: ['inactive-1', 'inactive-2'],
        onSelectedRowKeysChange,
      }),
    );
    runBatchMutationMock.mockResolvedValue([
      createFulfilledResult('inactive-1'),
      createRejectedResult('inactive-2'),
    ]);

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');
    const { queryClient } = renderWithQueryClient(<ClassesManagementPanel />);
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Set active' }));

    expect(
      await screen.findByText('Some selected classes were not set to active.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '1 of 2 selected classes could not be set to active. Successful rows were refreshed. Please review the remaining selection and try again.',
      ),
    ).toBeInTheDocument();
    expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith(['inactive-2']);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.classPartials(), refetchType: 'none' }));
  });

  it('opens bulk create and dispatches create requests for selected notCreated rows', async () => {
    const onSelectedRowKeysChange = vi.fn();
    classesManagementStateMock.mockReturnValue(
      buildReadyClassesManagementState({
        cohorts: [
          { key: 'cohort-2025', name: 'Cohort 2025', active: true, startYear: 2025, startMonth: 9 },
        ],
        selectedRowKeys: ['not-created-1'],
        yearGroups: [{ key: 'year-11', name: 'Year 11' }],
        onSelectedRowKeysChange,
      }),
    );
    runBatchMutationMock.mockResolvedValue([createFulfilledResult('not-created-1')]);

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');
    const { queryClient } = renderWithQueryClient(<ClassesManagementPanel />);
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Create ABClass' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create ABClass' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(runBatchMutationMock).toHaveBeenCalledTimes(1));
    const submittedRows = runBatchMutationMock.mock.calls[0][0] as ClassesManagementRow[];
    expect(submittedRows).toHaveLength(1);
    expect(submittedRows[0]?.classId).toBe('not-created-1');
    expect(submittedRows[0]?.status).toBe('notCreated');
    expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith([]);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.classPartials(), refetchType: 'none' }));
  });

  it('disables set-active while its batch mutation is in flight', async () => {
    const onSelectedRowKeysChange = vi.fn();
    classesManagementStateMock.mockReturnValue(
      buildReadyClassesManagementState({
        selectedRowKeys: ['inactive-1'],
        onSelectedRowKeysChange,
      }),
    );

    let resolveBatch!: (results: RowMutationResult<ClassesManagementRow, unknown>[]) => void;
    runBatchMutationMock.mockImplementationOnce(
      () => new Promise<RowMutationResult<ClassesManagementRow, unknown>[]>((resolve) => {
        resolveBatch = resolve;
      }),
    );

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');
    renderWithQueryClient(<ClassesManagementPanel />);

    const setActiveButton = screen.getByRole('button', { name: 'Set active' });
    expect(setActiveButton).toBeEnabled();

    fireEvent.click(setActiveButton);
    await waitFor(() => expect(setActiveButton).toBeDisabled());

    resolveBatch([createFulfilledResult('inactive-1')]);
    await waitFor(() => expect(onSelectedRowKeysChange).toHaveBeenCalledWith([]));
  });

  it('shows a top-level error and keeps failed rows selected when setting inactive fully fails', async () => {
    const onSelectedRowKeysChange = vi.fn();
    classesManagementStateMock.mockReturnValue(
      buildReadyClassesManagementState({
        selectedRowKeys: ['active-1', 'active-2'],
        onSelectedRowKeysChange,
      }),
    );
    runBatchMutationMock.mockResolvedValue([
      createRejectedResult('active-1'),
      createRejectedResult('active-2'),
    ]);

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');
    const { queryClient } = renderWithQueryClient(<ClassesManagementPanel />);
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Set inactive' }));

    expect(
      await screen.findByText('Could not set selected classes to inactive.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Unable to set any of the 2 selected classes to inactive. Please review the remaining selection and try again.',
      ),
    ).toBeInTheDocument();
    expect(onSelectedRowKeysChange).toHaveBeenLastCalledWith(['active-1', 'active-2']);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: queryKeys.classPartials(), refetchType: 'none' }));
  });

  it('shows refresh-failure-specific guidance and hides stale rows when a partial delete refresh fails', async () => {
    const onSelectedRowKeysChange = vi.fn();
    classesManagementStateMock.mockReturnValue(
      buildReadyClassesManagementState({
        selectedRowKeys: ['active-1', 'orphaned-1'],
        onSelectedRowKeysChange,
      }),
    );
    runBatchMutationMock.mockResolvedValue([
      createFulfilledResult('active-1'),
      createRejectedResult('orphaned-1'),
    ]);

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');
    const { queryClient } = renderWithQueryClient(<ClassesManagementPanel />);
    vi.spyOn(queryClient, 'refetchQueries').mockRejectedValueOnce(new ApiTransportError({
      requestId: 'request-refresh',
      error: {
        code: 'RATE_LIMITED',
        message: 'Transport refresh text.',
        retriable: true,
      },
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete ABClass' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

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
