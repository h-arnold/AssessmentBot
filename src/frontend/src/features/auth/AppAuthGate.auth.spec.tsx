import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import type * as SharedQueriesModule from '../../query/sharedQueries';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { createAppQueryClient } from '../../query/queryClient';
import { AuthStatusCard } from './AuthStatusCard';
import { AppAuthGate } from './AppAuthGate';
import { useAuthorisationStatus } from './useAuthorisationStatus';

const { getAuthorisationStatusMock, warmClassPartialsMock } = vi.hoisted(() => ({
  getAuthorisationStatusMock: vi.fn(),
  warmClassPartialsMock: vi.fn(),
}));

vi.mock('../../services/authService', () => ({
  getAuthorisationStatus: getAuthorisationStatusMock,
}));

vi.mock('../../query/sharedQueries', async () => {
  const actual = await vi.importActual<typeof SharedQueriesModule>('../../query/sharedQueries');

  return {
    ...actual,
    warmClassPartials: warmClassPartialsMock,
  };
});

/**
 * Exposes the shared auth-hook result for gate-adjacent assertions.
 */
function AuthHookProbe() {
  const { authViewState, authError, isAuthResolved, isAuthorised } = useAuthorisationStatus();

  return (
    <output data-testid="auth-hook-probe">
      {JSON.stringify({
        authViewState,
        authError,
        isAuthResolved,
        isAuthorised,
      })}
    </output>
  );
}

/**
 * Creates a fresh React Query wrapper for each test.
 */
function createQueryWrapper() {
  const queryClient = createAppQueryClient();

  /**
   * Provides the per-test query client to rendered children.
   */
  function QueryWrapper({ children }: Readonly<PropsWithChildren>) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return {
    queryClient,
    QueryWrapper,
  };
}

describe('AppAuthGate', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shares the resolved auth result with the auth UI without a second auth request', async () => {
    const { QueryWrapper, queryClient } = createQueryWrapper();
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmClassPartialsMock.mockResolvedValueOnce([]);

    render(
      <AppAuthGate>
        <AuthStatusCard />
        <AuthHookProbe />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    expect(screen.getByText('Checking authorisation status...')).toBeInTheDocument();
    expect(await screen.findByText('Authorised')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('auth-hook-probe')).toHaveTextContent(
        JSON.stringify({
          authViewState: 'authorised',
          authError: null,
          isAuthResolved: true,
          isAuthorised: true,
        })
      );
    });

    await waitFor(() => {
      expect(warmClassPartialsMock).toHaveBeenCalledWith(queryClient);
    });

    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });

  it('preserves the unauthorised auth UI behaviour without starting warm-up', async () => {
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockResolvedValueOnce(false);

    render(
      <AppAuthGate>
        <AuthStatusCard />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    expect(await screen.findByText('Unauthorised')).toBeInTheDocument();
    expect(screen.queryByText('Checking authorisation status...')).not.toBeInTheDocument();
    expect(warmClassPartialsMock).not.toHaveBeenCalled();
    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });

  it('preserves the failure auth UI behaviour without starting warm-up', async () => {
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockRejectedValueOnce(
      new ApiTransportError({
        requestId: 'req-auth-gate',
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limited.',
          retriable: true,
        },
      })
    );

    render(
      <AppAuthGate>
        <AuthStatusCard />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    expect(await screen.findByText('Unauthorised')).toBeInTheDocument();
    expect(
      await screen.findByText('The service is busy. Please try again shortly.')
    ).toBeInTheDocument();
    expect(warmClassPartialsMock).not.toHaveBeenCalled();
    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });
});
