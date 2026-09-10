import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import type * as SharedQueriesModule from '../../query/sharedQueries';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import {
  getStartupWarmupQueryKey,
} from '../../query/sharedQueries';
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
 * Probes the application access context and renders a protected-child marker so the
 * gate's admission decision is observable.
 *
 * @returns {JSX.Element} The probe element exposing the access context and a child marker.
 */
function AccessGateProbe() {
  const access = useApplicationAccessContext();
  return (
    <>
      <output data-testid="protected-child">Protected application content</output>
      <output data-testid="access-context">
        {access ? JSON.stringify(access) : 'no-provider'}
      </output>
    </>
  );
}

/**
 * Creates a deferred promise for async warm-up control in gate tests.
 *
 * @template DeferredValue
 * @returns {{ promise: Promise<DeferredValue>; resolvePromise: (value: DeferredValue) => void; rejectPromise: (error: unknown) => void }} Deferred promise helpers.
 */
function createDeferredPromise<DeferredValue>() {
  let resolvePromise!: (value: DeferredValue) => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<DeferredValue>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolvePromise,
    rejectPromise,
  };
}

/**
 * Creates a React Query client wrapper for application access gate tests.
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

const EXPECTED_ACCESS_CALLS_AFTER_RETRY = 2;

describe('AppAuthGate application access', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('renders protected children and delivers an admin role through the access context when the access reason is ok', async () => {
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
        <AccessGateProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('protected-child')).toBeInTheDocument();
    expect(screen.getByTestId('access-context')).toHaveTextContent('"role":"admin"');
  });

  it('blocks the application with a fresh-install result when the caller cannot claim access', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockResolvedValueOnce({});
    getApplicationAccessMock.mockResolvedValueOnce({
      allowed: false,
      role: null,
      email: '',
      reason: 'freshInstall',
    });
    const { QueryWrapper } = createQueryWrapper();

    render(
      <AppAuthGate>
        <AccessGateProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
    expect(screen.getByText('Application not configured')).toBeInTheDocument();
    expect(screen.getByText(/identity could not be resolved/i)).toBeInTheDocument();
  });

  it('blocks the application with a broken-configuration result when the access reason is brokenConfig', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockResolvedValueOnce({});
    getApplicationAccessMock.mockResolvedValueOnce({
      allowed: false,
      role: null,
      email: '',
      reason: 'brokenConfig',
    });
    const { QueryWrapper } = createQueryWrapper();

    render(
      <AppAuthGate>
        <AccessGateProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
    expect(screen.getByText('Authentication configuration invalid')).toBeInTheDocument();
    expect(screen.getByText(/must be repaired by a script editor/i)).toBeInTheDocument();
  });

  it('blocks the application with an access-denied result when the access reason is denied', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockResolvedValueOnce({});
    getApplicationAccessMock.mockResolvedValueOnce({
      allowed: false,
      role: null,
      email: '',
      reason: 'denied',
    });
    const { QueryWrapper } = createQueryWrapper();

    render(
      <AppAuthGate>
        <AccessGateProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(screen.getByText(/not authorised to use this application/i)).toBeInTheDocument();
  });

  it('no longer blocks on a warm-up FORBIDDEN error once the access reason is ok', async () => {
    const forbiddenError = new ApiTransportError({
      requestId: 'req-warmup-forbidden',
      error: { code: 'FORBIDDEN', message: 'Access denied.', retriable: false },
    });
    const { queryClient, QueryWrapper } = createQueryWrapper();
    queryClient.setQueryData(getStartupWarmupQueryKey('classPartials'), []);
    queryClient.getQueryCache().find({ queryKey: getStartupWarmupQueryKey('classPartials') })?.setState({
      data: undefined,
      dataUpdateCount: 0,
      dataUpdatedAt: 0,
      error: forbiddenError,
      errorUpdateCount: 1,
      errorUpdatedAt: Date.now(),
      fetchFailureCount: 1,
      fetchFailureReason: forbiddenError,
      fetchMeta: undefined,
      isInvalidated: false,
      status: 'error',
      fetchStatus: 'idle',
    });
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockResolvedValueOnce({});
    getApplicationAccessMock.mockResolvedValueOnce({
      allowed: true,
      role: 'admin',
      email: 'owner@example.com',
      reason: 'ok',
    });

    render(
      <AppAuthGate>
        <AccessGateProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('protected-child')).toBeInTheDocument();
    expect(screen.getByTestId('access-context')).toHaveTextContent('"role":"admin"');
  });

  it('admits protected children immediately once the access reason is ok, without a verifying-access withhold', async () => {
    const deferredWarmupCycle = createDeferredPromise<void>();
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockReturnValueOnce(deferredWarmupCycle.promise);
    getApplicationAccessMock.mockResolvedValueOnce({
      allowed: true,
      role: 'admin',
      email: 'owner@example.com',
      reason: 'ok',
    });
    const { QueryWrapper } = createQueryWrapper();

    render(
      <AppAuthGate>
        <AccessGateProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('protected-child')).toBeInTheDocument();
    expect(screen.queryByText('Verifying access')).not.toBeInTheDocument();
  });

  it('admits only when the access reason is ok, ignoring a ready warm-up for non-ok reasons', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockResolvedValueOnce({});
    getApplicationAccessMock.mockResolvedValueOnce({
      allowed: false,
      role: null,
      email: '',
      reason: 'denied',
    });
    const { QueryWrapper } = createQueryWrapper();

    render(
      <AppAuthGate>
        <AccessGateProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
  });

  it('still fires the warm-up prefetch after admission and takes role from the access call, not the warm-up', async () => {
    const forbiddenError = new ApiTransportError({
      requestId: 'req-warmup-forbidden',
      error: { code: 'FORBIDDEN', message: 'Access denied.', retriable: false },
    });
    const { queryClient, QueryWrapper } = createQueryWrapper();
    queryClient.setQueryData(getStartupWarmupQueryKey('classPartials'), []);
    queryClient.getQueryCache().find({ queryKey: getStartupWarmupQueryKey('classPartials') })?.setState({
      data: undefined,
      dataUpdateCount: 0,
      dataUpdatedAt: 0,
      error: forbiddenError,
      errorUpdateCount: 1,
      errorUpdatedAt: Date.now(),
      fetchFailureCount: 1,
      fetchFailureReason: forbiddenError,
      fetchMeta: undefined,
      isInvalidated: false,
      status: 'error',
      fetchStatus: 'idle',
    });
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockResolvedValueOnce({});
    getApplicationAccessMock.mockResolvedValueOnce({
      allowed: true,
      role: 'admin',
      email: 'owner@example.com',
      reason: 'ok',
    });

    render(
      <AppAuthGate>
        <AccessGateProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('protected-child')).toBeInTheDocument();
    expect(screen.getByTestId('access-context')).toHaveTextContent('"role":"admin"');
    expect(warmStartupQueriesMock).toHaveBeenCalled();
  });

  it('runs the OAuth authorisation gate first and then resolves application access exactly once', async () => {
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
        <AccessGateProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('protected-child')).toBeInTheDocument();
    expect(screen.getByTestId('access-context')).toHaveTextContent('"role":"admin"');
  });

  it('renders an error Result and retries the access query when getApplicationAccess fails', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockResolvedValueOnce({});
    getApplicationAccessMock.mockRejectedValueOnce(new Error('Access lookup failed'));
    getApplicationAccessMock.mockResolvedValueOnce({
      allowed: true,
      role: 'admin',
      email: 'owner@example.com',
      reason: 'ok',
    });
    const { QueryWrapper } = createQueryWrapper();
    const user = userEvent.setup();

    render(
      <AppAuthGate>
        <AccessGateProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    const retryButton = await screen.findByRole('button', { name: 'Retry' });
    expect(retryButton).toBeInTheDocument();
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });

    await user.click(retryButton);

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(EXPECTED_ACCESS_CALLS_AFTER_RETRY);
    });
    expect(await screen.findByTestId('protected-child')).toBeInTheDocument();
    expect(screen.getByTestId('access-context')).toHaveTextContent('"role":"admin"');
  });
});
