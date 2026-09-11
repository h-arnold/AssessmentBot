import type { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as SharedQueriesModule from '../../query/sharedQueries';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import {
  getStartupWarmupQueryKey,
  startupWarmupDatasetKeys,
} from '../../query/sharedQueries';
import type { ApplicationAccess } from '../../services/authService/authService.zod';
import {
  brokenConfigAccess,
  createQueryWrapper,
  deniedAccess,
  freshInstallAccess,
  grantedAdminAccess,
} from '../../test/auth/appAuthGateTestHelpers';
import { createDeferredPromise } from '../../test/shared/testDeferredPromise';
import { useApplicationAccessContext } from './ApplicationAccessContext';
import { AppAuthGate } from './AppAuthGate';

const { getAuthorisationStatusMock, warmStartupQueriesMock, getApplicationAccessMock } =
  await vi.hoisted(async () => {
    const { createAppAuthGateMocks } = await import('../../test/auth/appAuthGateTestHelpers');
    return createAppAuthGateMocks();
  });

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

const forbiddenWarmupError = new ApiTransportError({
  requestId: 'req-warmup-forbidden',
  error: { code: 'FORBIDDEN', message: 'Access denied.', retriable: false },
});

/**
 * Seeds the class-partials warm-up query with a cached failure state.
 *
 * @param {QueryClient} queryClient The test query client to seed.
 * @param {ApiTransportError} error The warm-up transport error to cache.
 * @returns {void}
 */
function seedForbiddenWarmupError(queryClient: QueryClient, error: ApiTransportError): void {
  queryClient.setQueryData(getStartupWarmupQueryKey('classPartials'), []);
  queryClient
    .getQueryCache()
    .find({ queryKey: getStartupWarmupQueryKey('classPartials') })
    ?.setState({
      data: undefined,
      dataUpdateCount: 0,
      dataUpdatedAt: 0,
      error,
      errorUpdateCount: 1,
      errorUpdatedAt: Date.now(),
      fetchFailureCount: 1,
      fetchFailureReason: error,
      fetchMeta: undefined,
      isInvalidated: false,
      status: 'error',
      fetchStatus: 'idle',
    });
}

/**
 * Seeds every startup warm-up dataset with a successful cache entry so the
 * datasets read as ready before the gate resolves access.
 *
 * @param {QueryClient} queryClient The test query client to seed.
 * @returns {void}
 */
function seedReadyWarmupData(queryClient: QueryClient): void {
  for (const datasetKey of startupWarmupDatasetKeys) {
    queryClient.setQueryData(getStartupWarmupQueryKey(datasetKey), []);
  }
}

type ResolvedAccessGateOptions = Readonly<{
  warmupPromise?: Promise<unknown>;
  forbiddenWarmupError?: ApiTransportError;
  seedReadyWarmup?: boolean;
}>;

/**
 * Renders the auth gate with an authorised caller and a resolved access result.
 *
 * @param {ApplicationAccess} access The access result the mocked service resolves with.
 * @param {ResolvedAccessGateOptions} [options] Optional warm-up overrides.
 * @returns {ReturnType<typeof render> & { queryClient: QueryClient }} The render result and query client.
 */
function renderResolvedAccessGate(
  access: ApplicationAccess,
  options: ResolvedAccessGateOptions = {}
) {
  const { queryClient, QueryWrapper } = createQueryWrapper();

  if (options.seedReadyWarmup) {
    seedReadyWarmupData(queryClient);
  }

  if (options.forbiddenWarmupError) {
    seedForbiddenWarmupError(queryClient, options.forbiddenWarmupError);
  }

  getAuthorisationStatusMock.mockResolvedValueOnce(true);
  warmStartupQueriesMock.mockImplementationOnce(() => options.warmupPromise ?? Promise.resolve({}));
  getApplicationAccessMock.mockResolvedValueOnce(access);

  return {
    queryClient,
    ...render(
      <AppAuthGate>
        <AccessGateProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    ),
  };
}

const EXPECTED_ACCESS_CALLS_AFTER_RETRY = 2;

describe('AppAuthGate application access', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('renders protected children and delivers an admin role through the access context when the access reason is ok', async () => {
    renderResolvedAccessGate(grantedAdminAccess);

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('protected-child')).toBeInTheDocument();
    expect(screen.getByTestId('access-context')).toHaveTextContent('"role":"admin"');
  });

  it('blocks the application with a fresh-install result when the caller cannot claim access', async () => {
    renderResolvedAccessGate(freshInstallAccess);

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Application not configured')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
    expect(screen.getByText(/identity could not be resolved/i)).toBeInTheDocument();
    // Non-ok access must not prefetch the startup warm-up datasets.
    expect(warmStartupQueriesMock).not.toHaveBeenCalled();
  });

  it('blocks the application with a broken-configuration result when the access reason is brokenConfig', async () => {
    renderResolvedAccessGate(brokenConfigAccess);

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Authentication configuration invalid')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
    expect(screen.getByText(/must be repaired by a script editor/i)).toBeInTheDocument();
    expect(warmStartupQueriesMock).not.toHaveBeenCalled();
  });

  it('blocks the application with an access-denied result when the access reason is denied', async () => {
    renderResolvedAccessGate(deniedAccess);

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
    expect(screen.getByText(/not authorised to use this application/i)).toBeInTheDocument();
    expect(warmStartupQueriesMock).not.toHaveBeenCalled();
  });

  it('no longer blocks on a warm-up FORBIDDEN error once the access reason is ok', async () => {
    renderResolvedAccessGate(grantedAdminAccess, { forbiddenWarmupError });

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('protected-child')).toBeInTheDocument();
    expect(screen.getByTestId('access-context')).toHaveTextContent('"role":"admin"');
  });

  it('admits protected children immediately once the access reason is ok, without a verifying-access withhold', async () => {
    const deferredWarmupCycle = createDeferredPromise<void>();

    renderResolvedAccessGate(grantedAdminAccess, { warmupPromise: deferredWarmupCycle.promise });

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('protected-child')).toBeInTheDocument();
    expect(screen.queryByText('Verifying access')).not.toBeInTheDocument();
  });

  it('blocks a non-ok caller even when the startup warm-up datasets are already ready', async () => {
    renderResolvedAccessGate(deniedAccess, { seedReadyWarmup: true });

    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
    expect(warmStartupQueriesMock).not.toHaveBeenCalled();
  });

  it('does not start the warm-up prefetch while application access is still pending', async () => {
    const deferredAccess = createDeferredPromise<ApplicationAccess>();
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    warmStartupQueriesMock.mockResolvedValueOnce({});
    getApplicationAccessMock.mockReturnValueOnce(deferredAccess.promise);
    const { QueryWrapper } = createQueryWrapper();

    render(
      <AppAuthGate>
        <AccessGateProbe />
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    expect(await screen.findByRole('status', { name: 'Verifying access' })).toBeInTheDocument();
    expect(warmStartupQueriesMock).not.toHaveBeenCalled();

    deferredAccess.resolvePromise(grantedAdminAccess);

    expect(await screen.findByTestId('protected-child')).toBeInTheDocument();
    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledTimes(1);
    });
  });

  it('still fires the warm-up prefetch after admission and takes role from the access call, not the warm-up', async () => {
    renderResolvedAccessGate(grantedAdminAccess, { forbiddenWarmupError });

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('protected-child')).toBeInTheDocument();
    expect(screen.getByTestId('access-context')).toHaveTextContent('"role":"admin"');
    expect(warmStartupQueriesMock).toHaveBeenCalled();
  });

  it('runs the OAuth authorisation gate first and then resolves application access exactly once', async () => {
    renderResolvedAccessGate(grantedAdminAccess);

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
    getApplicationAccessMock.mockResolvedValueOnce(grantedAdminAccess);
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
    // A failed access resolution must not trigger the warm-up prefetch.
    expect(warmStartupQueriesMock).not.toHaveBeenCalled();

    await user.click(retryButton);

    await waitFor(() => {
      expect(getApplicationAccessMock).toHaveBeenCalledTimes(EXPECTED_ACCESS_CALLS_AFTER_RETRY);
    });
    expect(await screen.findByTestId('protected-child')).toBeInTheDocument();
    expect(screen.getByTestId('access-context')).toHaveTextContent('"role":"admin"');
    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledTimes(1);
    });
  });
});
