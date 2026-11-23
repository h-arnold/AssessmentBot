/**
 * Component test for the blocking treatment shown by the Authentication
 * settings tab when its initial settings read fails.
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
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAuthenticationSettingsMock,
  messageErrorMock,
  messageSuccessMock,
  setAuthenticationSettingsMock,
} from '@/test/settings/authenticationSettings.mockHandles';
import { renderAuthenticationSettingsTab } from '@/test/settings/authenticationSettingsTestHelpers';

afterEach(() => {
  getAuthenticationSettingsMock.mockReset();
  setAuthenticationSettingsMock.mockReset();
  messageSuccessMock.mockReset();
  messageErrorMock.mockReset();
  vi.resetModules();
});

describe('Authentication settings load failure blocking treatment', () => {
  it('renders a blocking Card with an Alert and no form controls when the settings read fails', async () => {
    getAuthenticationSettingsMock.mockRejectedValueOnce(
      new Error('UNAUTHORIZED: unable to read authentication settings.')
    );

    renderAuthenticationSettingsTab();

    const panel = await screen.findByRole('region', { name: /authentication settings panel/i });
    await waitFor(() => expect(within(panel).getByRole('alert')).toBeInTheDocument());
    expect(within(panel).queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(
      within(panel).queryByRole('heading', { level: 3, name: /authentication provider/i })
    ).not.toBeInTheDocument();
  });
});
