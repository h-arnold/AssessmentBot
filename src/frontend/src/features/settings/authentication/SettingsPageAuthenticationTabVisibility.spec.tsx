/**
 * SettingsPage-level integration test for Authentication tab visibility gating.
 *
 * Per the Authentication settings layout contract, the tab-visibility gate lives
 * in SettingsPage: it consumes the application access context to decide whether
 * the Authentication tab is shown (admin sees it, non-admin does not). The gate is
 * deliberately NOT inside the tab component, so this spec is kept separate from the
 * mounted-content behaviour tests in `AuthenticationSettingsTab.spec.tsx` and never
 * forces the tab component to self-gate.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ApplicationAccessContext,
  type ApplicationAccessContextValue,
} from '../../auth/ApplicationAccessContext';
import { renderWithFrontendProviders } from '../../../test/renderWithFrontendProviders';
import { SettingsPage } from '../../../pages/SettingsPage';

const administratorAccessContextValue: ApplicationAccessContextValue = {
  role: 'admin',
  reason: 'ok',
  allowed: true,
  email: 'admin@example.com',
};

const standardUserAccessContextValue: ApplicationAccessContextValue = {
  role: 'user',
  reason: 'ok',
  allowed: true,
  email: 'user@example.com',
};

/**
 * Renders the Settings page inside the application access context and the shared
 * frontend providers.
 *
 * @param {ApplicationAccessContextValue} accessContextValue The access role context to mount.
 * @returns {ReturnType<typeof renderWithFrontendProviders>} The render result.
 */
function renderSettingsPage(accessContextValue: ApplicationAccessContextValue) {
  return renderWithFrontendProviders(
    <ApplicationAccessContext.Provider value={accessContextValue}>
      <SettingsPage />
    </ApplicationAccessContext.Provider>
  );
}

describe('Authentication tab visibility gating at the Settings page', () => {
  it('shows the Authentication tab for an admin user', () => {
    renderSettingsPage(administratorAccessContextValue);

    expect(screen.getByRole('tab', { name: /authentication/i })).toBeInTheDocument();
  });

  it('does not show the Authentication tab for a non-admin user', () => {
    renderSettingsPage(standardUserAccessContextValue);

    expect(
      screen.queryByRole('tab', { name: /authentication/i })
    ).not.toBeInTheDocument();
  });
});
