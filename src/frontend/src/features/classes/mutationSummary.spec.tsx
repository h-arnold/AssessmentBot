import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import type * as BulkSetCohortFlowModule from './bulkSetCohortFlow';
import type { ClassesManagementState } from './useClassesManagement';

const classesManagementStateMock = vi.fn();
const bulkSetCohortMock = vi.fn();

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

vi.mock('./bulkSetCohortFlow', async () => {
  const actual = await vi.importActual('./bulkSetCohortFlow') as typeof BulkSetCohortFlowModule;

  return {
    ...actual,
    bulkSetCohort: bulkSetCohortMock,
  };
});

const readyRows: ClassesManagementState['rows'] = [
  {
    classId: 'class-1',
    className: 'Alpha',
    status: 'active',
    cohortKey: 'cohort-a',
    cohortLabel: 'Cohort A',
    yearGroupKey: 'year-7',
    yearGroupLabel: 'Year 7',
    courseLength: 2,
    active: true,
  },
  {
    classId: 'class-2',
    className: 'Bravo',
    status: 'inactive',
    cohortKey: 'cohort-b',
    cohortLabel: 'Cohort B',
    yearGroupKey: 'year-8',
    yearGroupLabel: 'Year 8',
    courseLength: 3,
    active: false,
  },
];

const activeCohorts = [
  {
    key: 'cohort-a',
    name: 'Cohort A',
    active: true,
    startYear: 2024,
    startMonth: 9,
  },
  {
    key: 'cohort-c',
    name: 'Cohort C',
    active: true,
    startYear: 2025,
    startMonth: 9,
  },
];

/**
 * Builds a ready-state shell for the panel test.
 *
 * @param {Partial<ClassesManagementState>} overrides State overrides.
 * @returns {ClassesManagementState} Ready-state hook response.
 */
function buildReadyClassesManagementState(overrides: Partial<ClassesManagementState> = {}): ClassesManagementState {
  return {
    blockingErrorMessage: null,
    classesManagementViewState: 'ready',
    classesCount: readyRows.length,
    cohorts: activeCohorts,
    errorMessage: null,
    nonBlockingWarningMessage: null,
    refreshRequiredMessage: null,
    rows: [...readyRows],
    selectedRowKeys: ['class-1', 'class-2'],
    yearGroups: [],
    onSelectedRowKeysChange: vi.fn(),
    ...overrides,
  };
}

/**
 * Renders the panel with a fresh query client for the integration test.
 *
 * @param {React.ReactElement} ui UI under test.
 * @returns {{ queryClient: QueryClient }} Query client handle.
 */
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

beforeEach(() => {
  classesManagementStateMock.mockReset();
  bulkSetCohortMock.mockReset();
});

describe('mutationSummary', () => {
  it('hands partial metadata updates off to the persistent summary alert without refresh guidance', async () => {
    classesManagementStateMock.mockReturnValue(buildReadyClassesManagementState());
    bulkSetCohortMock.mockResolvedValue([
      { status: 'fulfilled', row: readyRows[0], data: { ok: true } },
      { status: 'rejected', row: readyRows[1], error: new Error('Cohort update failed.') },
    ]);

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');
    renderWithQueryClient(<ClassesManagementPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Set cohort' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set cohort' });
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Cohort' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Cohort C' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));

    await screen.findByText('Some selected classes were not updated.');
    await screen.findByText('1 of 2 selected classes could not be updated. Successful rows were refreshed. Please review the remaining selection and try again.');
    expect(screen.queryByText('Update succeeded but refresh is required.')).not.toBeInTheDocument();
    expect(screen.queryByText('The mutation succeeded, but refresh is required to see the latest classes.')).not.toBeInTheDocument();
  });

  it('uses refresh-failure guidance when a partial metadata update cannot be refreshed', async () => {
    classesManagementStateMock.mockReturnValue(buildReadyClassesManagementState());
    bulkSetCohortMock.mockResolvedValue([
      { status: 'fulfilled', row: readyRows[0], data: { ok: true } },
      { status: 'rejected', row: readyRows[1], error: new Error('Cohort update failed.') },
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

    fireEvent.click(screen.getByRole('button', { name: 'Set cohort' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set cohort' });
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Cohort' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Cohort C' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));

    await screen.findByText('Some selected classes were not updated.');
    await screen.findByText('1 of 2 selected classes could not be updated. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.');
    await screen.findByText('The classes are busy updating right now. Please try again shortly.');
    expect(screen.queryByRole('table', { name: 'Classes table' })).not.toBeInTheDocument();
    expect(screen.queryByText('Transport refresh text.')).not.toBeInTheDocument();
    expect(screen.queryByText('Successful rows were refreshed. Please review the remaining selection and try again.')).not.toBeInTheDocument();
  });
});
