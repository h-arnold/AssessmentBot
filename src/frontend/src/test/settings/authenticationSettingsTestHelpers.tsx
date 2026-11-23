/**
 * Shared fixtures and render helpers for the Authentication settings tab specs.
 *
 * The suites render the real tab against seeded service mocks. Keep the
 * administrator access context, the mode/settings fixtures, the save-failure
 * matrix and the render/save helpers here so each suite owns only its own
 * scenarios and assertions.
 */

import { screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import {
  ApplicationAccessContext,
  type ApplicationAccessContextValue,
} from '@/features/auth/ApplicationAccessContext';
import { AuthenticationSettingsTab } from '@/features/settings/authentication/AuthenticationSettingsTab/AuthenticationSettingsTab';
import { ApiTransportError } from '@/errors/apiTransportError';
import type { AuthenticationSettings } from '@/services/authService/authService.zod';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import { getAuthenticationSettingsMock } from './authenticationSettings.mockHandles';

/** Administrator access context used to mount the admin-only tab content. */
export const administratorAccessContextValue: ApplicationAccessContextValue = {
  role: 'admin',
  reason: 'ok',
  allowed: true,
  email: 'admin@example.com',
};

/** Settings loaded when the tab is configured for Google Groups membership. */
export const groupsModeSettings: AuthenticationSettings = {
  authMode: 'googleGroups',
  authGroupEmail: 'teachers@example.com',
  authUsers: [],
  authRevision: null,
};

/** Settings loaded when the tab is configured with an explicit authorised-user list. */
export const scriptPropertiesModeSettings: AuthenticationSettings = {
  authMode: 'scriptProperties',
  authGroupEmail: '',
  authUsers: [
    { email: 'admin@example.com', role: 'admin' },
    { email: 'teacher@example.com', role: 'user' },
  ],
  authRevision: '1',
};

/** scriptProperties settings whose staged user list has been emptied. */
export const emptyUserListSettings: AuthenticationSettings = {
  authMode: 'scriptProperties',
  authGroupEmail: '',
  authUsers: [],
  authRevision: '1',
};

/** googleGroups settings with no configured group email, for local validation. */
export const blankGroupGroupsModeSettings: AuthenticationSettings = {
  authMode: 'googleGroups',
  authGroupEmail: '',
  authUsers: [],
  authRevision: null,
};

/** Copy shown when the save failure has no dedicated user-safe mapping. */
export const genericSaveErrorMessage = 'Unable to save authentication settings right now.';

/** Result returned by the mocked save service after a successful write. */
export const successfulSaveResult = {
  success: true as const,
  authRevision: '2',
};

/**
 * Builds the transport error the mocked save service rejects with for a stable
 * backend authentication-settings failure code.
 *
 * @param {string} code The stable backend error code.
 * @param {string} message The backend-safe failure message.
 * @returns {ApiTransportError} The transport error to reject the save with.
 */
export function createAuthSettingsSaveError(code: string, message: string): ApiTransportError {
  return new ApiTransportError({
    requestId: `req-${code.toLowerCase()}`,
    error: { code, message, isRetriable: code === 'RATE_LIMITED' },
  });
}

/** One save-failure mapping scenario and its expected user-visible copy. */
export type SaveFailureCase = Readonly<{
  name: string;
  settings: AuthenticationSettings;
  error: unknown;
  expectedAlert: string | RegExp;
  unexpectedInAlert?: readonly RegExp[];
  unexpectedInDocument?: RegExp;
  expectSaveEnabled?: boolean;
  expectReadCalledOnce?: boolean;
}>;

/** Save-failure scenarios asserted by the failure-mapping suite. */
export const saveFailureCases: readonly SaveFailureCase[] = [
  {
    name: 'a last-admin removal error',
    settings: scriptPropertiesModeSettings,
    error: createAuthSettingsSaveError(
      'AUTH_SETTINGS_LAST_ADMIN',
      'Auth Users must contain at least one admin.'
    ),
    expectedAlert: /at least one admin must remain/i,
    expectSaveEnabled: true,
    expectReadCalledOnce: true,
  },
  {
    name: 'a candidate-check failure',
    settings: scriptPropertiesModeSettings,
    error: createAuthSettingsSaveError(
      'AUTH_SETTINGS_INVALID_CANDIDATE',
      'The candidate authentication configuration was rejected.'
    ),
    expectedAlert: /the candidate list is invalid\. review the authorised users and try again\./i,
    unexpectedInAlert: [/missing from the candidate list/i],
    expectSaveEnabled: true,
  },
  {
    name: 'a googleGroups saving-admin denial',
    settings: groupsModeSettings,
    error: createAuthSettingsSaveError(
      'AUTH_SETTINGS_SAVING_ADMIN_DENIED',
      'The saving administrator must be an OWNER or MANAGER of the candidate group when switching to googleGroups mode.'
    ),
    expectedAlert: /group role|owner|manager|group membership|group admin/i,
    unexpectedInAlert: [/candidate list/i, /add yourself as an admin/i],
    expectSaveEnabled: true,
  },
  {
    name: 'a scriptProperties saving-admin denial',
    settings: scriptPropertiesModeSettings,
    error: createAuthSettingsSaveError(
      'AUTH_SETTINGS_SAVING_ADMIN_DENIED',
      'The saving administrator is missing from the candidate list.'
    ),
    expectedAlert:
      /your admin access is missing from the candidate list\. add yourself as an admin and try again\./i,
    unexpectedInAlert: [/group role|owner|manager|group membership/i],
    expectSaveEnabled: true,
  },
  {
    name: 'a RATE_LIMITED transport code',
    settings: scriptPropertiesModeSettings,
    error: createAuthSettingsSaveError(
      'RATE_LIMITED',
      'Authentication settings could not be saved because the configuration lock is busy. Please retry.'
    ),
    expectedAlert: /the service is busy\. please try again shortly\./i,
    expectSaveEnabled: true,
  },
  {
    name: 'a prose-only failure that carries no transport code',
    settings: scriptPropertiesModeSettings,
    error: new Error('Another administrator saved first. Review and re-save your changes.'),
    expectedAlert: genericSaveErrorMessage,
    unexpectedInDocument: /another administrator saved first/i,
  },
];

/**
 * Renders the authentication settings tab inside the application access context
 * and the shared frontend providers.
 *
 * @returns {ReturnType<typeof render>} The render result.
 */
export function renderAuthenticationSettingsTab() {
  return renderWithFrontendProviders(
    <ApplicationAccessContext.Provider value={administratorAccessContextValue}>
      <AuthenticationSettingsTab />
    </ApplicationAccessContext.Provider>
  );
}

/**
 * Renders the tab with the given settings loaded and activates the save action.
 *
 * @param {AuthenticationSettings} settings The settings the mocked read resolves with.
 * @param {ReturnType<typeof userEvent.setup>} user The user-event instance owned by the calling suite.
 * @returns {Promise<void>} Resolves once the save trigger has been activated.
 */
export async function renderTabAndClickSave(
  settings: AuthenticationSettings,
  user: ReturnType<typeof userEvent.setup>
): Promise<void> {
  getAuthenticationSettingsMock.mockImplementationOnce(() => Promise.resolve(settings));
  renderAuthenticationSettingsTab();

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  await user.click(screen.getByRole('button', { name: /save/i }));
}
