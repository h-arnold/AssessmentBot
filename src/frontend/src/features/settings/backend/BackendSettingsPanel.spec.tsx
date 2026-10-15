import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendSettingsPanel } from './BackendSettingsPanel';
import type { BackendSettingsForm } from './backendSettingsForm.zod';
import type * as BackendSettingsFieldDescriptors from './backendSettingsFieldDescriptors';
import { BackendSettingsFormSchema } from './backendSettingsForm.zod';
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

const readyBackendSettingsFormValues = {
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
} satisfies BackendSettingsForm;

const noStoredKeyBackendSettingsFormValues = {
  ...readyBackendSettingsFormValues,
  hasApiKey: false,
  apiKey: '',
};

const booleanBindingBackendSettingsFormValues = {
  ...readyBackendSettingsFormValues,
  jsonDbBackupOnInitialise: false,
};

const { useBackendSettingsMock } = vi.hoisted(() => {
  return {
    useBackendSettingsMock: vi.fn(),
  };
});
const { bypassBackendSettingsFieldValidation } = vi.hoisted(() => {
  return {
    bypassBackendSettingsFieldValidation: { current: false },
  };
});
const slowPanelInteractionTimeoutMs = 30_000;
const NON_STRING_PATH_SEGMENT = 7;

vi.mock('./useBackendSettings', () => {
  return {
    useBackendSettings: useBackendSettingsMock,
  };
});

vi.mock('./backendSettingsFieldDescriptors', async (importOriginal) => {
  const actual = await importOriginal<typeof BackendSettingsFieldDescriptors>();
  return {
    ...actual,
    createBackendSettingsFieldValidator: (...arguments_: Parameters<typeof actual.createBackendSettingsFieldValidator>) => {
      return bypassBackendSettingsFieldValidation.current
        ? () => Promise.resolve()
        : actual.createBackendSettingsFieldValidator(...arguments_);
    },
  };
});

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
 * @returns {HTMLElement | null} The form item's extra region, or null when absent.
 */
function getFormItemExtraRegion(): HTMLElement | null {
  return getField('API key').closest('.ant-form-item')?.querySelector('.ant-form-item-extra') ?? null;
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
    bypassBackendSettingsFieldValidation.current = false;
    vi.restoreAllMocks();
    useBackendSettingsMock.mockReset();
    saveBackendSettingsMock.mockReset();
  });

  it('renders the backend panel skeleton inside the owned announced status region before the form is available', () => {
    useBackendSettingsMock.mockImplementation(() => {
      return {
        ...backendSettingsHookState,
        isInitialLoading: true,
      };
    });

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
    useBackendSettingsMock.mockImplementation(() => {
      return {
        ...backendSettingsHookState,
        loadError: 'Unable to load backend settings right now.',
      };
    });

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
      useBackendSettingsMock.mockImplementation(() => {
        return {
          ...backendSettingsHookState,
          backendSettingsFormValues: null,
          hasApiKey: true,
          isSaveBlocked: true,
          loadError: 'apiKey: REDACTED',
        };
      });

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
    useBackendSettingsMock.mockImplementation(() => {
      return {
        ...backendSettingsHookState,
        backendSettingsFormValues: readyBackendSettingsFormValues,
        hasApiKey: true,
      };
    });

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
    useBackendSettingsMock.mockImplementation(() => {
      return {
        ...backendSettingsHookState,
        backendSettingsFormValues: readyBackendSettingsFormValues,
        isSaveBlocked: true,
        hasApiKey: true,
      };
    });

    renderBackendSettingsPanel();

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('shows save-button loading while a save is in flight without publishing post-save refresh busy state yet', () => {
    useBackendSettingsMock.mockImplementation(() => {
      return {
        ...backendSettingsHookState,
        backendSettingsFormValues: readyBackendSettingsFormValues,
        isSaving: true,
        hasApiKey: true,
      };
    });

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
    useBackendSettingsMock.mockImplementation(() => {
      return buildRefreshingBackendSettingsState({
        backendSettingsFormValues: readyBackendSettingsFormValues,
        hasApiKey: true,
      });
    }
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
      useBackendSettingsMock.mockImplementation(() => {
        return {
          ...backendSettingsHookState,
          backendSettingsFormValues: noStoredKeyBackendSettingsFormValues,
          hasApiKey: false,
        };
      });

      renderBackendSettingsPanel();

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(getField('API key')).toHaveFocus();
      });
    },
    slowPanelInteractionTimeoutMs
  );

  it('maps schema field errors and ignores hasApiKey and non-string paths without saving', async () => {
    bypassBackendSettingsFieldValidation.current = true;
    useBackendSettingsMock.mockImplementation(() => {
      return {
        ...backendSettingsHookState,
        backendSettingsFormValues: readyBackendSettingsFormValues,
        hasApiKey: true,
      };
    });
    vi.spyOn(BackendSettingsFormSchema, 'safeParse').mockReturnValue({
      success: false,
      error: {
        issues: [
          { path: ['apiKey'], message: 'API key rejected' },
          { path: ['backendUrl'], message: 'Backend URL rejected' },
          { path: ['hasApiKey'], message: 'Internal flag rejected' },
          { path: [NON_STRING_PATH_SEGMENT], message: 'Non-string path rejected' },
        ],
      },
    } as ReturnType<typeof BackendSettingsFormSchema.safeParse>);

    renderBackendSettingsPanel();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('API key rejected')).toBeInTheDocument();
    expect(await screen.findByText('Backend URL rejected')).toBeInTheDocument();
    expect(screen.queryByText('Internal flag rejected')).not.toBeInTheDocument();
    expect(screen.queryByText('Non-string path rejected')).not.toBeInTheDocument();
    expect(saveBackendSettingsMock).not.toHaveBeenCalled();
  });

  it('shows stored-key helper text when an API key already exists', () => {
    useBackendSettingsMock.mockImplementation(() => {
      return {
        ...backendSettingsHookState,
        backendSettingsFormValues: readyBackendSettingsFormValues,
        hasApiKey: true,
      };
    });

    const { rerender } = renderBackendSettingsPanel();

    const apiKeyFormItemExtra = getFormItemExtraRegion();

    expect(apiKeyFormItemExtra).not.toBeNull();
    expect(apiKeyFormItemExtra as HTMLElement).toHaveTextContent(/stored api key already exists/i);
    expect(apiKeyFormItemExtra as HTMLElement).toHaveTextContent(/leave this field blank to keep it/i);

    useBackendSettingsMock.mockImplementation(() => {
      return {
        ...backendSettingsHookState,
        backendSettingsFormValues: noStoredKeyBackendSettingsFormValues,
        hasApiKey: false,
      };
    });

    rerender(<BackendSettingsPanel />);

    const refreshedApiKeyFormItemExtra = getFormItemExtraRegion();

    expect(refreshedApiKeyFormItemExtra).not.toBeNull();
    expect(refreshedApiKeyFormItemExtra as HTMLElement).not.toHaveTextContent(
      /stored api key already exists/i
    );
    expect(refreshedApiKeyFormItemExtra as HTMLElement).toHaveTextContent(/enter a new api key/i);
  });

  it('binds boolean and numeric fields through Ant Design form state', async () => {
    useBackendSettingsMock.mockImplementation(() => {
      return {
        ...backendSettingsHookState,
        backendSettingsFormValues: booleanBindingBackendSettingsFormValues,
        hasApiKey: true,
      };
    });

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
    useBackendSettingsMock.mockImplementation(() => {
      return {
        ...backendSettingsHookState,
        backendSettingsFormValues: readyBackendSettingsFormValues,
        hasApiKey: true,
        saveError: 'Unable to save backend settings right now.',
      };
    });

    renderBackendSettingsPanel();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to save backend settings right now.'
    );
  });

  // Contract: the auth surface moved out of the backend settings panel entirely, so neither
  // the auth fields render nor the auth form values reach the save payload.
  it('renders the panel without the authentication fields', () => {
    useBackendSettingsMock.mockImplementation(() => {
      return {
        ...backendSettingsHookState,
        backendSettingsFormValues: readyBackendSettingsFormValues,
        hasApiKey: true,
      };
    });

    renderBackendSettingsPanel();

    expect(screen.queryByLabelText('Auth group email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Authentication options')).not.toBeInTheDocument();
  });

  it(
    'sends a save payload that excludes the authentication fields',
    async () => {
      useBackendSettingsMock.mockImplementation(() => {
        return {
          ...backendSettingsHookState,
          backendSettingsFormValues: readyBackendSettingsFormValues,
          hasApiKey: true,
        };
      });

      renderBackendSettingsPanel();

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(saveBackendSettingsMock).toHaveBeenCalledTimes(1);
      });

      const savePayload = saveBackendSettingsMock.mock.calls[0][0];

      expect(savePayload).not.toHaveProperty('authGroupEmail');
      expect(savePayload).not.toHaveProperty('authMode');
    },
    slowPanelInteractionTimeoutMs
  );
});
