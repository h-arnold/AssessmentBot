/**
 * Component tests for staging edits to the authorised-user list shown by the
 * Authentication settings tab in scriptProperties mode.
 *
 * These specs describe the mounted behaviour of `AuthenticationSettingsTab`
 * once it is rendered by the Settings page. The tab owns its staged state through
 * the `useAuthenticationSettings` hook and renders the single-Form/single-submit
 * layout from the Authentication settings layout contract.
 *
 * Tab-visibility gating lives in SettingsPage (it consumes the application access
 * context to decide whether the Authentication tab is shown) and is covered by the
 * separate SettingsPage-level integration spec in this folder, so this file never
 * forces the tab component to self-gate.
 */

import '@/test/settings/authenticationSettings.mockSetup';
import { QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationAccessContext } from '@/features/auth/ApplicationAccessContext';
import { StartupWarmupStateProvider } from '@/features/auth/startupWarmupState';
import { AuthenticationSettingsTab } from './AuthenticationSettingsTab';
import {
  getAuthenticationSettingsMock,
  messageErrorMock,
  messageSuccessMock,
  setAuthenticationSettingsMock,
} from '@/test/settings/authenticationSettings.mockHandles';
import {
  administratorAccessContextValue,
  emptyUserListSettings,
  renderAuthenticationSettingsTab,
  scriptPropertiesModeSettings,
} from '@/test/settings/authenticationSettingsTestHelpers';

let user: ReturnType<typeof userEvent.setup>;

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

describe('Script Properties staged user-list editing', () => {
  it('normalises the email when a user is added', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(scriptPropertiesModeSettings)
    );

    renderAuthenticationSettingsTab();

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email/i), 'MixedCase@Example.com');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText('mixedcase@example.com')).toBeInTheDocument();
  });

  it('shows the at-least-one-administrator explanation when the staged user list is empty', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(emptyUserListSettings)
    );

    renderAuthenticationSettingsTab();

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/at least one administrator is required/i)).toBeInTheDocument();
  });

  it('blocks adding a duplicate staged email without creating a second row', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(scriptPropertiesModeSettings)
    );

    renderAuthenticationSettingsTab();

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email/i), 'teacher@example.com');
    await user.click(screen.getByRole('button', { name: /add/i }));

    const duplicateRows = screen.getAllByText('teacher@example.com');
    expect(duplicateRows).toHaveLength(1);
  });

  it('stages a role change through the inline role select', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(scriptPropertiesModeSettings)
    );

    renderAuthenticationSettingsTab();

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /role/i })).toBeInTheDocument();
    });

    const teacherRow = screen.getByText('teacher@example.com').closest('tr') as HTMLElement;
    const teacherRoleSelect = within(teacherRow).getByRole('combobox', { name: /role/i });
    await user.click(teacherRoleSelect);
    await user.click(
      await screen.findByText('admin', { selector: '.ant-select-item-option-content' })
    );
    await waitFor(() => {
      const row = screen.getByText('teacher@example.com').closest('tr') as HTMLElement;
      expect(within(row).getAllByText('admin').length).toBeGreaterThan(0);
    });
  });

  it('stages a removal through the row confirm action', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(scriptPropertiesModeSettings)
    );

    renderAuthenticationSettingsTab();

    await waitFor(() => {
      expect(screen.getByText('teacher@example.com')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /remove teacher@example.com/i }));

    expect(
      await screen.findByText(/remove teacher@example.com from authorised users\?/i)
    ).toBeInTheDocument();
    expect(screen.getByText('teacher@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm removal' }));

    await waitFor(() => {
      expect(screen.queryByText('teacher@example.com')).not.toBeInTheDocument();
    });
  });

  it('keeps the staged row when the removal confirmation is cancelled', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(scriptPropertiesModeSettings)
    );

    renderAuthenticationSettingsTab();

    await waitFor(() => {
      expect(screen.getByText('teacher@example.com')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /remove teacher@example.com/i }));

    expect(
      await screen.findByText(/remove teacher@example.com from authorised users\?/i)
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('teacher@example.com')).toBeInTheDocument();
  });

  it('preserves staged edits across a re-render', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(scriptPropertiesModeSettings)
    );

    const renderResult = renderAuthenticationSettingsTab();

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
