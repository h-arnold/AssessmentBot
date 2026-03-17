import { QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { createAppQueryClient } from '../../query/queryClient';
import { useAuthorisationStatus } from './useAuthorisationStatus';

const { getAuthorisationStatusMock } = vi.hoisted(() => ({
  getAuthorisationStatusMock: vi.fn(),
}));

vi.mock('../../services/authService', () => ({
  getAuthorisationStatus: getAuthorisationStatusMock,
}));

/**
 * Creates a fresh React Query wrapper for each test.
 */
function createQueryWrapper() {
  const queryClient = createAppQueryClient();

  return function QueryWrapper({ children }: Readonly<PropsWithChildren>) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/**
 * Exposes the shared auth-hook result for multi-consumer assertions.
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

describe('useAuthorisationStatus', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exposes a resolved authorised result through the shared auth hook', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(true);

    const { useAuthorisationStatus } = await import('./useAuthorisationStatus');
    const { result } = renderHook(() => useAuthorisationStatus(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.authViewState).toBe('loading');
    expect(result.current.isAuthResolved).toBe(false);

    await waitFor(() => {
      expect(result.current).toMatchObject({
        authViewState: 'authorised',
        authError: null,
        isAuthResolved: true,
        isAuthorised: true,
      });
    });
  });

  it('maps an unauthorised backend result to the existing unauthorised view state', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(false);

    const { useAuthorisationStatus } = await import('./useAuthorisationStatus');
    const { result } = renderHook(() => useAuthorisationStatus(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        authViewState: 'unauthorised',
        authError: null,
        isAuthResolved: true,
        isAuthorised: false,
      });
    });
  });

  it('maps auth failures to the existing user-safe copy', async () => {
    getAuthorisationStatusMock.mockRejectedValueOnce(
      new ApiTransportError({
        requestId: 'req-1',
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limited.',
          retriable: true,
        },
      })
    );

    const { useAuthorisationStatus } = await import('./useAuthorisationStatus');
    const { result } = renderHook(() => useAuthorisationStatus(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        authViewState: 'unauthorised',
        authError: 'The service is busy. Please try again shortly.',
        isAuthResolved: true,
        isAuthorised: false,
      });
    });
  });

  it('lets shared auth state be consumed without a second auth transport call', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(true);

    const { AuthStatusCard } = await import('./AuthStatusCard');

    render(
      <>
        <AuthStatusCard />
        <AuthHookProbe />
      </>,
      {
        wrapper: createQueryWrapper(),
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
    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });
});
