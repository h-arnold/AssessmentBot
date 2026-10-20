import '@/test/auth/appAuthGate.mockSetup';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationAccess } from '@/services/authService/authService.zod';
import {
  createQueryWrapper,
  EMPTY_STARTUP_WARMUP_RESULT,
  grantedAdminAccess,
} from '@/test/auth/appAuthGateTestHelpers';
import { useApplicationAccessContext } from './ApplicationAccessContext';
import { AppAuthGate } from './AppAuthGate';
import {
  getApplicationAccess,
  hasScriptAuthorisation,
} from '@/services/authService/authService';
import { warmStartupQueries } from '@/query/sharedQueries';

const getAuthorisationStatusMock = vi.mocked(hasScriptAuthorisation);
const warmStartupQueriesMock = vi.mocked(warmStartupQueries);
const getApplicationAccessMock = vi.mocked(getApplicationAccess);

/**
 * Probes the application access context delivered to the gate's children subtree.
 *
 * @returns {JSX.Element} The probe element exposing the resolved access context.
 */
function AccessGateContextProbe() {
  const access = useApplicationAccessContext();
  return (
    <output data-testid="access-context">{access ? JSON.stringify(access) : 'no-provider'}</output>
  );
}

/**
 * Renders the auth gate with an authorised caller and a resolved access result.
 *
 * @param {ApplicationAccess} access The access result the mocked service resolves with.
 * @returns {ReturnType<typeof render>} The render result.
 */
function renderGateWithResolvedAccess(access: ApplicationAccess) {
  getAuthorisationStatusMock.mockResolvedValueOnce(true);
  warmStartupQueriesMock.mockResolvedValueOnce(EMPTY_STARTUP_WARMUP_RESULT);
  getApplicationAccessMock.mockResolvedValueOnce(access);
  const { QueryWrapper } = createQueryWrapper();

  return render(
    <AppAuthGate>
      <AccessGateContextProbe />
    </AppAuthGate>,
    { wrapper: QueryWrapper }
  );
}

describe('ApplicationAccessContext', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('delivers the resolved role and reason to consumers through the gate-mounted context', async () => {
    renderGateWithResolvedAccess(grantedAdminAccess);

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('access-context')).toHaveTextContent('"role":"admin"');
  });

  it('exposes the full access context value (role, reason, allowed, email) to consumers', async () => {
    const memberAccess: ApplicationAccess = {
      allowed: false,
      role: 'user',
      email: 'member@example.com',
      reason: 'ok',
    };

    renderGateWithResolvedAccess(memberAccess);

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('access-context')).toHaveTextContent(
      JSON.stringify(memberAccess)
    );
  });
});
