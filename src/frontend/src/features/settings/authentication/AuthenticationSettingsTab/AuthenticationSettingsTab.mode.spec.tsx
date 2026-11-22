/**
 * Component tests for the Authentication settings tab's mode regions and the
 * confirmation modal shown when the baseline authentication mode is changed.
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
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAuthenticationSettingsMock,
  messageErrorMock,
  messageSuccessMock,
  setAuthenticationSettingsMock,
} from '@/test/settings/authenticationSettings.mockHandles';
import {
  groupsModeSettings,
  renderAuthenticationSettingsTab,
  scriptPropertiesModeSettings,
  successfulSaveResult,
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

describe('Authentication mode region rendering', () => {
  it('shows the group email and membership note in googleGroups mode and hides the user list', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(groupsModeSettings));

    renderAuthenticationSettingsTab();

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
    getAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(scriptPropertiesModeSettings)
    );

    renderAuthenticationSettingsTab();

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

    renderAuthenticationSettingsTab();

    const groupEmailInput = await screen.findByLabelText(/auth group email/i);
    expect(groupEmailInput).toHaveValue('teachers@example.com');

    await user.clear(groupEmailInput);

    expect(groupEmailInput).toHaveValue('teachers@example.com');
    expect(screen.getByText(/cannot be cleared once set/i)).toBeInTheDocument();
    expect(setAuthenticationSettingsMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });

  it('blocks clearing a group email that was set and saved earlier in the session', async () => {
    setAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(successfulSaveResult)
    );
    getAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(scriptPropertiesModeSettings)
    );

    renderAuthenticationSettingsTab();

    const modeSelect = await screen.findByRole('combobox', { name: /authentication mode/i });
    await user.click(modeSelect);
    await user.click(
      await screen.findByText('Google Groups', { selector: '.ant-select-item-option-content' })
    );
    await user.click(await screen.findByRole('button', { name: /confirm switch/i }));

    const groupEmailInput = await screen.findByLabelText(/auth group email/i);
    await user.type(groupEmailInput, 'newgroup@example.com');
    expect(groupEmailInput).toHaveValue('newgroup@example.com');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(setAuthenticationSettingsMock).toHaveBeenCalledTimes(1);
    });

    await user.clear(groupEmailInput);

    expect(groupEmailInput).toHaveValue('newgroup@example.com');
    expect(screen.getByText(/cannot be cleared once set/i)).toBeInTheDocument();
  });
});

describe('Authentication mode-switch confirmation modal', () => {
  it('opens the confirmation modal when the baseline mode is changed', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(scriptPropertiesModeSettings)
    );

    renderAuthenticationSettingsTab();

    const modeSelect = await screen.findByRole('combobox', { name: /authentication mode/i });
    await user.click(modeSelect);
    await user.click(
      await screen.findByText('Google Groups', { selector: '.ant-select-item-option-content' })
    );

    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText(/change authentication mode\?/i)).toBeInTheDocument();
    expect(
      within(modal).getByText(/access will be verified against membership of the google group/i)
    ).toBeInTheDocument();
  });

  it('reverts the mode select when the modal is cancelled', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(scriptPropertiesModeSettings)
    );

    renderAuthenticationSettingsTab();

    const modeSelect = await screen.findByRole('combobox', { name: /authentication mode/i });
    await user.click(modeSelect);
    await user.click(
      await screen.findByText('Google Groups', { selector: '.ant-select-item-option-content' })
    );

    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.getAllByText('Script Properties').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('swaps the visible regions and seeds the candidate list when the switch is confirmed', async () => {
    getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(groupsModeSettings));

    renderAuthenticationSettingsTab();

    const modeSelect = await screen.findByRole('combobox', { name: /authentication mode/i });
    await user.click(modeSelect);
    await user.click(
      await screen.findByText('Script Properties', { selector: '.ant-select-item-option-content' })
    );

    const modal = await screen.findByRole('dialog');
    expect(
      within(modal).getByText(/access will be verified against the authorised user list below/i)
    ).toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: /confirm switch/i }));

    expect(await screen.findByRole('columnheader', { name: /email/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
