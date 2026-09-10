import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import type * as SharedQueriesModule from '../../query/sharedQueries';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../../query/queryClient';
import { useApplicationAccessContext } from './ApplicationAccessContext';
import { AppAuthGate } from './AppAuthGate';

const {
  getAuthorisationStatusMock,
  warmStartupQueriesMock,
  getApplicationAccessMock,
} = vi.hoisted(() => ({
  getAuthorisationStatusMock: vi.fn(),
  warmStartupQueriesMock: vi.fn(),
  getApplicationAccessMock: vi.fn(),
}));

vi.mock('../../services/authService/authService', () => ({
  getAuthorisationStatus: getAuthorisationStatusMock,
  getApplicationAccess: getApplicationAccessMock,
}));

vi.mock('../../query/sharedQueries', async () => {
  const actual = await vi.importActual<typeof SharedQueriesModule>('../../query/sharedQueries');

  return {
    ...actual,
    warmStartupQueries: warmStartupQueriesMock,
  };
});

/**
 * Probes the application access context delivered to the gate's children subtree.
 *
 * @returns {JSX.Element} The probe element exposing the resolved access context.
 */
function AccessGateContextProbe() {
  const access = useApplicationAccessContext();
  return (
    <output data-testid="access-context">
      {access ? JSON.stringify(access) : 'no-provider'}
    </output>
  );
}

/**
 * Creates a React Query client wrapper for application access context tests.
 *
 * @returns {{ queryClient: ReturnType<typeof createAppQueryClient>; QueryWrapper(properties: Readonly<PropsWithChildren>): JSX.Element }} The query client and provider wrapper.
 */
function createQueryWrapper() {
  const queryClient = createAppQueryClient();

  /**
   * Wraps children in the shared test query client.
   *
   * @param {Readonly<PropsWithChildren>} properties Wrapper properties.
   * @returns {JSX.Element} The wrapped children.
   */
  function QueryWrapper({ children }: Readonly<PropsWithChildren>) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, QueryWrapper };
}

describe('ApplicationAccessContext', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('delivers the resolved role and reason to consumers through the gate-mounted context', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockResolvedValueOnce({});
    getApplicationAccessMock.mockResolvedValueOnce({
      allowed: true,
      role: 'admin',
      email: 'owner@example.com',
      reason: 'ok',
    });
    const { QueryWrapper } = createQueryWrapper();

    render(
      <AppAuthGate>
        <AccessGateContextProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('access-context')).toHaveTextContent('"role":"admin"');
  });

  it('exposes the full access context value (role, reason, allowed, email) to consumers', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockResolvedValueOnce({});
    getApplicationAccessMock.mockResolvedValueOnce({
      allowed: false,
      role: 'user',
      email: 'member@example.com',
      reason: 'ok',
    });
    const { QueryWrapper } = createQueryWrapper();

    render(
      <AppAuthGate>
        <AccessGateContextProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('access-context')).toHaveTextContent(
      JSON.stringify({
        allowed: false,
        role: 'user',
        email: 'member@example.com',
        reason: 'ok',
      })
    );
  });
});
