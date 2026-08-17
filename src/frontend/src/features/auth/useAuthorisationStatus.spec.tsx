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

vi.mock('../../services/authService/authService', () => ({
  getAuthorisationStatus: getAuthorisationStatusMock,
}));

/**
 * Creates a fresh React Query wrapper for each test.
 *
 * @returns {(properties: Readonly<PropsWithChildren>) => JSX.Element} The query client wrapper used by the tests.
 */
function createQueryWrapper() {
  const queryClient = createAppQueryClient();

  return function QueryWrapper({ children }: Readonly<PropsWithChildren>) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/**
 * Exposes the shared auth-hook result for multi-consumer assertions.
 *
 * @returns {JSX.Element} The rendered auth hook probe.
 */
function AuthHookProbe() {
  const { isAuthorised, isLoading, error } = useAuthorisationStatus() as unknown as {
    isAuthorised: boolean;
    isLoading: boolean;
    error: string | null;
  };

  return (
    <output data-testid="auth-hook-probe">
      {JSON.stringify({
        isAuthorised,
        isLoading,
        error,
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

    expect(result.current).toMatchObject({ isLoading: true });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        isAuthorised: true,
        isLoading: false,
        error: null,
      });
    });
  });

  it('maps an unauthorised backend result to isAuthorised false with no error', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(false);

    const { useAuthorisationStatus } = await import('./useAuthorisationStatus');
    const { result } = renderHook(() => useAuthorisationStatus(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        isAuthorised: false,
        isLoading: false,
        error: null,
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
        isAuthorised: false,
        isLoading: false,
        error: 'Too many requests. Please wait a moment and try again.',
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

    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('auth-hook-probe')).toHaveTextContent(
        JSON.stringify({
          isAuthorised: true,
          isLoading: false,
          error: null,
        })
      );
    });
    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });
});
