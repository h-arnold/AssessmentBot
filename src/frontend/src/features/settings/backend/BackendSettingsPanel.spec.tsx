import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendSettingsPanel } from './BackendSettingsPanel';
import type { useBackendSettings } from './useBackendSettings';

type BackendSettingsPanelHookState = ReturnType<typeof useBackendSettings>;

const saveBackendSettingsMock = vi.fn<BackendSettingsPanelHookState['saveBackendSettings']>();

const backendSettingsHookState: BackendSettingsPanelHookState = {
  backendSettingsFormValues: null,
  hasApiKey: false,
  isInitialLoading: false,
  isSaveBlocked: false,
  isSaving: false,
  isRefreshing: false,
  loadError: null,
  saveBackendSettings: saveBackendSettingsMock,
  saveError: null,
} satisfies BackendSettingsPanelHookState;

const { useBackendSettingsMock } = vi.hoisted(() => ({
  useBackendSettingsMock: vi.fn(),
}));
const slowPanelInteractionTimeoutMs = 30_000;

vi.mock('./useBackendSettings', () => ({
  useBackendSettings: useBackendSettingsMock,
}));

let user: ReturnType<typeof userEvent.setup>;

/**
 * Renders the backend settings panel for one test scenario.
 *
 * @returns {ReturnType<typeof render>} The render result.
 */
function renderBackendSettingsPanel() {
  return render(<BackendSettingsPanel />);
}

/**
 * Returns the backend settings form field labelled by the provided name.
 *
 * @param {string} label The visible field label.
 * @returns {HTMLElement} The labelled field.
 */
function getField(label: string) {
  return screen.getByLabelText(label);
}

/**
 * Returns the Ant Design extra region for the form item labelled by the provided name.
 *
 * @param {string} label The visible field label.
 * @returns {HTMLElement | null} The form item's extra region, or null when absent.
 */
function getFormItemExtraRegion(label: string): HTMLElement | null {
  return getField(label).closest('.ant-form-item')?.querySelector('.ant-form-item-extra') ?? null;
}

/**
 * Builds a mocked hook state with the planned post-save refresh boundary flag.
 *
 * @param {Partial<BackendSettingsPanelHookState>} overrides Hook-state overrides.
 * @returns {BackendSettingsPanelHookState} Mocked state at the current hook boundary.
 */
function buildRefreshingBackendSettingsState(
  overrides: Partial<BackendSettingsPanelHookState> = {}
): BackendSettingsPanelHookState {
  const refreshingState: BackendSettingsPanelHookState = {
    ...backendSettingsHookState,
    ...overrides,
    isRefreshing: true,
  };

  return refreshingState;
}

describe('BackendSettingsPanel', () => {
  beforeEach(() => {
    user = userEvent.setup();
    useBackendSettingsMock.mockImplementation(() => backendSettingsHookState);
  });

  afterEach(() => {
    useBackendSettingsMock.mockReset();
    saveBackendSettingsMock.mockReset();
  });

  it('renders the backend panel skeleton inside the owned announced status region before the form is available', () => {
    useBackendSettingsMock.mockImplementation(() => ({
      ...backendSettingsHookState,
      isInitialLoading: true,
    }));

    renderBackendSettingsPanel();
    const panel = screen.getByRole('region', { name: 'Backend settings panel' });

    expect(
      within(panel).getByRole('status', { name: 'Loading backend settings' })
    ).toBeInTheDocument();
    expect(panel.querySelector('.ant-skeleton')).not.toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(
      within(panel).queryByRole('heading', { level: 3, name: 'Backend' })
    ).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText('API key')).not.toBeInTheDocument();
  });

  it('renders a blocking load failure inside the owned backend panel region', () => {
    useBackendSettingsMock.mockImplementation(() => ({
      ...backendSettingsHookState,
      loadError: 'Unable to load backend settings right now.',
    }));

    renderBackendSettingsPanel();
    const panel = screen.getByRole('region', { name: 'Backend settings panel' });

    expect(within(panel).getByRole('alert')).toHaveTextContent(
      'Unable to load backend settings right now.'
    );
    expect(within(panel).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it(
    'suppresses the form and save action when the backend config payload is incomplete',
    () => {
      useBackendSettingsMock.mockImplementation(() => ({
        ...backendSettingsHookState,
        backendSettingsFormValues: null,
        hasApiKey: true,
        isSaveBlocked: true,
        loadError: 'apiKey: REDACTED',
      }));

      renderBackendSettingsPanel();
      const panel = screen.getByRole('region', { name: 'Backend settings panel' });

      expect(within(panel).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
      expect(
        within(panel).queryByRole('heading', { level: 3, name: 'Backend' })
      ).not.toBeInTheDocument();
      expect(within(panel).queryByLabelText('API key')).not.toBeInTheDocument();
      expect(within(panel).getByRole('alert')).toHaveTextContent('apiKey: REDACTED');
    },
    slowPanelInteractionTimeoutMs
  );

  it('renders the planned section cards and visible field labels', () => {
    useBackendSettingsMock.mockImplementation(() => ({
      ...backendSettingsHookState,
      backendSettingsFormValues: {
        hasApiKey: true,
        apiKey: '',
        backendUrl: 'https://backend.example.com',
        backendAssessorBatchSize: 30,
        slidesFetchBatchSize: 20,
        daysUntilAuthRevoke: 60,
        jsonDbMasterIndexKey: 'master-index',
        jsonDbLockTimeoutMs: 30_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
        authGroupEmail: '',
      },
      hasApiKey: true,
    }));

    renderBackendSettingsPanel();

    expect(screen.getByRole('region', { name: 'Backend settings panel' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Backend' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Advanced' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Database' })).toBeInTheDocument();
    expect(getField('API key')).toBeInTheDocument();
    expect(getField('Backend URL')).toBeInTheDocument();
    expect(getField('Backend assessor batch size')).toBeInTheDocument();
    expect(getField('Slides fetch batch size')).toBeInTheDocument();
    expect(getField('Days until auth revoke')).toBeInTheDocument();
    expect(getField('JSON DB master index key')).toBeInTheDocument();
    expect(getField('JSON DB lock timeout')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'JSON DB log level' })).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'JSON DB backup on initialise' })
    ).toBeInTheDocument();
    expect(getField('JSON DB root folder ID')).toBeInTheDocument();
  });

  it('disables the save button while saving is blocked', () => {
    useBackendSettingsMock.mockImplementation(() => ({
      ...backendSettingsHookState,
      backendSettingsFormValues: {
        hasApiKey: true,
        apiKey: '',
        backendUrl: 'https://backend.example.com',
        backendAssessorBatchSize: 30,
        slidesFetchBatchSize: 20,
        daysUntilAuthRevoke: 60,
        jsonDbMasterIndexKey: 'master-index',
        jsonDbLockTimeoutMs: 30_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
        authGroupEmail: '',
      },
      isSaveBlocked: true,
      hasApiKey: true,
    }));

    renderBackendSettingsPanel();

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('shows save-button loading while a save is in flight without publishing post-save refresh busy state yet', () => {
    useBackendSettingsMock.mockImplementation(() => ({
      ...backendSettingsHookState,
      backendSettingsFormValues: {
        hasApiKey: true,
        apiKey: '',
        backendUrl: 'https://backend.example.com',
        backendAssessorBatchSize: 30,
        slidesFetchBatchSize: 20,
        daysUntilAuthRevoke: 60,
        jsonDbMasterIndexKey: 'master-index',
        jsonDbLockTimeoutMs: 30_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
        authGroupEmail: '',
      },
      isSaving: true,
      hasApiKey: true,
    }));

    renderBackendSettingsPanel();

    const panel = screen.getByRole('region', { name: 'Backend settings panel' });
    const saveButton = screen.getByRole('button', { name: /save/i });

    expect(saveButton).toHaveClass('ant-btn-loading');
    expect(saveButton).toBeDisabled();
    expect(panel).not.toHaveAttribute('aria-busy', 'true');
    expect(within(panel).queryByText('Refreshing backend settings...')).not.toBeInTheDocument();
    expect(within(panel).getByRole('heading', { level: 3, name: 'Backend' })).toBeInTheDocument();
  });

  it('keeps populated settings visible while publishing panel busy state during a post-save refresh', () => {
    useBackendSettingsMock.mockImplementation(() =>
      buildRefreshingBackendSettingsState({
        backendSettingsFormValues: {
          hasApiKey: true,
          apiKey: '',
          backendUrl: 'https://backend.example.com',
          backendAssessorBatchSize: 30,
          slidesFetchBatchSize: 20,
          daysUntilAuthRevoke: 60,
          jsonDbMasterIndexKey: 'master-index',
          jsonDbLockTimeoutMs: 30_000,
          jsonDbLogLevel: 'INFO',
          jsonDbBackupOnInitialise: true,
          jsonDbRootFolderId: 'folder-1234',
          authGroupEmail: '',
          authMode: 'googleGroups',
        },
        hasApiKey: true,
      })
    );

    renderBackendSettingsPanel();

    const panel = screen.getByRole('region', { name: 'Backend settings panel' });
    const saveButton = within(panel).getByRole('button', { name: 'Save' });

    expect(panel).toHaveAttribute('aria-busy', 'true');
    expect(within(panel).getByText('Refreshing backend settings...')).toBeInTheDocument();
    expect(saveButton).not.toHaveClass('ant-btn-loading');
    expect(within(panel).getByRole('heading', { level: 3, name: 'Backend' })).toBeInTheDocument();
    expect(within(panel).getByLabelText('Backend URL')).toHaveDisplayValue(
      'https://backend.example.com'
    );
    expect(within(panel).getByLabelText('Backend assessor batch size')).toHaveDisplayValue('30');
  });

  it(
    'moves focus to the first invalid field after submit failure',
    async () => {
      useBackendSettingsMock.mockImplementation(() => ({
        ...backendSettingsHookState,
        backendSettingsFormValues: {
          hasApiKey: false,
          apiKey: '',
          backendUrl: 'https://backend.example.com',
          backendAssessorBatchSize: 30,
          slidesFetchBatchSize: 20,
          daysUntilAuthRevoke: 60,
          jsonDbMasterIndexKey: 'master-index',
          jsonDbLockTimeoutMs: 30_000,
          jsonDbLogLevel: 'INFO',
          jsonDbBackupOnInitialise: true,
          jsonDbRootFolderId: 'folder-1234',
          authGroupEmail: '',
          authMode: 'googleGroups',
        },
        hasApiKey: false,
      }));

      renderBackendSettingsPanel();

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(getField('API key')).toHaveFocus();
      });
    },
    slowPanelInteractionTimeoutMs
  );

  it('shows stored-key helper text when an API key already exists', () => {
    useBackendSettingsMock.mockImplementation(() => ({
      ...backendSettingsHookState,
      backendSettingsFormValues: {
        hasApiKey: true,
        apiKey: '',
        backendUrl: 'https://backend.example.com',
        backendAssessorBatchSize: 30,
        slidesFetchBatchSize: 20,
        daysUntilAuthRevoke: 60,
        jsonDbMasterIndexKey: 'master-index',
        jsonDbLockTimeoutMs: 30_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
        authGroupEmail: '',
      },
      hasApiKey: true,
    }));

    const { rerender } = renderBackendSettingsPanel();

    const apiKeyFormItemExtra = getFormItemExtraRegion('API key');

    expect(apiKeyFormItemExtra).not.toBeNull();
    expect(apiKeyFormItemExtra as HTMLElement).toHaveTextContent(/stored api key already exists/i);
    expect(apiKeyFormItemExtra as HTMLElement).toHaveTextContent(/leave this field blank to keep it/i);

    useBackendSettingsMock.mockImplementation(() => ({
      ...backendSettingsHookState,
      backendSettingsFormValues: {
        hasApiKey: false,
        apiKey: '',
        backendUrl: 'https://backend.example.com',
        backendAssessorBatchSize: 30,
        slidesFetchBatchSize: 20,
        daysUntilAuthRevoke: 60,
        jsonDbMasterIndexKey: 'master-index',
        jsonDbLockTimeoutMs: 30_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
        authGroupEmail: '',
      },
      hasApiKey: false,
    }));

    rerender(<BackendSettingsPanel />);

    const refreshedApiKeyFormItemExtra = getFormItemExtraRegion('API key');

    expect(refreshedApiKeyFormItemExtra).not.toBeNull();
    expect(refreshedApiKeyFormItemExtra as HTMLElement).not.toHaveTextContent(
      /stored api key already exists/i
    );
    expect(refreshedApiKeyFormItemExtra as HTMLElement).toHaveTextContent(/enter a new api key/i);
  });

  it('binds boolean and numeric fields through Ant Design form state', async () => {
    useBackendSettingsMock.mockImplementation(() => ({
      ...backendSettingsHookState,
      backendSettingsFormValues: {
        hasApiKey: true,
        apiKey: '',
        backendUrl: 'https://backend.example.com',
        backendAssessorBatchSize: 30,
        slidesFetchBatchSize: 20,
        daysUntilAuthRevoke: 60,
        jsonDbMasterIndexKey: 'master-index',
        jsonDbLockTimeoutMs: 30_000,
        jsonDbLogLevel: 'INFO',
          jsonDbBackupOnInitialise: false,
          jsonDbRootFolderId: 'folder-1234',
          authGroupEmail: '',
          authMode: 'googleGroups',
        },
      hasApiKey: true,
    }));

    renderBackendSettingsPanel();

    fireEvent.click(screen.getByRole('switch', { name: 'JSON DB backup on initialise' }));
    fireEvent.change(getField('Backend assessor batch size'), {
      target: { value: '45' },
    });
    fireEvent.change(getField('JSON DB lock timeout'), {
      target: { value: '35000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(saveBackendSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonDbBackupOnInitialise: true,
          backendAssessorBatchSize: 45,
          jsonDbLockTimeoutMs: 35_000,
        })
      );
    });
  });

  it('renders persistent inline feedback for save failures', () => {
    useBackendSettingsMock.mockImplementation(() => ({
      ...backendSettingsHookState,
      backendSettingsFormValues: {
        hasApiKey: true,
        apiKey: '',
        backendUrl: 'https://backend.example.com',
        backendAssessorBatchSize: 30,
        slidesFetchBatchSize: 20,
        daysUntilAuthRevoke: 60,
        jsonDbMasterIndexKey: 'master-index',
        jsonDbLockTimeoutMs: 30_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
        authGroupEmail: '',
      },
      hasApiKey: true,
      saveError: 'Unable to save backend settings right now.',
    }));

    renderBackendSettingsPanel();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to save backend settings right now.'
    );
  });

  it('renders the auth group email field with its label, email input type, and static helper text in the form item extra region', () => {
    useBackendSettingsMock.mockImplementation(() => ({
      ...backendSettingsHookState,
      backendSettingsFormValues: {
        hasApiKey: true,
        apiKey: '',
        backendUrl: 'https://backend.example.com',
        backendAssessorBatchSize: 30,
        slidesFetchBatchSize: 20,
        daysUntilAuthRevoke: 60,
        jsonDbMasterIndexKey: 'master-index',
        jsonDbLockTimeoutMs: 30_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
        authGroupEmail: 'teachers@school.edu',
      },
      hasApiKey: true,
    }));

    renderBackendSettingsPanel();

    const authGroupEmailField = getField('Auth group email');

    expect(authGroupEmailField).toHaveAttribute('type', 'email');

    const authGroupEmailFormItemExtra = getFormItemExtraRegion('Auth group email');

    expect(authGroupEmailFormItemExtra).not.toBeNull();
    expect(authGroupEmailFormItemExtra as HTMLElement).toHaveTextContent(
      'Enter the email address of the Google Group whose members are allowed to access this application.'
    );

    const backendSectionCard = screen
      .getByRole('heading', { level: 3, name: 'Backend' })
      .closest('.settings-section-card');

    expect(backendSectionCard).not.toBeNull();
    expect(
      within(backendSectionCard as HTMLElement).getByLabelText('Auth group email')
    ).toBeInTheDocument();
  });

  it(
    'sets a field error and skips the save when a configured auth group email is cleared on submit',
    async () => {
      useBackendSettingsMock.mockImplementation(() => ({
        ...backendSettingsHookState,
        backendSettingsFormValues: {
          hasApiKey: true,
          apiKey: '',
          backendUrl: 'https://backend.example.com',
          backendAssessorBatchSize: 30,
          slidesFetchBatchSize: 20,
          daysUntilAuthRevoke: 60,
          jsonDbMasterIndexKey: 'master-index',
          jsonDbLockTimeoutMs: 30_000,
          jsonDbLogLevel: 'INFO',
          jsonDbBackupOnInitialise: true,
          jsonDbRootFolderId: 'folder-1234',
          authGroupEmail: 'teachers@school.edu',
          authMode: 'googleGroups',
        },
        hasApiKey: true,
      }));

      renderBackendSettingsPanel();

      await waitFor(() => {
        expect(getField('Auth group email')).toHaveDisplayValue('teachers@school.edu');
      });

      fireEvent.change(getField('Auth group email'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(saveBackendSettingsMock).not.toHaveBeenCalled();
        expect(getField('Auth group email').closest('.ant-form-item')).toHaveClass(
          'ant-form-item-has-error'
        );
      });
    },
    slowPanelInteractionTimeoutMs
  );

  it(
    'renders the Authentication options dropdown with both options and the security helper text',
    async () => {
      useBackendSettingsMock.mockImplementation(() => ({
        ...backendSettingsHookState,
        backendSettingsFormValues: {
          hasApiKey: true,
          apiKey: '',
          backendUrl: 'https://backend.example.com',
          backendAssessorBatchSize: 30,
          slidesFetchBatchSize: 20,
          daysUntilAuthRevoke: 60,
          jsonDbMasterIndexKey: 'master-index',
          jsonDbLockTimeoutMs: 30_000,
          jsonDbLogLevel: 'INFO',
          jsonDbBackupOnInitialise: true,
          jsonDbRootFolderId: 'folder-1234',
          authGroupEmail: '',
        },
        hasApiKey: true,
      }));

      renderBackendSettingsPanel();

      const authenticationOptionsField = getField('Authentication options');

      expect(authenticationOptionsField).toBeInTheDocument();
      expect(authenticationOptionsField.closest('.ant-select')).not.toBeNull();

      const authenticationOptionsFormItemExtra = getFormItemExtraRegion(
        'Authentication options'
      );

      expect(authenticationOptionsFormItemExtra).not.toBeNull();
      expect(authenticationOptionsFormItemExtra as HTMLElement).toHaveTextContent(
        /development/i
      );
      expect(authenticationOptionsFormItemExtra as HTMLElement).toHaveTextContent(
        /production/i
      );

      await user.click(authenticationOptionsField);
      expect(await screen.findByText('Google Groups')).toBeInTheDocument();
      expect(screen.getByText('None')).toBeInTheDocument();
    },
    slowPanelInteractionTimeoutMs
  );
});
