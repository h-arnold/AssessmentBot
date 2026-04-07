import * as React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../query/queryClient';
import { SettingsPage } from './SettingsPage';
import { pageContent } from './pageContent';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';

const backendSettingsFeatureEntryText = 'Backend settings feature entry';
const backendSettingsFeatureEntryRegionLabel = 'Backend settings feature entry';

vi.mock('../features/classes/ClassesManagementPanel', () => ({
  ClassesManagementPanel() {
    const [selectedRows, setSelectedRows] = React.useState(0);

    return (
      <div role="region" aria-label="Classes management panel">
        <div>Summary</div>
        <div>Bulk actions</div>
        <div role="table" aria-label="Classes table">
          <label>
            <input
              aria-label="Select Year 10 Maths"
              checked={selectedRows === 1}
              onChange={(event) => {
                setSelectedRows(event.currentTarget.checked ? 1 : 0);
              }}
              type="checkbox"
            />
            Year 10 Maths
          </label>
        </div>
        <div>{`Selected rows: ${selectedRows}`}</div>
        <button disabled type="button">
          Create ABClass
        </button>
      </div>
    );
  },
}));

vi.mock('../features/settings/backend/BackendSettingsPanel', () => ({
  BackendSettingsPanel() {
    return (
      <div role="region" aria-label={backendSettingsFeatureEntryRegionLabel}>
        {backendSettingsFeatureEntryText}
      </div>
    );
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('SettingsPage', () => {
  const renderSettingsPage = (queryClient = createAppQueryClient()) => {
    const prefetchQuerySpy = vi
      .spyOn(queryClient, 'prefetchQuery')
      .mockImplementation(() => Promise.resolve());

    return {
      prefetchQuerySpy,
      ...renderWithFrontendProviders(<SettingsPage />, { queryClient }),
    };
  };

  it('renders the shared settings heading and summary copy', () => {
    renderSettingsPage();

    expect(
      screen.getByRole('heading', { level: 2, name: pageContent.settings.heading })
    ).toBeInTheDocument();
    expect(screen.getByText(pageContent.settings.summary)).toBeInTheDocument();
  });

  it('renders the backend settings feature entry when the tab is selected', () => {
    renderSettingsPage();

    const classesTab = screen.getByRole('tab', { name: 'Classes' });
    const backendSettingsTab = screen.getByRole('tab', { name: 'Backend settings' });

    expect(classesTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(backendSettingsTab);

    expect(backendSettingsTab).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('region', { name: backendSettingsFeatureEntryRegionLabel })
    ).toBeInTheDocument();
    expect(screen.getByText(backendSettingsFeatureEntryText)).toBeInTheDocument();
  });

  it('resets the Classes selection when leaving and re-entering the tab', async () => {
    renderSettingsPage();

    const classesTable = screen.getByRole('table', { name: 'Classes table' });
    fireEvent.click(within(classesTable).getByRole('checkbox', { name: 'Select Year 10 Maths' }));

    await waitFor(() => {
      expect(screen.getByText('Selected rows: 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Backend settings' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Classes' }));

    await waitFor(() => {
      expect(screen.getByText('Selected rows: 0')).toBeInTheDocument();
    });
  });

  it('prefetches Google Classrooms on page load without blocking the initial classes tab render', async () => {
    const queryClient = createAppQueryClient();
    const { prefetchQuerySpy } = renderSettingsPage(queryClient);

    expect(screen.getByRole('tab', { name: 'Classes' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Bulk actions')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Classes table' })).toBeInTheDocument();
    expect(screen.getByText('Selected rows: 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create ABClass' })).toBeDisabled();

    await waitFor(() => {
      expect(prefetchQuerySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.any(Array),
          queryFn: expect.any(Function),
        })
      );
    });
  });
});
