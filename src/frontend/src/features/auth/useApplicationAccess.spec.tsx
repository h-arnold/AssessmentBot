import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../../query/queryClient';
import { useApplicationAccess } from './useApplicationAccess';

const { getApplicationAccessMock } = vi.hoisted(() => ({
  getApplicationAccessMock: vi.fn(),
}));

vi.mock('../../services/authService/authService', () => ({
  getApplicationAccess: getApplicationAccessMock,
}));

/**
 * Renders the application access probe that surfaces the resolved access payload.
 *
 * @returns {JSX.Element} The probe element exposing the access payload.
 */
function ApplicationAccessProbe() {
  const access = useApplicationAccess();
  return <output data-testid="access-payload">{JSON.stringify(access)}</output>;
}

/**
 * Creates a React Query client wrapper for application access hook tests.
 *
 * @param {number} [staleTime] Explicit query stale-time that makes rerender/remount fetch
 *   behaviour deterministic and independent of React Query's unspecified default stale-time.
 * @returns {{ queryClient: ReturnType<typeof createAppQueryClient>; QueryWrapper(properties: Readonly<PropsWithChildren>): JSX.Element }} The query client and provider wrapper.
 */
function createQueryWrapper(staleTime?: number) {
  const queryClient = createAppQueryClient();
  if (typeof staleTime === 'number') {
    queryClient.setDefaultOptions({
      queries: { staleTime },
    });
  }

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

describe('useApplicationAccess', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('resolves the application access payload from getApplicationAccess exactly once on mount', async () => {
    getApplicationAccessMock.mockResolvedValueOnce({
      allowed: true,
      role: 'admin',
      email: 'owner@example.com',
      reason: 'ok',
    });
    const { QueryWrapper } = createQueryWrapper();
    render(<ApplicationAccessProbe />, { wrapper: QueryWrapper });

    await waitFor(() => {
      expect(screen.getByTestId('access-payload')).toHaveTextContent('"role":"admin"');
    });
    expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
  });

  it('performs a single fetch and does not duplicate the request on a rerender', async () => {
    getApplicationAccessMock.mockResolvedValueOnce({
      allowed: true,
      role: 'admin',
      email: 'owner@example.com',
      reason: 'ok',
    });
    const { QueryWrapper } = createQueryWrapper(Infinity);

    const { rerender } = render(<ApplicationAccessProbe />, { wrapper: QueryWrapper });
    await waitFor(() => {
      expect(screen.getByTestId('access-payload')).toHaveTextContent('"role":"admin"');
    });
    rerender(<ApplicationAccessProbe />);
    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
  });
});
