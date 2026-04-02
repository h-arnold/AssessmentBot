import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../query/queryClient';
import { SettingsPage } from './SettingsPage';
import { pageContent } from './pageContent';

const backendSettingsFeatureEntryText = 'Backend settings feature entry';
const backendSettingsFeatureEntryRegionLabel = 'Backend settings feature entry';
const getGoogleClassroomsQueryOptionsMock = vi.fn(() => ({
  queryKey: ['googleClassrooms'],
  queryFn: vi.fn(),
}));

vi.mock(
  '../features/settings/backend/BackendSettingsPanel',
  () => ({
    BackendSettingsPanel() {
      return (
        <div role="region" aria-label={backendSettingsFeatureEntryRegionLabel}>
          {backendSettingsFeatureEntryText}
        </div>
      );
    },
  }),
);

vi.mock('../query/sharedQueries', async () => {
  const actual = await vi.importActual('../query/sharedQueries');

  return {
    ...actual,
    getGoogleClassroomsQueryOptions: getGoogleClassroomsQueryOptionsMock,
  };
});

describe('SettingsPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderSettingsPage = (queryClient = createAppQueryClient()) => ({
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <SettingsPage />
      </QueryClientProvider>
    ),
  });

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
    expect(screen.getByRole('region', { name: backendSettingsFeatureEntryRegionLabel })).toBeInTheDocument();
    expect(screen.getByText(backendSettingsFeatureEntryText)).toBeInTheDocument();
  });

  it('prefetches Google Classrooms on page load without blocking the initial classes tab render', async () => {
    const queryClient = createAppQueryClient();
    const prefetchQuerySpy = vi.spyOn(queryClient, 'prefetchQuery').mockResolvedValue();
    renderSettingsPage(queryClient);

    expect(screen.getByRole('tab', { name: 'Classes' })).toHaveAttribute('aria-selected', 'true');

    await waitFor(() => {
      expect(getGoogleClassroomsQueryOptionsMock).toHaveBeenCalledTimes(1);
      expect(prefetchQuerySpy).toHaveBeenCalledWith(
        getGoogleClassroomsQueryOptionsMock.mock.results[0]?.value
      );
    });
  });
});
