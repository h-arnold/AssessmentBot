import * as React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackendSettingsForm } from '../features/settings/backend/backendSettingsForm.zod';
import { createAppQueryClient } from '../query/queryClient';
import { getCssRuleBlock } from '../test/appStylesRaw';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';
import { SettingsPage } from './SettingsPage';
import { pageContent } from './pageContent';

const backendSettingsPanelLabel = 'Backend settings panel';

const readyBackendSettingsFormValues = {
  hasApiKey: true,
  apiKey: '',
  backendUrl: 'https://backend.example.com',
  backendAssessorBatchSize: 30,
  slidesFetchBatchSize: 20,
  daysUntilAuthRevoke: 60,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 15_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
} satisfies BackendSettingsForm;

const { useBackendSettingsMock } = vi.hoisted(() => ({
  useBackendSettingsMock: vi.fn(),
}));

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

vi.mock('../features/settings/backend/useBackendSettings', () => ({
  useBackendSettings: useBackendSettingsMock,
}));

const backendSettingsHookState = {
  backendSettingsFormValues: readyBackendSettingsFormValues,
  hasApiKey: true,
  isInitialLoading: false,
  isSaveBlocked: false,
  isSaving: false,
  isRefreshing: false,
  loadError: null,
  saveBackendSettings: vi.fn(),
  saveError: null,
};

/**
 * Returns the shared Settings page content wrapper.
 *
 * @param {HTMLElement} container The rendered test container.
 * @returns {HTMLElement} The shared Settings page content wrapper.
 */
function getSettingsPageContent(container: HTMLElement) {
  const settingsPageContent = container.querySelector('.app-page-content');

  if (!(settingsPageContent instanceof HTMLElement)) {
    throw new TypeError('Expected the shared settings page content wrapper to render.');
  }

  return settingsPageContent;
}

describe('SettingsPage', () => {
  beforeEach(() => {
    useBackendSettingsMock.mockImplementation(() => backendSettingsHookState);
  });

  afterEach(() => {
    backendSettingsHookState.saveBackendSettings.mockReset();
    useBackendSettingsMock.mockReset();
    vi.clearAllMocks();
  });

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
    expect(screen.getByRole('region', { name: backendSettingsPanelLabel })).toBeInTheDocument();
    expect(screen.getByLabelText('Backend URL')).toBeInTheDocument();
  });

  it('keeps the shared settings frame element stable when switching from Classes to Backend settings', () => {
    const { container } = renderSettingsPage();
    const settingsPageContent = getSettingsPageContent(container);

    expect(settingsPageContent).toHaveClass('settings-page-content--classes');

    fireEvent.click(screen.getByRole('tab', { name: 'Backend settings' }));

    expect(getSettingsPageContent(container)).toBe(settingsPageContent);
  });

  it('renders the backend settings panel inside the shared settings frame instead of replacing it', () => {
    const { container } = renderSettingsPage();
    const settingsPageContent = getSettingsPageContent(container);

    fireEvent.click(screen.getByRole('tab', { name: 'Backend settings' }));

    const backendSettingsPanel = screen.getByRole('region', { name: backendSettingsPanelLabel });

    expect(getSettingsPageContent(container)).toBe(settingsPageContent);
    expect(settingsPageContent).toContainElement(screen.getByRole('tablist'));
    expect(settingsPageContent).toContainElement(backendSettingsPanel);
    expect(backendSettingsPanel.closest('.app-page-content')).toBe(settingsPageContent);
    expect(within(backendSettingsPanel).getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('routes the shared wide Settings page selector through the shared wide-page token', () => {
    const classesPageRuleBlock = getCssRuleBlock('.settings-page-content--classes');

    expect(classesPageRuleBlock).toMatch(/width:\s*min\([^)]*var\(--app-page-width-wide-data\)/);
    expect(classesPageRuleBlock).not.toMatch(/\b1280px\b/);
  });

  it('routes the backend settings panel through the shared default-panel token and keeps it centred', () => {
    const backendPanelRuleBlock = getCssRuleBlock('.settings-tab-panel--backend');

    expect(backendPanelRuleBlock).toMatch(/width:\s*min\([^)]*var\(--app-panel-width-default\)/);
    expect(backendPanelRuleBlock).toMatch(/margin-inline:\s*auto/);
    expect(backendPanelRuleBlock).not.toMatch(/\b720px\b/);
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
