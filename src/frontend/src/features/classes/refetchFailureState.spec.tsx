import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClassesManagementState } from './useClassesManagement';

const classesManagementStateMock = vi.fn();

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

const staleRows: ClassesManagementState['rows'] = [
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

/**
 * Builds a ready-state shell that still carries refresh-failure guidance.
 *
 * @returns {ClassesManagementState} Mocked hook response.
 */
function buildRefreshFailureState(): ClassesManagementState {
  return {
    blockingErrorMessage: null,
    classesManagementViewState: 'ready',
    classesCount: staleRows.length,
    cohorts: [],
    errorMessage: null,
    isRefreshing: false,
    nonBlockingWarningMessage: null,
    refreshRequiredMessage: 'The classes could not be refreshed right now. Please reload the page and try again.',
    rows: [...staleRows],
    selectedRowKeys: [],
    yearGroups: [],
    onSelectedRowKeysChange: vi.fn(),
  };
}

/**
 * Renders the panel with a fresh query client for the refresh-failure test.
 *
 * @param {React.ReactElement} ui UI under test.
 * @returns {JSX.Element} Render result.
 */
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  classesManagementStateMock.mockReset();
});

describe('refetchFailureState', () => {
  it('suppresses stale table rows while the refresh-required summary is shown', async () => {
    classesManagementStateMock.mockReturnValue(buildRefreshFailureState());

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');
    renderWithQueryClient(<ClassesManagementPanel />);

    expect(screen.getByText('Update succeeded but refresh is required.')).toBeInTheDocument();
    expect(screen.getByText('The classes could not be refreshed right now. Please reload the page and try again.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Classes table' })).not.toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.queryByText('Bravo')).not.toBeInTheDocument();
  });
});
