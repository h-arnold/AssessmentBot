import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const classesManagementStateMock = vi.fn();

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

describe('ClassesManagementPanel', () => {
  it('renders a loading feature state shell while classes data resolves', async () => {
    classesManagementStateMock.mockReturnValue({
      classesManagementViewState: 'loading',
      classesCount: null,
      errorMessage: null,
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    render(<ClassesManagementPanel />);

    expect(screen.getByText('Classes feature is loading.')).toBeInTheDocument();
  });

  it('renders an error feature state message when classes management fails', async () => {
    classesManagementStateMock.mockReturnValue({
      classesManagementViewState: 'error',
      classesCount: null,
      errorMessage: 'Classes failed to load.',
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    render(<ClassesManagementPanel />);

    expect(screen.getByText('Classes feature is unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Classes failed to load.')).toBeInTheDocument();
  });

  it('renders a ready feature state summary once classes are available', async () => {
    classesManagementStateMock.mockReturnValue({
      classesManagementViewState: 'ready',
      classesCount: 3,
      errorMessage: null,
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    render(<ClassesManagementPanel />);

    expect(screen.getByText('Classes ready: 3')).toBeInTheDocument();
  });
});
