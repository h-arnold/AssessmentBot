/**
 * Component tests for the admin-only Authentication settings tab content.
 *
 * These specs describe the mounted behaviour of `AuthenticationSettingsTab` once it is
 * rendered by the Settings page. The tab owns its staged state through the
 * `useAuthenticationSettings` hook and renders the single-Form/single-submit layout from
 * the Authentication settings layout contract.
 *
 * Tab-visibility gating lives in SettingsPage (it consumes the application access context
 * to decide whether the Authentication tab is shown) and is covered by the separate
 * SettingsPage-level integration spec in this folder, so this file never forces the tab
 * component to self-gate.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as Antd from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApplicationAccessContext,
  type ApplicationAccessContextValue,
} from '../../auth/ApplicationAccessContext';
import { StartupWarmupStateProvider } from '../../auth/startupWarmupState';
import { renderWithFrontendProviders } from '../../../test/renderWithFrontendProviders';
import type { AuthenticationSettings } from '../../../services/authService/authService.zod';
import { AuthenticationSettingsTab } from './AuthenticationSettingsTab';

const { getAuthenticationSettingsMock, setAuthenticationSettingsMock, messageSuccessMock, messageErrorMock } =
  vi.hoisted(() => ({
    getAuthenticationSettingsMock: vi.fn(),
    setAuthenticationSettingsMock: vi.fn(),
    messageSuccessMock: vi.fn(),
    messageErrorMock: vi.fn(),
  }));

vi.mock('../../../services/authService/authService', () => ({
  getAuthenticationSettings: getAuthenticationSettingsMock,
  setAuthenticationSettings: setAuthenticationSettingsMock,
}));

vi.mock('antd', async () => {
  const actual = (await vi.importActual('antd')) as typeof Antd;

  return {
    ...actual,
    App: Object.assign(actual.App, {
      useApp: () => ({
        message: {
          success: messageSuccessMock,
          error: messageErrorMock,
        },
        notification: {
          open: vi.fn(),
        },
      }),
    }),
  };
});

const administratorAccessContextValue: ApplicationAccessContextValue = {
  role: 'admin',
  reason: 'ok',
  allowed: true,
  email: 'admin@example.com',
};

const groupsModeSettings: AuthenticationSettings = {
  authMode: 'googleGroups',
  authGroupEmail: 'teachers@example.com',
  authUsers: [],
  authRevision: null,
};

const scriptPropertiesModeSettings: AuthenticationSettings = {
  authMode: 'scriptProperties',
  authGroupEmail: '',
  authUsers: [
    { email: 'admin@example.com', role: 'admin' },
    { email: 'teacher@example.com', role: 'user' },
  ],
  authRevision: '1',
};

const emptyUserListSettings: AuthenticationSettings = {
  authMode: 'scriptProperties',
  authGroupEmail: '',
  authUsers: [],
  authRevision: '1',
};

const successfulSaveResult = {
  success: true as const,
  authRevision: '2',
};

let user: ReturnType<typeof userEvent.setup>;

/**
 * Renders the authentication settings tab inside the application access context
 * and the shared frontend providers.
 *
 * @param {ApplicationAccessContextValue} accessContextValue The access role context to mount.
 * @returns {ReturnType<typeof render>} The render result.
 */
function renderAuthenticationSettingsTab(accessContextValue: ApplicationAccessContextValue) {
  return renderWithFrontendProviders(
    <ApplicationAccessContext.Provider value={accessContextValue}>
      <AuthenticationSettingsTab />
    </ApplicationAccessContext.Provider>
  );
}

beforeEach(() => {
  user = userEvent.setup();
});

afterEach(() => {
  getAuthenticationSettingsMock.mockReset();
  setAuthenticationSettingsMock.mockReset();
  messageSuccessMock.mockReset();
  messageErrorMock.mockReset();
  vi.resetModules();
});

describe('Authentication mode region rendering', () => {

  it('shows the group email and membership note in googleGroups mode and hides the user list', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(groupsModeSettings));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByLabelText(/auth group email/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/membership is managed in google groups/i)).toBeInTheDocument();
    expect(
      screen.getByText(/access is verified against google group membership/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /email/i })).not.toBeInTheDocument();
  });

  it('shows the authorised-user list in scriptProperties mode and hides the group email field', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/auth group email/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/access is verified against the saved user list with roles/i)
    ).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('teacher@example.com')).toBeInTheDocument();
  });

  it('blocks clearing a configured group email and keeps the form usable', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(groupsModeSettings));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    const groupEmailInput = await screen.findByLabelText(/auth group email/i);
    expect(groupEmailInput).toHaveValue('teachers@example.com');

    await user.clear(groupEmailInput);

    expect(groupEmailInput).toHaveValue('teachers@example.com');
    expect(screen.getByText(/cannot be cleared once set/i)).toBeInTheDocument();
    expect(setAuthenticationSettingsMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });
});

describe('Script Properties staged user-list editing', () => {

  it('normalises the email when a user is added', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email/i), 'MixedCase@Example.com');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText('mixedcase@example.com')).toBeInTheDocument();
  });

  it('shows the at-least-one-administrator explanation when the staged user list is empty', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(emptyUserListSettings));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
    });

    expect(
      screen.getByText(/at least one administrator is required/i)
    ).toBeInTheDocument();
  });

  it('blocks adding a duplicate staged email without creating a second row', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email/i), 'teacher@example.com');
    await user.click(screen.getByRole('button', { name: /add/i }));

    const duplicateRows = screen.getAllByText('teacher@example.com');
    expect(duplicateRows).toHaveLength(1);
  });

  it('stages a role change through the inline role select', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /role/i })).toBeInTheDocument();
    });

    const teacherRow = screen.getByText('teacher@example.com').closest('tr') as HTMLElement;
    const teacherRoleSelect = within(teacherRow).getByRole('combobox', { name: /role/i });
    await user.click(teacherRoleSelect);
    await user.click(await screen.findByText('admin', { selector: '.ant-select-item-option-content' }));
    await waitFor(() => {
      const row = screen.getByText('teacher@example.com').closest('tr') as HTMLElement;
      expect(within(row).getAllByText('admin').length).toBeGreaterThan(0);
    });
  });

  it('stages a removal through the row confirm action', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByText('teacher@example.com')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /remove teacher@example.com/i }));

    expect(await screen.findByText(/remove teacher@example.com from authorised users\?/i)).toBeInTheDocument();
    expect(screen.getByText('teacher@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm removal' }));

    await waitFor(() => {
      expect(screen.queryByText('teacher@example.com')).not.toBeInTheDocument();
    });
  });

  it('keeps the staged row when the removal confirmation is cancelled', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByText('teacher@example.com')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /remove teacher@example.com/i }));

    expect(await screen.findByText(/remove teacher@example.com from authorised users\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('teacher@example.com')).toBeInTheDocument();
  });

  it('preserves staged edits across a re-render', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));

    const renderResult = renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email/i), 'newteacher@example.com');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText('newteacher@example.com')).toBeInTheDocument();

    renderResult.rerender(
      <QueryClientProvider client={renderResult.queryClient}>
        <StartupWarmupStateProvider warmupState="ready">
          <ApplicationAccessContext.Provider value={administratorAccessContextValue}>
            <AuthenticationSettingsTab />
          </ApplicationAccessContext.Provider>
        </StartupWarmupStateProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('newteacher@example.com')).toBeInTheDocument();
  });
});

describe('Authentication mode-switch confirmation modal', () => {

  it('opens the confirmation modal when the baseline mode is changed', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    const modeSelect = await screen.findByRole('combobox', { name: /authentication mode/i });
    await user.click(modeSelect);
    await user.click(await screen.findByText('Google Groups', { selector: '.ant-select-item-option-content' }));

    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText(/change authentication mode\?/i)).toBeInTheDocument();
    expect(
      within(modal).getByText(/access will be verified against membership of the google group/i)
    ).toBeInTheDocument();
  });

  it('reverts the mode select when the modal is cancelled', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    const modeSelect = await screen.findByRole('combobox', { name: /authentication mode/i });
    await user.click(modeSelect);
    await user.click(await screen.findByText('Google Groups', { selector: '.ant-select-item-option-content' }));

    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.getAllByText('Script Properties').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('swaps the visible regions and seeds the candidate list when the switch is confirmed', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(groupsModeSettings));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    const modeSelect = await screen.findByRole('combobox', { name: /authentication mode/i });
    await user.click(modeSelect);
    await user.click(await screen.findByText('Script Properties', { selector: '.ant-select-item-option-content' }));

    const modal = await screen.findByRole('dialog');
    expect(
      within(modal).getByText(/access will be verified against the authorised user list below/i)
    ).toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: /confirm switch/i }));

    expect(await screen.findByRole('columnheader', { name: /email/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Authentication settings save success payload and feedback', () => {

  it('sends one atomic save payload with the expected revision and announces success via the App message instance', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));
    setAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(successfulSaveResult));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(setAuthenticationSettingsMock).toHaveBeenCalledTimes(1);
    });

    const savePayload = setAuthenticationSettingsMock.mock.calls[0][0];
    expect(savePayload).toMatchObject({
      authMode: 'scriptProperties',
      expectedAuthRevision: '1',
      authUsers: expect.arrayContaining([{ email: 'admin@example.com', role: 'admin' }]),
    });
    expect(messageSuccessMock).toHaveBeenCalledWith('Authentication settings saved.');
  });

  it('omits the user list and expected revision from the groups-mode save payload', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(groupsModeSettings));
    setAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(successfulSaveResult));

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(setAuthenticationSettingsMock).toHaveBeenCalledTimes(1);
    });

    const savePayload = setAuthenticationSettingsMock.mock.calls[0][0];
    expect(savePayload).toEqual({
      authMode: 'googleGroups',
      authGroupEmail: 'teachers@example.com',
    });
    expect(savePayload).not.toHaveProperty('authUsers');
    expect(savePayload).not.toHaveProperty('expectedAuthRevision');
  });
});

describe('Stale revision conflict handling', () => {

  it('keeps a persistent warning, preserves the staged list, and leaves storage untouched on a stale revision', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));
    setAuthenticationSettingsMock.mockRejectedValueOnce(
      new Error('STALE_AUTH_REVISION: another administrator saved first.')
    );

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/another administrator saved first/i);
    });
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.queryByText(/authentication settings saved/i)).not.toBeInTheDocument();
  });
});

describe('Last-admin and candidate-check save failures', () => {

  it('surfaces a last-admin removal error in the status stack while keeping the form usable', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));
    setAuthenticationSettingsMock.mockRejectedValueOnce(
      new Error('LAST_ADMIN_REMOVED: at least one admin must remain.')
    );

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/at least one admin must remain/i);
    });
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    expect(getAuthenticationSettingsMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a candidate-check failure in the status stack while keeping the form usable', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(scriptPropertiesModeSettings));
    setAuthenticationSettingsMock.mockRejectedValueOnce(
      new Error('CANDIDATE_CHECK_FAILED: your admin access is missing from the candidate list.')
    );

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/candidate list/i);
    });
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });
});

describe('Authentication settings load failure blocking treatment', () => {

  it('renders a blocking Card with an Alert and no form controls when the settings read fails', async () => {
    getAuthenticationSettingsMock.mockRejectedValueOnce(
      new Error('UNAUTHORIZED: unable to read authentication settings.')
    );

    renderAuthenticationSettingsTab(administratorAccessContextValue);

    const panel = await screen.findByRole('region', { name: /authentication settings panel/i });
    await waitFor(() => expect(within(panel).getByRole('alert')).toBeInTheDocument());
    expect(within(panel).queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(
      within(panel).queryByRole('heading', { level: 3, name: /authentication provider/i })
    ).not.toBeInTheDocument();
  });
});
