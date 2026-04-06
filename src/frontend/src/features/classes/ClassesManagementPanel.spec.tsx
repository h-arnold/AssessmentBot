import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const classesManagementStateMock = vi.fn();

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

/**
 * Renders a component wrapped in a fresh QueryClientProvider for tests that
 * need access to the React Query context.
 *
 * @param {React.ReactElement} ui The component to render.
 * @returns {ReturnType<typeof render>} Testing Library render result.
 */
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ClassesManagementPanel', () => {
  it('renders a loading feature state shell while classes data resolves', async () => {
    classesManagementStateMock.mockReturnValue({
      blockingErrorMessage: null,
      classesManagementViewState: 'loading',
      classesCount: null,
      errorMessage: null,
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: [],
      selectedRowKeys: [],
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
      errorMessage: 'Classes failed to load.',
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: [],
      selectedRowKeys: [],
      onSelectedRowKeysChange: vi.fn(),
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    renderWithQueryClient(<ClassesManagementPanel />);

    expect(screen.getByText('Classes feature is unavailable.')).toBeInTheDocument();
    expect(screen.getAllByText('Classes failed to load.')).toHaveLength(1);
  });

  it('renders a ready feature state summary once classes are available', async () => {
    classesManagementStateMock.mockReturnValue({
      blockingErrorMessage: null,
      classesManagementViewState: 'ready',
      classesCount: 3,
      errorMessage: null,
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: [],
      selectedRowKeys: [],
      onSelectedRowKeysChange: vi.fn(),
    });

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
      errorMessage: 'Unable to load classes right now.',
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: [],
      selectedRowKeys: [],
      onSelectedRowKeysChange: vi.fn(),
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    renderWithQueryClient(<ClassesManagementPanel />);

    expect(screen.getByText('Classes feature is unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Unable to load active Google Classrooms right now.')).toBeInTheDocument();
  });
});
