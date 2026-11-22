/**
 * Component tests for saving Authentication settings from the tab: the atomic
 * save payload and success feedback, revision rebasing, stale-revision conflicts,
 * backend failure-code mapping and local blank-group-email validation.
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
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SetAuthenticationSettingsRequestSchema } from '@/services/authService/authService.zod';
import {
  getAuthenticationSettingsMock,
  messageErrorMock,
  messageSuccessMock,
  setAuthenticationSettingsMock,
} from '@/test/settings/authenticationSettings.mockHandles';
import {
  blankGroupGroupsModeSettings,
  createAuthSettingsSaveError,
  genericSaveErrorMessage,
  groupsModeSettings,
  renderTabAndClickSave,
  saveFailureCases,
  scriptPropertiesModeSettings,
  successfulSaveResult,
} from '@/test/settings/authenticationSettingsTestHelpers';

const expectedSecondSaveCallCount = 2;

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

describe('Authentication settings save success payload and feedback', () => {
  it('sends one atomic save payload with the expected revision and announces success via the App message instance', async () => {
    setAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(successfulSaveResult)
    );

    await renderTabAndClickSave(scriptPropertiesModeSettings, user);

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
    setAuthenticationSettingsMock.mockImplementationOnce(() =>
      Promise.resolve(successfulSaveResult)
    );

    await renderTabAndClickSave(groupsModeSettings, user);

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

  it('rebases the expected revision after a successful save so a second save sends the committed revision', async () => {
    setAuthenticationSettingsMock
      .mockImplementationOnce(() => Promise.resolve({ success: true as const, authRevision: '2' }))
      .mockImplementationOnce(() => Promise.resolve({ success: true as const, authRevision: '3' }));

    await renderTabAndClickSave(scriptPropertiesModeSettings, user);

    await waitFor(() => expect(setAuthenticationSettingsMock).toHaveBeenCalledTimes(1));
    expect(setAuthenticationSettingsMock.mock.calls[0][0]).toMatchObject({
      authMode: 'scriptProperties',
      expectedAuthRevision: '1',
    });

    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() =>
      expect(setAuthenticationSettingsMock).toHaveBeenCalledTimes(expectedSecondSaveCallCount)
    );
    expect(setAuthenticationSettingsMock.mock.calls[1][0]).toMatchObject({
      authMode: 'scriptProperties',
      expectedAuthRevision: '2',
    });
  });
});

describe('Stale revision conflict handling', () => {
  it('keeps a persistent warning, preserves the staged list, and leaves storage untouched on a stale revision', async () => {
    setAuthenticationSettingsMock.mockRejectedValueOnce(
      createAuthSettingsSaveError(
        'AUTH_SETTINGS_STALE_REVISION',
        'Stale auth revision: the stored settings changed since this save was prepared.'
      )
    );

    await renderTabAndClickSave(scriptPropertiesModeSettings, user);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/another administrator saved first/i);
    });
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.queryByText(/authentication settings saved/i)).not.toBeInTheDocument();
  });
});

describe('Authentication settings save failure mapping', () => {
  it.each(saveFailureCases)(
    'maps $name to the expected status copy',
    async ({
      settings,
      error,
      expectedAlert,
      unexpectedInAlert,
      unexpectedInDocument,
      expectSaveEnabled,
      expectReadCalledOnce,
    }) => {
      setAuthenticationSettingsMock.mockRejectedValueOnce(error);

      await renderTabAndClickSave(settings, user);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(expectedAlert);
      if (unexpectedInAlert) {
        for (const pattern of unexpectedInAlert) {
          expect(alert).not.toHaveTextContent(pattern);
        }
      }
      if (unexpectedInDocument) {
        expect(screen.queryByText(unexpectedInDocument)).not.toBeInTheDocument();
      }
      if (expectSaveEnabled) {
        expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
      }
      if (expectReadCalledOnce) {
        expect(getAuthenticationSettingsMock).toHaveBeenCalledTimes(1);
      }
    }
  );
});

describe('Blank group-email local validation', () => {
  it('surfaces the targeted blank group-email validation copy instead of the generic save copy', async () => {
    const blankGroupValidation = SetAuthenticationSettingsRequestSchema.safeParse({
      authMode: 'googleGroups',
      authGroupEmail: '',
    });
    if (blankGroupValidation.success) {
      throw new Error('Expected a blank group email to fail request validation.');
    }
    setAuthenticationSettingsMock.mockRejectedValueOnce(blankGroupValidation.error);

    await renderTabAndClickSave(blankGroupGroupsModeSettings, user);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/auth group email must be non-blank/i);
    });
    expect(screen.queryByText(genericSaveErrorMessage)).not.toBeInTheDocument();
  });
});
