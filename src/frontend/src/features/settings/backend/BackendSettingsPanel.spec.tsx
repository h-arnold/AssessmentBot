import { App as AntdApp } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendSettingsPanel } from './BackendSettingsPanel';
import type { BackendSettingsForm } from './backendSettingsForm.zod';

type BackendSettingsPanelHookState = Readonly<{
  backendSettingsFormValues: BackendSettingsForm | null;
  hasApiKey: boolean;
  isInitialLoading: boolean;
  isSaveBlocked: boolean;
  isSaving: boolean;
  loadError: string | null;
  partialLoadError: string | null;
  saveBackendSettings: ReturnType<typeof vi.fn>;
  saveError: string | null;
}>;

const backendSettingsHookState = {
  backendSettingsFormValues: null,
  hasApiKey: false,
  isInitialLoading: false,
  isSaveBlocked: false,
  isSaving: false,
  loadError: null,
  partialLoadError: null,
  saveBackendSettings: vi.fn(),
  saveError: null,
} satisfies BackendSettingsPanelHookState;

const { useBackendSettingsMock } = vi.hoisted(() => ({
  useBackendSettingsMock: vi.fn(),
}));
const slowPanelInteractionTimeoutMs = 30_000;

vi.mock('./useBackendSettings', () => ({
  useBackendSettings: useBackendSettingsMock,
}));

/**
 * Renders the backend settings panel within the Ant Design app context.
 *
 * @returns {ReturnType<typeof render>} The render result.
 */
function renderBackendSettingsPanel() {
  return render(
    <AntdApp>
      <BackendSettingsPanel />
    </AntdApp>
  );
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

describe('BackendSettingsPanel', () => {
  beforeEach(() => {
    useBackendSettingsMock.mockImplementation(() => backendSettingsHookState);
  });

  afterEach(() => {
    useBackendSettingsMock.mockReset();
    backendSettingsHookState.saveBackendSettings.mockReset();
  });

  it('renders a loading skeleton before the form is available', () => {
    useBackendSettingsMock.mockImplementation(() => ({
      ...backendSettingsHookState,
      isInitialLoading: true,
    }));

    renderBackendSettingsPanel();

    expect(
      screen.getByRole('status', { name: 'Loading backend settings' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('renders a top-level alert for a blocking load failure', () => {
    useBackendSettingsMock.mockImplementation(() => ({
      ...backendSettingsHookState,
      loadError: 'Unable to load backend settings right now.',
    }));

    renderBackendSettingsPanel();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to load backend settings right now.'
    );
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('renders a persistent warning for a partial load warning', () => {
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
        jsonDbLockTimeoutMs: 15_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
      },
      hasApiKey: true,
      isSaveBlocked: true,
      partialLoadError: 'apiKey: REDACTED',
    }));

    renderBackendSettingsPanel();

    expect(screen.getByRole('alert')).toHaveTextContent('apiKey: REDACTED');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  }, slowPanelInteractionTimeoutMs);

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
        jsonDbLockTimeoutMs: 15_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
      },
      hasApiKey: true,
    }));

    renderBackendSettingsPanel();

    expect(
      screen.getByRole('region', { name: 'Backend settings panel' })
    ).toBeInTheDocument();
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
        jsonDbLockTimeoutMs: 15_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
      },
      isSaveBlocked: true,
      hasApiKey: true,
    }));

    renderBackendSettingsPanel();

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('shows the loading state while a save is in flight', () => {
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
        jsonDbLockTimeoutMs: 15_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
      },
      isSaving: true,
      hasApiKey: true,
    }));

    renderBackendSettingsPanel();

    const saveButton = screen.getByRole('button', { name: /save/i });

    expect(saveButton).toHaveClass('ant-btn-loading');
    expect(saveButton).toBeDisabled();
  });

  it('moves focus to the first invalid field after submit failure', async () => {
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
        jsonDbLockTimeoutMs: 15_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
      },
      hasApiKey: false,
    }));

    renderBackendSettingsPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(getField('API key')).toHaveFocus();
    });
  }, slowPanelInteractionTimeoutMs);

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
        jsonDbLockTimeoutMs: 15_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
      },
      hasApiKey: true,
    }));

    const { rerender } = renderBackendSettingsPanel();

    expect(
      screen.getByText(/stored api key already exists/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/leave this field blank to keep it/i)).toBeInTheDocument();

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
        jsonDbLockTimeoutMs: 15_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
      },
      hasApiKey: false,
    }));

    rerender(
      <AntdApp>
        <BackendSettingsPanel />
      </AntdApp>
    );

    expect(screen.queryByText(/stored api key already exists/i)).not.toBeInTheDocument();
    expect(screen.getByText(/enter a new api key/i)).toBeInTheDocument();
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
        jsonDbLockTimeoutMs: 15_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: false,
        jsonDbRootFolderId: 'folder-1234',
      },
      hasApiKey: true,
    }));

    renderBackendSettingsPanel();

    fireEvent.click(screen.getByRole('switch', { name: 'JSON DB backup on initialise' }));
    fireEvent.change(getField('Backend assessor batch size'), {
      target: { value: '45' },
    });
    fireEvent.change(getField('JSON DB lock timeout'), {
      target: { value: '20000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(backendSettingsHookState.saveBackendSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonDbBackupOnInitialise: true,
          backendAssessorBatchSize: 45,
          jsonDbLockTimeoutMs: 20_000,
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
        jsonDbLockTimeoutMs: 15_000,
        jsonDbLogLevel: 'INFO',
        jsonDbBackupOnInitialise: true,
        jsonDbRootFolderId: 'folder-1234',
      },
      hasApiKey: true,
      saveError: 'Unable to save backend settings right now.',
    }));

    renderBackendSettingsPanel();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to save backend settings right now.'
    );
  });
});
