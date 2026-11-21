import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApplicationAccessContext,
  type ApplicationAccessContextValue,
} from '@/features/auth/ApplicationAccessContext';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import type { AuthenticationSettings } from '@/services/authService/authService.zod';
import { AuthenticationSettingsTab } from './AuthenticationSettingsTab';

const { getAuthenticationSettingsMock, setAuthenticationSettingsMock } = vi.hoisted(() => {
  return {
    getAuthenticationSettingsMock: vi.fn(),
    setAuthenticationSettingsMock: vi.fn(),
  };
});

vi.mock('@/services/authService/authService', () => {
  return {
    getAuthenticationSettings: getAuthenticationSettingsMock,
    setAuthenticationSettings: setAuthenticationSettingsMock,
  };
});

const administratorAccess: ApplicationAccessContextValue = {
  role: 'admin',
  reason: 'ok',
  allowed: true,
  email: 'admin@example.com',
};

const settings: AuthenticationSettings = {
  authMode: 'googleGroups',
  authGroupEmail: 'teachers@example.com',
  authUsers: [],
  authRevision: null,
};

afterEach(() => {
  vi.resetAllMocks();
});

beforeEach(() => {
  getAuthenticationSettingsMock.mockImplementation(() => Promise.resolve(settings));
  setAuthenticationSettingsMock.mockImplementation(() =>
    Promise.resolve({ success: true as const, authRevision: '2' })
  );
});

describe('AuthenticationSettingsTab form structure', () => {
  it('keeps the provider card and sole save submit action inside one form', async () => {
    renderWithFrontendProviders(
      <ApplicationAccessContext.Provider value={administratorAccess}>
        <AuthenticationSettingsTab />
      </ApplicationAccessContext.Provider>
    );

    await screen.findByRole('button', { name: 'Save' });
    const forms = document.querySelectorAll('form');
    expect(forms).toHaveLength(1);
    const [form] = forms;
    expect(form).toBeDefined();
    if (!form) {
      throw new Error('Expected the authentication settings form to be rendered');
    }
    expect(
      within(form).getByRole('heading', { level: 3, name: 'Authentication provider' })
    ).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
    expect(form.querySelectorAll('button[type="submit"], input[type="submit"]')).toHaveLength(1);
    expect(setAuthenticationSettingsMock).not.toHaveBeenCalled();
  });
});
