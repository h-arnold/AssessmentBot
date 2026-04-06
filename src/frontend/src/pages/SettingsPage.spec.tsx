import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../query/queryKeys';
import { createAppQueryClient } from '../query/queryClient';
import { classesManagementPanelRegionLabel } from '../features/classes/ClassesManagementPanel';
import { SettingsPage } from './SettingsPage';
import { pageContent } from './pageContent';

const backendSettingsFeatureEntryText = 'Backend settings feature entry';
const backendSettingsFeatureEntryRegionLabel = 'Backend settings feature entry';
const classesManagementFeatureEntryText = 'Classes management feature entry';

vi.mock('../features/settings/backend/BackendSettingsPanel', () => ({
  BackendSettingsPanel() {
    return (
      <div role="region" aria-label={backendSettingsFeatureEntryRegionLabel}>
        {backendSettingsFeatureEntryText}
      </div>
    );
  },
}));

vi.mock('../features/classes/ClassesManagementPanel', () => ({
  classesManagementPanelRegionLabel: 'Classes management panel',
  ClassesManagementPanel() {
    return (
      <div role="region" aria-label="Classes management panel">
        {classesManagementFeatureEntryText}
      </div>
    );
  },
}));

describe('SettingsPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderSettingsPage = (queryClient = createAppQueryClient()) => {
    const prefetchQuerySpy = vi
      .spyOn(queryClient, 'prefetchQuery')
      .mockImplementation(() => Promise.resolve());

    return {
      queryClient,
      prefetchQuerySpy,
      ...render(
        <QueryClientProvider client={queryClient}>
          <SettingsPage />
        </QueryClientProvider>
      ),
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

  it('prefetches Google Classrooms on page load without blocking the initial classes tab render', async () => {
    const queryClient = createAppQueryClient();
    const { prefetchQuerySpy } = renderSettingsPage(queryClient);

    expect(screen.getByRole('tab', { name: 'Classes' })).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('region', { name: classesManagementPanelRegionLabel })
    ).toBeInTheDocument();
    expect(screen.getByText(classesManagementFeatureEntryText)).toBeInTheDocument();

    await waitFor(() => {
      expect(prefetchQuerySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: queryKeys.googleClassrooms(),
          queryFn: expect.any(Function),
        })
      );
    });
  });
});
